# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Express backend + Vite dev client together
npm run dev:client   # Vite dev only (no backend)
npm run db:migrate   # Apply Better Auth and app migrations to DATABASE_URL
npm run build        # tsc + Vite production build
npm run lint         # ESLint
npm test             # Vitest contract tests
npm run preview      # Vite preview of production build
```

## Workflow

`tmux.sh` opens 3 general Claude Code panes, a dev server pane (`npm run dev`), and a git shell. All panes are equal — no fixed roles.

- **FEATURES.md** is the source of truth for the feature backlog and specs. Check it before starting work on a new feature.
- **CLAUDE.md** (this file) is always auto-loaded, so conventions survive any `/clear` or `/compact`.
- When starting a new feature, write or update the spec in `FEATURES.md` first, then implement on a `feat/<name>` branch.

## Architecture

**HoliTrackr (MyAtlas)** is a full-stack travel tracking app where users mark countries they've visited on an interactive world map.

**Stack:** React 18 + TypeScript + Vite + Tailwind + d3-geo canvas map (frontend), Express 5 + Better-Auth + PostgreSQL (backend), deployed to Vercel.

### Server (`server.ts`)
The single entry point for the backend. It:
- Mounts Better-Auth middleware at `/api/auth/**` for Google OAuth + session handling
- Exposes REST endpoints under `/api/countries` (GET, POST, DELETE, PATCH) and `/api/countries/visits` (POST, PATCH, DELETE: extra visits)
- Runs Vite as middleware in dev mode; serves `/dist` in production
- Runs the shared PostgreSQL migrations on startup from `src/server/databaseMigrations.ts`

**Current DB schema — `visited_countries`:**
```
user_id       TEXT
country_code  TEXT
country_name  TEXT
status        TEXT        ('visited' | 'bucketlist')
notes         TEXT
place         TEXT        (free text, max 120 chars, e.g. "Kyoto & Osaka")
visit_date    DATE        (stored as YYYY-MM-01; API serialises as visitedAt: YYYY-MM;
                           for bucket-list rows it means "Hoping to go")
rating        INTEGER     (1-5 or NULL; CHECK constraint)
tags          TEXT        (JSON array of strings; API serialises as tags: string[])
created_at    TIMESTAMPTZ
```
The journal columns above are the country's **first visit**. Extra visits
(FEATURES.md #8) live in **`country_visits`** (added, never backfilled; the
API returns them as `visits` on each country, oldest first):
```
id            SERIAL PK
user_id       TEXT        (REFERENCES "user"(id) ON DELETE CASCADE)
country_code  TEXT        ┐ same identity as visited_countries;
country_name  TEXT        ┘ indexed with user_id
visit_date    DATE NOT NULL (YYYY-MM-01; API: visitedAt YYYY-MM)
place, rating, notes, tags  (as on visited_countries; rating CHECK 1-5 or NULL)
created_at    TIMESTAMPTZ
```
Removing a country (or Reset) deletes its `country_visits` rows in the same
statement. Shared query/handler logic is in `src/server/countryVisits.ts`.

### Frontend (`src/`)
- `App.tsx` — top-level state owner: session, visited countries array, toggle/remove/reset logic, localStorage migration
- `src/components/WorldMap.tsx` — canvas world map: spinnable globe on desktop (`GlobeMapSurface`) with a Globe / Flat toggle that unrolls between them (`MorphMapSurface`, choice kept in localStorage), after a once-per-session startup intro (`IntroMapSurface`, timing in `src/lib/introTimeline.ts`); always flat below `lg` (`FlatMapSurface`); country clicks bubble up via callback
- `src/lib/mapEngine/` — the map engine: country index + hit-testing, micro-state clustering, canvas renderer, `useFlatMap` (d3-zoom) and `useGlobeMap` (drag/inertia/idle spin, great-circle turns) hooks
- `src/lib/worldAtlas.ts` — loads the compact country TopoJSON in `src/data/` (`motion` or `detail`); rebuild the data with `node scripts/build-world-atlas.mjs`
- `src/components/TripTimeline.tsx` — timeline v2, filling the shell's full-height slot below the bar (`h-full min-h-0`): on `lg` a split of `TimelineMap` (map fills in, great-circle legs, "Your atlas in …" chip) + `TimelineRuler` (draggable playhead, `TimelineRulerMarks`, Prev / Play / Next) beside a scrolling `TimelineFeed` ("Your journey": year groups of `TimelineTripCard`, oldest first, then `TimelineNextSection` for dated bucket-list plans and `TimelineUndatedSection` with "Add a date"); stacked below `lg`. Data from `src/lib/timelineModel.ts`
- `src/components/SignInScreen.tsx` — signed-out "atlas plate": dark globe touring a demo journey (`src/lib/signInTour.ts`, drawn by `mapEngine/drawSignIn.ts`) and Continue with Google. Uses self-hosted Instrument Serif + JetBrains Mono (`@fontsource`), a deliberate exception to the palette/fonts rule scoped to this screen
- App shell (Atlas v2): `src/components/AppBar.tsx` — 64px white bar with the MyAtlas mark, `ViewSwitch` (Map / Timeline), `CountrySearch` in the middle ("/" focuses it) and `UserMenu` (avatar); full-height map + 360px sidebar below it on `lg`, no footer. Below `lg` the map view has no bar: search + avatar float over a full-bleed map, the list is a sheet under it with a `TimelineButton`, and the bar returns in the timeline view. Session check shows `LoadingScreen`
- Map chrome (desktop, `MapChrome.tsx`): top-left the Globe / Flat toggle beside `MapSummaryChip` (progress bar, "n of 195 countries", "n of 7 continents"; a placeholder while loading; on mobile the count + colour key under the search), or a "‹ World view" pill while a country is open (zooms back out via `worldViewSeq`); bottom-left `MapLegend`, the "Show" fieldset whose Visited / Bucket list checkboxes hide those fills (`MapFilter` state in `App.tsx`, helpers in `src/lib/mapFilter.ts`); bottom-centre a how-to hint until the first map interaction; bottom-right `MapZoomStack` (zoom in / out / "Fit to my countries", owned by each surface; globe fit maths is `fitGlobe` in `mapEngine/globeMotion.ts`). `MapOverlays` is the dark hover tooltip. There is no click popup or modal: a map click opens the country in the sidebar (outlined 2.5px blue on the map), and marking shows an Undo `Toast` bottom-centre of the map. First run shows `MapWelcomeCard` ("Start your atlas", its own `CountrySearch welcome`) over the map until dismissed or something is marked
- `src/components/CountrySidebar.tsx` — sidebar, a full-height `<aside>` (its own left border on `lg`; the shell's wrapper has none): `CountryList` ("Your countries" with a `SortMenu` — continent / date / name, grouping in `src/lib/countryListModel.ts` — and the mobile `TimelineButton` beside it; Visited / Bucket list tabs; a `CountryRow` per country with a hover/focus status pill; arrow-key navigation; `KeyboardLegend` footer; `SidebarEmpty` / `SidebarSkeleton` states, the skeleton while `App.tsx` loads the countries) or `CountryMarkPanel` (an unmarked country clicked on the map: Visited / Bucket list) or `CountryDetailPanel` (`StatusControl`, inline autosaving `JournalFields` with `StarRating`, `TagPicker` and `AutosaveStatus`, a `VisitList` of the country's visits with `VisitEditor` and "Add another visit"; removing shows an Undo `Toast`); on mobile the list sits in the shell's sheet and the detail panel opens as a bottom sheet. Selecting a country turns the map to it
- `src/lib/countryVisits.ts` — pure list updates for extra visits (optimistic state in `App.tsx`; pending visits use negative ids)
- `src/lib/auth.ts` — Better-Auth server config (DB adapter, Google provider)
- `src/lib/auth-client.ts` — Better-Auth browser client
- `src/types/` — shared `Country` and `VisitedCountry` TypeScript interfaces

### Data flow
1. User signs in via Google OAuth (Better-Auth handles redirect/callback)
2. `App.tsx` fetches session → fetches `/api/countries` for that user
3. Map clicks call `toggleCountry()` → POST or DELETE/PATCH to `/api/countries`
4. On first auth, localStorage data is migrated to the DB

### Vercel deployment
`vercel.json` rewrites Better Auth requests to `api/auth/[...all].ts` and leaves other `/api/**` paths to their matching Vercel Functions (`api/countries.ts`, `api/countries/visits.ts`, `api/public/stats.ts`; the two session-scoped ones share their auth + pool setup in `src/server/vercelApi.ts`). Non-API paths fall back to the Vite SPA. `server.ts` mirrors the custom API routes for local development.

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

### Atlas v2 trunk

The Atlas v2 redesign (FEATURES.md, "Atlas v2 redesign") is too big to land on
`main` piecemeal, so it has its own long-lived trunk:

- `atlas-v2` — branched from `main`. Every redesign ticket branches
  `feat/<name>` off `atlas-v2` and PRs back into `atlas-v2`, never `main`.
- Merge `main` into `atlas-v2` regularly (a merge commit, not a rebase) so
  fixes on `main` reach the redesign and conflicts stay small.
- `atlas-v2` → `main` only when a milestone is releasable, via one PR with a
  test plan covering the whole milestone.
- Vercel builds a preview deployment for every pushed branch, so `atlas-v2`
  and its PRs each get a preview URL. Check the redesign there, not on
  production.
- Non-redesign fixes still go `fix/<name>` → `main`.

## Adding a New API Endpoint

1. Add the route handler in `server.ts` following the existing pattern (check session with `auth.api.getSession`, query with `pool.query`)
2. Always validate `session?.user?.id` before touching the DB — return 401 if missing
3. Use parameterised queries only — never string-interpolate user input into SQL
4. Add schema changes to `src/server/databaseMigrations.ts`, then run `npm run db:migrate` for the deployment database
5. Update `src/types/` if the response shape changes

The intentional exception is `GET /api/public/stats`: it does not use the caller's session. It always scopes its parameterised query to server-only `PUBLIC_STATS_OWNER_USER_ID` and returns only the closed public response type. Keep its Express and Vercel adapters thin and put shared behavior in `src/server/publicStats.ts`.

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
| `PUBLIC_STATS_OWNER_USER_ID` | Optional Better Auth user id whose visited-country summary may be public; missing returns 503 |
