# Refound — Frontend

React (Vite) frontend for Refound, the campus lost-and-found register.
Every screen in the PRD flow is built, and every page reads and writes through the
Express API in [`../backend`](../backend). Nothing is stored in the browser except
the signed-in session.

## Run locally

Start PostgreSQL and the backend first (see [`../backend/README.md`](../backend/README.md)), then:

```
cd frontend
npm ci                        # installs exactly what package-lock.json records
npm run dev
```

Open http://localhost:5173

### Accounts

| Role | How |
| --- | --- |
| Student | Sign up at `/signup`, then log in |
| Staff / Supervisor | Created on the server with `npm run seed:staff` (email, role and password come from `backend/.env`); log in on the **Staff / Volunteer** tab |

## Pages

| Route | Who | Page |
| --- | --- | --- |
| `/` | Everyone | Landing page |
| `/items` | Everyone | The register: search, category and location filters |
| `/items/:ref` | Everyone | Item details — public-safe fields only |
| `/help` | Everyone | How to get an item back, FAQ |
| `/privacy` | Everyone | Who can see what (draft notice) |
| `/signup`, `/login` | Everyone | Student sign up; student / staff log in |
| `/welcome` | Student | Home: ID card, claims ready for pickup, newest items |
| `/items/:ref/claim` | Student | Private ownership claim |
| `/claims` | Student | All my claims, plus "What's new" (unread outcomes; badge in the navbar) |
| `/claims/:id` | Student | One claim: timeline, rejection reason, withdraw while pending, what to bring |
| `/staff` | Staff | Desk: counters, claims waiting, recently logged |
| `/staff/items` | Staff | Inventory of every record, incl. returned; unclaimed 14+ days |
| `/staff/items/new` | Staff | Log a found item with a staff-only ownership note |
| `/staff/items/:ref` | Staff | One record: private note and every claim on it |
| `/staff/claims` | Staff | Review claims against the record, approve/reject, handover |
| `/staff/logbook` | Supervisor | Audit history with filters and CSV export |
| anything else | Everyone | 404 page |

A crash on any page shows a recovery screen instead of a blank page, and the
navigation turns into a menu on phone-sized screens.

## Which file calls which endpoint

| File | Endpoints |
| --- | --- |
| [`src/auth/authService.js`](src/auth/authService.js) | `POST /api/auth/signup`, `POST /api/auth/login` |
| [`src/services/itemsService.js`](src/services/itemsService.js) | `GET /api/items`, `/api/items/locations`, `/api/items/:ref`, `POST /api/items/:ref/claims`, `/api/claims/mine/*` |
| [`src/services/staffService.js`](src/services/staffService.js) | `POST /api/items`, `GET /api/items/:ref/claims`, `/api/staff/*`, `PATCH /api/claims/:id`, `POST /api/claims/:id/handover` |
| [`src/services/auditService.js`](src/services/auditService.js) | `GET /api/audit` |

Role checks in the UI only hide screens — the server enforces them.

## Pointing the UI at the API

Copy `.env.example` to `.env.local` and set `VITE_API_URL` (defaults to
`http://localhost:3000`):

```
VITE_API_URL=http://localhost:3000
```

If `localhost` reaches a different program on your machine (for example a Docker
or WSL relay holding port 3000 on IPv6), use `http://127.0.0.1:3000` instead.
Without a running backend, the screens report that they cannot reach the API.
