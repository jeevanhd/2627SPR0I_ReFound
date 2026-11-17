# ReFound backend

Node.js + Express + PostgreSQL API for the campus lost-and-found register.

This slice covers the staff side: **authentication, item registration, claim
review and handover**, plus the database schema. Public listing/search and
student claim submission are the other half of the API.

## Run it

```bash
cd backend
cp .env.example .env          # fill in DATABASE_URL and JWT_SECRET
npm install
npm run db:init               # apply db/schema.sql (safe to re-run)
npm run seed:staff            # creates the staff account from .env
npm run seed:items            # optional: the 24 sample records the UI ships with
npm start                     # http://localhost:3000
```

`npm test` runs the unit tests, and the integration tests too when
`DATABASE_URL` is set — without it they are skipped rather than silently passing.

## Endpoints in this slice

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | anyone | Create a **student** account (role cannot be requested) |
| POST | `/api/auth/login` | anyone | Returns a JWT and the role stored in the database |
| GET | `/api/auth/me` | signed in | Check a stored session |
| POST | `/api/items` | staff | Register a found item, allocate its reference code |
| GET | `/api/items/:ref/claims` | staff | Read claims **with** the private answers |
| PATCH | `/api/claims/:id` | staff | Approve or reject a pending claim |
| POST | `/api/claims/:id/handover` | staff | Record a handover after an identity check |
| GET | `/api/staff/items` | staff | Every record, returned ones included, with claim counts and the private note |
| GET | `/api/staff/claims?status=` | staff | The review queue, with the private answers and item detail |
| GET | `/api/audit?action=&q=&limit=` | supervisor | Read the audit history, newest first |
| GET | `/api/health` | anyone | Liveness check |

## Rules the code enforces

- **The client never decides its own role.** Signup always writes `student`, and
  every request re-reads the role from the database. Sending `role: "staff"` in a
  body changes nothing.
- **Private fields never leave through a public shape.** `toPublicItem()` in
  `src/lib/items.js` is the only place an item is shaped for a response, and
  `private_note` is not in it. Claim answers are returned only on the staff route.
- **A handover needs an approved claim and a recorded identity check.** Both are
  refused with a 409/400 rather than a warning.
- **A rejection must carry a reason.** The student reads it, so a blank reason is a
  400, not a silent rejection.
- **Approving one claim closes the others on that item.** They are marked
  `auto_closed` with a reason the student can read, and the item cannot be approved
  twice — an already-reserved item is a 409.
- **Reference codes are unique and sequential** (`RF-0149`), allocated from a
  PostgreSQL sequence inside the same transaction as the insert.
- **Every staff action is audited** into `audit_log`, with the item title and
  claimant name in `detail` so the logbook can describe an event without a join.
- **The audit history is supervisor-only.** A desk volunteer can act on records
  but cannot read the history of who did what.

## Sample data

`npm run seed:items` loads `db/sample-items.json` — the same 24 records the
frontend ships in `src/data/items.js` — so the staff inventory and the student
listing show the same rack instead of one being empty. It is idempotent (existing
refs are skipped) and it advances `item_ref_seq` past any ref already used, so a
newly registered item can never collide with a seeded one.

## What is not built yet

Public item search (`GET /api/items`), item detail (`GET /api/items/:ref`),
student claim submission (`POST /api/items/:ref/claims`) and
`GET /api/claims/mine`. The frontend still uses its mocks until those land.
