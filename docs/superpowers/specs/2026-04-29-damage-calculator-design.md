# Damage Calculator — Design

**Date:** 2026-04-29
**Status:** Approved (design phase); ready for implementation plan
**Scope:** New `/calc` page and `frontend/src/lib/calc/` engine. One backend change to broaden form whitelist in the seed pipeline.

## Goal

Ship a Pokemon damage calculator that, given an attacker (species or custom), a defender (species or custom), level/EV/IV/nature/item config, and up to 4 attacker moves, computes the % of defender HP each move deals and the probability of OHKO/2HKO/3HKO. v1 is the "core" calc — STAB, type effectiveness, EVs/IVs/nature, items. Crits, status, screens, weather, terrain, and abilities are **out of scope for v1** and tracked separately as B/C scope.

The page supports two EV input modes:
- **Traditional** — standard EVs (0–252 per stat, 510 total), IVs visible (default 31), level user-controlled (default 50).
- **Champion** — modeled after a newer Pokemon game's allocation system: 66 total EVs, 32 cap per stat, level locked at 50, IVs locked at 31. Nature still applies.

## Non-goals (v1)

- Crits, burn, screens (Reflect/Light Screen/Aurora Veil), weather (Sun/Rain), terrain — **B scope**.
- Abilities, multi-hit moves, fixed-damage moves (Seismic Toss, Night Shade), variable-power moves (Gyro Ball, Low Kick, Return), OHKO moves (Fissure) — **C scope**.
- Backend persistence of calc state. URL-encoded state only.
- Saving calc setups to localStorage or to the existing `Team` model. Sharing happens via URL.
- Loading attacker/defender directly from a saved team. Re-evaluate after Team model gains EV/IV/nature/item/move fields, which is its own project.

## Approach summary

- **Calc engine in TypeScript**, in `frontend/src/lib/calc/`. Pure functions, no React. Vitest-tested against Showdown's golden numbers.
- **Backend change is data-only**: broaden the seed pipeline's form whitelist to include megas, primals, and Gmax forms. No new endpoints, no model changes.
- **State held in `useReducer`** on the page; URL-encoded via a single `?s=<base64>` query param so calc setups are bookmarkable and shareable.
- **Live updates**: every input change recomputes synchronously. No debouncing of the calc itself; only the URL sync is debounced.

## Backend & data pipeline

The only backend change for v1 is broadening the form whitelist in `crates/seed/src/transform.rs`.

**Before:** filter excludes `mega`, `mega-x`, `mega-y`, `gmax`, `primal`, `totem`, `eternamax`, `battle-bond`, `ash`, Pikachu cosplay/cap forms.

**After:** filter includes `default`, `-mega`, `-mega-x`, `-mega-y`, `-primal`, `-gmax`. Still excludes totem, eternamax, battle-bond, ash, Pikachu cosplay/caps, and other event/cosmetic forms.

Roughly +70 entries (~50 megas, 2 primals, ~30 Gmax). Each is a separate Pokemon with its own `id` but shares `species_id` with the base form. Existing `(species_id, id)` sort order groups them after the base form correctly.

**Re-seed required:** `make seed-local` after the filter change.

**Tests** (`seed/tests/transform_tests.rs`):
- Charizard-Mega-X is included with Charizard's `species_id`.
- Kyogre-Primal is included with Kyogre's `species_id`.
- A Gmax form (e.g., the first one alphabetically that exists in the CSV fixtures) is included.
- Pikachu-Cap forms, totem forms, and Eternamax-Eternatus remain excluded.
- Sort order: assertion that Charizard-Mega-X appears immediately after Charizard.

**No new endpoints. No schema changes. No new Redis keys.** The calc consumes existing endpoints:
- `GET /api/v1/pokemon` (list, now with megas/primals/Gmax)
- `GET /api/v1/pokemon/:id`
- `GET /api/v1/types`
- `GET /api/v1/types/efficacy`
- `GET /api/v1/moves` (already filterable by `type_id` and `damage_class`)

## Calc engine — `frontend/src/lib/calc/`

**Module layout:**

