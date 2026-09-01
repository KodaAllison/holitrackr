# Holitrackr — Feature Ideas

A living doc of potential features. Add notes, priority, or status as things progress.

---

## 1. Travel Stats Dashboard
**Status:** Idea

A dedicated page showing personal stats at a glance.

- Total countries visited + bucket listed
- Continents covered (out of 7)
- % of world explored (countries visited / 195)
- Most recent trip
- "Streak" — consecutive years with at least one new country
- Continent breakdown bar/donut chart

---

## 2. Trip Journal / Country Detail View
**Status:** Idea

Click a visited country to open a rich side panel.

- Photo upload (one or more)
- Star rating (1–5)
- Tags (food, culture, nature, adventure, work…)
- Full journal entry (rich text or markdown)
- Builds on the existing `notes` column — would likely need a separate `country_details` table

---

## 3. Friends & Compare Maps
**Status:** Idea

Social layer on top of the personal map.

- Public profile link (read-only shareable map)
- Add friends by username/email
- "Countries in common" overlay on the map
- Optional leaderboard: who's visited the most

---

## 4. Trip Timeline
**Status:** Done

A chronological, narrative view of travel history.

- Uses existing `visit_date` data
- Feed of countries grouped by year
- Complements the map — shows the journey, not just the destination

---

## 5. Travel Goals & Milestones
**Status:** Idea

Set personal goals and get notified when you hit them.

- Custom goals: "visit 50 countries", "explore all of South America"
- Progress bar per goal
- In-app milestone notifications/badges on completion

---

## 6. Continent Challenges
**Status:** Idea

Predefined, opt-in challenges with badges on completion.

- Examples: "All 54 African Countries", "Nordic 5", "ASEAN 10", "G7 Nations"
- Progress tracked automatically from visited countries
- Trophy/badge displayed on profile

---

## 7. CSV / PDF Export
**Status:** Idea

Let users take their data out of the app.

- CSV: country code, name, visit date, notes
- PDF: map screenshot + stats page — useful for visa applications or keepsakes
- Could also serve as a data portability / GDPR-friendly feature

---

## 8. Multiple Visits per Country
**Status:** Idea

Support logging multiple visits to the same country, each with its own date and optionally its own notes. Currently the schema stores one row per country per user, so a repeat visitor loses all but one trip date.

- Requires a new `country_visits` table: `(id, user_id, country_code, visit_date, notes)` — linked to the existing `visited_countries` row
- `visited_countries` keeps its role as the status record (visited / bucket list); `country_visits` holds the individual trip log
- Timeline (#4) would show each visit as a separate event rather than one entry per country
- Trip Journal (#2) could attach notes/photos per visit rather than per country
- UX: "Add another visit" button on the country detail or list row; first mark via map sets status + creates visit #1
- Open question: does visit count show on the map (e.g. a badge) or only in the list/timeline?

---

## 9. In-List Status Toggle
**Status:** Idea

Allow users to switch a country between "visited" and "bucket list" directly from the country list sidebar, without having to re-click it on the map or use the search bar.

- Small toggle/button on each list row (e.g. a pill that reads "Visited" or "Bucket List", click to flip)
- Fires the existing PATCH or re-uses `toggleCountry` with an explicit status — no new API endpoint needed
- Purely a `VisitedCountriesList.tsx` + `App.tsx` change; no DB or type changes required
- Removes the current friction: finding a country on the map just to change its status

---

## 10. Public Country Stats API
**Status:** Done

A read-only portfolio endpoint at `GET /api/public/stats` exposes a privacy-limited snapshot for one server-configured owner.

- Returns canonical country codes/names, continents, counts, and the snapshot generation time
- Never exposes user ids, notes, dates, ratings, tags, coordinates, cities, or chronology
- Uses shared Express/Vercel behavior, exact CORS permissions, and Vercel CDN caching
- Owner is selected only through `PUBLIC_STATS_OWNER_USER_ID`, never caller input
- Future private-by-default opt-in profiles are tracked separately in Koder ticket `t_mtikfd5y_b4962`

---

## Adding Ideas

When adding a new idea, include:
- What it does (1–2 sentences)
- Key sub-features or open questions
- Any data/API changes needed
