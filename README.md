# Trainer Assist

A mobile-first Pokemon toolbox for trainers. Browse all 1200+ Pokemon (including regional variants and battle forms), explore type effectiveness, search moves, and build teams with type coverage analysis. Supports English, Japanese, and Chinese.

## Tech Stack

- **Backend:** Rust (Axum) REST API with Redis for data storage
- **Frontend:** Next.js 16 (App Router) with Tailwind CSS v4
- **Data Pipeline:** Rust binary that fetches PokeAPI CSV data, transforms it, and loads into Redis
- **Infrastructure:** Docker Compose (Postgres 16, Redis 7, API, Frontend, Seed)

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│  Next.js Frontend   │────▶│  Rust/Axum API       │
│  :3000              │     │  :3001               │
└─────────────────────┘     └──────┬────────┬──────┘
                                   │        │
                            ┌──────▼──┐  ┌──▼───────┐
                            │  Redis  │  │ Postgres  │
                            │  :6380  │  │  :5433    │
                            └─────────┘  └──────────┘
```

- **Redis** stores all Pokemon data as denormalized JSON (summaries, details, types, moves, efficacy matrix)
- **Postgres** is provisioned for future user data (teams, auth)
- **Seed binary** fetches 16 CSV files from PokeAPI GitHub, parses, transforms, and loads into Redis

## Features

| Feature | Description |
|---------|-------------|
| **Pokemon Browser** | Search, filter by type (up to 2), paginated grid with sprites |
| **Pokemon Detail** | Stats, abilities with descriptions (hidden abilities marked), moves, height/weight/generation |
| **Type Explorer** | Select 1-2 types to see defensive/offensive effectiveness + matching Pokemon |
| **Move Search** | Filterable/sortable table by name, type, damage class |
| **Team Builder** | 6-slot teams, Pokemon search picker, type coverage analysis (shared weaknesses, resistances) |
| **i18n** | English, Japanese (ja), Chinese Simplified (zh) for all UI text, Pokemon names, types, moves, abilities |
| **Theme** | Light, dark, and system (auto) theme with class-based Tailwind CSS dark mode |

## Quick Start

### Docker (recommended)

```bash
# Start all services
make up

# Seed the database (first time only)
make seed

# Open http://localhost:3000
```

### Local Development

```bash
# Start infrastructure only
make infra-up

# Seed data locally
make seed-local

# Run API and frontend (separate terminals)
make dev-api
make dev-frontend
```

### Environment

Copy `.env.example` to `.env` in the `backend/` directory:

```
REDIS_URL=redis://127.0.0.1:6380
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/trainer_assist
HOST=0.0.0.0
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

## API Endpoints

```
GET  /api/v1/health
GET  /api/v1/pokemon              ?offset=0&limit=20&type=fire&type2=flying&search=char
GET  /api/v1/pokemon/:id
GET  /api/v1/types
GET  /api/v1/types/efficacy
GET  /api/v1/types/:id/pokemon
GET  /api/v1/moves                ?search=thunder&type_id=13&damage_class=special
```

## Project Structure

```
trainer-assist/
├── backend/
│   ├── Cargo.toml                  # Workspace root
│   ├── Dockerfile
│   └── crates/
│       ├── api/                    # Axum REST API server
│       │   └── src/
│       │       ├── main.rs
│       │       ├── config.rs       # Environment config
│       │       ├── error.rs        # AppError with IntoResponse
│       │       ├── state.rs        # AppState (Redis + Postgres)
│       │       └── routes/         # pokemon, types, moves, teams
│       ├── seed/                   # Data pipeline binary
│       │   └── src/
│       │       ├── fetch.rs        # Download CSVs (parallel)
│       │       ├── parse.rs        # CSV → typed structs
│       │       ├── transform.rs    # Join/denormalize → models
│       │       └── load.rs         # Write to Redis
│       └── shared/                 # Shared models + Redis keys
│           └── src/
│               ├── models.rs       # PokemonSummary, PokemonDetail, etc.
│               └── redis_keys.rs   # Key constants + helpers
├── frontend/
│   ├── Dockerfile
│   └── src/
│       ├── app/                    # Next.js App Router pages
│       │   ├── pokemon/            # Browser + detail pages
│       │   ├── types/              # Type effectiveness explorer
│       │   ├── moves/              # Move search table
│       │   └── team-builder/       # Team builder with coverage
│       ├── components/             # TypeBadge, PokemonCard, StatBar, etc.
│       ├── hooks/                  # useDebounce, useTeam
│       └── lib/
│           ├── api.ts              # Fetch wrapper
│           ├── types.ts            # TypeScript interfaces
│           ├── team-store.ts       # localStorage persistence
│           ├── format.ts           # Formatting utilities
│           ├── i18n/               # Translations (en/ja/zh)
│           └── theme/              # ThemeProvider (light/dark/system)
├── docker-compose.yml
├── Makefile
└── .env.example
```

