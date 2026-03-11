# CLAUDE.md — Trainer Assist

## Workflow Rules

- **Always restart backend after changes**: After modifying backend code (Rust crates), kill the running API process and restart it (`cargo run -p api` from `backend/`). Verify it's responding on port 3001.
- **Re-seed after model/seed changes**: If you changed models (`shared/src/models.rs`) or the seed pipeline (`seed/src/`), run `make seed-local` before restarting the API.
- **Do not kill Docker**: Infrastructure (Postgres, Redis) runs in Docker. Never stop Docker containers unless explicitly asked.

## Project Overview

Pokemon toolbox web app. Rust/Axum backend + Next.js frontend. Data sourced from PokeAPI CSVs, stored in Redis as denormalized JSON. Teams stored in browser localStorage. No auth.

## Architecture

- **Monorepo**: `backend/` (Cargo workspace) + `frontend/` (Next.js)
- **Backend crates**: `api` (Axum server), `seed` (data pipeline), `shared` (models + Redis keys)
- **Frontend**: Next.js 16 App Router, Tailwind CSS v4, Vitest for tests
- **Infra**: Docker Compose — Postgres 16 (:5433), Redis 7 (:6380), API (:3001), Frontend (:3000)

## Key Commands

```bash
# Docker
make up              # Start all services
make seed            # Seed Redis with Pokemon data
make down            # Stop everything

# Local dev
make infra-up        # Start Postgres + Redis
make seed-local      # Seed locally
make dev-api         # Run API
make dev-frontend    # Run frontend

# Testing
cd backend && cargo test          # 37 backend tests
cd frontend && npm test           # 42 frontend tests

# Linting
cd backend && cargo clippy
cd frontend && npm run lint
```

## Backend Structure

### Crates

- **`crates/shared/src/models.rs`** — All data models: `PokemonSummary`, `PokemonDetail`, `Stats`, `TypeRef`, `TypeEfficacy`, `MoveSummary`, `PokemonMoveRef`, `AbilityInfo` (with `is_hidden`), `LocalizedNames`
- **`crates/shared/src/redis_keys.rs`** — Redis key constants and helper functions
- **`crates/api/src/routes/`** — REST handlers: `pokemon.rs`, `types.rs`, `moves.rs`, `teams.rs` (placeholder)
- **`crates/api/src/error.rs`** — `AppError` with `not_found()` / `internal()`, implements `IntoResponse`
- **`crates/api/src/state.rs`** — `AppState` holding Redis client + PgPool
- **`crates/api/src/config.rs`** — Env config with defaults
- **`crates/seed/src/`** — Pipeline: `fetch.rs` (parallel CSV download) → `parse.rs` (CSV → structs) → `transform.rs` (joins/denormalize) → `load.rs` (Redis SET)

### API Endpoints

```
GET /api/v1/pokemon          ?offset&limit&type&type2&search&generation
GET /api/v1/pokemon/:id
GET /api/v1/types
GET /api/v1/types/efficacy
GET /api/v1/types/:id/pokemon
GET /api/v1/moves            ?search&type_id&damage_class
GET /api/v1/health
```

### Data Pipeline Notes

- **Form filtering**: `is_default=1` OR non-excluded suffix. Excluded: mega, gmax, totem, eternamax, battle-bond, ash, cosplay costumes, pikachu caps
- **Type filtering**: Excludes type IDs 19 (Stellar), 10001 (???), 10002 (Shadow)
- **Localization**: Language IDs — 9=English, 1=Japanese (ja-Hrkt), 12=Chinese Simplified
- **Ability descriptions**: Uses `ability_flavor_text.csv`, picks highest `version_group_id` per language
- **Moves**: Only level-up moves (`pokemon_move_method_id=1`), deduplicated across version groups
- **CSV source**: `raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/`
- **Sprites**: `raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png`

## Frontend Structure

### Pages (App Router)

- `/` — Home with feature cards
- `/pokemon` — Searchable grid, type filter (up to 2), pagination
- `/pokemon/[id]` — Detail: stats, abilities, moves, info
- `/types` — Type effectiveness explorer (select 1-2 types)
- `/moves` — Sortable/filterable move table
- `/team-builder` — 6-slot teams, search picker, type coverage analysis

