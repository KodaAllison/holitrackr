# HoliTrackr 🌍

HoliTrackr is a full-stack travel tracker for recording visited countries, planning a bucket list, keeping a lightweight travel journal, and viewing trips on an interactive world map. The user interface is currently branded as **MyAtlas**.

The main application is private and requires Google sign-in. A separate read-only API can expose a deliberately limited country summary for one configured portfolio owner.

## Features

- Interactive canvas world map (d3-geo): a spinnable globe on desktop with a Globe / Flat toggle that unrolls between the two, and a flat map on mobile
- Startup globe intro (once per session) and an "atlas plate" sign-in screen
- Visited, bucket-list, and unselected states, with Show filters to hide either fill
- Country search (press `/` to focus) as an alternative to selecting countries on the map
- Sidebar country list sortable by continent, date, or name, with keyboard navigation; a draggable bottom sheet on mobile
- Google authentication through Better Auth
- Per-user PostgreSQL persistence
- Visited and bucket-list totals, world-explored percentage, and remaining-country count
- Countries grouped by status and continent
- Travel journal fields for place, notes, visit month, rating, and tags, saved automatically
- Multiple visits per country, each with its own month, place, rating, notes, and tags
- Milestone moments (10, 25, 50, 100 countries, or a first country on a new continent)
- Scrubbable timeline: map that fills in as you play, great-circle legs between trips, a draggable ruler, and a journey feed (oldest first) with planned and undated sections
- One-time migration of older per-user browser data into the database
- Privacy-limited public stats endpoint for portfolio integrations
- Responsive React and Tailwind interface

There is currently no guest mode. A visitor must sign in before using the main tracker.

## Technology

| Area | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Map | d3-geo canvas renderer (globe and flat), d3-zoom, bundled TopoJSON country boundaries |
| Local backend | Express 5 running through `tsx` |
| Production backend | Vercel Functions under `api/` |
| Authentication | Better Auth with Google OAuth |
| Database | PostgreSQL locally or a hosted provider such as Neon |
| Production database driver | `@neondatabase/serverless` |
| Tests | Vitest |
| Fonts | Instrument Serif and JetBrains Mono (`@fontsource`) on the sign-in screen only |
| Code quality | TypeScript strict mode and ESLint |

## How the application is structured

The same browser application talks to different HTTP adapters depending on its environment:

| Environment | Request path |
|---|---|
| Local development | Browser → `server.ts` → PostgreSQL |
| Vercel production | Browser → matching function in `api/` → Neon/PostgreSQL |

`src/server/publicStats.ts` contains the shared public-stats behavior used by both adapters. Private country payload parsing is shared through `src/server/countryPayloads.ts` so development and production accept the same inputs.

## Getting started

### Prerequisites

- Node.js 20 or newer
- npm
- A PostgreSQL database
- Google OAuth credentials

### 1. Clone and install

```bash
git clone https://github.com/KodaAllison/holitrackr.git
cd holitrackr
npm install
```

### 2. Create the local environment file

On PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS, Linux, or Git Bash:

```bash
cp .env.example .env
```

Fill in the values in `.env`:

| Variable | Required? | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Random secret used to sign authentication data |
| `BETTER_AUTH_URL` | Yes | Server-side application URL; locally `http://localhost:5173` |
| `VITE_BETTER_AUTH_URL` | Yes | Authentication URL used by the browser |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `PUBLIC_STATS_OWNER_USER_ID` | No | Better Auth user whose visited-country summary may be public |

Never commit `.env`. Variables prefixed with `VITE_` are included in the browser bundle, so secrets and the public-stats owner selection must not use that prefix.

### 3. Configure Google sign-in

Create a Web application OAuth client in Google Cloud and configure it for the local and deployed HoliTrackr URLs. Put its client ID and client secret in `.env`.

The configured application URL must agree with `BETTER_AUTH_URL`. A mismatch commonly causes Google redirect or trusted-origin errors.

### 4. Start the application

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

On startup, the Express server runs the Better Auth migrations and ensures the `visited_countries` and `country_visits` tables and their current columns exist in the configured database.

