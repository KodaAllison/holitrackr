# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Express backend + Vite dev client together
npm run dev:client   # Vite dev only (no backend)
npm run build        # tsc + Vite production build
npm run lint         # ESLint
npm run preview      # Vite preview of production build
```

## Workflow

`tmux.sh` opens 3 general Claude Code panes, a dev server pane (`npm run dev`), and a git shell. All panes are equal — no fixed roles.

- **FEATURES.md** is the source of truth for the feature backlog and specs. Check it before starting work on a new feature.
- **CLAUDE.md** (this file) is always auto-loaded, so conventions survive any `/clear` or `/compact`.
- When starting a new feature, write or update the spec in `FEATURES.md` first, then implement on a `feat/<name>` branch.

## Architecture

**HoliTrackr (MyAtlas)** is a full-stack travel tracking app where users mark countries they've visited on an interactive world map.

**Stack:** React 18 + TypeScript + Vite + Tailwind + Leaflet (frontend), Express 5 + Better-Auth + PostgreSQL (backend), deployed to Vercel.

### Server (`server.ts`)
The single entry point for the backend. It:
- Mounts Better-Auth middleware at `/api/auth/**` for Google OAuth + session handling
- Exposes REST endpoints under `/api/countries` (GET, POST, DELETE, PATCH)
- Runs Vite as middleware in dev mode; serves `/dist` in production
- Runs a PostgreSQL migration on startup — add new `ALTER TABLE` / `CREATE TABLE` statements to the migration block at the top of `server.ts`

**Current DB schema — `visited_countries`:**
```
user_id       TEXT
country_code  TEXT
country_name  TEXT
status        TEXT        ('visited' | 'bucketlist')
notes         TEXT
visit_date    DATE        (stored as YYYY-MM-01; API serialises as visitedAt: YYYY-MM)
created_at    TIMESTAMPTZ
```

### Frontend (`src/`)
- `App.tsx` — top-level state owner: session, visited countries array, toggle/remove/reset logic, localStorage migration
- `src/components/WorldMap.tsx` — Leaflet map; country clicks bubble up via callback
- `src/components/Header.tsx` — navbar; accepts optional `user` prop to render `UserMenu`
- `src/components/Stats.tsx` — visited/bucket-list counts bar
- `src/components/VisitedCountriesList.tsx` — sidebar list with remove, reset, journal edit
- `src/lib/auth.ts` — Better-Auth server config (DB adapter, Google provider)
- `src/lib/auth-client.ts` — Better-Auth browser client
- `src/types/` — shared `Country` and `VisitedCountry` TypeScript interfaces

### Data flow
1. User signs in via Google OAuth (Better-Auth handles redirect/callback)
2. `App.tsx` fetches session → fetches `/api/countries` for that user
3. Map clicks call `toggleCountry()` → POST or DELETE/PATCH to `/api/countries`
4. On first auth, localStorage data is migrated to the DB

### Vercel deployment
`vercel.json` routes all traffic to the compiled server entry (`api/index.ts`). The Neon serverless Postgres instance can have a cold-start delay of up to 20 seconds; the server has a corresponding timeout.

## Coding Conventions

### TypeScript
- Strict mode is on — no `any`, no non-null assertions without a comment explaining why
- Define shared types in `src/types/`; don't inline object shapes in component props if they're reused
- Use `unknown` + type guards when parsing API responses or JSON (see `App.tsx` for the pattern)

### React
- State lives in `App.tsx` unless it's purely local UI state (e.g. dropdown open/closed)
- Pass callbacks down as props; don't reach up via refs or context unless necessary
- Optimistic updates: update state immediately, fire the API call, revert on failure via `refetchFromServer()`
- No `useEffect` for derived data — compute it inline from existing state

### Tailwind
- Use Tailwind utility classes only — no custom CSS files unless Tailwind can't do it
- Stick to the existing blue-600 / gray-50 / white palette unless a feature explicitly needs new colours
- Responsive: mobile-first, use `lg:` breakpoint for the map/sidebar split

### Components
- One component per file, filename matches the export name
- No default prop objects — use `prop?: Type` and handle undefined inline
- Keep components focused; if a component exceeds ~150 lines it probably needs splitting

## Branch & PR Strategy

- `main` — production, always deployable
- `feat/<short-name>` — feature branches off main (e.g. `feat/trip-timeline`)
- `fix/<short-name>` — bug fix branches
- Squash-merge PRs to keep main history clean
- PR description should reference the feature from `FEATURES.md` and include a brief test plan

## Adding a New API Endpoint

1. Add the route handler in `server.ts` following the existing pattern (check session with `auth.api.getSession`, query with `pool.query`)
2. Always validate `session?.user?.id` before touching the DB — return 401 if missing
3. Use parameterised queries only — never string-interpolate user input into SQL
4. Add the migration (new column or table) to the migration block at the top of `server.ts` so it runs on next deploy
5. Update `src/types/` if the response shape changes

## Feature Backlog

See `FEATURES.md` in the repo root for the full ideas list and status of each feature.

## Environment Variables

Copy `.env.example` to `.env`. Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon, Supabase, Railway, or local) |
| `BETTER_AUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | App base URL (e.g. `http://localhost:5173`) |
| `VITE_BETTER_AUTH_URL` | Same value, exposed to the Vite client |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console OAuth credentials |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console OAuth credentials |
