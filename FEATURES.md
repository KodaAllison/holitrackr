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
**Status:** Idea

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

## Adding Ideas

When adding a new idea, include:
- What it does (1–2 sentences)
- Key sub-features or open questions
- Any data/API changes needed
