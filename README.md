# PadelPassTeam

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

## Run the project

```bash
npm run install:all   # installs root, backend and frontend dependencies
npm run dev           # starts the backend and the frontend together
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

Open the frontend: the page calls `GET /api/health` and displays `OK` when the backend is reachable. In development, Vite forwards every `/api` request to the backend, so the browser only talks to one origin.

### Environment variables

Copy `backend/.env.example` to `backend/.env` to override the defaults. Never commit a `.env` file.

| Variable | Default | Description       |
| -------- | ------- | ----------------- |
| `PORT`   | `3000`  | Backend HTTP port |

## Scripts (from the root)

| Command          | Description                                 |
| ---------------- | ------------------------------------------- |
| `npm run dev`    | Start backend and frontend                  |
| `npm run lint`   | ESLint + Prettier check on both apps        |
| `npm test`       | Vitest on both apps (Supertest for the API) |
| `npm run format` | Format both apps with Prettier              |

The same `dev`, `lint`, `test` and `format` scripts exist inside `/backend` and `/frontend`.

## Git workflow

- One branch per story: `feature/PAD-<n>-<short-desc>`, created from an up-to-date `main`.
- Commits: `feat(PAD-<n>): ...`, `test(PAD-<n>): ...`, `chore(PAD-<n>): ...`.
- One pull request per story, titled `PAD-<n> | <story title>`, reviewed and approved by another member before merging.
- Nobody pushes to `main` directly.
