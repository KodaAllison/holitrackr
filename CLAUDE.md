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

## Architecture

**HoliTrackr (MyAtlas)** is a full-stack travel tracking app where users mark countries they've visited on an interactive world map.

**Stack:** React 18 + TypeScript + Vite + Tailwind + Leaflet (frontend), Express 5 + Better-Auth + PostgreSQL (backend), deployed to Vercel.

### Server (`server.ts`)
The single entry point for the backend. It:
- Mounts Better-Auth middleware at `/api/auth/**` for Google OAuth + session handling
- Exposes three REST endpoints: `GET /api/countries`, `POST /api/countries`, `DELETE /api/countries/:code`
- Runs Vite as middleware in dev mode; serves `/dist` in production
- Runs a PostgreSQL migration on startup to create `visited_countries` (columns: `user_id`, `country_code`, `country_name`, `visit_date`)

### Frontend (`src/`)
- `App.tsx` — top-level state owner: session state, visited countries array, toggling logic, and localStorage migration for pre-auth users
- `src/components/WorldMap.tsx` — Leaflet map; country click events bubble up to `App.tsx` via callback
- `src/lib/auth.ts` — Better-Auth server-side config (DB adapter, Google provider)
- `src/lib/auth-client.ts` — Better-Auth browser client (used for sign-in/sign-out/session)
- `src/types/` — shared `Country` and `VisitedCountry` TypeScript interfaces

### Data flow
1. User signs in via Google OAuth (Better-Auth handles the redirect/callback)
2. `App.tsx` fetches session → fetches `/api/countries` for that user
3. Map clicks call `toggleCountry()` → POST or DELETE to `/api/countries`
4. On first auth, localStorage data is migrated to the DB

### Vercel deployment
`vercel.json` routes all traffic to the compiled server entry (`api/index.ts`). The Neon serverless Postgres instance can have a cold-start delay of up to 20 seconds; the server has a corresponding timeout.

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