```
src/lib/calc/
├── index.ts          # public surface: calculateDamage(), calculateKO()
├── stats.ts          # EV/IV/nature/level → final stat (both modes)
├── damage.ts         # main damage formula, returns 16 rolls
├── ko.ts             # roll distribution → OHKO/2HKO/3HKO probabilities
├── natures.ts        # 25-nature table: name + boosted/lowered stat
├── items.ts          # held-item table (full list, ranked by usefulness)
├── url.ts            # serializeState / deserializeState
├── types.ts          # CalcInput, CalcResult, EVMode, etc.
└── __tests__/
```

### Stat formula (`stats.ts`)

Standard Gen 3+ formula, used identically for both modes:

- HP: `floor((2*base + iv + floor(ev/4)) * level / 100) + level + 10`
- Other: `floor((floor((2*base + iv + floor(ev/4)) * level / 100) + 5) * nature)`

Where `nature ∈ {0.9, 1.0, 1.1}`. The boosted/lowered stat comes from the 25-nature table.

**Champion mode uses the same formula** but enforces `level=50`, `iv=31`, EV cap = 32 per stat / 66 total. The smaller per-stat EV cap is what limits Champion's stat swing; the formula itself is unchanged. If the actual game uses a different formula in practice, override `evToStatContribution()` in one place.

### Damage formula (`damage.ts`)

Gen 5+ standard:

```
base   = floor( floor( (2*L/5 + 2) * P * A / D ) / 50 ) + 2
final  = floor( base * stab * type_eff * item * roll )    for roll in 0.85..1.00 (16 ints)
```

Where:
- `L` = attacker level
- `P` = move power
- `A` = attacker's Attack (physical) or Special Attack (special)
- `D` = defender's Defense (physical) or Special Defense (special)
- `stab` = `1.5` if move type ∈ attacker's types (after type override), else `1.0`
- `type_eff` = product of `TypeEfficacy` lookups for the move type vs each defender type
- `item` = the held-item multiplier from `items.ts`
- `roll` = 0.85, 0.86, …, 1.00 (16 values from the in-game integer roll)

Returns the 16-integer roll array. Modifiers are applied left-to-right as a product over an explicit ordered list — additional modifiers slot into that list later for B/C without rewriting the formula.

### KO probability (`ko.ts`)

- **OHKO%** = `(rolls ≥ defender_hp).count / 16`
- **2HKO%** — convolve the 16-roll distribution with itself (16² = 256 outcomes); `2HKO% = P(sum of 2 rolls ≥ hp)`.
- **3HKO%** — convolve again (16³ = 4096 outcomes).

Output also includes a verbal qualifier: `"guaranteed OHKO"` (P=1), `"possible OHKO"` (0<P<1), `"guaranteed 2HKO"`, etc. Matches Showdown's phrasing for the at-a-glance read.

### Public API

```ts
type EVMode = 'traditional' | 'champion';

interface PokemonConfig {
  pokemonId: number;
  baseStatsOverride: Stats | null;     // null = use species base stats
  typesOverride: number[] | null;       // null = use species types; 1 or 2 type IDs
  level: number;                        // locked to 50 in champion mode
  ivs: Stats;                           // locked to 31s in champion mode
  evs: Stats;
  nature: NatureId;
  itemId: ItemId | null;
}

interface CalcInput {
  evMode: EVMode;
  attacker: PokemonConfig;
  defender: PokemonConfig;
  move: MoveSummary;
}

interface CalcResult {
  rolls: number[];           // 16 ints
  defenderHp: number;
  minPct: number;
  maxPct: number;
  avgPct: number;
  ohkoPct: number;
  twoHkoPct: number;
  threeHkoPct: number;
  qualifier: string;         // "guaranteed 2HKO", etc.
  modifiers: {               // breakdown for "show details" panel
    stab: number;
    typeEff: number;
    item: number;
  };
  attackerStat: number;      // computed Atk or SpA used
  defenderStat: number;      // computed Def or SpD used
  // null result for unsupported moves
  unsupportedReason?: 'fixed-damage' | 'variable-power' | 'multi-hit' | 'ohko-move' | 'no-power';
}

calculateDamage(input: CalcInput): CalcResult | { unsupportedReason: ... }
```

### Unsupported moves

Moves with `power: null` (status moves), or that fall under fixed-damage / variable-power / multi-hit / OHKO categories, return a result with `unsupportedReason` set. The UI shows "Not supported in v1" in the result card rather than guessing or showing a wrong number. This is the seam where C scope plugs in later.

