#!/usr/bin/env bash
# Start the whole ReFound stack with one command: database, API and web UI.
#
#   bash scripts/dev.sh              # PostgreSQL in Docker, then the API and UI
#   SKIP_DB=1 bash scripts/dev.sh    # use a PostgreSQL that is already running
#
# Ctrl-C stops the API and the UI. The database container keeps its data between
# runs; delete it with: docker rm -f refound-pg

set -euo pipefail
# Job control, so each background job runs in its own process group. Killing a
# single PID would leave the npm/node/vite children behind and keep the ports busy.
set -m

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_CONTAINER="${DB_CONTAINER:-refound-pg}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-refound}"
DB_USER="${DB_USER:-refound}"
DB_PASSWORD="${DB_PASSWORD:-refound}"
API_PORT="${PORT:-3000}"
WEB_PORT="${WEB_PORT:-5173}"
READY_TRIES=40

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required but not installed."; }

stop_group() {
  local pid="${1:-}"
  [[ -n "$pid" ]] || return 0
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
}

kill_group() {
  local pid="${1:-}"
  [[ -n "$pid" ]] || return 0
  kill -KILL -- "-$pid" 2>/dev/null || true
}

cleanup() {
  local code=$?
  trap - INT TERM EXIT
  say "Stopping the API and the UI"
  stop_group "${WEB_PID:-}"
  stop_group "${API_PID:-}"
  wait 2>/dev/null || true
  # Anything that ignored SIGTERM gets SIGKILL, so the ports are free next time.
  kill_group "${WEB_PID:-}"
  kill_group "${API_PID:-}"
  exit "$code"
}
trap cleanup INT TERM EXIT

need node
need npm
need curl

# ---------- environment ----------
if [[ ! -f backend/.env ]]; then
  say "backend/.env is missing — creating it from backend/.env.example"
  cp backend/.env.example backend/.env
  # A placeholder secret is fine to read but not to run with, so generate a real one.
  secret="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${secret}|" backend/.env
  warn "Wrote backend/.env with a generated JWT_SECRET."
  warn "Set STAFF_EMAIL / STAFF_PASSWORD there before the staff account is seeded."
fi

# ---------- database ----------
if [[ "${SKIP_DB:-0}" == "1" ]]; then
  say "SKIP_DB=1 — using the PostgreSQL already listening on port ${DB_PORT}"
else
  need docker
  docker info >/dev/null 2>&1 || die "Docker is installed but not running. Start Docker, or run with SKIP_DB=1 against your own PostgreSQL."

  if docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    say "Database container ${DB_CONTAINER} is already running"
  elif docker ps -a --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    say "Starting the existing database container ${DB_CONTAINER}"
    docker start "$DB_CONTAINER" >/dev/null
  else
    say "Creating database container ${DB_CONTAINER}"
    docker run -d --name "$DB_CONTAINER" \
      -e POSTGRES_USER="$DB_USER" \
      -e POSTGRES_PASSWORD="$DB_PASSWORD" \
      -e POSTGRES_DB="$DB_NAME" \
      -p "${DB_PORT}:5432" \
      postgres:16-alpine >/dev/null
  fi

  say "Waiting for PostgreSQL to accept connections"
  for _ in $(seq 1 "$READY_TRIES"); do
    if docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1 \
    || die "PostgreSQL did not become ready. Inspect it with: docker logs $DB_CONTAINER"
  say "PostgreSQL ready on port ${DB_PORT}"
fi

# ---------- dependencies (npm ci, never npm install — see DEPENDENCIES.md) ----------
for dir in backend frontend; do
  if [[ ! -d "$dir/node_modules" ]]; then
    say "Installing $dir dependencies with npm ci"
    ( cd "$dir" && npm ci --silent )
  fi
done

# ---------- schema and sample data (both idempotent) ----------
say "Applying the schema and seeding sample data"
( cd backend && npm run --silent db:init && npm run --silent seed:staff && npm run --silent seed:items )

# ---------- API and UI ----------
wait_for() {
  local url=$1 label=$2
  for _ in $(seq 1 "$READY_TRIES"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      say "$label ready"
      return 0
    fi
    sleep 1
  done
  warn "$label did not answer at $url"
  return 1
}

say "Starting the API on port ${API_PORT}"
( cd backend && PORT="$API_PORT" npm run --silent dev ) &
API_PID=$!

say "Starting the web UI on port ${WEB_PORT}"
( cd frontend && VITE_API_URL="http://localhost:${API_PORT}" npm run --silent dev -- --port "$WEB_PORT" --host 127.0.0.1 ) &
WEB_PID=$!

wait_for "http://127.0.0.1:${API_PORT}/api/health" "API"
wait_for "http://127.0.0.1:${WEB_PORT}/" "Web UI"

cat <<EOF

  ReFound is up
  -------------
  Web UI   http://localhost:${WEB_PORT}
  API      http://localhost:${API_PORT}/api/health
  Database ${DB_CONTAINER} on port ${DB_PORT} (kept between runs)

  Staff sign-in uses the account seeded from backend/.env.
  Ctrl-C stops the API and the UI.

EOF

wait
