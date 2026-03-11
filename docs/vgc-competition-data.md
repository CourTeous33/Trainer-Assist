# VGC Competition Data — Research & Implementation Plan

## Goal

Add official Pokemon VGC (Video Game Championships, doubles format) competition data to Trainer Assist. Show per-Pokemon tournament stats (appearances, placements) on detail pages, with ruleset/regulation info.

---

## Data Sources

### Official

- **[Pokemon.com Championship Series Results](https://www.pokemon.com/us/play-pokemon/pokemon-events/championship-series-event-results)** — Only truly official source. HTML pages listing event results for 2016–2026 with top placements and team lists for Worlds/Internationals. No API — requires scraping.

### Community (Structured Data)

| Source | URL | Data Available | Format | Notes |
|--------|-----|----------------|--------|-------|
| Pokedata.ovh | https://www.pokedata.ovh/standingsVGC/ | Standings, team sheets, pairings | JSON | Aggregates RK9 data. Best structured source. |
| vgc-standings (GitHub) | https://github.com/mikewVGC/vgc-standings | Standings, pairings, team sheets, stats | JSON | Consumes Pokedata.ovh JSON. Shows data structure. |
| RK9.gg | https://rk9.gg/events/pokemon | Pairings, standings, team sheets | HTML | Official tournament software. No public API. |
| Limitless VGC | https://limitlessvgc.com/ | Team lists, usage rankings, tournament history | HTML | No documented API. Has usage stats at /pokemon. |
| Victory Road | https://victoryroad.pro/ | Event results, team reports | HTML | Coverage site. |

### Recommended Approach

Use **Pokedata.ovh** as primary data source (already JSON). Supplement with **Pokemon.com** for official Worlds/Internationals team lists if needed.

---

## Data Model

### Tournament

```jsonc
// data/vgc/tournaments.json
[
  {
    "id": "2024-worlds",
    "name": "2024 Pokemon World Championships",
    "date": "2024-08-16",
    "region": "international",     // "regional", "international", "worlds"
    "regulation": "reg-g",
    "players": 450,
    "top_cut": [
      {
        "placement": 1,            // 1=champion, 2=finalist, 3-4=top4, 5-8=top8
        "player": "PlayerName",
        "pokemon_ids": [25, 898, 382, ...]  // species_ids of team
      }
    ]
  }
]
```

### Regulation / Ruleset

```jsonc
// data/vgc/regulations.json
[
  {
    "id": "reg-g",
    "name": "Regulation G",
    "series": "2024",
    "description": "All Pokemon from Paldea Pokedex + select returning Pokemon",
    "allowed_pokemon": [1, 2, 3, ...],   // species_ids, null = national dex
    "restricted_pokemon": [150, 249, ...],
    "restricted_count": 2,               // max restricted legends per team
    "start_date": "2024-01-01",
    "end_date": "2024-12-31"
  }
]
```

### Per-Pokemon Stats (Computed)

```jsonc
// Derived at seed/query time, stored in Redis as vgc:pokemon:{species_id}
{
  "species_id": 898,
  "total_appearances": 42,
  "champion": 5,
  "top2": 8,
  "top4": 15,
  "top8": 42,
  "by_regulation": {
    "reg-g": { "champion": 3, "top2": 5, "top4": 10, "top8": 25 },
    "reg-f": { "champion": 2, "top2": 3, "top4": 5, "top8": 17 }
  }
}
```

---

## Architecture

```
crawler (Python)  -->  data/vgc/*.json (committed to repo)
                            |
seed binary       -->  reads JSON --> loads Redis
                            |         - vgc:tournaments (list)
                            |         - vgc:pokemon:{species_id} (computed stats)
                            |         - vgc:regulations (list)
                            |
Rust API          -->  GET /api/v1/vgc/pokemon/:id
                       GET /api/v1/vgc/tournaments?regulation=reg-g
                       GET /api/v1/vgc/regulations
                            |
Next.js           -->  Pokemon detail page: VGC stats section
                       (future) Dedicated /vgc page with tournament browser
```

### Why JSON files in repo?

- Simple, versionable, reviewable via PR
- No extra database or storage service needed
- Seed binary already reads static data — same pattern as PokeAPI CSVs
- Easy to manually edit/fix data

---

## Crawler Design

### Language: Python

Web scraping is significantly easier in Python (requests + BeautifulSoup) than Rust.

### Location: `scripts/crawl_vgc.py`

### Behavior

1. Fetch tournament list from Pokedata.ovh JSON endpoints
2. For each tournament, fetch standings and team sheets
3. Map Pokemon names/forms to species_ids (using PokeAPI data already in repo)
4. Output `data/vgc/tournaments.json` and `data/vgc/regulations.json`
5. Idempotent — re-running updates existing data without duplicates

### Dependencies

```
requests
beautifulsoup4  # if scraping HTML fallbacks
```

---

## GitHub Actions Workflow

```yaml
# .github/workflows/update-vgc.yml
name: Update VGC Data

on:
  workflow_dispatch:        # manual trigger in GitHub UI
    inputs:
      season:
        description: 'Season to crawl (e.g. 2024, 2025, all)'
        required: false
        default: 'all'

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: pip install requests beautifulsoup4

      - name: Run VGC crawler
        run: python scripts/crawl_vgc.py --season ${{ github.event.inputs.season }}

      - name: Create PR with updated data
        uses: peter-evans/create-pull-request@v6
        with:
          title: 'Update VGC tournament data'
          branch: update-vgc-data
          commit-message: 'chore: update VGC tournament data'
          body: |
            Automated update of VGC tournament data.
            Triggered manually via GitHub Actions.
```

---

## Backend Changes

### New Rust Models (`shared/src/models.rs`)

```rust
pub struct VgcTournament {
    pub id: String,
    pub name: String,
    pub date: String,
    pub region: String,
    pub regulation: String,
    pub players: u32,
    pub top_cut: Vec<VgcPlacement>,
}

pub struct VgcPlacement {
    pub placement: u32,
    pub player: String,
    pub pokemon_ids: Vec<i32>,  // species_ids
}

pub struct VgcRegulation {
    pub id: String,
    pub name: String,
    pub series: String,
    pub description: String,
    pub allowed_pokemon: Option<Vec<i32>>,
    pub restricted_pokemon: Vec<i32>,
    pub restricted_count: u32,
    pub start_date: String,
    pub end_date: String,
}

pub struct VgcPokemonStats {
    pub species_id: i32,
    pub total_appearances: u32,
    pub champion: u32,
    pub top2: u32,
    pub top4: u32,
    pub top8: u32,
    pub by_regulation: HashMap<String, VgcPlacementCounts>,
}

pub struct VgcPlacementCounts {
    pub champion: u32,
    pub top2: u32,
    pub top4: u32,
    pub top8: u32,
}
```

### New Redis Keys (`shared/src/redis_keys.rs`)

```
vgc:tournaments     — JSON array of all tournaments
vgc:regulations     — JSON array of all regulations
vgc:pokemon:{id}    — VgcPokemonStats for a species
```

### New API Routes (`api/src/routes/vgc.rs`)

```
GET /api/v1/vgc/pokemon/:id       — VGC stats for a Pokemon
GET /api/v1/vgc/tournaments       — Tournament list (?regulation=reg-g)
GET /api/v1/vgc/regulations       — All regulations
```

### Seed Extension

Add to `seed/src/main.rs`:
1. Read `data/vgc/tournaments.json` and `data/vgc/regulations.json`
2. Compute per-Pokemon VGC stats from tournament top_cut data
3. Write to Redis keys above

---

## Frontend Changes

### Pokemon Detail Page (`/pokemon/[id]`)

Add a "VGC Stats" section showing:
- Total tournament appearances
- Placement breakdown: Champion / Top 2 / Top 4 / Top 8
- Breakdown by regulation (collapsible)

### Future: `/vgc` Page

- Tournament browser with regulation filter
- Top Pokemon usage rankings per regulation
- Tournament detail view with full team lists

---

## Implementation Phases

### Phase 1: Crawler + Data Files
1. Create `scripts/crawl_vgc.py`
2. Inspect Pokedata.ovh JSON structure
3. Output `data/vgc/tournaments.json` and `data/vgc/regulations.json`
4. Add `.github/workflows/update-vgc.yml`

### Phase 2: Backend Integration
1. Add VGC models to `shared/src/models.rs`
2. Add Redis keys to `shared/src/redis_keys.rs`
3. Extend seed to load VGC data into Redis
4. Add `/api/v1/vgc/` routes

### Phase 3: Frontend
1. Add VGC stats section to Pokemon detail page
2. Create API functions in `lib/api.ts`
3. Add i18n translations for VGC labels

### Phase 4: Polish
1. Dedicated `/vgc` page with tournament browser
2. Usage ranking charts
3. Regulation detail view (which Pokemon are allowed)
