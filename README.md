# HoliTrackr 🌍

HoliTrackr is a full-stack travel tracker for recording visited countries, planning a bucket list, keeping a lightweight travel journal, and viewing trips on an interactive world map. The user interface is currently branded as **MyAtlas**.

The main application is private and requires Google sign-in. A separate read-only API can expose a deliberately limited country summary for one configured portfolio owner.

## Features

- Interactive Leaflet world map with visited, bucket-list, and unselected states
- Country search as an alternative to selecting countries on the map
- Google authentication through Better Auth
- Per-user PostgreSQL persistence
- Visited and bucket-list totals, world-explored percentage, and remaining-country count
- Countries grouped by status and continent
- Travel journal fields for notes, visit month, rating, and tags
- Timeline view grouped by visit year
- One-time migration of older per-user browser data into the database
- Privacy-limited public stats endpoint for portfolio integrations
- Responsive React and Tailwind interface

There is currently no guest mode. A visitor must sign in before using the main tracker.

## Technology

| Area | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Map | Leaflet, React-Leaflet, OpenStreetMap tiles, GeoJSON country boundaries |
| Local backend | Express 5 running through `tsx` |
| Production backend | Vercel Functions under `api/` |
| Authentication | Better Auth with Google OAuth |
| Database | PostgreSQL locally or a hosted provider such as Neon |
| Production database driver | `@neondatabase/serverless` |
| Tests | Vitest |
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

On startup, the Express server runs the Better Auth migrations and ensures the `visited_countries` table and its current columns exist in the configured database.

## Available commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Express and the Vite development client together |
| `npm run dev:client` | Start only Vite; API and authentication routes will not be available locally |
| `npm run db:migrate` | Apply Better Auth and `visited_countries` migrations to `DATABASE_URL` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run lint` | Run ESLint |
| `npm run build` | Type-check the full project and create the Vite production bundle |
| `npm run preview` | Preview the already-built frontend |

## Using HoliTrackr

1. Sign in with Google.
2. Select a country on the map or use country search.
3. Mark it as **Visited** or **Bucket List**.
4. Open **Edit Journal** to add notes, a visit month, a rating, and tags.
5. Switch to **Timeline** to view visited countries grouped by year.
6. Use the country list to edit, remove, or reset records.

Map changes are applied optimistically in the browser. If a database request fails, the app refetches the server state.

## API overview

### Authentication

`/api/auth/**` is managed by Better Auth. The private country endpoints use the Better Auth session cookie and return `401 Unauthorized` when no signed-in user is available.

### Private countries API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/countries` | Return the signed-in user's countries and journal data |
| `POST` | `/api/countries` | Add a country or update its visited/bucket-list status |
| `PATCH` | `/api/countries` | Update journal fields |
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
  "visitedAt": "2026-09",
  "rating": 5,
  "tags": ["Food", "Culture", "City"]
}
```

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

The application stores one row per user and country identity in `visited_countries`.

| Column | Purpose |
|---|---|
| `id` | Database row identifier |
| `user_id` | Better Auth owner id |
| `country_code` | GeoJSON/ISO-like country code |
| `country_name` | Country name used with the code as identity |
| `status` | `visited` or `bucketlist` |
| `notes` | Optional journal note |
| `visit_date` | Optional month stored as the first day of that month |
| `rating` | Optional 1–5 rating |
| `tags` | Journal tags serialized as JSON text |
| `created_at` | Row creation timestamp |

The uniqueness constraint is `(user_id, country_code, country_name)`. Multiple visits to the same country are not currently represented as separate rows.

## Project structure

```text
api/
  auth/[...all].ts       Better Auth Vercel function
  countries.ts           Private countries Vercel function
  public/stats.ts        Public stats Vercel function
src/
  components/            React UI components
  lib/                   Auth, continent, metadata, and country helpers
  server/                Shared server-side behavior and payload parsing
  types/                 Shared TypeScript contracts
server.ts                Local Express server and database migrations
vercel.json              Production build and rewrite configuration
PUBLIC_STATS_PLAN.md     Final public-stats contract
```

The map loads country boundaries from a public GeoJSON source and map tiles from OpenStreetMap, so the map requires internet access even when the application server is local.

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

Confirm that the browser can reach the external GeoJSON source and OpenStreetMap tile servers.

## Roadmap

Potential features and current status are tracked in [FEATURES.md](./FEATURES.md). Opt-in public profiles are intentionally deferred; the current endpoint exposes only one deployment-configured owner.

## License

MIT