### Key Libraries

- `src/lib/api.ts` — `fetchApi<T>()` wrapper, typed endpoint functions
- `src/lib/types.ts` — TypeScript interfaces matching Rust models
- `src/lib/team-store.ts` — localStorage CRUD for teams
- `src/lib/format.ts` — `formatPokemonId()`
- `src/lib/i18n/` — `LocaleProvider`, `useLocale()`, `localizedName()`, translations (en/ja/zh)
- `src/lib/theme/` — `ThemeProvider`, `useTheme()` — light/dark/system with localStorage persistence

### Components

- `TypeBadge` — Colored badge with SVG type icon, 3 sizes (sm/md/lg), supports `names` for i18n
- `TypeIcon` — SVG icons for all 18 Pokemon types
- `PokemonCard` — Grid card with sprite, name, types
- `StatBar` — Horizontal stat bar with color coding
- `SearchInput` — Debounced search input (300ms)
- `MobileNav` — Bottom navigation bar
- `LanguageSwitcher` — EN/JA/ZH dropdown
- `ThemeSwitcher` — Light/Dark/System dropdown
- `LoadingSpinner`, `ErrorMessage` — Status indicators

### i18n Pattern

All named entities use `LocalizedNames { en, ja?, zh? }`. The `localizedName(names, locale)` helper selects the correct language, falling back to English. UI text uses `t('key')` from `useLocale()` with parameter interpolation via `{variable}` syntax.

### Theme System

Class-based dark mode via Tailwind CSS v4 `@custom-variant dark (&:where(.dark, .dark *))`. `ThemeProvider` wraps the app, toggles `.dark` class on `<html>`. Three modes: light, dark, system (follows OS `prefers-color-scheme`). Persisted in localStorage key `trainer-assist-theme`.

### Hidden Abilities

`AbilityInfo` has `is_hidden: bool`. In the seed pipeline, `pokemon_abilities.csv` has `is_hidden` column (1 = hidden). The Pokemon detail page shows a purple "Hidden" badge next to hidden abilities.

## Testing

### Backend Tests (37 total)

Located in `crates/*/tests/` directories:
- `shared/tests/models_tests.rs` — Serialization roundtrips
- `shared/tests/redis_keys_tests.rs` — Key generation
- `seed/tests/parse_tests.rs` — CSV parsing with fixtures
- `seed/tests/transform_tests.rs` — Form filtering, type exclusion, stats, i18n, abilities, moves
- `api/tests/error_tests.rs` — HTTP status codes, JSON error bodies

### Frontend Tests (42 total)

Using Vitest + @testing-library/react + happy-dom:
- `src/lib/__tests__/format.test.ts`
- `src/lib/__tests__/team-store.test.ts`
- `src/lib/__tests__/i18n.test.ts`
- `src/lib/__tests__/api.test.ts`
- `src/hooks/__tests__/use-debounce.test.ts`
- `src/components/__tests__/StatBar.test.tsx`
- `src/lib/__tests__/theme.test.ts`

## Conventions

- **Rust**: Axum 0.8 with `Arc<AppState>`, `Result<Json<T>, AppError>` return types
- **Frontend**: `'use client'` on interactive components, `useLocale()` for i18n, all components have `dark:` Tailwind classes
- **Dark mode**: Every `bg-white` has `dark:bg-gray-800`, every `text-gray-800` has `dark:text-gray-100`, borders `dark:border-gray-700`
- **Docker ports**: Offset to avoid host conflicts (Redis 6380, Postgres 5433)
- **API prefix**: All endpoints under `/api/v1/`
- **Redis keys**: `pokemon:list`, `pokemon:{id}`, `type:list`, `type:efficacy`, `type:{id}:pokemon`, `move:list`

## Known Limitations

- Generation filtering on Pokemon list is a no-op (PokemonSummary lacks generation field)
- Teams are localStorage only (no backend persistence yet — teams.rs is a placeholder)
- No auth system
- No SSR data fetching (all pages are client-side with useEffect)
