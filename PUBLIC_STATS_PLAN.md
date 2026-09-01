# Public Country Stats API — Final Implementation Plan

## Goal

Expose one deliberately public, read-only snapshot of the configured portfolio owner's visited countries at `GET /api/public/stats`. The endpoint is not a general public-profile system and never chooses an owner from a URL, query string, cookie, or request body.

## Fixed decisions

- The only data owner is `PUBLIC_STATS_OWNER_USER_ID`, configured on the server/deployment.
- Missing owner configuration returns `503 { "error": "Public stats unavailable" }` with `Cache-Control: no-store`.
- The database query selects only `country_code` and `country_name` for rows where `user_id = $1` and `status = 'visited'`.
- Output is built from a closed response type; database rows are never spread into JSON.
- Country output is canonical local metadata: ISO-like alpha-3 code, alpha-2 code, English name, and continent.
- `-99` is repaired only for the exact stored names `France`, `Norway`, and `Kosovo`. Northern Cyprus, Somaliland, unknown codes, and malformed rows are omitted.
- Kosovo is a documented compatibility extension (`XKX` / `XK`), not presented as an ISO 3166 assignment.
- Countries and continent names are sorted alphabetically, and duplicate canonical countries are returned once.
- `generatedAt` records when that response was originally generated. A cached response keeps its original timestamp.
- Successful GET responses use Vercel CDN caching for one hour and stale-while-revalidate for one day. This supports background refresh; it is not a guaranteed database-outage fallback.
- Errors use `no-store`.
- Approved browser origins receive a matching `Access-Control-Allow-Origin`; other origins still receive the public JSON without that header. Every response varies on `Origin`.
- Approved origins: `https://kodaallison.dev`, `https://www.kodaallison.dev`, and `http://localhost:3000`.
- Express development and Vercel production adapters call the same shared service.
- Vitest is added for the shared HTTP-contract seam. The project minimum is Node.js 20.

## Public response

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

The response must never expose user IDs, database IDs, notes, visit dates, ratings, tags, coordinates, cities, or chronology.

## Delivery slices

1. Add canonical metadata and normalization with the three approved `-99` repairs.
2. Add a shared query/response/HTTP service with CORS, cache, error, and method behavior.
3. Add thin `api/public/stats.ts` and Express adapters.
4. Bring `api/countries.ts` to feature parity with the Express GET, POST, PATCH, and DELETE behavior.
5. Document environment setup, public contract, caching limits, and the future opt-in profiles ticket.
6. Verify focused tests, full tests, typecheck/build, lint, and a two-axis code review.

## Deferred extension

Koder ticket `t_mtikfd5y_b4962` covers private-by-default, opt-in public profiles with slugs. It is explicitly outside this implementation.