## State & URL encoding

**Component-level state** lives in the `/calc` page using `useReducer`. One reducer, action types like `SET_ATTACKER`, `SET_EV`, `SET_MOVE`, `OVERRIDE_BASE_STATS`, `TOGGLE_EV_MODE`, etc.

### State shape (`CalcState`)

```ts
interface CalcState {
  evMode: 'traditional' | 'champion';
  attacker: {
    pokemonId: number;
    baseStatsOverride: Stats | null;
    typesOverride: number[] | null;
    level: number;
    ivs: Stats;
    evs: Stats;
    nature: NatureId;
    itemId: ItemId | null;
    moveIds: [number | null, number | null, number | null, number | null];
  };
  defender: {
    pokemonId: number;
    baseStatsOverride: Stats | null;
    typesOverride: number[] | null;
    level: number;
    ivs: Stats;
    evs: Stats;
    nature: NatureId;
    itemId: ItemId | null;
  };
}
```

### URL encoding

- One query param: `?s=<base64-encoded-compact-json>`. Compact JSON uses short keys (e.g., `{v:1,m:'t',a:{p:6,...},d:{p:1,...}}`) to keep URLs ~140 chars for a fully specified calc.
- `serializeState(state) → string` and `deserializeState(string) → state` in `src/lib/calc/url.ts`.
- Page-level `useEffect` syncs reducer state → URL via `router.replace` with **300ms debounce**, so typing doesn't spam history entries.
- On mount, parse `?s=` if present and hydrate the reducer; otherwise sensible defaults (Lv50, 0 EVs, 31 IVs, neutral nature, no item, no overrides, no moves selected, default attacker/defender Pokemon — pick something common like Pikachu vs. Charizard for first paint).
- Versioning: include `v: 1` so the format can evolve without breaking shared v1 links.

### Defaults and validation on deserialize

UI-only state (e.g., "show details" reveal) is **not** serialized.

`deserializeState` handles:
- Unknown Pokemon ID → fall back to default attacker/defender, surface a non-fatal toast.
- Out-of-range numbers (level 999, EV 9999) → clamp to legal ranges silently.
- Champion-mode invariants (level≠50, IVs≠31, EV total>66, any EV>32) → clamp/correct on load and silently fix.
- Malformed/corrupt base64 → ignore the param, start with defaults.

## Page layout & components

**Route:** `frontend/src/app/calc/page.tsx`. Added to `MobileNav` and any header nav alongside `/team-builder`. Home page (`app/page.tsx`) gets a new feature card linking to `/calc`.

### Layout — desktop (≥md)

```
┌──────────────────────────────────────────────────────────────────┐
│  Damage Calculator                          [Traditional|Champion]│
├────────────────────────────────┬─────────────────────────────────┤
│  ATTACKER                      │  DEFENDER                       │
│  PokemonPicker                 │  PokemonPicker                  │
│  sprite/name/types             │  sprite/name/types              │
│  [Override base ▾]             │  [Override base ▾]              │
│  EVStatTable                   │  EVStatTable                    │
│  ItemDropdown                  │  ItemDropdown                   │
│  Moves: [1][2][3][4]           │                                 │
├────────────────────────────────┴─────────────────────────────────┤
│  RESULTS                                                          │
│  [DamageResultCard ×4]                                            │
└──────────────────────────────────────────────────────────────────┘
```

### Layout — mobile (<md)

Vertical stack — Attacker → Defender → 4 result cards. EV mode toggle stays sticky at top.

### New components (in `frontend/src/components/`)

