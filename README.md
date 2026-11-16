# PadelPassTeam

[![CI](https://github.com/Bahyamin/PadelPass/actions/workflows/ci.yml/badge.svg)](https://github.com/Bahyamin/PadelPass/actions/workflows/ci.yml)

Padel court booking and equipment rental web app (PadelBook).

Team: Paul Calonne, Enki Millet, Benjamin Zilber, Yutong Cao.

## Structure

| Folder      | Content                                   |
| ----------- | ----------------------------------------- |
| `/frontend` | React + Vite single page app              |
| `/backend`  | Node.js + Express REST API, prefix `/api` |

The backend follows the layout of the SDD (section 6.1):

```
backend/src/
  app.js            Express app: middlewares and module routers
  server.js         starts the HTTP server
  config/           configuration read from environment variables
  middlewares/      errorHandler (and later authenticate, requireRole, validate)
  modules/<name>/   one folder per module: routes, controller, service, repository
  utils/            errors.js (AppError, ValidationError, ConflictError...)
backend/tests/      unit/ and integration/ tests
```

Every error is returned as `{ "error": { "code", "message", "requestId" } }`.

Differences with the SDD: the code is written in JavaScript (ES modules) instead of TypeScript, and the tests use Vitest instead of Jest.

## Requirements

- Node.js 22 or later
- npm
- Docker (for the local PostgreSQL)

## Run the project

```bash
npm run install:all                    # installs root, backend and frontend dependencies
cp backend/.env.example backend/.env   # local settings (Windows: copy backend\.env.example backend\.env)
docker compose up -d                   # starts PostgreSQL on localhost:5433
cd backend
npx prisma migrate dev                 # creates the tables
npx prisma db seed                     # inserts the starting data
cd ..
npm run dev                            # starts the backend and the frontend together
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

Open the frontend: the page calls `GET /api/health` and displays `OK` when the backend is reachable. In development, Vite forwards every `/api` request to the backend, so the browser only talks to one origin.

### Environment variables

All variables live in `backend/.env`, created from `backend/.env.example`. Never commit a `.env` file.

| Variable | Description |
| --- | --- |
| `PORT` | Backend HTTP port (default `3000`) |
| `DATABASE_URL` | PostgreSQL connection string; the example value matches `docker-compose.yml` |
| `SEED_ADMIN_PASSWORD` | Password of the admin account created by the seed |
| `SEED_STAFF_PASSWORD` | Password of the staff account created by the seed |
| `TEST_DATABASE_URL` | Optional. Database of the backend tests (default: `padelpass_test` on the local PostgreSQL) |

## Database

PostgreSQL 16 runs in Docker (`docker-compose.yml`), on port **5433** of your machine so it does not clash with a locally installed PostgreSQL. The schema is managed with Prisma (`backend/prisma/schema.prisma`) and follows the SDD, section 4.1: `users`, `courts`, `court_closures`, `opening_hours`, `pricing_rules`, `settings`, `bookings`, `booking_equipment`, `equipment_types`, `equipment_items`, `rentals`, `notifications`, `audit_logs`.

| Command (from `/backend`) | Description |
| --- | --- |
| `npx prisma migrate dev` | Apply the migrations (and create a new one after a schema change) |
| `npx prisma db seed` | Insert the starting data; safe to run several times |
| `npx prisma studio` | Browse the data in a web UI |

The seed creates 4 courts, opening hours 08:00-23:00 every day, peak (40 €/h) and off-peak (28 €/h) pricing rules, the booking parameters (3 active bookings, 14-day window, 24 h cancellation deadline), 3 equipment types with 24 items, and two accounts: `admin@padelbook.local` and `staff@padelbook.local`.

Integrity rules of the SDD (section 4.2) are enforced by PostgreSQL itself, in the first migration: the `no_overlap` exclusion constraint refuses two confirmed bookings that overlap on the same court, and CHECK constraints refuse a booking that ends before it starts or that has neither a player nor a guest.

The backend tests need the PostgreSQL container to be running. They use a separate `padelpass_test` database, created and migrated automatically, so they never touch the development data.

## Scripts (from the root)

| Command          | Description                                 |
| ---------------- | ------------------------------------------- |
| `npm run dev`    | Start backend and frontend                  |
| `npm run lint`   | ESLint + Prettier check on both apps        |
| `npm test`       | Vitest on both apps (Supertest for the API) |
| `npm run format` | Format both apps with Prettier              |

The same `dev`, `lint`, `test` and `format` scripts exist inside `/backend` and `/frontend`.

## Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request, and on `main` after each merge. Two jobs run in parallel, one per app: `npm ci`, `npm run lint`, `npm test`. The backend job starts a PostgreSQL service container for the API tests. A pull request can only be merged when both checks are green.

## Git workflow

- One branch per story: `feature/PAD-<n>-<short-desc>`, created from an up-to-date `main`.
- Commits: `feat(PAD-<n>): ...`, `test(PAD-<n>): ...`, `chore(PAD-<n>): ...`.
- One pull request per story, titled `PAD-<n> | <story title>`, reviewed and approved by another member before merging.
- Nobody pushes to `main` directly.
