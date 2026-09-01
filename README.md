# HoliTrackr 🌍

A web application for tracking and visualizing the countries you've visited on an interactive world map.

## Features

- Interactive world map with GeoJSON country boundaries
- Click to mark countries as visited
- Color-coded visualization of your travel history
- Beautiful, modern UI

## Tech Stack

- React + TypeScript
- Leaflet + React-Leaflet
- Vite
- Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 20+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/KodaAllison/holitrackr.git
cd holitrackr

# Install dependencies
npm install

# Copy the environment template and fill in your values
cp .env.example .env

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
npm run preview
```

## How to Use

1. Click on any country on the map to mark it as visited
2. Visited countries will turn green
3. Click again to unmark
4. Your progress is shown in the stats bar at the top

## Public Stats API

`GET /api/public/stats` exposes a deliberately small, read-only country summary for one configured portfolio owner. Set `PUBLIC_STATS_OWNER_USER_ID` to that owner's Better Auth user id; callers cannot select or toggle the owner in a URL.

Example response:

```json
{
  "countries": [
    { "alpha3": "ESP", "alpha2": "ES", "name": "Spain", "continent": "Europe" }
  ],
  "countryCount": 1,
  "continentCount": 1,
  "continents": ["Europe"],
  "generatedAt": "2026-09-01T12:00:00.000Z"
}
```

Only visited-country identity and derived continent data are returned. User ids, notes, dates, ratings, tags, coordinates, cities, and trip chronology are never part of the response.

Browser JavaScript from the portfolio domains and `http://localhost:3000` receives CORS permission. CORS is a browser sharing rule, not authentication: the endpoint is intentionally public and direct HTTP clients can read it regardless of origin.

Successful responses are cached by Vercel's shared CDN for one hour and can be served stale while Vercel refreshes them in the background for one day. `generatedAt` therefore describes the cached snapshot's original generation time. This is not a guaranteed database-outage fallback; errors are returned with `Cache-Control: no-store`.

Run the contract tests with:

```bash
npm test
```

## License

MIT