| Component | Responsibility |
|---|---|
| `PokemonPicker` | Search + 18 type icon filters (`TypeKeypad`-style). Shows results including megas/primals/Gmax. Selecting fills the attacker or defender slot. |
| `BaseStatOverridePanel` | Collapsible panel under Pokemon header. Inputs for 6 base stats + 1–2 type pickers. "Reset to species" button. Shows a "Custom" badge in the Pokemon header when active. |
| `EVStatTable` | 6-row grid: stat name, base, IV, EV, final. EV inputs are number+stepper. Nature dropdown above the table. Level input above. Total-EV counter (`X / 510` or `X / 66`) with red border when exceeded. |
| `NatureDropdown` | 25 natures with "+SpA −Atk" style sublabel. Defaults to neutral (Hardy). |
| `ItemDropdown` | Sectioned by usefulness rank (Top Tier → Type-boost → Other). Each row: icon, name, multiplier note. Searchable. |
| `MoveSlot` | Empty: "Tap to add". Filled: type icon, name, category icon, power. Click → opens `MovePicker`. |
| `MovePicker` | Modal. Search input + 18 type icon filter row + 3 category icon filter (physical/special/status). List filtered to attacker's known moves only. |
| `DamageResultCard` | Move header + horizontal range bar (color-coded by % HP) + `min%–max% (avg)` + `OHKO X% · 2HKO Y% · 3HKO Z%` + qualifier text + "Show details ▾" reveal (rolls, modifier breakdown). |
| `DamageRangeBar` | Visual % HP bar. ≥100% = red full, partial = colored fill. |
| `EVModeToggle` | Two-button segmented control. On switch, runs invariant fixups (clamp EVs, lock IVs to 31 / level to 50 in Champion). |

### Reused components

`TypeBadge`, `TypeIcon`, `SearchInput`, `LoadingSpinner`, `ErrorMessage`, `StatBar` (for displaying computed stats), `WikiLink` (Pokemon and move names), `useDebounce`.

### i18n

- New translation keys for all calc UI strings added to `src/lib/i18n/translations.ts` (en/ja/zh).
- All Pokemon/move/type names continue to use `localizedName()`.
- Item names and nature names get `LocalizedNames` shapes (en/ja/zh) in `items.ts` and `natures.ts`.

### Theme

Every new component has `dark:` variants per the existing convention in `CLAUDE.md` (`bg-white` ↔ `dark:bg-gray-800`, etc.). Damage range bar colors picked to work on both themes.

### Item table

Full list of damage-affecting held items, ranked by usefulness:

- **Top tier (always-on big multipliers):** Life Orb (×1.3), Choice Band (×1.5 physical Atk), Choice Specs (×1.5 special Atk), Expert Belt (×1.2 on super-effective only), Muscle Band (×1.1 physical), Wise Glasses (×1.1 special).
- **Type-boost (×1.2 to one type):** Charcoal (Fire), Mystic Water (Water), Miracle Seed (Grass), Magnet (Electric), Black Belt (Fighting), Sharp Beak (Flying), Poison Barb (Poison), Soft Sand (Ground), Hard Stone (Rock), Silver Powder (Bug), Spell Tag (Ghost), Dragon Fang (Dragon), Black Glasses (Dark), Metal Coat (Steel), Twisted Spoon (Psychic), Never-Melt Ice (Ice), Pixie Plate (Fairy), Silk Scarf (Normal).
- **Other situational:** Light Ball (Pikachu only, ×2 Atk and SpA), Thick Club (Cubone/Marowak, ×2 Atk), Soul Dew (Latias/Latios, ×1.5 SpA on Dragon/Psychic), Metronome — **excluded** (requires multi-turn state).

Items requiring triggered or stateful effects (Weakness Policy, Throat Spray, Adrenaline Orb, Air Balloon) are **excluded from v1**. Adding them is a B/C task because they require state outside the per-hit calc.

## Testing

### Backend (cargo test)

Add to `seed/tests/transform_tests.rs`:
- Charizard-Mega-X is included with Charizard's `species_id`.
- Kyogre-Primal is included.
- A Gmax form actually present in CSV fixtures is included.
- Pikachu-Cap, totem, eternamax, battle-bond remain excluded.
- Sort order: Charizard-Mega-X immediately follows Charizard in `pokemon:list`.

### Frontend — calc engine unit tests (`src/lib/calc/__tests__/`)

- `stats.test.ts`:
  - Lv50 Garchomp 252 Atk EV / 31 IV / Adamant nature → 200 Atk (Showdown canonical).
  - Lv50 Blissey 252 HP EV / 31 IV → 362 HP.
  - Lv100 Pikachu 0 EV / 31 IV / neutral nature → expected stats hand-computed.
  - Champion mode: Lv50, 32 Atk EV, 31 IV, Adamant → expected stat (hand-computed).
  - Nature multiplier applied last; matches in-game flooring order.
