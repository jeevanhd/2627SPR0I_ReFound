# Refound — Frontend

React (Vite) frontend for Refound, the campus lost-and-found register.
Every screen in the PRD flow is built. Data is mocked in the browser until the
frontend is connected to the Express API in [`../backend`](../backend).

## Run locally

```
cd frontend
npm ci                        # installs exactly what package-lock.json records
npm run dev
```

Open http://localhost:5173

### Demo accounts (any password)

| Role | How |
| --- | --- |
| Student | Sign up at `/signup`, then log in |
| Staff | `staff@campus.edu` on the **Staff / Volunteer** tab |
| Supervisor | `supervisor@campus.edu` on the **Staff / Volunteer** tab |

In dev mode the footer has **Reset demo data**, which clears every mock account,
claim and logged item in this browser.

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

## Where the mocks live

| File | Stands in for |
| --- | --- |
| [`src/auth/authService.js`](src/auth/authService.js) | `POST /api/auth/signup`, `POST /api/auth/login` |
| [`src/services/itemsService.js`](src/services/itemsService.js) | Public items and student claims (`GET /api/items`, `POST /api/items/:ref/claims`, `GET /api/claims/mine`, withdraw a pending claim, unread claim updates) — not built in the backend yet |
| [`src/services/staffService.js`](src/services/staffService.js) | `POST /api/items`, `GET /api/items/:ref/claims`, `PATCH /api/claims/:id` (needs a `reason` field for rejections; approving should close other pending claims on the item), `POST /api/claims/:id/handover` |
| [`src/services/auditService.js`](src/services/auditService.js) | `GET /api/audit` |
| [`src/services/mockDb.js`](src/services/mockDb.js) | The shared browser store all mocks read and write |

Each mock function names the endpoint it replaces, and its request and response
shapes follow the backend, so connecting the real API means swapping function
bodies for `fetch()` calls. The staff inventory (`/staff/items`) has no backend
endpoint yet.

Mocks never store passwords. Role checks in the UI only hide screens — the server
must enforce them.

## Pointing the UI at the API

The staff desk, the logbook and sign-in talk to the backend over HTTP. Copy
`.env.example` to `.env.local` and set `VITE_API_URL` (defaults to
`http://localhost:3000`):

```
VITE_API_URL=http://localhost:3000
```

Start the backend first (`cd ../backend && npm start`), otherwise the screens
report that they cannot reach the API. The student listing, item detail and claim
form still read the bundled sample data until the public API lands.
