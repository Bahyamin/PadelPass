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
| `JWT_SECRET` | Secret used to sign the login tokens; any long random value (required, the backend refuses to start without it) |
| `APP_URL` | Address of the front end, used in the links sent by email (default `http://localhost:5173`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Email server. In development: the SMTP credentials of your Mailtrap inbox. Leave `SMTP_HOST` empty to print the emails in the backend console instead |
| `MAIL_FROM` | Sender of the emails |
| `DATABASE_URL` | PostgreSQL connection string; the example value matches `docker-compose.yml` |
| `SEED_ADMIN_PASSWORD` | Password of the admin account created by the seed |
| `SEED_STAFF_PASSWORD` | Password of the staff account created by the seed |
| `TEST_DATABASE_URL` | Optional. Database of the backend tests (default: `padelpass_test` on the local PostgreSQL) |

## API

All routes are prefixed with `/api` and follow SDD section 5.1.

### POST /api/auth/register — create a player account (public)

Request body: `firstName`, `lastName`, `email`, `password`, `phone`, `acceptedTerms`.

- `201`: account created with role `PLAYER`, not verified, and consent date recorded.
- `400 VALIDATION_ERROR`: invalid input, weak password, or terms not accepted.
- `409 EMAIL_ALREADY_USED`: an account already exists with this email.

Passwords are hashed with bcrypt (cost 12) and are never returned in responses. The registration page is available at `/register`.
### POST /api/auth/verify-email — activate an account (public)

Body: `{ "token" }`, the token of the link received by email after registration. The link opens the page `/verify-email?token=...` of the front end, which calls this route and then shows the login page.

| Status | Meaning |
| --- | --- |
| `200` | Account verified, the player can log in |
| `400` | `INVALID_TOKEN`: unknown or already used link; `TOKEN_EXPIRED`: link older than 48 hours |

### POST /api/auth/resend-verification — get a new link (public)

Body: `{ "email" }`. Always answers `202` with the same message, whether the email has an account or not, so the answer never reveals which accounts exist.
### POST /api/auth/login — log in (public)

Body: `{ "email", "password" }`. On success the answer is the user, and a JWT valid 24 h is set in an httpOnly, SameSite=Strict cookie named `token`.

| Status | Meaning |
| --- | --- |
| `200` | Logged in |
| `401` | `INVALID_CREDENTIALS`: always the same message, whether the email exists or not |
| `403` | `EMAIL_NOT_VERIFIED`: right password, but the email address is not verified yet |
| `429` | `ACCOUNT_LOCKED`: 5 failed attempts in a row, login blocked for 15 minutes (also for unknown emails) |

### POST /api/auth/logout — log out

Clears the cookie. Answers `204`.

### GET /api/users/me — the logged-in user (player)

Answers `200` with the user, or `401 UNAUTHORIZED` without a valid token.

Protected routes use two middlewares: `authenticate` (valid JWT cookie, else `401`) and `requireRole(...)` (role allowed, else `403`).

**Access by role** (FR-07, NFR-08, AC-03). The server decides, from the role stored in the login token:

| Access | Roles | Routes |
| --- | --- | --- |
| Public | everybody | `/api/health`, `/api/courts`, `/api/availability`, `/api/equipment/availability`, `/api/auth/*` |
| Player | any logged-in user | `/api/users/me`, `/api/pricing/quote`, `/api/bookings`, `/api/bookings/me` |
| Admin | `ADMIN` | `/api/admin/*`: `403 FORBIDDEN` for `PLAYER`, `STAFF` and `EQUIPMENT_MANAGER` |

`backend/tests/integration/roleAccess.test.js` checks this matrix for every route and every role: **add each new route to it**. In the front end, `<RequireAuth roles={ADMIN}>` (lists in `src/auth/roles.js`) sends a user without the role to the home page, and the home page only shows the links of the user's role.

### Club configuration — `/api/admin` (administrator)

Every route needs an `ADMIN` login: `401` without login, `403 FORBIDDEN` for any other role. Each change is written to `audit_logs`. Existing bookings keep the price saved when they were booked.

| Route | Body and answer |
| --- | --- |
| `GET /api/admin/opening-hours` | The 7 days: `{ dayOfWeek, closed, openTime, closeTime }` (0 = Sunday) |
| `PUT /api/admin/opening-hours` | Replaces the week: 7 entries, `openTime` before `closeTime` on `:00` or `:30`, or `closed: true` |
| `GET /api/admin/pricing-rules` | The rules, by day and start time; prices as strings (`"40.00"`) |
| `POST /api/admin/pricing-rules` | `{ dayOfWeek, startTime, endTime, pricePerHour, label }`: `201`; `409 PRICING_RULE_OVERLAP` if it overlaps a rule of the same day |
| `PATCH /api/admin/pricing-rules/:id` | Any of these fields; `404` for an unknown rule |
| `DELETE /api/admin/pricing-rules/:id` | `204` |
| `GET /api/admin/settings` | `{ maxActiveBookings, bookingWindowDays, cancellationDeadlineHours, equipmentChangeDeadlineHours }` |
| `PUT /api/admin/settings` | Any of these, as whole numbers; `400` for an unknown parameter or a value out of range |

The page `/admin/settings` of the front end (link "Club settings" on the home page, for administrators) edits all three.

### GET /api/courts — list the active courts (public)

Returns `[{ "id", "name", "type" }]`.

### GET /api/equipment/availability — equipment for a slot (public)

Query: `date` (`YYYY-MM-DD`), `start` (`HH:00` or `HH:30`), `duration` (`60` or `90`). Returns, for each active equipment type, its `name`, `category`, `rentalPrice` and the `available` quantity: the items in service (not `DAMAGED`, `MAINTENANCE` or `LOST`) minus the quantities reserved by the confirmed bookings that overlap the slot, never below 0. An invalid slot gets `400 VALIDATION_ERROR`.

The page `/equipment` of the front end ("Equipment for rent" on the home page) shows this table.

### GET /api/availability?date=YYYY-MM-DD — availability grid of a day (public)

Returns the opening and closing time, the 30-minute `slots` of the day, and for each active court the status of every slot: `FREE`, `BOOKED` (confirmed booking), `CLOSED` (court closure) or `PAST`.

| Status | Meaning |
| --- | --- |
| `200` | The grid of the day |
| `400` | `VALIDATION_ERROR`: missing or invalid date; `OUTSIDE_BOOKING_WINDOW`: before today or more than 14 days ahead |

The page `/book` of the front end shows this grid.

### GET /api/pricing/quote — price of a slot (player)

Query: `courtId`, `date` (`YYYY-MM-DD`), `start` (`HH:00` or `HH:30`), `duration` (`60` or `90`). Returns the court, the end time and the `price` computed from the pricing rules, per 30-minute segment (e.g. Wednesday 18:00-19:30 at peak price = `"60.00"`).

### POST /api/bookings — book a court (player)

Body: `{ "courtId", "date", "start", "duration" }`, checked like the quote. Answers `201` with the booking: `status` `CONFIRMED`, `paymentStatus` `UNPAID`, and the `courtPrice` saved in the booking (a later price change does not alter it).

Once the booking is saved, the player gets a confirmation email in French (FR-30, AC-12): date, time, court, equipment and price. It is sent in the background, so the answer never waits for it. If the email provider fails, the booking stays valid: the email is retried 3 times (after 1, 2 and 4 seconds), and logged in `notifications` as `SENT` or `FAILED` (type `BOOKING_CONFIRMATION`). The same template is ready for changes (`BOOKING_UPDATE`) and cancellations (`BOOKING_CANCELLATION`): `bookingEmailsService.notify('UPDATED' | 'CANCELLED', bookingId)`.

| Status | Meaning |
| --- | --- |
| `400` | `VALIDATION_ERROR`, `SLOT_IN_PAST`, `OUTSIDE_BOOKING_WINDOW` (more than 14 days ahead), `OUTSIDE_OPENING_HOURS`, `NO_PRICING_RULE` |
| `401` | Not logged in |
| `404` | `COURT_NOT_FOUND`: unknown or inactive court |
| `409` | `COURT_CLOSED`: the court is closed during the slot |
| `409` | `SLOT_UNAVAILABLE`: "This court is already booked" (also for the quote). The `no_overlap` constraint of the database decides between two simultaneous requests: exactly one succeeds, the other gets this `409`, never a `500` |
| `409` | `LIMIT_REACHED`: the player already has the maximum number of active bookings (setting `max_active_bookings`, default 3); the message lists them. Active = confirmed and not started yet: cancelled and past bookings do not count |



### GET /api/bookings/me — my bookings (player)

Returns `{ "upcoming": [...], "past": [...] }`, only with the bookings of the logged-in player (the id comes from the login cookie). `upcoming` holds the bookings not finished yet, soonest first; `past` the finished ones, most recent first. Each booking gives `date`, `start`, `end`, `duration`, `courtName`, `equipment` (`name`, `quantity`, `unitPrice`), `courtPrice`, `equipmentPrice`, `feesTotal`, `totalPrice`, `status` and `paymentStatus`. `401` without login.

The page `/my-bookings` of the front end ("My bookings" on the home page, once logged in) shows both lists.

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

## Scheduled jobs

When the backend starts (`npm run dev` or `npm start`), `server.js` also starts a job with node-cron (`src/jobs/reminders.job.js`), every 15 minutes, Paris time:

- **Booking reminders** (FR-31, AC-13): an email to the player of each confirmed booking that starts in 24 hours (± 15 minutes). Each reminder is logged in `notifications` with the type `BOOKING_REMINDER`, so a booking is reminded only once; a `FAILED` email is tried again at the next run while the booking is still in the window. Cancelled bookings and guest bookings get no reminder.

The tests never start the job: they use `app.js`, and only `server.js` starts it.

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
