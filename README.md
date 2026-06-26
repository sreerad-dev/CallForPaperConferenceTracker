# 📅 Call for Papers Conference Tracker

A personal CFP (Call for Papers) dashboard for researchers in **Data Engineering, AI, and Large-Scale Systems**. Aggregates submission deadlines from multiple upstream sources, auto-refreshes twice a week, and surfaces upcoming deadlines, venue rankings, and rolling submission cycles in a clean React UI.

![CFP Tracker](src/assets/hero.png)

---

## Features

- **Deadline tracking** across 50+ conferences and workshops
- **Urgency highlighting** — deadlines within 30 days surfaced prominently
- **CORE rankings** — A\*, A, B, and unranked venues clearly labelled
- **Rolling submissions** — dedicated view for VLDB, SIGMOD, PETS, ACL ARR and similar venues
- **Research area filters** — Data Engineering · Distributed Systems · ML Systems · NLP · AI Security · Cloud · Software Engineering · Programming Languages · and more
- **Charts** — visual breakdown by ranking, area, and format
- **Auto-refresh** — scraper runs automatically every Monday and Thursday
- **Manual scrape** — "Scrape Now" button in the UI triggers an on-demand refresh
- **HMR** — dev server live-reloads when the data file changes

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8 |
| Styling | Tailwind CSS v4 |
| Table | TanStack Table v8 |
| Charts | Recharts |
| Icons | Lucide React |
| Scraper | Node.js + TypeScript (`tsx`) |
| Data sources | [ai-deadlines](https://github.com/paperswithcode/ai-deadlines) · [ccf-deadlines](https://github.com/ccfddl/ccf-deadlines) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Git (used by the setup script to clone data repos)

### 1. Install dependencies

```bash
npm install
```

### 2. Clone the data repos

This pulls the two upstream conference deadline repos into `server/data/repos/`:

```bash
npm run setup
```

### 3. Generate the data file

Runs the scraper pipeline and writes `public/cfp-tracker.md`:

```bash
npm run scrape
```

### 4. Start the dev server

```bash
npm run dev
```

The app is now available at `http://localhost:5173`.

---

## How It Works

```
npm run setup
    └── clones ai-deadlines + ccf-deadlines repos locally

npm run scrape
    └── server/scraper/pipeline.ts
            ├── loads YAML from ai-deadlines (AI/ML venues)
            ├── loads YAML from ccf-deadlines (systems, DB, security)
            ├── resolves deadlines, normalises CORE rankings
            ├── computes isUpcoming / isPassed / isRolling flags
            └── renders cfp-tracker.md → public/cfp-tracker.md

Vite dev server (vite.config.ts)
    ├── serves GET  /api/cfp-tracker.md
    ├── serves POST /api/refresh  (triggers manual scrape)
    ├── serves GET  /api/refresh-status
    ├── starts Mon/Thu auto-refresh scheduler
    └── watches cfp-tracker.md → triggers HMR on change

React app
    └── useCfpData hook fetches /api/cfp-tracker.md
            └── parseMarkdown.ts → Conference[]
```

---

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── Charts.tsx           # Breakdown charts by ranking/area/format
│   │   ├── ConferenceTable.tsx  # Sortable/filterable full table
│   │   ├── DeadlineBadge.tsx    # Urgency badge (days remaining)
│   │   ├── RankingBadge.tsx     # CORE ranking badge (A*, A, B …)
│   │   ├── RollingPanel.tsx     # Rolling submission venues view
│   │   └── UpcomingPanel.tsx    # Deadlines within 30 days
│   ├── hooks/
│   │   └── useCfpData.ts        # Fetch + parse cfp-tracker.md
│   ├── utils/
│   │   └── parseMarkdown.ts     # Markdown table → Conference[]
│   ├── types.ts                 # Conference, RollingVenue, enums
│   └── App.tsx                  # Root component, tabs, header
│
├── server/
│   ├── scraper/
│   │   ├── index.ts             # Entry point (runScraper)
│   │   ├── pipeline.ts          # Core scraping + merging logic
│   │   ├── renderer.ts          # Renders Conference[] → Markdown
│   │   ├── deadlines.ts         # Deadline resolution utilities
│   │   └── types.ts             # ConferenceRecord, RollingVenueRecord
│   ├── sources/
│   │   ├── aideadlines.ts       # Parses ai-deadlines YAML
│   │   └── ccfdeadlines.ts      # Parses ccf-deadlines YAML
│   └── scheduler.ts             # Mon/Thu auto-refresh + /api/refresh
│
├── scripts/
│   └── setup.js                 # Clones upstream data repos
│
├── public/
│   └── cfp-tracker.md           # Generated data file (gitignored)
│
└── vite.config.ts               # Vite plugin: API routes + scheduler
```

---

## npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with API routes and scheduler |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview the production build |
| `npm run setup` | Clone / update the upstream deadline repos |
| `npm run scrape` | Run the scraper and regenerate `cfp-tracker.md` |
| `npm run lint` | Run ESLint |

---

## Data Sources

| Source | Coverage |
|---|---|
| [paperswithcode/ai-deadlines](https://github.com/paperswithcode/ai-deadlines) | ~200 AI/ML venues |
| [ccfddl/ccf-deadlines](https://github.com/ccfddl/ccf-deadlines) | Systems, databases, security, networking |
| Official conference websites | Manually curated entries in `server/scraper/pipeline.ts` |

The cloned repos live in `server/data/repos/` (gitignored) and are updated automatically on each scrape run.

---

## Research Areas

Data Engineering · Distributed Systems · ML Systems · LLM Infrastructure · NLP · AI & Cyber Security · Privacy Engineering · Cloud Computing · Big Data · Database Systems · RAG & Knowledge Graphs · MLOps · Streaming Systems · Observability & Reliability · Information Retrieval · Software Engineering · Programming Languages

---

## Auto-Refresh Schedule

The scheduler (`server/scheduler.ts`) runs inside the Vite dev server process:

- **Automatic** — triggers a full scrape every **Monday** and **Thursday**
- **Manual** — click "Scrape Now" in the UI, or `POST /api/refresh`
- **State** — last refresh date persisted to `server/data/scheduler-state.json` to avoid duplicate runs across hot-reloads

---

## License

MIT