- `damage.test.ts`:
  - Mega Garchomp Earthquake (252+ Atk Adamant) vs 252/0 Garchomp → match Showdown's roll array.
  - 252 SpA Choice Specs Latios Draco Meteor vs 252 HP Blissey → match.
  - STAB on/off path.
  - Type effectiveness: ×2, ×0.25 (double resist), ×0 (immunity → 0 damage).
  - Item multipliers: Life Orb ×1.3 final, Choice Band ×1.5 on physical Atk, Expert Belt only on super-effective.
  - Override path: setting `baseStatsOverride` produces the same numbers as if the species had those base stats natively.
- `ko.test.ts`:
  - All-rolls-kill case → OHKO 100%, qualifier "guaranteed OHKO".
  - No-rolls-kill case → OHKO 0%.
  - Partial OHKO → matches `(rolls ≥ hp).count / 16` exactly.
  - 2HKO convolution: when `min_roll × 2 ≥ hp`, 2HKO is 100%.
  - Qualifier text correct for each band.
- `url.test.ts`:
  - Roundtrip: `deserialize(serialize(state))` deep-equals `state`.
  - Malformed base64 → returns defaults, doesn't throw.
  - Out-of-range numbers clamp on deserialize.
  - Champion-mode invariants enforced on load.
  - `v: 1` field present in serialized output.
- `natures.test.ts`, `items.test.ts`: shape sanity (25 natures, no duplicates, neutral natures multiplier 1.0; every item has a multiplier and `LocalizedNames`).

### Frontend — component tests (`src/components/__tests__/`)

- `EVStatTable.test.tsx` — typing in EV input updates state; total counter goes red over 510/66; Champion-mode locks IV inputs and shows the locked indicator.
- `MovePicker.test.tsx` — type filter narrows list; category filter narrows list; both filters compose; clearing returns full list.
- `DamageResultCard.test.tsx` — given a known `CalcResult`, renders correct min/max/avg/KO%; "Show details" toggle reveals the rolls.
- `EVModeToggle.test.tsx` — switching to Champion clamps a stale 252 EV down to 32 and locks level to 50.

### Frontend — page smoke test

- `calc-page.test.tsx`: mount `/calc` with mocked API responses, set attacker/defender/move, verify a result card renders with non-zero damage. One happy-path flow only.

### Coverage target

Calc engine near-100% (it's pure functions). Components match the existing repo's coverage approach (test behavior, not implementation).

## Forward compatibility (B/C scope)

The v1 surface is shaped so B and C are **pure additions**, not rewrites.

### B scope (crit / burn / screens / weather)

- `CalcInput` gains a `modifiers` object: `{ crit, isBurned, screens: { reflect, lightScreen, auroraVeil }, weather }`.
- `damage.ts` runs modifiers as a left-to-right product over an ordered list. New modifiers slot into that list — no formula rewrite.
- URL state version bumps to `v: 2`; `migrateV1ToV2()` fills new fields with neutral defaults so v1 links keep working.
- New UI: a "Conditions" panel under each Pokemon's stats (burn, screens, weather, crit toggle). New translation keys. No restructuring of the existing layout.

### C scope (abilities / terrain / multi-hit / fixed-damage / OHKO moves)

- Abilities: `PokemonConfig.abilityId` drives a new `abilities.ts` table whose entries register modifier hooks at known points (`onAttacker`, `onDefender`, `onMove`). Static dispatch — a switch over a finite enum.
- Terrain: same panel as B's weather.
- Multi-hit: `damage.ts` returns `rolls × hits` (or a hits-distribution for variable-hit moves like Bullet Seed). KO calc convolves over that distribution the same way it does today for 2HKO/3HKO.
- Fixed-damage / OHKO moves: today these return `unsupportedReason`; C replaces with a fixed result (`Seismic Toss → attacker.level`, OHKO move → flag for "OHKO move"). UI surfaces specially. No surrounding flow change.

### Deliberate non-additions

- No "modifier chain" abstraction or plugin registry. Direct multiplication is fine for the modifier count we have at full C scope.
- No premature ability-hook framework. When abilities ship, a switch over the finite ability enum will work.
- No backend calc endpoint. Even at full C scope, the engine remains client-side and well within frontend module size norms (~300 lines v1 → ~1500 lines full C).

Backend stays untouched through B/C. All B/C additions are frontend-only and additive.