## Available commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Express and the Vite development client together |
| `npm run dev:client` | Start only Vite; API and authentication routes will not be available locally |
| `npm run db:migrate` | Apply Better Auth and application migrations to `DATABASE_URL` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run lint` | Run ESLint |
| `npm run build` | Type-check the full project and create the Vite production bundle |
| `npm run preview` | Preview the already-built frontend |

## Using HoliTrackr

1. Sign in with Google.
2. Click a country on the map (drag to spin the globe) or use country search. The country opens in the sidebar.
3. Mark it as **Visited** or **Bucket list**. An Undo toast appears.
4. In the sidebar, fill in the journal (place, notes, month, rating, tags). Changes autosave. For bucket-list countries the month means "Hoping to go".
5. Use **Add another visit** to record repeat trips to the same country.
6. Switch to **Timeline** (top bar, or the Timeline button on mobile) and press Play to replay your travels, or drag the playhead along the ruler.
7. Use the country list to sort, edit, remove, or reset records.

Use the Globe / Flat toggle (desktop) to change map style; the choice is remembered. Below the `lg` breakpoint the map is always flat, with a floating search, map controls, and a draggable bottom sheet.

Map changes are applied optimistically in the browser. If a database request fails, an error toast offers Retry and the app refetches the server state.

## API overview

### Authentication

`/api/auth/**` is managed by Better Auth. The private country endpoints use the Better Auth session cookie and return `401 Unauthorized` when no signed-in user is available.

### Private countries API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/countries` | Return the signed-in user's countries and journal data |
| `POST` | `/api/countries` | Add a country or update its visited/bucket-list status |
| `PATCH` | `/api/countries` | Update journal fields (including `place`) |
| `DELETE` | `/api/countries` | Remove one country |
| `DELETE` | `/api/countries?reset=true` | Remove all countries for the signed-in user |

Example POST body:

```json
{
  "code": "ESP",
  "name": "Spain",
  "status": "visited",
  "notes": "Optional short note"
}
```

Example PATCH body:

```json
{
  "code": "ESP",
  "name": "Spain",
  "notes": "Great food and architecture",
  "place": "Barcelona & Seville",
  "visitedAt": "2026-09",
  "rating": 5,
  "tags": ["Food", "Culture", "City"]
}
```

Extra visits (`/api/countries/visits`, handled by `api/countries/visits.ts` in production) let a country carry more than one trip. Each has `visitedAt` (`YYYY-MM`), `place`, `rating`, `notes`, and `tags`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/countries/visits` | Add an extra visit to a country |
| `PATCH` | `/api/countries/visits` | Update an extra visit |
| `DELETE` | `/api/countries/visits` | Remove an extra visit |

Country identity uses both code and name because the source GeoJSON can reuse placeholder codes such as `-99`.

## Public stats API

`GET /api/public/stats` is an intentionally public, read-only country summary for one server-configured owner. It is designed for a portfolio map or stats widget, not as a general public-profile system.

### Enabling it

If `PUBLIC_STATS_OWNER_USER_ID` is absent, the endpoint returns:

```http
503 Service Unavailable
Cache-Control: no-store
```

No database query is made in that case.

First, sign in using the Google account whose travel data should be public. Better Auth creates its row in PostgreSQL. Open the Neon SQL Editor and run:

```sql
SELECT
  u.id,
  u.email,
  u.name,
  COUNT(vc.id) FILTER (WHERE vc.status = 'visited') AS visited_count
FROM "user" AS u
LEFT JOIN visited_countries AS vc
  ON vc.user_id = u.id
GROUP BY u.id, u.email, u.name;
```

Find the correct email and copy its `id`.

For local development:

```env
PUBLIC_STATS_OWNER_USER_ID=the-copied-user-id
```

For production:

1. Open the HoliTrackr project in Vercel.
2. Go to **Settings → Environment Variables**.
3. Add `PUBLIC_STATS_OWNER_USER_ID` with the copied id.
4. Enable it for Production and any required Preview environments.
5. Redeploy so the function receives the new value.

The id is not a password, but it must remain server-side because it selects whose records are allowed to be public. Do not prefix it with `VITE_`, place it in a URL, or commit a real value.

### Response

```json
{
  "countries": [
    {
      "alpha3": "ESP",
      "alpha2": "ES",
      "name": "Spain",
      "continent": "Europe"
    }
  ],
  "countryCount": 1,
  "continentCount": 1,
  "continents": ["Europe"],
  "generatedAt": "2026-09-01T12:00:00.000Z"
}
```

Only rows with `status = 'visited'` are considered. Countries are deduplicated and sorted using local canonical metadata.

The response never includes database ids, user ids, notes, dates, ratings, tags, coordinates, cities, or trip chronology. Unknown and malformed country rows are omitted rather than copied into the response.

### CORS

Browser JavaScript receives `Access-Control-Allow-Origin` only for:

- `https://kodaallison.dev`
- `https://www.kodaallison.dev`
- `http://localhost:3000`

Other callers still receive the public JSON but do not receive that browser permission header. CORS is a browser sharing rule, not authentication or data security.

### Vercel caching

Successful responses use:

```http
Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400
```

Vercel's shared cache can reuse a successful response for one hour. After that, it may serve the cached response while refreshing it in the background for up to one day.

`generatedAt` describes when that cached response was originally generated, so it does not change on every request. This cache behavior is not a guaranteed database-outage fallback. Errors use `Cache-Control: no-store`.

The complete public contract and normalization decisions are recorded in [PUBLIC_STATS_PLAN.md](./PUBLIC_STATS_PLAN.md).

## Database model

The application stores one row per user and country identity in `visited_countries`. That row holds the country's first visit and journal.

| Column | Purpose |
|---|---|
| `id` | Database row identifier |
| `user_id` | Better Auth owner id |
| `country_code` | GeoJSON/ISO-like country code |
| `country_name` | Country name used with the code as identity |
| `status` | `visited` or `bucketlist` |
| `place` | Optional free-text place, up to 120 characters (e.g. "Kyoto & Osaka") |
| `notes` | Optional journal note |
| `visit_date` | Optional month stored as the first day of that month ("Hoping to go" for bucket-list rows) |
| `rating` | Optional 1–5 rating (CHECK constraint) |
| `tags` | Journal tags serialized as JSON text |
| `created_at` | Row creation timestamp |

The uniqueness constraint is `(user_id, country_code, country_name)`.

Extra visits live in `country_visits`, which references `"user"(id)` with `ON DELETE CASCADE`:

| Column | Purpose |
|---|---|
| `id` | Serial primary key |
| `user_id`, `country_code`, `country_name` | Same identity as `visited_countries` (indexed) |
| `visit_date` | Required month stored as the first day of that month |
| `place`, `rating`, `notes`, `tags` | As on `visited_countries` |
| `created_at` | Row creation timestamp |

Removing a country or resetting the atlas deletes its `country_visits` rows in the same statement.

## Project structure

```text
api/
  auth/[...all].ts       Better Auth Vercel function
  countries.ts           Private countries Vercel function
  countries/visits.ts    Extra-visits Vercel function
  public/stats.ts        Public stats Vercel function
src/
  components/            React UI: app bar, sidebar, map chrome, timeline, sign-in
  data/                  Compact world TopoJSON (motion and detail levels)
  lib/                   Auth, continent, metadata, timeline, and country helpers
  lib/mapEngine/         d3-geo canvas engine: hit-testing, clustering, renderer,
                         flat and globe hooks, morph, intro and sign-in drawing
  server/                Shared server-side behavior and payload parsing
  types/                 Shared TypeScript contracts
scripts/                 migrate.ts and build-world-atlas.mjs (rebuilds src/data)
server.ts                Local Express server and database migrations
vercel.json              Production build and rewrite configuration
PUBLIC_STATS_PLAN.md     Final public-stats contract
```

Country boundaries come from compact TopoJSON files bundled in `src/data/` (about 32 KB and 110 KB gzipped), so the map needs no external tiles or boundary downloads. Regenerate them from the pinned source with `node scripts/build-world-atlas.mjs`; the script and tests fail if any country name or ISO alpha-3 identity changes, so saved rows keep matching.

## Testing and quality checks

Run the normal verification sequence before opening a pull request:

```bash
npm test
npm run build
npm run lint
```

The public-stats tests cover:

- owner-scoped, public-column-only database querying
- country normalization and the approved `-99` repairs
- privacy-safe output
- sorting and deduplication
- CORS behavior
- CDN cache headers
- missing configuration and database failures
- preflight behavior

## Deploying to Vercel

1. Import the repository into Vercel.
2. Add every required environment variable from `.env.example`.
3. Set `BETTER_AUTH_URL` and `VITE_BETTER_AUTH_URL` to the deployed application URL.
4. From a trusted environment configured with the deployment database variables, run `npm run db:migrate`.
5. Deploy using the repository's `vercel.json` build configuration.
6. Sign in once, source the Better Auth owner id, and set `PUBLIC_STATS_OWNER_USER_ID` if the public endpoint is required.
7. Redeploy after adding or changing environment variables.

## Troubleshooting

### The server exits during startup

Check that `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` are present. Local startup intentionally stops when migrations or required configuration fail.

### Google sign-in redirects incorrectly

Check that Google OAuth allows the local/deployed application and that `BETTER_AUTH_URL` matches the URL being used.

### The session check times out

The UI waits up to 20 seconds. A Vercel function or sleeping Neon compute may be starting up. Check the function logs and database availability if it continues.

### The public endpoint returns 503

`PUBLIC_STATS_OWNER_USER_ID` is missing or empty in that environment. Add it and redeploy.

### The public endpoint returns an empty list

Confirm that the selected user id is correct and that the user has rows whose status is exactly `visited`. Bucket-list rows are intentionally excluded.

### The map does not load

The map data is bundled with the app, so check the browser console and network tab for a failed request for the hashed `world-*.topo.json` asset. If the atlas fails to load, the app shows "Couldn't load your atlas." with a Retry button.

## Roadmap

Potential features and current status are tracked in [FEATURES.md](./FEATURES.md), including the Atlas v2 redesign specs. Redesign work lands on the `atlas-v2` trunk (see `CLAUDE.md`). Opt-in public profiles are intentionally deferred; the current endpoint exposes only one deployment-configured owner.

## License

MIT
