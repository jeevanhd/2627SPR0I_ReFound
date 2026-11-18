# Refound — Campus Lost and Found

### Lost something on campus? Find it here.

## Start Here

New to this repo? Three things, in this order, then pick up an issue.

1. **Where it lives.** https://github.com/kalviumcommunity/2627SPR0I_ReFound — public, so the course can open it without being added as a collaborator.
2. **What we are fixing.** [Issue #8 — Assigned incident: found items are not searchable and private ownership details are exposed](https://github.com/kalviumcommunity/2627SPR0I_ReFound/issues/8).
3. **How to run it locally.** [SETUP.md](SETUP.md) pins the four tool versions. The `docker compose up` command is **not finished yet** — it lands once the service and Compose files exist.

Work reaches `main` only through a reviewed pull request. There are no direct pushes to `main`; see [Team Workflow](#team-workflow).

## Repository Access

This repository is public: https://github.com/kalviumcommunity/2627SPR0I_ReFound
Anyone on the course can open it without being added as a collaborator.

## Getting Started (Run Locally)

One command starts the database, the API and the web UI:

```
git clone https://github.com/kalviumcommunity/2627SPR0I_ReFound.git
cd 2627SPR0I_ReFound
npm run dev
```

`npm run dev` creates `backend/.env` from the example on first run, starts
PostgreSQL in a Docker container, applies the schema, seeds the sample records,
then serves the API on http://localhost:3000 and the UI on http://localhost:5173.
It waits until both answer before it says they are up, and Ctrl-C stops the API
and the UI. The database container keeps its data between runs.

- Already have PostgreSQL running? `SKIP_DB=1 npm run dev` uses it instead of Docker.
- Match the pinned tool versions in [SETUP.md](SETUP.md). The API's base image and
  npm packages are pinned — see [DEPENDENCIES.md](DEPENDENCIES.md) for what is
  pinned and how to upgrade on purpose.
- Prefer to start the pieces yourself? `backend/README.md` and `frontend/README.md`
  each have their own steps.

## Assigned Incident

**Found items on campus cannot be searched, and private ownership details are exposed.**
Students have no way to check whether a lost item was handed in, and staff keep
records on paper or in spreadsheets that are hard to search and show private details.

Tracked as [issue #8 — Assigned incident: found items are not searchable and private ownership details are exposed](https://github.com/kalviumcommunity/2627SPR0I_ReFound/issues/8), assigned to Danushri Prakash.

Issue #8 is the pointer, not the build. The PRD, the mock and the service code are
separate pieces of work.

## Team Workflow

- All work happens on a feature branch (`feature/<short-name>`).
- Changes reach `main` only through a pull request.
- At least one teammate reviews every pull request before it is merged.
- No direct pushes to `main`. A direct push skips review, hides who changed what
  and why, and makes "it is on main" easy to confuse with "it is live".
- Code being on `main` does not mean it is deployed. Deployment is a separate step.
- A pull request is merged only after a teammate's review is visible on it.

## Problem Statement

Students often lose their belongings on campus and do not know whether someone has found them. They usually have to visit the help desk or ask other students in group chats.

There is no simple way to check which items have been found. Paper registers and spreadsheets can also be difficult to manage and search.

## Solution

Campus Lost and Found is a web application that helps students find their lost belongings.

Desk volunteers can add details of found items to the application. Students can browse and search for items using keywords, categories, and locations.

Students can submit a claim if they find an item that belongs to them. Desk volunteers will verify the ownership and student identity before handing over the item.

Private details will only be visible to authorized staff and will never be displayed publicly.

## Tech Stack

- **Frontend:** React.js
- **Backend:** Node.js with Express.js
- **Database:** PostgreSQL
- **DevOps:** Docker and GitHub Actions
- **Deployment:** Render
- **Version Control:** Git and GitHub

## What We Are Going to Build

We are going to build a simple website with two main sections:

### 1. Student Section
- View the list of found items.
- Search for items using keywords.
- Filter items by category and location.
- View item descriptions.
- Submit a claim to collect an item.

### 2. Staff Section
- Add newly found items.
- Generate a unique reference number for each item.
- View and manage student claims.
- Approve or reject claims.
- Verify student identity before handing over an item.
- Mark items as handed over.

### 3. Data Storage and Security
- Store item and claim details in PostgreSQL.
- Keep private ownership details confidential.
- Allow only authorized staff to manage claims and handovers.
- Maintain records even after application restarts or updates.

## Application Workflow

1. Staff adds a found item.
2. The item appears in the public listing.
3. Student searches for the item.
4. Student submits a claim.
5. Staff verifies the student's ownership and identity.
6. Staff hands over the item and updates its status.

## Team Details

- **Team Number:** 04

### Team Members

1. Danushri Prakash
2. Jeevan_HD