## Redis Data Layout

| Key | Content |
|-----|---------|
| `pokemon:list` | All `PokemonSummary[]` (id, name, names, types, sprite_url) |
| `pokemon:{id}` | Full `PokemonDetail` (stats, abilities, moves, height, weight, generation) |
| `type:list` | All `TypeRef[]` (18 standard types, no Stellar/???/Shadow) |
| `type:efficacy` | All `TypeEfficacy[]` (attacking_type_id, defending_type_id, damage_factor) |
| `type:{id}:pokemon` | `PokemonSummary[]` for that type |
| `move:list` | All `MoveSummary[]` (name, type, power, accuracy, pp, damage_class) |

## Data Pipeline

The seed binary processes PokeAPI CSV files:

1. **Fetch** — Downloads 16 CSV files in parallel from `raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/`
2. **Parse** — Deserializes into typed Rust structs with `csv` + `serde`
3. **Transform** — Joins tables, builds localized names (en/ja/zh), filters forms (excludes mega/gmax/totem/cosmetic, includes regionals/battle forms), excludes non-standard types (Stellar, ???, Shadow)
4. **Load** — Writes denormalized JSON to Redis

## Testing

```bash
# Backend (37 tests)
cd backend && cargo test

# Frontend (42 tests)
cd frontend && npm test
```

### Backend Test Coverage

| Suite | Tests | What's tested |
|-------|-------|---------------|
| `shared/models` | 7 | Serialization roundtrips, skip-none fields, null optionals |
| `shared/redis_keys` | 6 | Key constants and dynamic key generation |
| `seed/parse` | 4 | CSV parsing, empty/missing CSV handling |
| `seed/transform` | 15 | Form filtering, excluded types, stats, localized names, abilities, moves, efficacy |
| `api/error` | 5 | HTTP status codes, JSON error bodies, error conversions |

### Frontend Test Coverage

| Suite | Tests | What's tested |
|-------|-------|---------------|
| `format` | 5 | Pokemon ID padding |
| `team-store` | 10 | localStorage CRUD, corrupted JSON, create/update/delete |
| `i18n` | 7 | Locale selection, fallback to English |
| `api` | 5 | URL construction, query params, error handling |
| `use-debounce` | 3 | Initial value, delayed update, timer reset |
| `StatBar` | 5 | Rendering, bar width calculation, custom color |
| `theme` | 7 | Theme defaults, localStorage persistence, system preference, resolved theme |

## Make Targets

| Target | Description |
|--------|-------------|
| `make up` | Start all services with Docker |
| `make down` | Stop all services |
| `make seed` | Run data pipeline in Docker |
| `make logs` | Follow Docker logs |
| `make infra-up` | Start Postgres + Redis only |
| `make dev-api` | Run API locally |
| `make dev-frontend` | Run frontend locally |
| `make dev` | Run API + frontend locally |
| `make seed-local` | Run seed pipeline locally |
| `make clippy` | Run Rust linter |
| `make test` | Run backend tests |

## Port Mapping

| Service | Host Port | Container Port |
|---------|-----------|----------------|
| Frontend | 3000 | 3000 |
| API | 3001 | 3001 |
| Redis | 6380 | 6379 |
| Postgres | 5433 | 5432 |

Ports are offset to avoid conflicts with local services.
