# ReFound — Local Runtime Setup

This note lets a teammate match the machine used to build and run the
ReFound service. Versions below are what the commands actually printed on
2026-11-11. Do not install "latest" — install these versions (or check
yours against them) so we all hit the same behaviour.

## Tool versions

| Tool | Version | Command used |
| --- | --- | --- |
| Container runtime | Docker Engine 29.5.2 (Docker Desktop, Windows 11) | `docker version --format '{{.Server.Version}}'` |
| Compose | Docker Compose version v5.1.4 | `docker compose version` |
| Git | git version 2.52.0.windows.1 | `git --version` |
| PostgreSQL client | psql (PostgreSQL) 17.6 | `psql --version` |

Summary:

```
Runtime: Docker Engine 29.5.2
Compose: Docker Compose version v5.1.4
Git: git version 2.52.0.windows.1
PostgreSQL client: psql (PostgreSQL) 17.6
Host for this sprint: Render free tier
Payment card: none
```

## Host for this sprint

**Render free tier** — the single host chosen by faculty. No second host is
set up. This note only records the choice; deployment happens in a later step.

## Payment

No payment card was entered and no paid plan or trial was used for any tool
or host in this setup.

## Local container check

Command:

```
docker run --rm hello-world
```

Result (first lines of output):

```
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

## How a teammate repeats the check

1. Install Docker Desktop and make sure it is **running** (the daemon must be
   up, not just installed).
2. Run each command and compare with the table above:

   ```
   docker version --format '{{.Server.Version}}'
   docker compose version
   git --version
   psql --version
   ```

3. Run `docker run --rm hello-world` and confirm you see `Hello from Docker!`.

### Common problems

- **Daemon not running.** `docker version` prints the client but fails with:

  ```
  failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine ...
  The system cannot find the file specified.
  ```

  Start Docker Desktop, wait for it to finish starting, and run the command again.

- **`docker compose` not found.** Compose is missing. Install it before you
  continue — a working `docker` alone is not enough, because Compose will start
  the service and PostgreSQL together.

- **`psql` not recognized (Windows).** The PostgreSQL client may be installed
  but not on PATH. On this machine it is at
  `C:\Program Files\PostgreSQL\17\pgAdmin 4\runtime\psql.exe`. Add that folder
  to PATH, or install the PostgreSQL 17 command-line tools.

- **Install needs admin rights you don't have.** Stop and ask the mentor. Do not
  switch to a paid plan to get around it.
