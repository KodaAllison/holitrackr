# Holitrackr — Feature Ideas

A living doc of potential features. Add notes, priority, or status as things progress.

---

## Atlas v2 redesign (in progress)
**Status:** In progress on the `atlas-v2` trunk

A redesign of the map, sign-in, loading and timeline. Designs and interactive
prototypes: https://claude.ai/artifact/WhSUVyzknsVdn7KDUdywKC

Work lands on `atlas-v2`, not `main` (see CLAUDE.md, Branch & PR Strategy).
Features in this redesign: #11–#14 below, plus updates to #2, #4, #5 and #8.

**Decisions that apply to every screen:**
- The spinnable globe is the **default desktop map everywhere**: browse,
  selected, empty and loading states. Some static mocks show a flat map; read
  them as the globe.
- A flat map is always **one click away** via the Globe / Flat toggle.
- **Mobile stays flat** (no globe, no toggle).
- The keyboard and screen-reader route is search + the country list. The map
  canvas is `aria-hidden` and mirrors the list's selection.
- "195" means the 193 UN member states plus the 2 observer states.
- Time-based views (timeline feed, replay) read **oldest first**.
- One renderer for globe and flat: d3-geo on a canvas. Leaflet is removed.
- Map data is our own compact TopoJSON (see #11).

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

**Atlas v2 update — journal fields.** *(Done: `place` added; the rating CHECK is on; bucket-list rows use the date as "Hoping to go". The inline autosave panel comes with the list/detail redesign.)* `rating` and `tags` columns already
exist on `visited_countries`. Atlas v2 adds `place` (free text, e.g.
"Kyoto & Osaka") and tightens the other two: rating 1–5 or null, tags as a
list. The detail panel edits them inline with autosave. The bucket-list
journal hides Rating and treats the visit date as "Hoping to go". Public stats
(#10) must never expose rating, tags or place.

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
**Status:** Done (v1). v2 planned in Atlas v2.

A chronological, narrative view of travel history.

- Uses existing `visit_date` data
- Feed of countries grouped by year
- Complements the map — shows the journey, not just the destination

**Timeline v2 — scrub your journey.** Replaces the plain feed.
- Map (left): countries fill in as time passes; a dashed great-circle route
  joins trips, with the newest leg drawn in; the active country is outlined and
  labelled.
- Ruler (below the map): from the first trip to now, with per-year bars and a
  dot per trip. A draggable playhead snaps to trips, with prev / Play / next.
- Past "Now", a hatched **Next** zone shows bucket-list countries that have a
  "Hoping to go" date.
- Feed (right): **oldest first**. Year headers note "first time in <continent>".
  Each card shows the month, place, stars, notes and tags. Clicking a card moves
  the playhead, and Play scrolls the feed.
- After the dated trips: a **Next** section, then **No date recorded** with an
  "Add a date" action.
- Play replaces the old "Replay my travels" idea.
- Needs the journal fields (#2) and the canvas map engine (#11). With multiple
  visits (#8), each visit becomes its own card and point on the route.

---

## 5. Travel Goals & Milestones
**Status:** Idea

Set personal goals and get notified when you hit them.

- Custom goals: "visit 50 countries", "explore all of South America"
- Progress bar per goal
- In-app milestone notifications/badges on completion

**Atlas v2 — milestone moments.** When a mark crosses a milestone (10, 25, 50
or 100 countries, or the first country on a new continent), the globe turns to
that country, a ring pulses, and a toast appears. Each milestone fires once and
respects reduced motion. Comes after the globe map (#12).

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

**Atlas v2 update.** The visits table carries the per-trip journal:
`(id, user_id, country_code, country_name, visit_date, place, rating, notes, tags)`.
It is backfilled from `visited_countries.visit_date`, and status stays on
`visited_countries`. The migration must be reversible and have a backfill test.
Land it on `atlas-v2` only. The detail panel gets "Add another visit".

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

## 11. Compact world map data
**Status:** Done (Atlas v2)

The map used to fetch a 14.6 MB GeoJSON from GitHub on every mount. It now
loads our own TopoJSON, built by `scripts/build-world-atlas.mjs` from the same
source pinned to a commit:

- `world-motion.topo.json` (~100 KB, ~32 KB gzipped): for spin, intro and
  morph frames
- `world-detail.topo.json` (~330 KB, ~110 KB gzipped): for the map at rest and
  when zoomed
- The files are bundled as hashed assets, fetched on first use and served with
  immutable cache headers
- Every feature keeps its original `name` and `ISO3166-1-Alpha-3` (including
  Natural Earth's `-99` codes). Saved rows still match, so no migration is
  needed. The build fails if any identity changes.
- Small islands and micro-states are kept (`keep-shapes`)

---

## 12. Globe map (desktop default) + Globe / Flat toggle
**Status:** In progress (Atlas v2). Engine, flat map and desktop globe have landed; the Globe / Flat toggle is next.

- **Engine:** d3-geo on a canvas, with orthographic for the globe, Equal Earth
  for flat, and a blended projection for the morph. It replaces Leaflet
  everywhere, including the mobile flat map (d3-zoom for pan/zoom).
  - Hit-testing: `projection.invert` + `geoContains` with a bbox prefilter.
  - Micro-states: shown as dots with a ≥24px hit area, clustered until zoomed.
  - Redraws only while moving, pauses when the tab is hidden, and respects
    `devicePixelRatio`.
  - Frame budget: about 8 ms on a mid-range laptop.
  - MapLibre was rejected: much heavier, can't morph, and we don't need street
    level.
- **Globe interactions:**
  - Drag to spin with inertia; scroll or buttons to zoom.
  - Hover shows a tooltip (name + status).
  - Clicking a country turns the globe along a great circle to face it and
    opens the detail panel. Selecting in the list or search does the same.
  - A slow idle spin pauses on hover, drag or selection.
  - Uses motion data while moving and detail data at rest.
- **Toggle:** a segmented control at the top-left of the map. Switching
  animates the globe unrolling into the flat map and back. The choice is
  remembered per user (default Globe). Flat view has pan/zoom and opens on
  "fit my countries". Both views share selection, hover, tooltip and styling.
- **Map chrome:**
  - Summary chip: "17 of 195 countries"; Show legend.
  - Palette: visited `#0B7A53`, bucket list amber hatch `#F2B24E`/`#C27A0A`,
    land `#F7F8F9`, ocean `#DCE6EE`, borders `#B4C0CC`, action blue
    `#2563EB`. This is a deliberate extension of the blue-600 / gray-50
    palette for the map only.
- **List + detail panel:**
  - Grouped visited / bucket list, with an inline status pill (covers #9) and
    keyboard navigation.
  - Inline journal with autosave and an Undo toast.
  - On mobile it becomes a bottom sheet.
- **Reduced motion:** no idle spin, no inertia, instant turns, and the toggle
  switches without the morph.

---

## 13. Startup globe intro
**Status:** Planned (Atlas v2)

Replaces the "Loading map..." state.
- A dark globe spins in, and countries light up as the data arrives (visited
  green, bucket list hatched).
- It then settles into the interactive globe. If the saved preference is Flat,
  it finishes with the unroll into the flat map.
- Plays once per session, never blocks input, and has a Skip button.
- Reduced motion shows the finished map.

---

## 14. Atlas-plate sign-in
**Status:** Planned (Atlas v2)

The signed-out first load.
- A centred globe inside a rotating instrument bezel.
- "EVERY COUNTRY YOU'VE BEEN / EVERY COUNTRY YOU'RE GOING NEXT" orbits the
  globe and fades at the bottom, as if passing behind it.
- The globe tours demo countries west to east, with map-style callouts (name,
  coordinates, status) and an "n / 195" counter.
- "So, where have you been?" and Continue with Google sit centred below.
- **Demo data only** — never a real user's.
- Fonts: Instrument Serif + JetBrains Mono, self-hosted and scoped to sign-in
  and the intro (a deliberate exception).
- Reduced motion: a still frame.

---

## Adding Ideas

When adding a new idea, include:
- What it does (1–2 sentences)
- Key sub-features or open questions
- Any data/API changes needed
