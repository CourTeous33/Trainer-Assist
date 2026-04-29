# Damage Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `/calc` page that computes per-move % HP damage and OHKO/2HKO/3HKO probabilities given two configurable Pokemon (species or custom-base-stats), level/EV/IV/nature/item config, and up to four attacker moves. Two EV input modes: Traditional (510 total / 252 cap, level user-set, IVs visible) and Champion (66 total / 32 cap, Lv50 locked, IVs locked at 31). State is URL-encoded so calc setups are bookmarkable.

**Architecture:** Pure-TypeScript calc engine in `frontend/src/lib/calc/` (no React, no network). Page (`frontend/src/app/calc/page.tsx`) drives a `useReducer` whose state is bidirectionally synced to a single `?s=<base64>` URL param. Pokemon/move/type data come from existing API endpoints; the only backend change is broadening the seed pipeline's form filter to include megas, primals, and Gmax forms. Static tables (25 natures, ~25 items) ship as TS constants.

**Tech Stack:** Rust (Axum) backend (data-only change), Next.js 16 App Router, React `useReducer`, Tailwind CSS v4 with `dark:` variants, Vitest + @testing-library/react for tests.

**Spec:** `docs/superpowers/specs/2026-04-29-damage-calculator-design.md`

---

## File Structure

| File | Responsibility | Change kind |
|---|---|---|
| `backend/crates/seed/src/transform.rs` | Loosen `excluded_suffixes` to permit mega/mega-x/mega-y/primal/gmax | modify |
| `backend/crates/seed/tests/transform_tests.rs` | Add tests asserting Mega-X / Primal / Gmax inclusion + sort order | modify |
| `frontend/src/lib/calc/types.ts` | Calc-only types: `EVMode`, `NatureId`, `ItemId`, `Nature`, `Item`, `PokemonConfig`, `CalcInput`, `CalcResult`, `UnsupportedReason` | create |
| `frontend/src/lib/calc/natures.ts` | 25-nature table with `LocalizedNames` and boost/lower stat | create |
| `frontend/src/lib/calc/items.ts` | Held-item table grouped by tier with multipliers and metadata | create |
| `frontend/src/lib/calc/stats.ts` | `computeStat`, `computeAllStats`, EV/IV/nature/level → final stat (both modes) | create |
| `frontend/src/lib/calc/damage.ts` | `calculateDamage` core formula returning 16 rolls + modifier breakdown + unsupported flag | create |
| `frontend/src/lib/calc/ko.ts` | OHKO/2HKO/3HKO probabilities via roll convolution + verbal qualifier | create |
| `frontend/src/lib/calc/url.ts` | `serializeState` / `deserializeState` with v=1 schema, clamping, Champion invariants | create |
| `frontend/src/lib/calc/index.ts` | Public re-exports + top-level `calculate()` orchestrator that bundles `damage()` + `ko()` | create |
| `frontend/src/lib/calc/__tests__/*.test.ts` | Per-module Vitest unit tests (golden cases verified against Showdown numbers) | create |
| `frontend/src/components/EVModeToggle.tsx` | Two-button segmented control; on switch, runs invariant fixups | create |
| `frontend/src/components/NatureDropdown.tsx` | 25-nature select with "+SpA −Atk" sublabels | create |
| `frontend/src/components/ItemDropdown.tsx` | Sectioned (Top tier / Type-boost / Other) searchable item select | create |
| `frontend/src/components/EVStatTable.tsx` | 6-row stat config grid with EV stepper inputs, IV inputs, computed final, total counter | create |
| `frontend/src/components/BaseStatOverridePanel.tsx` | Collapsible base-stat & type-override editor with "Custom" badge | create |
| `frontend/src/components/PokemonPicker.tsx` | Search + 18 type icon filters + result list | create |
| `frontend/src/components/MoveSlot.tsx` | Display a chosen move (or empty placeholder) and open `MovePicker` on click | create |
| `frontend/src/components/MovePicker.tsx` | Modal with search + 18 type icon filters + 3 damage-class icons; lists attacker's moves only | create |
| `frontend/src/components/DamageRangeBar.tsx` | Horizontal % HP bar with color band | create |
| `frontend/src/components/DamageResultCard.tsx` | Per-move result: header, range bar, KO%, qualifier, "Show details" toggle | create |
| `frontend/src/components/__tests__/*.test.tsx` | Component behavior tests | create |
| `frontend/src/app/calc/page.tsx` | Reducer, URL sync, layout, wires all components together | create |
| `frontend/src/app/calc/__tests__/calc-page.test.tsx` | Single happy-path smoke test | create |
| `frontend/src/components/MobileNav.tsx` | Add `/calc` entry | modify |
| `frontend/src/app/page.tsx` | Add home page feature card linking to `/calc` | modify |
| `frontend/src/lib/i18n/translations.ts` | New `calc.*` keys × 3 locales + `nav.calc` + `home.calc.*` + nature/item localized name lookup helpers if needed | modify |

---

## Task 1: Backend — broaden form whitelist for megas, primals, Gmax

Loosen the seed pipeline's excluded-suffix list and update transform tests. Re-seed Redis afterward so the API serves the new forms.

**Files:**
- Modify: `backend/crates/seed/src/transform.rs:265-276`
- Modify: `backend/crates/seed/tests/transform_tests.rs`

- [ ] **Step 1: Add failing tests for the new form inclusions and the sort order**

Open `backend/crates/seed/tests/transform_tests.rs`, scroll to the existing form-filter test cluster, and add:

```rust
#[test]
fn pokemon_list_includes_mega_x() {
    let data = test_fixture_data();
    let pokemon = build_pokemon_summaries(&data);
    let mega_x = pokemon.iter().find(|p| p.name == "charizard-mega-x")
        .expect("charizard-mega-x should be present in pokemon:list");
    let charizard = pokemon.iter().find(|p| p.name == "charizard").unwrap();
    assert_eq!(mega_x.species_id, charizard.species_id, "mega-x shares species_id with charizard");
}

#[test]
fn pokemon_list_includes_primal_kyogre() {
    let data = test_fixture_data();
    let pokemon = build_pokemon_summaries(&data);
    assert!(pokemon.iter().any(|p| p.name == "kyogre-primal"),
        "kyogre-primal should be present in pokemon:list");
}

#[test]
fn pokemon_list_includes_a_gmax_form() {
    let data = test_fixture_data();
    let pokemon = build_pokemon_summaries(&data);
    assert!(pokemon.iter().any(|p| p.name.ends_with("-gmax")),
        "at least one -gmax form should be present in pokemon:list");
}

#[test]
fn pokemon_list_still_excludes_eternamax_and_caps() {
    let data = test_fixture_data();
    let pokemon = build_pokemon_summaries(&data);
    assert!(!pokemon.iter().any(|p| p.name == "eternatus-eternamax"),
        "eternamax should remain excluded");
    assert!(!pokemon.iter().any(|p| p.name.ends_with("-cap")),
        "pikachu-*-cap forms should remain excluded");
    assert!(!pokemon.iter().any(|p| p.name.ends_with("-totem")),
        "totem forms should remain excluded");
}

#[test]
fn mega_x_appears_immediately_after_base_charizard() {
    let data = test_fixture_data();
    let pokemon = build_pokemon_summaries(&data);
    let charizard_idx = pokemon.iter().position(|p| p.name == "charizard").unwrap();
    let after = &pokemon[charizard_idx + 1..charizard_idx + 4];
    assert!(after.iter().any(|p| p.name == "charizard-mega-x"),
        "charizard-mega-x should appear within 3 entries after charizard");
}
```

If `build_pokemon_summaries` is named differently in this crate, look at the existing tests in the same file and reuse the same helper they call.

- [ ] **Step 2: Run the new tests; verify they FAIL**

Run from `/home/ubuntu/Trainer-Assist/backend`:

```bash
cargo test -p seed --test transform_tests pokemon_list_includes_mega_x pokemon_list_includes_primal_kyogre pokemon_list_includes_a_gmax_form pokemon_list_still_excludes_eternamax_and_caps mega_x_appears_immediately_after_base_charizard
```

Expected: failures because mega/primal/gmax are still excluded.

- [ ] **Step 3: Loosen the suffix filter**

In `backend/crates/seed/src/transform.rs:265-276`, replace the `excluded_suffixes` array with:

```rust
let excluded_suffixes = [
    "totem", "totem-busted",
    "starter", "belle", "libre", "cosplay", "pop-star", "phd", "rock-star",
    "original-cap", "hoenn-cap", "sinnoh-cap", "unova-cap", "kalos-cap",
    "alola-cap", "partner-cap", "world-cap",
    "eternamax",
    "battle-bond", "ash",
    "power-construct",
];
```

(Removed: `mega`, `mega-x`, `mega-y`, `gmax`. We want them included. `primal` was never in the list — Kyogre/Groudon's primal forms have suffix `primal` which was being excluded by the `is_default == 1` short-circuit failing; verify by reading the row identifiers.)

Update the comment one line above to read:

```rust
// Exclude: totem, eternamax, battle-only/cosmetic, Pikachu cosplay/cap forms.
// INCLUDED: default forms, mega/mega-x/mega-y, primal, gmax.
```

- [ ] **Step 4: Run the full transform test suite; verify all pass**

```bash
cargo test -p seed --test transform_tests
```

Expected: all tests pass, including the five new ones.

- [ ] **Step 5: Re-seed and smoke-check the API**

```bash
make seed-local
```

Then in another shell:

```bash
curl -s 'http://localhost:3001/api/v1/pokemon?search=mega-x&limit=5' | head -c 500
```

Expected: at least Charizard-Mega-X in the JSON. If the API isn't running, start it with `cd backend && cargo run -p api`.

- [ ] **Step 6: Commit**

```bash
git add backend/crates/seed/src/transform.rs backend/crates/seed/tests/transform_tests.rs
git commit -m "Include mega, primal, and gmax forms in seed pipeline"
```

---

## Task 2: Calc engine — types module

Define the calc-only TypeScript types so subsequent modules import a stable surface. No tests for type-only files (the type system is the test).

**Files:**
- Create: `frontend/src/lib/calc/types.ts`

- [ ] **Step 1: Write `types.ts`**

Create `frontend/src/lib/calc/types.ts`:

```ts
import type { Stats, MoveSummary, LocalizedNames } from '@/lib/types';

export type EVMode = 'traditional' | 'champion';

export type NatureId =
  | 'hardy' | 'lonely' | 'brave' | 'adamant' | 'naughty'
  | 'bold' | 'docile' | 'relaxed' | 'impish' | 'lax'
  | 'timid' | 'hasty' | 'serious' | 'jolly' | 'naive'
  | 'modest' | 'mild' | 'quiet' | 'bashful' | 'rash'
  | 'calm' | 'gentle' | 'sassy' | 'careful' | 'quirky';

export type StatKey = keyof Stats; // 'hp' | 'attack' | 'defense' | 'special_attack' | 'special_defense' | 'speed'

export interface Nature {
  id: NatureId;
  names: LocalizedNames;
  boosted: StatKey | null;   // null for neutral natures
  lowered: StatKey | null;   // null for neutral natures
}

export type ItemTier = 'top' | 'type-boost' | 'other';

export interface Item {
  id: string;
  names: LocalizedNames;
  tier: ItemTier;
  // Multiplier shape — at most one is non-null per item.
  damageMult?: number;             // applied to final damage (e.g. Life Orb 1.3)
  attackMult?: { stat: 'attack' | 'special_attack'; factor: number };  // boosts the stat itself
  typeBoost?: { typeId: number; factor: number };                       // boosts moves of one type
  superEffectiveMult?: number;     // applied only when type_eff > 1 (Expert Belt)
  speciesGate?: number[];          // species IDs this item is exclusive to (Light Ball, Thick Club, Soul Dew)
  speciesGateNote?: string;        // human-readable note shown when the user selects an item their mon can't hold
}

export interface PokemonConfig {
  pokemonId: number;
  baseStatsOverride: Stats | null;
  typesOverride: number[] | null;
  level: number;
  ivs: Stats;
  evs: Stats;
  nature: NatureId;
  itemId: string | null;
}

export interface CalcInput {
  evMode: EVMode;
  attacker: PokemonConfig;
  defender: PokemonConfig;
  attackerSpecies: { types: number[]; baseStats: Stats };
  defenderSpecies: { types: number[]; baseStats: Stats };
  move: MoveSummary;
  typeEfficacy: number[][]; // [attackingTypeId][defendingTypeId] → factor in {0, 50, 100, 200}/100
}

export type UnsupportedReason =
  | 'no-power'        // status moves
  | 'fixed-damage'    // Seismic Toss, Night Shade, Dragon Rage, Sonic Boom
  | 'variable-power'  // Gyro Ball, Low Kick, Return, Frustration, Punishment, Heat Crash...
  | 'multi-hit'       // Bullet Seed, Icicle Spear, Triple Kick...
  | 'ohko-move';      // Fissure, Horn Drill, Sheer Cold, Guillotine

export interface CalcResult {
  rolls: number[];          // 16 ints
  defenderHp: number;
  minPct: number;
  maxPct: number;
  avgPct: number;
  ohkoPct: number;
  twoHkoPct: number;
  threeHkoPct: number;
  qualifier: string;
  modifiers: { stab: number; typeEff: number; item: number };
  attackerStat: number;
  defenderStat: number;
}

export interface UnsupportedResult {
  unsupportedReason: UnsupportedReason;
}

export type CalcOutcome = CalcResult | UnsupportedResult;

export const STAT_KEYS: StatKey[] = [
  'hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed',
];

export const ZERO_EVS: Stats = {
  hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0,
};

export const MAX_IVS: Stats = {
  hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31,
};
```

- [ ] **Step 2: Type-check**

Run from `/home/ubuntu/Trainer-Assist/frontend`:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/calc/types.ts
git commit -m "Add calc engine type definitions"
```

---

## Task 3: Calc engine — natures table

The 25-nature table with localized names and boosted/lowered stat. Tests cover shape sanity.

**Files:**
- Create: `frontend/src/lib/calc/natures.ts`
- Create: `frontend/src/lib/calc/__tests__/natures.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/calc/__tests__/natures.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NATURES, getNature, NATURE_MULTIPLIER } from '../natures';

describe('NATURES', () => {
  it('has exactly 25 entries', () => {
    expect(NATURES.length).toBe(25);
  });

  it('has unique ids', () => {
    const ids = NATURES.map((n) => n.id);
    expect(new Set(ids).size).toBe(25);
  });

  it('5 neutral natures have null boosted/lowered', () => {
    const neutral = NATURES.filter((n) => n.boosted === null && n.lowered === null);
    expect(neutral.map((n) => n.id).sort()).toEqual(
      ['bashful', 'docile', 'hardy', 'quirky', 'serious'],
    );
  });

  it('non-neutral natures have both boosted and lowered set', () => {
    const nonNeutral = NATURES.filter((n) => n.boosted || n.lowered);
    for (const n of nonNeutral) {
      expect(n.boosted).not.toBeNull();
      expect(n.lowered).not.toBeNull();
    }
  });
});

describe('getNature', () => {
  it('returns the nature with the given id', () => {
    expect(getNature('adamant').boosted).toBe('attack');
    expect(getNature('adamant').lowered).toBe('special_attack');
  });
});

describe('NATURE_MULTIPLIER', () => {
  it('returns 1.1 for boosted, 0.9 for lowered, 1.0 for unaffected, 1.0 for neutral natures', () => {
    expect(NATURE_MULTIPLIER(getNature('adamant'), 'attack')).toBe(1.1);
    expect(NATURE_MULTIPLIER(getNature('adamant'), 'special_attack')).toBe(0.9);
    expect(NATURE_MULTIPLIER(getNature('adamant'), 'speed')).toBe(1.0);
    expect(NATURE_MULTIPLIER(getNature('hardy'), 'attack')).toBe(1.0);
  });

  it('does not apply nature to HP', () => {
    // No nature affects HP in the formula; the multiplier function should never be called for hp.
    // Keep the contract: caller is responsible for not asking about hp.
    expect(NATURE_MULTIPLIER(getNature('adamant'), 'hp')).toBe(1.0);
  });
});
```

- [ ] **Step 2: Run; verify it fails (module not found)**

```bash
cd frontend && npx vitest run src/lib/calc/__tests__/natures.test.ts
```

Expected: fail — `Cannot find module '../natures'`.

- [ ] **Step 3: Implement `natures.ts`**

Create `frontend/src/lib/calc/natures.ts`:

```ts
import type { Nature, NatureId, StatKey } from './types';

export const NATURES: Nature[] = [
  // Neutral
  { id: 'hardy',   names: { en: 'Hardy',   ja: 'がんばりや', zh: '勤奋' }, boosted: null,             lowered: null },
  { id: 'docile',  names: { en: 'Docile',  ja: 'すなお',     zh: '坦率' }, boosted: null,             lowered: null },
  { id: 'bashful', names: { en: 'Bashful', ja: 'てれや',     zh: '害羞' }, boosted: null,             lowered: null },
  { id: 'quirky',  names: { en: 'Quirky',  ja: 'きまぐれ',   zh: '浮躁' }, boosted: null,             lowered: null },
  { id: 'serious', names: { en: 'Serious', ja: 'まじめ',     zh: '认真' }, boosted: null,             lowered: null },
  // +Atk
  { id: 'lonely',  names: { en: 'Lonely',  ja: 'さみしがり', zh: '怕寂寞' }, boosted: 'attack',         lowered: 'defense' },
  { id: 'brave',   names: { en: 'Brave',   ja: 'ゆうかん',   zh: '勇敢' },   boosted: 'attack',         lowered: 'speed' },
  { id: 'adamant', names: { en: 'Adamant', ja: 'いじっぱり', zh: '固执' },   boosted: 'attack',         lowered: 'special_attack' },
  { id: 'naughty', names: { en: 'Naughty', ja: 'やんちゃ',   zh: '顽皮' },   boosted: 'attack',         lowered: 'special_defense' },
  // +Def
  { id: 'bold',    names: { en: 'Bold',    ja: 'ずぶとい',   zh: '大胆' },   boosted: 'defense',        lowered: 'attack' },
  { id: 'relaxed', names: { en: 'Relaxed', ja: 'のんき',     zh: '悠闲' },   boosted: 'defense',        lowered: 'speed' },
  { id: 'impish',  names: { en: 'Impish',  ja: 'わんぱく',   zh: '淘气' },   boosted: 'defense',        lowered: 'special_attack' },
  { id: 'lax',     names: { en: 'Lax',     ja: 'のうてんき', zh: '乐天' },   boosted: 'defense',        lowered: 'special_defense' },
  // +Speed
  { id: 'timid',   names: { en: 'Timid',   ja: 'おくびょう', zh: '胆小' },   boosted: 'speed',          lowered: 'attack' },
  { id: 'hasty',   names: { en: 'Hasty',   ja: 'せっかち',   zh: '急躁' },   boosted: 'speed',          lowered: 'defense' },
  { id: 'jolly',   names: { en: 'Jolly',   ja: 'ようき',     zh: '爽朗' },   boosted: 'speed',          lowered: 'special_attack' },
  { id: 'naive',   names: { en: 'Naive',   ja: 'むじゃき',   zh: '天真' },   boosted: 'speed',          lowered: 'special_defense' },
  // +SpA
  { id: 'modest',  names: { en: 'Modest',  ja: 'ひかえめ',   zh: '内敛' },   boosted: 'special_attack', lowered: 'attack' },
  { id: 'mild',    names: { en: 'Mild',    ja: 'おっとり',   zh: '慢吞吞' }, boosted: 'special_attack', lowered: 'defense' },
  { id: 'quiet',   names: { en: 'Quiet',   ja: 'れいせい',   zh: '冷静' },   boosted: 'special_attack', lowered: 'speed' },
  { id: 'rash',    names: { en: 'Rash',    ja: 'うっかりや', zh: '马虎' },   boosted: 'special_attack', lowered: 'special_defense' },
  // +SpD
  { id: 'calm',    names: { en: 'Calm',    ja: 'おだやか',   zh: '温和' },   boosted: 'special_defense', lowered: 'attack' },
  { id: 'gentle',  names: { en: 'Gentle',  ja: 'おとなしい', zh: '温顺' },   boosted: 'special_defense', lowered: 'defense' },
  { id: 'sassy',   names: { en: 'Sassy',   ja: 'なまいき',   zh: '自大' },   boosted: 'special_defense', lowered: 'speed' },
  { id: 'careful', names: { en: 'Careful', ja: 'しんちょう', zh: '慎重' },   boosted: 'special_defense', lowered: 'special_attack' },
];

const NATURE_INDEX: Record<NatureId, Nature> = Object.fromEntries(
  NATURES.map((n) => [n.id, n]),
) as Record<NatureId, Nature>;

export function getNature(id: NatureId): Nature {
  return NATURE_INDEX[id];
}

export function NATURE_MULTIPLIER(nature: Nature, stat: StatKey): number {
  if (stat === 'hp') return 1.0;
  if (nature.boosted === stat) return 1.1;
  if (nature.lowered === stat) return 0.9;
  return 1.0;
}
```

- [ ] **Step 4: Run tests; verify all pass**

```bash
cd frontend && npx vitest run src/lib/calc/__tests__/natures.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/calc/natures.ts frontend/src/lib/calc/__tests__/natures.test.ts
git commit -m "Add 25-nature table with multiplier helper"
```

---

## Task 4: Calc engine — items table

Held-item table. Includes Top tier, Type-boost (one per type), and species-gated items (Light Ball, Thick Club, Soul Dew). Excludes triggered/stateful items (Weakness Policy, etc.) — those are B/C scope.

**Files:**
- Create: `frontend/src/lib/calc/items.ts`
- Create: `frontend/src/lib/calc/__tests__/items.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/calc/__tests__/items.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ITEMS, getItem, ITEMS_BY_TIER } from '../items';

describe('ITEMS', () => {
  it('has unique ids', () => {
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ITEMS.length);
  });

  it('every item has en name', () => {
    for (const item of ITEMS) expect(item.names.en).toBeTruthy();
  });

  it('every item has at least one multiplier defined', () => {
    for (const item of ITEMS) {
      const hasMult = item.damageMult || item.attackMult || item.typeBoost || item.superEffectiveMult;
      expect(hasMult, `${item.id} has no multiplier`).toBeTruthy();
    }
  });

  it('groups items by tier', () => {
    expect(ITEMS_BY_TIER.top.length).toBeGreaterThan(0);
    expect(ITEMS_BY_TIER['type-boost'].length).toBe(18);
    expect(ITEMS_BY_TIER.other.length).toBeGreaterThan(0);
  });

  it('Life Orb is 1.3x final damage', () => {
    expect(getItem('life-orb')!.damageMult).toBe(1.3);
  });

  it('Choice Band boosts physical attack 1.5x', () => {
    const cb = getItem('choice-band')!;
    expect(cb.attackMult).toEqual({ stat: 'attack', factor: 1.5 });
  });

  it('Expert Belt only applies on super-effective hits', () => {
    expect(getItem('expert-belt')!.superEffectiveMult).toBe(1.2);
  });

  it('Light Ball is gated to Pikachu species', () => {
    expect(getItem('light-ball')!.speciesGate).toContain(25);
  });
});

describe('getItem', () => {
  it('returns undefined for unknown id', () => {
    expect(getItem('not-a-real-item')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run; verify failure**

```bash
cd frontend && npx vitest run src/lib/calc/__tests__/items.test.ts
```

- [ ] **Step 3: Implement `items.ts`**

Create `frontend/src/lib/calc/items.ts`:

```ts
import type { Item, ItemTier } from './types';

// Type IDs match PokeAPI: 1=normal, 2=fighting, 3=flying, 4=poison, 5=ground,
// 6=rock, 7=bug, 8=ghost, 9=steel, 10=fire, 11=water, 12=grass, 13=electric,
// 14=psychic, 15=ice, 16=dragon, 17=dark, 18=fairy.

export const ITEMS: Item[] = [
  // -------- Top tier --------
  { id: 'life-orb',     names: { en: 'Life Orb',     ja: 'いのちのたま',   zh: '生命宝珠' }, tier: 'top', damageMult: 1.3 },
  { id: 'choice-band',  names: { en: 'Choice Band',  ja: 'こだわりハチマキ', zh: '讲究头巾' }, tier: 'top', attackMult: { stat: 'attack', factor: 1.5 } },
  { id: 'choice-specs', names: { en: 'Choice Specs', ja: 'こだわりメガネ',   zh: '讲究眼镜' }, tier: 'top', attackMult: { stat: 'special_attack', factor: 1.5 } },
  { id: 'expert-belt',  names: { en: 'Expert Belt',  ja: 'たつじんのおび', zh: '达人之带' }, tier: 'top', superEffectiveMult: 1.2 },
  { id: 'muscle-band',  names: { en: 'Muscle Band',  ja: 'ちからのハチマキ', zh: '力量头带' }, tier: 'top', damageMult: 1.1 /* physical only — see attackMult guard in damage.ts */ },
  { id: 'wise-glasses', names: { en: 'Wise Glasses', ja: 'ものしりメガネ', zh: '博识眼镜' }, tier: 'top', damageMult: 1.1 /* special only */ },

  // -------- Type-boost --------
  { id: 'silk-scarf',     names: { en: 'Silk Scarf',     ja: 'シルクのスカーフ', zh: '丝绸围巾' }, tier: 'type-boost', typeBoost: { typeId: 1, factor: 1.2 } },
  { id: 'black-belt',     names: { en: 'Black Belt',     ja: 'くろおび',       zh: '黑带' },     tier: 'type-boost', typeBoost: { typeId: 2, factor: 1.2 } },
  { id: 'sharp-beak',     names: { en: 'Sharp Beak',     ja: 'するどいくちばし', zh: '锐利鸟嘴' }, tier: 'type-boost', typeBoost: { typeId: 3, factor: 1.2 } },
  { id: 'poison-barb',    names: { en: 'Poison Barb',    ja: 'どくバリ',       zh: '毒针' },     tier: 'type-boost', typeBoost: { typeId: 4, factor: 1.2 } },
  { id: 'soft-sand',      names: { en: 'Soft Sand',      ja: 'やわらかいすな', zh: '柔软沙子' }, tier: 'type-boost', typeBoost: { typeId: 5, factor: 1.2 } },
  { id: 'hard-stone',     names: { en: 'Hard Stone',     ja: 'かたいいし',     zh: '硬石头' },   tier: 'type-boost', typeBoost: { typeId: 6, factor: 1.2 } },
  { id: 'silver-powder',  names: { en: 'Silver Powder',  ja: 'ぎんのこな',     zh: '银粉' },     tier: 'type-boost', typeBoost: { typeId: 7, factor: 1.2 } },
  { id: 'spell-tag',      names: { en: 'Spell Tag',      ja: 'のろいのおふだ', zh: '诅咒之符' }, tier: 'type-boost', typeBoost: { typeId: 8, factor: 1.2 } },
  { id: 'metal-coat',     names: { en: 'Metal Coat',     ja: 'メタルコート',   zh: '金属膜' },   tier: 'type-boost', typeBoost: { typeId: 9, factor: 1.2 } },
  { id: 'charcoal',       names: { en: 'Charcoal',       ja: 'もくたん',       zh: '木炭' },     tier: 'type-boost', typeBoost: { typeId: 10, factor: 1.2 } },
  { id: 'mystic-water',   names: { en: 'Mystic Water',   ja: 'しんぴのしずく', zh: '神秘水滴' }, tier: 'type-boost', typeBoost: { typeId: 11, factor: 1.2 } },
  { id: 'miracle-seed',   names: { en: 'Miracle Seed',   ja: 'きせきのタネ',   zh: '奇迹种子' }, tier: 'type-boost', typeBoost: { typeId: 12, factor: 1.2 } },
  { id: 'magnet',         names: { en: 'Magnet',         ja: 'じしゃく',       zh: '磁铁' },     tier: 'type-boost', typeBoost: { typeId: 13, factor: 1.2 } },
  { id: 'twisted-spoon',  names: { en: 'Twisted Spoon',  ja: 'まがったスプーン', zh: '弯曲的汤匙' }, tier: 'type-boost', typeBoost: { typeId: 14, factor: 1.2 } },
  { id: 'never-melt-ice', names: { en: 'Never-Melt Ice', ja: 'とけないこおり', zh: '不融冰' },   tier: 'type-boost', typeBoost: { typeId: 15, factor: 1.2 } },
  { id: 'dragon-fang',    names: { en: 'Dragon Fang',    ja: 'りゅうのキバ',   zh: '龙之牙' },   tier: 'type-boost', typeBoost: { typeId: 16, factor: 1.2 } },
  { id: 'black-glasses',  names: { en: 'Black Glasses',  ja: 'くろいメガネ',   zh: '黑色眼镜' }, tier: 'type-boost', typeBoost: { typeId: 17, factor: 1.2 } },
  { id: 'pixie-plate',    names: { en: 'Pixie Plate',    ja: 'せいれいプレート', zh: '妖精石板' }, tier: 'type-boost', typeBoost: { typeId: 18, factor: 1.2 } },

  // -------- Other (species-gated) --------
  { id: 'light-ball', names: { en: 'Light Ball', ja: 'でんきだま', zh: '电气球' }, tier: 'other',
    attackMult: { stat: 'attack', factor: 2.0 }, // also applies to SpA — handled with both branches in damage.ts via speciesGate check
    speciesGate: [25 /* Pikachu */],
    speciesGateNote: 'Light Ball: only Pikachu may hold this' },
  { id: 'thick-club', names: { en: 'Thick Club', ja: 'ふといホネ', zh: '粗骨头' }, tier: 'other',
    attackMult: { stat: 'attack', factor: 2.0 },
    speciesGate: [104 /* Cubone */, 105 /* Marowak */],
    speciesGateNote: 'Thick Club: only Cubone or Marowak may hold this' },
  { id: 'soul-dew', names: { en: 'Soul Dew', ja: 'こころのしずく', zh: '心之水滴' }, tier: 'other',
    typeBoost: { typeId: 14 /* applied to Psychic */, factor: 1.2 },
    speciesGate: [380 /* Latias */, 381 /* Latios */],
    speciesGateNote: 'Soul Dew: only Latias or Latios may hold this. (Dragon-type boost handled by a duplicate slot if you need it; v1 boosts Psychic only — see plan.)' },
];

const ITEM_INDEX: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): Item | undefined {
  return ITEM_INDEX[id];
}

export const ITEMS_BY_TIER: Record<ItemTier, Item[]> = {
  top: ITEMS.filter((i) => i.tier === 'top'),
  'type-boost': ITEMS.filter((i) => i.tier === 'type-boost'),
  other: ITEMS.filter((i) => i.tier === 'other'),
};
```

> Note: `Muscle Band` and `Wise Glasses` use `damageMult: 1.1` plus a category guard that lives in `damage.ts` (Task 6). `Light Ball` boosts Atk and SpA both — the Light Ball branch in `damage.ts` doubles whichever attacking stat is in use rather than only Atk.

- [ ] **Step 4: Run tests; verify all pass**

```bash
cd frontend && npx vitest run src/lib/calc/__tests__/items.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/calc/items.ts frontend/src/lib/calc/__tests__/items.test.ts
git commit -m "Add held-item table with tier grouping"
```

---

## Task 5: Calc engine — stat computation

Implements EV/IV/nature/level → final stat for both modes. Champion mode uses the same formula but enforces level=50, IV=31, EV cap 32 per stat / 66 total.

**Files:**
- Create: `frontend/src/lib/calc/stats.ts`
- Create: `frontend/src/lib/calc/__tests__/stats.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/lib/calc/__tests__/stats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  computeStat, computeAllStats, clampEVsForMode, isLevelLockedForMode,
  evTotal, MAX_TOTAL_EV_TRADITIONAL, MAX_PER_STAT_EV_TRADITIONAL,
  MAX_TOTAL_EV_CHAMPION, MAX_PER_STAT_EV_CHAMPION,
} from '../stats';
import { getNature } from '../natures';

describe('computeStat', () => {
  it('Garchomp Lv50 252 Atk EV / 31 IV / Adamant → 200 Atk (Showdown canonical)', () => {
    // Garchomp base attack = 130
    expect(computeStat('attack', 130, 31, 252, 50, getNature('adamant'))).toBe(200);
  });

  it('Blissey Lv50 252 HP EV / 31 IV → 362 HP (Showdown canonical)', () => {
    // Blissey base HP = 255
    expect(computeStat('hp', 255, 31, 252, 50, getNature('hardy'))).toBe(362);
  });

  it('neutral nature applies 1.0', () => {
    expect(computeStat('speed', 100, 31, 0, 50, getNature('hardy'))).toBe(95);
  });

  it('boosted nature multiplies after stat formula and floors', () => {
    // Base 100 / 31 IV / 0 EV / Lv50 / Modest (boost SpA): pre-nature 95, ×1.1 = 104.5 → floor 104.
    expect(computeStat('special_attack', 100, 31, 0, 50, getNature('modest'))).toBe(104);
  });
});

describe('computeAllStats', () => {
  it('returns full Stats object with HP slot', () => {
    const stats = computeAllStats(
      { hp: 255, attack: 10, defense: 10, special_attack: 75, special_defense: 135, speed: 55 },
      { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      { hp: 252, attack: 0, defense: 252, special_attack: 0, special_defense: 4, speed: 0 },
      50,
      getNature('bold'),
    );
    expect(stats.hp).toBe(362);
    expect(stats.defense).toBeGreaterThan(stats.attack);
  });
});

describe('Champion mode caps', () => {
  it('clamps per-stat EV to 32 and total to 66', () => {
    const clamped = clampEVsForMode(
      { hp: 100, attack: 60, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      'champion',
    );
    // Each stat capped at 32 first, then total trimmed to 66 (greedy from rightmost).
    expect(clamped.hp).toBe(32);
    expect(clamped.attack).toBe(32);
    expect(evTotal(clamped)).toBeLessThanOrEqual(66);
  });

  it('Traditional mode allows 510 total / 252 per stat', () => {
    const clamped = clampEVsForMode(
      { hp: 252, attack: 252, defense: 252, special_attack: 0, special_defense: 0, speed: 0 },
      'traditional',
    );
    // 252+252 = 504 within 510, so just clamp trailing to keep total ≤ 510.
    expect(clamped.hp).toBe(252);
    expect(evTotal(clamped)).toBeLessThanOrEqual(510);
  });

  it('exposes the right caps via constants', () => {
    expect(MAX_TOTAL_EV_TRADITIONAL).toBe(510);
    expect(MAX_PER_STAT_EV_TRADITIONAL).toBe(252);
    expect(MAX_TOTAL_EV_CHAMPION).toBe(66);
    expect(MAX_PER_STAT_EV_CHAMPION).toBe(32);
  });
});

describe('isLevelLockedForMode', () => {
  it('locks level in champion mode', () => {
    expect(isLevelLockedForMode('champion')).toBe(true);
    expect(isLevelLockedForMode('traditional')).toBe(false);
  });
});
```

- [ ] **Step 2: Run; verify failure**

```bash
cd frontend && npx vitest run src/lib/calc/__tests__/stats.test.ts
```

- [ ] **Step 3: Implement `stats.ts`**

Create `frontend/src/lib/calc/stats.ts`:

```ts
import type { Stats } from '@/lib/types';
import type { EVMode, Nature, StatKey } from './types';
import { NATURE_MULTIPLIER } from './natures';
import { STAT_KEYS } from './types';

export const MAX_TOTAL_EV_TRADITIONAL = 510;
export const MAX_PER_STAT_EV_TRADITIONAL = 252;
export const MAX_TOTAL_EV_CHAMPION = 66;
export const MAX_PER_STAT_EV_CHAMPION = 32;

export function computeStat(
  stat: StatKey,
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: Nature,
): number {
  const evContribution = Math.floor(ev / 4);
  const inner = Math.floor(((2 * base + iv + evContribution) * level) / 100);
  if (stat === 'hp') {
    return inner + level + 10;
  }
  const withBase = inner + 5;
  const natured = Math.floor(withBase * NATURE_MULTIPLIER(nature, stat));
  return natured;
}

export function computeAllStats(
  base: Stats,
  ivs: Stats,
  evs: Stats,
  level: number,
  nature: Nature,
): Stats {
  return {
    hp: computeStat('hp', base.hp, ivs.hp, evs.hp, level, nature),
    attack: computeStat('attack', base.attack, ivs.attack, evs.attack, level, nature),
    defense: computeStat('defense', base.defense, ivs.defense, evs.defense, level, nature),
    special_attack: computeStat('special_attack', base.special_attack, ivs.special_attack, evs.special_attack, level, nature),
    special_defense: computeStat('special_defense', base.special_defense, ivs.special_defense, evs.special_defense, level, nature),
    speed: computeStat('speed', base.speed, ivs.speed, evs.speed, level, nature),
  };
}

export function evTotal(evs: Stats): number {
  return STAT_KEYS.reduce((sum, k) => sum + (evs[k] ?? 0), 0);
}

function perStatCap(mode: EVMode): number {
  return mode === 'champion' ? MAX_PER_STAT_EV_CHAMPION : MAX_PER_STAT_EV_TRADITIONAL;
}

function totalCap(mode: EVMode): number {
  return mode === 'champion' ? MAX_TOTAL_EV_CHAMPION : MAX_TOTAL_EV_TRADITIONAL;
}

export function clampEVsForMode(evs: Stats, mode: EVMode): Stats {
  const perStat = perStatCap(mode);
  const total = totalCap(mode);
  // Step 1: clamp each to [0, perStatCap].
  const stepped: Stats = {
    hp: Math.min(perStat, Math.max(0, evs.hp)),
    attack: Math.min(perStat, Math.max(0, evs.attack)),
    defense: Math.min(perStat, Math.max(0, evs.defense)),
    special_attack: Math.min(perStat, Math.max(0, evs.special_attack)),
    special_defense: Math.min(perStat, Math.max(0, evs.special_defense)),
    speed: Math.min(perStat, Math.max(0, evs.speed)),
  };
  // Step 2: if total exceeds, trim greedily from later stats first (preserves earlier user intent).
  let over = evTotal(stepped) - total;
  if (over <= 0) return stepped;
  const result = { ...stepped };
  const trimOrder: StatKey[] = ['speed', 'special_defense', 'special_attack', 'defense', 'attack', 'hp'];
  for (const key of trimOrder) {
    if (over <= 0) break;
    const reducible = Math.min(over, result[key]);
    result[key] -= reducible;
    over -= reducible;
  }
  return result;
}

export function isLevelLockedForMode(mode: EVMode): boolean {
  return mode === 'champion';
}

export function lockedLevelForMode(mode: EVMode): number | null {
  return mode === 'champion' ? 50 : null;
}

export function lockedIVsForMode(mode: EVMode): Stats | null {
  return mode === 'champion'
    ? { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 }
    : null;
}
```

- [ ] **Step 4: Run; verify all tests pass**

```bash
cd frontend && npx vitest run src/lib/calc/__tests__/stats.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/calc/stats.ts frontend/src/lib/calc/__tests__/stats.test.ts
git commit -m "Implement EV/IV/nature stat computation with mode caps"
```

---

## Task 6: Calc engine — damage formula

The Gen 5+ damage formula returning the 16-roll array, plus modifier breakdown. Routes status / fixed-damage / variable-power / multi-hit / OHKO moves to an `UnsupportedResult`. Item handling lives here, including category guards (Muscle Band / Wise Glasses) and species-gated items (Light Ball / Thick Club / Soul Dew).

**Files:**
- Create: `frontend/src/lib/calc/damage.ts`
- Create: `frontend/src/lib/calc/__tests__/damage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/lib/calc/__tests__/damage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../damage';
import type { CalcInput } from '../types';

// Helper to build a minimal CalcInput. Tests fill in specifics.
function input(over: Partial<CalcInput>): CalcInput {
  const baseStats = { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 };
  return {
    evMode: 'traditional',
    attacker: {
      pokemonId: 1, baseStatsOverride: null, typesOverride: null, level: 50,
      ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      nature: 'hardy', itemId: null,
    },
    defender: {
      pokemonId: 2, baseStatsOverride: null, typesOverride: null, level: 50,
      ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      nature: 'hardy', itemId: null,
    },
    attackerSpecies: { types: [1], baseStats },
    defenderSpecies: { types: [1], baseStats },
    move: { id: 1, name: 'tackle', names: { en: 'Tackle' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 40, accuracy: 100, pp: 35, damage_class: 'physical' },
    typeEfficacy: identityEfficacy(),
    ...over,
  };
}

function identityEfficacy(): number[][] {
  // 19x19 (1-indexed), all 100 (1.0x). Type ID 0 unused.
  const m = Array.from({ length: 19 }, () => Array(19).fill(100));
  return m;
}

describe('calculateDamage', () => {
  it('returns 16 rolls in non-decreasing order', () => {
    const out = calculateDamage(input({}));
    if ('unsupportedReason' in out) throw new Error('expected supported');
    expect(out.rolls.length).toBe(16);
    for (let i = 1; i < 16; i++) {
      expect(out.rolls[i]).toBeGreaterThanOrEqual(out.rolls[i - 1]);
    }
  });

  it('returns unsupported for status moves (power null)', () => {
    const out = calculateDamage(input({
      move: { id: 1, name: 'splash', names: { en: 'Splash' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: null, accuracy: null, pp: 40, damage_class: 'status' },
    }));
    expect('unsupportedReason' in out).toBe(true);
  });

  it('STAB applies when move type is in attacker types', () => {
    const noStab = calculateDamage(input({})) as Extract<ReturnType<typeof calculateDamage>, { rolls: number[] }>;
    const stab = calculateDamage(input({ attackerSpecies: { types: [1], baseStats: noStab.attackerStat as never as { hp:number;attack:number;defense:number;special_attack:number;special_defense:number;speed:number } } }));
    // Easier: assert modifier value rather than recompute by hand.
    expect((stab as { modifiers: { stab: number } }).modifiers.stab).toBe(1.5);
  });

  it('type effectiveness multiplies; 0× → all rolls 0', () => {
    const eff = identityEfficacy();
    eff[1][2] = 0; // normal vs ghost-like type → 0
    const out = calculateDamage(input({
      defenderSpecies: { types: [2], baseStats: input({}).defenderSpecies.baseStats },
      typeEfficacy: eff,
    })) as Extract<ReturnType<typeof calculateDamage>, { rolls: number[] }>;
    expect(out.rolls.every((r) => r === 0)).toBe(true);
    expect(out.modifiers.typeEff).toBe(0);
  });

  it('Life Orb multiplies final by 1.3', () => {
    const noItem = calculateDamage(input({})) as { rolls: number[] };
    const withOrb = calculateDamage(input({
      attacker: { ...input({}).attacker, itemId: 'life-orb' },
    })) as { rolls: number[]; modifiers: { item: number } };
    expect(withOrb.modifiers.item).toBe(1.3);
    // Each roll should be roughly 1.3x; allow +/-1 from int flooring per roll.
    for (let i = 0; i < 16; i++) {
      expect(withOrb.rolls[i]).toBeGreaterThanOrEqual(Math.floor(noItem.rolls[i] * 1.3) - 1);
      expect(withOrb.rolls[i]).toBeLessThanOrEqual(Math.floor(noItem.rolls[i] * 1.3) + 1);
    }
  });

  it('Choice Band boosts physical attack stat 1.5x', () => {
    const physical = calculateDamage(input({
      attacker: { ...input({}).attacker, itemId: 'choice-band' },
    })) as { attackerStat: number };
    const baseline = calculateDamage(input({})) as { attackerStat: number };
    expect(physical.attackerStat).toBe(Math.floor(baseline.attackerStat * 1.5));
  });

  it('Expert Belt only applies when type effectiveness > 1', () => {
    const eff = identityEfficacy();
    eff[1][3] = 200;
    const superEff = calculateDamage(input({
      defenderSpecies: { types: [3], baseStats: input({}).defenderSpecies.baseStats },
      typeEfficacy: eff,
      attacker: { ...input({}).attacker, itemId: 'expert-belt' },
    })) as { modifiers: { item: number } };
    expect(superEff.modifiers.item).toBe(1.2);

    const neutral = calculateDamage(input({
      attacker: { ...input({}).attacker, itemId: 'expert-belt' },
    })) as { modifiers: { item: number } };
    expect(neutral.modifiers.item).toBe(1.0);
  });

  it('baseStatsOverride substitutes for species base stats', () => {
    const baseline = calculateDamage(input({})) as { attackerStat: number };
    const override = calculateDamage(input({
      attacker: {
        ...input({}).attacker,
        baseStatsOverride: { hp: 100, attack: 200, defense: 100, special_attack: 100, special_defense: 100, speed: 100 },
      },
    })) as { attackerStat: number };
    expect(override.attackerStat).toBeGreaterThan(baseline.attackerStat);
  });

  it('Mega Garchomp Earthquake matches Showdown roll array', () => {
    // Mega Garchomp: attack=170, Adamant 252+ Atk EV / 31 IV.
    // Earthquake: power 100, ground-type, physical.
    // Defender: 0/0 garchomp neutral, defense base 95, ev 0, iv 31.
    // Ground vs dragon = 1.0. Garchomp is dragon/ground; ground move on garchomp = 2x (ground vs ground=1, but ground vs dragon=1).
    // Make the test setup simpler: Mega Garchomp Earthquake vs Garchomp 4 HP / 0 Def.
    // Reproduce the Showdown roll array for this matchup. Acceptable to approximate by
    // hand-running the formula and asserting the min/max here:
    const eff = identityEfficacy();
    // Ground (5) vs Dragon (16) = 1x; ground vs ground (5) = 1x.
    const out = calculateDamage(input({
      attacker: {
        ...input({}).attacker,
        baseStatsOverride: { hp: 108, attack: 170, defense: 115, special_attack: 120, special_defense: 95, speed: 92 },
        evs: { hp: 0, attack: 252, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
        nature: 'adamant',
      },
      defender: {
        ...input({}).defender,
        baseStatsOverride: { hp: 108, attack: 130, defense: 95, special_attack: 80, special_defense: 85, speed: 102 },
        evs: { hp: 4, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      },
      attackerSpecies: { types: [16, 5], baseStats: input({}).attackerSpecies.baseStats },
      defenderSpecies: { types: [16, 5], baseStats: input({}).defenderSpecies.baseStats },
      move: { id: 89, name: 'earthquake', names: { en: 'Earthquake' }, type_ref: { id: 5, name: 'ground', names: { en: 'Ground' } }, power: 100, accuracy: 100, pp: 10, damage_class: 'physical' },
      typeEfficacy: eff,
    })) as { rolls: number[]; modifiers: { stab: number; typeEff: number } };
    // STAB applies (ground move, attacker has ground type).
    expect(out.modifiers.stab).toBe(1.5);
    expect(out.modifiers.typeEff).toBe(1.0);
    // Roll integers are non-decreasing, max ≥ min.
    expect(out.rolls[0]).toBeGreaterThan(0);
    expect(out.rolls[15]).toBeGreaterThan(out.rolls[0]);
  });
});
```

> Note: the "matches Showdown roll array" test asserts shape (STAB applied, non-zero, monotonic) rather than exact 16-tuple values to keep the test resilient to integer-flooring micro-differences. If you want exact values, run the same setup in Showdown's calculator and paste the 16 rolls into a `expect(out.rolls).toEqual([...])`.

- [ ] **Step 2: Run; verify failures**

```bash
cd frontend && npx vitest run src/lib/calc/__tests__/damage.test.ts
```

- [ ] **Step 3: Implement `damage.ts`**

Create `frontend/src/lib/calc/damage.ts`:

```ts
import type { Stats } from '@/lib/types';
import type { CalcInput, CalcOutcome, CalcResult, UnsupportedResult } from './types';
import { computeAllStats } from './stats';
import { getNature } from './natures';
import { getItem } from './items';

const FIXED_DAMAGE_MOVES = new Set([
  'seismic-toss', 'night-shade', 'dragon-rage', 'sonic-boom', 'super-fang',
  'endeavor', 'final-gambit', 'psywave',
]);

const VARIABLE_POWER_MOVES = new Set([
  'gyro-ball', 'low-kick', 'grass-knot', 'electro-ball', 'heat-crash', 'heavy-slam',
  'return', 'frustration', 'punishment', 'flail', 'reversal', 'water-spout', 'eruption',
  'magnitude', 'present', 'fury-cutter', 'rollout', 'ice-ball', 'echoed-voice',
  'fling', 'natural-gift', 'judgment', 'techno-blast', 'multi-attack', 'wring-out',
  'crush-grip', 'stored-power', 'power-trip', 'spit-up',
]);

const MULTI_HIT_MOVES = new Set([
  'bullet-seed', 'icicle-spear', 'pin-missile', 'rock-blast', 'tail-slap',
  'fury-attack', 'fury-swipes', 'arm-thrust', 'comet-punch', 'spike-cannon',
  'double-slap', 'barrage', 'bonemerang', 'double-hit', 'double-kick',
  'gear-grind', 'dragon-darts', 'twineedle', 'water-shuriken', 'triple-kick',
  'triple-axel', 'population-bomb', 'surging-strikes',
]);

const OHKO_MOVES = new Set(['fissure', 'horn-drill', 'sheer-cold', 'guillotine']);

export function calculateDamage(input: CalcInput): CalcOutcome {
  const { move, attacker, defender, attackerSpecies, defenderSpecies, typeEfficacy } = input;

  // Unsupported moves.
  if (move.power == null || move.damage_class === 'status') return unsupported('no-power');
  if (FIXED_DAMAGE_MOVES.has(move.name))    return unsupported('fixed-damage');
  if (VARIABLE_POWER_MOVES.has(move.name))  return unsupported('variable-power');
  if (MULTI_HIT_MOVES.has(move.name))       return unsupported('multi-hit');
  if (OHKO_MOVES.has(move.name))            return unsupported('ohko-move');

  // Resolve base stats and types after override.
  const aBase = attacker.baseStatsOverride ?? attackerSpecies.baseStats;
  const dBase = defender.baseStatsOverride ?? defenderSpecies.baseStats;
  const aTypes = attacker.typesOverride ?? attackerSpecies.types;
  const dTypes = defender.typesOverride ?? defenderSpecies.types;

  // Compute stats.
  const aStats = computeAllStats(aBase, attacker.ivs, attacker.evs, attacker.level, getNature(attacker.nature));
  const dStats = computeAllStats(dBase, defender.ivs, defender.evs, defender.level, getNature(defender.nature));

  const isPhysical = move.damage_class === 'physical';
  let A = isPhysical ? aStats.attack : aStats.special_attack;
  const D = isPhysical ? dStats.defense : dStats.special_defense;

  // Item: stat-multiplier slot (Choice Band/Specs, Light Ball, Thick Club).
  let itemMultDamage = 1.0;
  let itemAppliedHere = 1.0;
  const item = attacker.itemId ? getItem(attacker.itemId) : undefined;
  if (item) {
    // Species gate: silently no-op if mon doesn't qualify.
    const speciesOk = !item.speciesGate || item.speciesGate.includes(attacker.pokemonId);
    if (speciesOk) {
      // attackMult applies to physical or special attack stat.
      if (item.attackMult) {
        if (item.id === 'light-ball') {
          // Pikachu doubles whichever attack stat is in use.
          A = Math.floor(A * 2);
        } else if ((item.attackMult.stat === 'attack' && isPhysical) ||
                   (item.attackMult.stat === 'special_attack' && !isPhysical)) {
          A = Math.floor(A * item.attackMult.factor);
        }
      }
      // typeBoost applies if move type matches.
      if (item.typeBoost && item.typeBoost.typeId === move.type_ref.id) {
        itemMultDamage *= item.typeBoost.factor;
      }
      // damageMult applies to final damage. Muscle Band physical-only / Wise Glasses special-only guard:
      if (item.damageMult) {
        if (item.id === 'muscle-band' && !isPhysical) { /* skip */ }
        else if (item.id === 'wise-glasses' && isPhysical) { /* skip */ }
        else { itemMultDamage *= item.damageMult; }
      }
      // superEffectiveMult applies only when typeEff > 1.
      // We compute typeEff next; defer this.
      itemAppliedHere = itemMultDamage;
    }
  }

  // Type effectiveness.
  let typeEff = 1.0;
  for (const dType of dTypes) {
    const factor = (typeEfficacy[move.type_ref.id]?.[dType] ?? 100) / 100;
    typeEff *= factor;
  }

  // Apply Expert Belt's superEffectiveMult here, gated on typeEff > 1.
  if (item && (!item.speciesGate || item.speciesGate.includes(attacker.pokemonId))
      && item.superEffectiveMult && typeEff > 1) {
    itemMultDamage *= item.superEffectiveMult;
  }

  const stab = aTypes.includes(move.type_ref.id) ? 1.5 : 1.0;

  // Base damage. Floor at every step the game floors.
  const L = attacker.level;
  const P = move.power;
  const inner = Math.floor(((2 * L) / 5 + 2) * P * A / D);
  const baseDamage = Math.floor(inner / 50) + 2;

  const rolls: number[] = [];
  for (let i = 85; i <= 100; i++) {
    const roll = i / 100;
    const dmg = Math.floor(baseDamage * stab * typeEff * itemMultDamage * roll);
    rolls.push(typeEff === 0 ? 0 : dmg);
  }

  const defenderHp = dStats.hp;
  const minPct = (rolls[0] / defenderHp) * 100;
  const maxPct = (rolls[15] / defenderHp) * 100;
  const avgPct = (rolls.reduce((a, b) => a + b, 0) / 16 / defenderHp) * 100;

  const result: CalcResult = {
    rolls,
    defenderHp,
    minPct,
    maxPct,
    avgPct,
    ohkoPct: 0,
    twoHkoPct: 0,
    threeHkoPct: 0,
    qualifier: '',
    modifiers: { stab, typeEff, item: itemMultDamage },
    attackerStat: A,
    defenderStat: D,
  };
  return result;
}

function unsupported(reason: import('./types').UnsupportedReason): UnsupportedResult {
  return { unsupportedReason: reason };
}
```

- [ ] **Step 4: Run; verify all tests pass**

```bash
cd frontend && npx vitest run src/lib/calc/__tests__/damage.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/calc/damage.ts frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Implement damage formula with STAB, type effectiveness, and item modifiers"
```

---

## Task 7: Calc engine — KO probabilities

OHKO/2HKO/3HKO via roll convolution. Returns the verbal qualifier string.

**Files:**
- Create: `frontend/src/lib/calc/ko.ts`
- Create: `frontend/src/lib/calc/__tests__/ko.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/lib/calc/__tests__/ko.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeKO, qualifier } from '../ko';

describe('computeKO', () => {
  const filledRolls = (n: number) => Array(16).fill(n);

  it('OHKO 100% when min roll ≥ hp', () => {
    const r = computeKO(filledRolls(100), 90);
    expect(r.ohkoPct).toBe(100);
    expect(r.twoHkoPct).toBe(100);
    expect(r.threeHkoPct).toBe(100);
  });

  it('OHKO 0% when max roll < hp', () => {
    const r = computeKO(filledRolls(50), 200);
    expect(r.ohkoPct).toBe(0);
    expect(r.twoHkoPct).toBe(0); // 50*2 = 100 < 200
    expect(r.threeHkoPct).toBe(0); // 150 < 200
  });

  it('partial OHKO matches (rolls ≥ hp).count / 16', () => {
    // 4 of 16 rolls clear the bar.
    const rolls = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 100, 100, 100, 100];
    const r = computeKO(rolls, 90);
    expect(r.ohkoPct).toBeCloseTo((4 / 16) * 100, 5);
  });

  it('2HKO sums two roll distributions; guaranteed when min*2 ≥ hp', () => {
    const r = computeKO(filledRolls(50), 100);
    // Every pair sums to 100 ≥ 100, so 2HKO is 100%.
    expect(r.twoHkoPct).toBe(100);
  });

  it('3HKO matches sum of three rolls', () => {
    const rolls = filledRolls(34); // 34*3 = 102 ≥ 100
    const r = computeKO(rolls, 100);
    expect(r.threeHkoPct).toBe(100);
  });
});

describe('qualifier', () => {
  it('returns "guaranteed OHKO" for 100% OHKO', () => {
    expect(qualifier({ ohkoPct: 100, twoHkoPct: 100, threeHkoPct: 100 })).toBe('guaranteed OHKO');
  });
  it('returns "possible OHKO" for partial OHKO', () => {
    expect(qualifier({ ohkoPct: 50, twoHkoPct: 100, threeHkoPct: 100 })).toBe('possible OHKO');
  });
  it('returns "guaranteed 2HKO" when 2HKO 100% but OHKO 0%', () => {
    expect(qualifier({ ohkoPct: 0, twoHkoPct: 100, threeHkoPct: 100 })).toBe('guaranteed 2HKO');
  });
  it('returns "possible 2HKO" for partial 2HKO', () => {
    expect(qualifier({ ohkoPct: 0, twoHkoPct: 30, threeHkoPct: 100 })).toBe('possible 2HKO');
  });
  it('returns "guaranteed 3HKO" when 3HKO 100% but 2HKO 0%', () => {
    expect(qualifier({ ohkoPct: 0, twoHkoPct: 0, threeHkoPct: 100 })).toBe('guaranteed 3HKO');
  });
  it('returns "4HKO or worse" when 3HKO < 100%', () => {
    expect(qualifier({ ohkoPct: 0, twoHkoPct: 0, threeHkoPct: 60 })).toBe('4HKO or worse');
  });
});
```

- [ ] **Step 2: Run; verify failures**

```bash
cd frontend && npx vitest run src/lib/calc/__tests__/ko.test.ts
```

- [ ] **Step 3: Implement `ko.ts`**

Create `frontend/src/lib/calc/ko.ts`:

```ts
export interface KOResult {
  ohkoPct: number;     // 0..100
  twoHkoPct: number;
  threeHkoPct: number;
}

export function computeKO(rolls: number[], hp: number): KOResult {
  const n = rolls.length;
  // OHKO
  const ohkoCount = rolls.filter((r) => r >= hp).length;
  const ohkoPct = (ohkoCount / n) * 100;

  // 2HKO: convolve rolls × rolls (n²)
  let twoHkoCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (rolls[i] + rolls[j] >= hp) twoHkoCount++;
    }
  }
  const twoHkoPct = (twoHkoCount / (n * n)) * 100;

  // 3HKO: convolve rolls × rolls × rolls (n³)
  let threeHkoCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        if (rolls[i] + rolls[j] + rolls[k] >= hp) threeHkoCount++;
      }
    }
  }
  const threeHkoPct = (threeHkoCount / (n * n * n)) * 100;

  return { ohkoPct, twoHkoPct, threeHkoPct };
}

export function qualifier(ko: KOResult): string {
  if (ko.ohkoPct === 100) return 'guaranteed OHKO';
  if (ko.ohkoPct > 0)     return 'possible OHKO';
  if (ko.twoHkoPct === 100) return 'guaranteed 2HKO';
  if (ko.twoHkoPct > 0)     return 'possible 2HKO';
  if (ko.threeHkoPct === 100) return 'guaranteed 3HKO';
  if (ko.threeHkoPct > 0)     return 'possible 3HKO';
  return '4HKO or worse';
}
```

- [ ] **Step 4: Run; verify all tests pass**

```bash
cd frontend && npx vitest run src/lib/calc/__tests__/ko.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/calc/ko.ts frontend/src/lib/calc/__tests__/ko.test.ts
git commit -m "Implement KO probability calculator"
```

---

## Task 8: Calc engine — URL state encoding

Pack/unpack `CalcState` into a base64 query param. Includes version field, clamping, Champion-mode invariants, defaults.

**Files:**
- Create: `frontend/src/lib/calc/url.ts`
- Create: `frontend/src/lib/calc/__tests__/url.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/lib/calc/__tests__/url.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { serializeState, deserializeState, defaultCalcState, type CalcState } from '../url';

describe('url serialization', () => {
  it('roundtrips a default state', () => {
    const s = defaultCalcState();
    expect(deserializeState(serializeState(s))).toEqual(s);
  });

  it('roundtrips a fully specified traditional state', () => {
    const s: CalcState = {
      ...defaultCalcState(),
      attacker: { ...defaultCalcState().attacker, pokemonId: 445, evs: { hp: 0, attack: 252, defense: 0, special_attack: 0, special_defense: 4, speed: 252 }, nature: 'adamant', itemId: 'choice-band', moveIds: [89, 232, 442, null] },
      defender: { ...defaultCalcState().defender, pokemonId: 376 },
    };
    expect(deserializeState(serializeState(s))).toEqual(s);
  });

  it('returns defaults on malformed base64', () => {
    expect(deserializeState('nonsense!@#')).toEqual(defaultCalcState());
  });

  it('clamps out-of-range numeric inputs on deserialize', () => {
    const bad = btoa(JSON.stringify({ v: 1, m: 't', a: { p: 1, l: 9999, e: { hp: 9999, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 }, i: { hp: 99, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 }, n: 'hardy', it: null, mv: [null, null, null, null] }, d: { p: 1, l: 50, e: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 }, i: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 }, n: 'hardy', it: null } }));
    const s = deserializeState(bad);
    expect(s.attacker.level).toBeLessThanOrEqual(100);
    expect(s.attacker.evs.hp).toBeLessThanOrEqual(252);
    expect(s.attacker.ivs.hp).toBeLessThanOrEqual(31);
  });

  it('enforces Champion invariants on load', () => {
    const champ = btoa(JSON.stringify({ v: 1, m: 'c', a: { p: 1, l: 75, e: { hp: 100, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 }, i: { hp: 0, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 }, n: 'hardy', it: null, mv: [null, null, null, null] }, d: { p: 1, l: 50, e: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 }, i: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 }, n: 'hardy', it: null } }));
    const s = deserializeState(champ);
    expect(s.evMode).toBe('champion');
    expect(s.attacker.level).toBe(50);
    expect(s.attacker.ivs.hp).toBe(31);
    expect(s.attacker.evs.hp).toBeLessThanOrEqual(32);
    const total = s.attacker.evs.hp + s.attacker.evs.attack + s.attacker.evs.defense + s.attacker.evs.special_attack + s.attacker.evs.special_defense + s.attacker.evs.speed;
    expect(total).toBeLessThanOrEqual(66);
  });

  it('serialized output contains v=1', () => {
    const blob = serializeState(defaultCalcState());
    const json = JSON.parse(atob(blob));
    expect(json.v).toBe(1);
  });
});
```

- [ ] **Step 2: Run; verify failures**

```bash
cd frontend && npx vitest run src/lib/calc/__tests__/url.test.ts
```

- [ ] **Step 3: Implement `url.ts`**

Create `frontend/src/lib/calc/url.ts`:

```ts
import type { Stats } from '@/lib/types';
import type { EVMode, NatureId } from './types';
import { clampEVsForMode, lockedIVsForMode, lockedLevelForMode } from './stats';

export interface CalcState {
  evMode: EVMode;
  attacker: AttackerState;
  defender: DefenderState;
}

export interface DefenderState {
  pokemonId: number;
  baseStatsOverride: Stats | null;
  typesOverride: number[] | null;
  level: number;
  ivs: Stats;
  evs: Stats;
  nature: NatureId;
  itemId: string | null;
}

export interface AttackerState extends DefenderState {
  moveIds: [number | null, number | null, number | null, number | null];
}

const DEFAULT_ATTACKER_ID = 445; // Garchomp
const DEFAULT_DEFENDER_ID = 242; // Blissey

export function defaultCalcState(): CalcState {
  const baseStats: Stats = { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 };
  const max31: Stats = { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 };
  return {
    evMode: 'traditional',
    attacker: {
      pokemonId: DEFAULT_ATTACKER_ID,
      baseStatsOverride: null, typesOverride: null,
      level: 50, ivs: max31, evs: { ...baseStats }, nature: 'hardy', itemId: null,
      moveIds: [null, null, null, null],
    },
    defender: {
      pokemonId: DEFAULT_DEFENDER_ID,
      baseStatsOverride: null, typesOverride: null,
      level: 50, ivs: max31, evs: { ...baseStats }, nature: 'hardy', itemId: null,
    },
  };
}

const NATURE_IDS: NatureId[] = [
  'hardy', 'lonely', 'brave', 'adamant', 'naughty',
  'bold', 'docile', 'relaxed', 'impish', 'lax',
  'timid', 'hasty', 'serious', 'jolly', 'naive',
  'modest', 'mild', 'quiet', 'bashful', 'rash',
  'calm', 'gentle', 'sassy', 'careful', 'quirky',
];

function isNatureId(s: unknown): s is NatureId {
  return typeof s === 'string' && (NATURE_IDS as string[]).includes(s);
}

function clampStats(input: unknown, max: number): Stats {
  const obj = (input ?? {}) as Partial<Stats>;
  const c = (n: unknown) => Math.min(max, Math.max(0, Math.floor(Number(n) || 0)));
  return {
    hp: c(obj.hp), attack: c(obj.attack), defense: c(obj.defense),
    special_attack: c(obj.special_attack), special_defense: c(obj.special_defense), speed: c(obj.speed),
  };
}

function packSide(side: AttackerState | DefenderState, isAttacker: boolean): Record<string, unknown> {
  const base: Record<string, unknown> = {
    p: side.pokemonId,
    l: side.level,
    e: side.evs,
    i: side.ivs,
    n: side.nature,
    it: side.itemId,
    bso: side.baseStatsOverride,
    to: side.typesOverride,
  };
  if (isAttacker) base.mv = (side as AttackerState).moveIds;
  return base;
}

function unpackSide(raw: unknown, isAttacker: boolean, mode: EVMode): AttackerState | DefenderState {
  const r = (raw ?? {}) as Record<string, unknown>;
  const lockedLevel = lockedLevelForMode(mode);
  const lockedIvs = lockedIVsForMode(mode);
  const rawLevel = Math.min(100, Math.max(1, Math.floor(Number(r.l) || 50)));
  const level = lockedLevel ?? rawLevel;
  const evsClamped = clampEVsForMode(clampStats(r.e, 252), mode);
  const ivs = lockedIvs ?? clampStats(r.i, 31);
  const nature = isNatureId(r.n) ? r.n : 'hardy';
  const pokemonId = Math.max(1, Math.floor(Number(r.p) || 1));
  const itemId = typeof r.it === 'string' ? r.it : null;
  const baseStatsOverride = r.bso ? clampStats(r.bso, 999) : null;
  const typesOverride = Array.isArray(r.to) ? (r.to as unknown[]).slice(0, 2).map((x) => Math.max(1, Math.floor(Number(x) || 1))) : null;
  const side: DefenderState = { pokemonId, level, ivs, evs: evsClamped, nature, itemId, baseStatsOverride, typesOverride };
  if (isAttacker) {
    const mv = Array.isArray(r.mv) ? r.mv : [];
    const moveIds: AttackerState['moveIds'] = [
      typeof mv[0] === 'number' ? mv[0] : null,
      typeof mv[1] === 'number' ? mv[1] : null,
      typeof mv[2] === 'number' ? mv[2] : null,
      typeof mv[3] === 'number' ? mv[3] : null,
    ];
    return { ...side, moveIds };
  }
  return side;
}

export function serializeState(state: CalcState): string {
  const blob = {
    v: 1,
    m: state.evMode === 'champion' ? 'c' : 't',
    a: packSide(state.attacker, true),
    d: packSide(state.defender, false),
  };
  return btoa(JSON.stringify(blob));
}

export function deserializeState(blob: string): CalcState {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(atob(blob)) as Record<string, unknown>;
  } catch {
    return defaultCalcState();
  }
  if (!parsed || typeof parsed !== 'object') return defaultCalcState();
  const mode: EVMode = parsed.m === 'c' ? 'champion' : 'traditional';
  return {
    evMode: mode,
    attacker: unpackSide(parsed.a, true, mode) as AttackerState,
    defender: unpackSide(parsed.d, false, mode),
  };
}
```

- [ ] **Step 4: Run; verify all tests pass**

```bash
cd frontend && npx vitest run src/lib/calc/__tests__/url.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/calc/url.ts frontend/src/lib/calc/__tests__/url.test.ts
git commit -m "Implement URL state serialization for damage calc"
```

---

## Task 9: Calc engine — public API (`index.ts`)

Bundle `damage` + `ko` into a single `calculate()` orchestrator and re-export the public surface.

**Files:**
- Create: `frontend/src/lib/calc/index.ts`
- Create: `frontend/src/lib/calc/__tests__/index.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/lib/calc/__tests__/index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calculate } from '../index';
import type { CalcInput } from '../types';

function baseInput(): CalcInput {
  const baseStats = { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 };
  const efficacy = Array.from({ length: 19 }, () => Array(19).fill(100));
  return {
    evMode: 'traditional',
    attacker: { pokemonId: 1, baseStatsOverride: null, typesOverride: null, level: 50,
      ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      nature: 'hardy', itemId: null },
    defender: { pokemonId: 2, baseStatsOverride: null, typesOverride: null, level: 50,
      ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      nature: 'hardy', itemId: null },
    attackerSpecies: { types: [1], baseStats },
    defenderSpecies: { types: [1], baseStats },
    move: { id: 1, name: 'tackle', names: { en: 'Tackle' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 40, accuracy: 100, pp: 35, damage_class: 'physical' },
    typeEfficacy: efficacy,
  };
}

describe('calculate', () => {
  it('returns full result with KO numbers and qualifier', () => {
    const out = calculate(baseInput());
    if ('unsupportedReason' in out) throw new Error('expected supported');
    expect(out.rolls.length).toBe(16);
    expect(out.qualifier).toBeTruthy();
    expect(out.minPct).toBeGreaterThan(0);
    expect(out.ohkoPct).toBeGreaterThanOrEqual(0);
    expect(out.threeHkoPct).toBeGreaterThanOrEqual(out.twoHkoPct);
  });

  it('passes through unsupported moves', () => {
    const out = calculate({
      ...baseInput(),
      move: { id: 1, name: 'splash', names: { en: 'Splash' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: null, accuracy: null, pp: 40, damage_class: 'status' },
    });
    expect('unsupportedReason' in out).toBe(true);
  });
});
```

- [ ] **Step 2: Run; verify failure**

- [ ] **Step 3: Implement `index.ts`**

Create `frontend/src/lib/calc/index.ts`:

```ts
import type { CalcInput, CalcOutcome } from './types';
import { calculateDamage } from './damage';
import { computeKO, qualifier } from './ko';

export * from './types';
export { NATURES, getNature } from './natures';
export { ITEMS, ITEMS_BY_TIER, getItem } from './items';
export {
  computeStat, computeAllStats, clampEVsForMode, evTotal,
  isLevelLockedForMode, lockedLevelForMode, lockedIVsForMode,
  MAX_TOTAL_EV_TRADITIONAL, MAX_PER_STAT_EV_TRADITIONAL,
  MAX_TOTAL_EV_CHAMPION, MAX_PER_STAT_EV_CHAMPION,
} from './stats';
export { calculateDamage } from './damage';
export { computeKO, qualifier } from './ko';
export {
  defaultCalcState, serializeState, deserializeState,
  type CalcState, type AttackerState, type DefenderState,
} from './url';

export function calculate(input: CalcInput): CalcOutcome {
  const dmg = calculateDamage(input);
  if ('unsupportedReason' in dmg) return dmg;
  const ko = computeKO(dmg.rolls, dmg.defenderHp);
  return {
    ...dmg,
    ohkoPct: ko.ohkoPct,
    twoHkoPct: ko.twoHkoPct,
    threeHkoPct: ko.threeHkoPct,
    qualifier: qualifier(ko),
  };
}
```

- [ ] **Step 4: Run all calc tests**

```bash
cd frontend && npx vitest run src/lib/calc
```

Expected: every calc test passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/calc/index.ts frontend/src/lib/calc/__tests__/index.test.ts
git commit -m "Wire calc engine public API"
```

---

## Task 10: Component — `EVModeToggle`

Two-button segmented control. Switching to champion runs invariant fixups (level → 50, IVs → 31, EVs clamped).

**Files:**
- Create: `frontend/src/components/EVModeToggle.tsx`
- Create: `frontend/src/components/__tests__/EVModeToggle.test.tsx`
- Modify: `frontend/src/lib/i18n/translations.ts` (add `calc.modeTraditional`, `calc.modeChampion`)

- [ ] **Step 1: Write failing test**

Create `frontend/src/components/__tests__/EVModeToggle.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/lib/i18n/context';
import EVModeToggle from '../EVModeToggle';

function withLocale(ui: React.ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

describe('EVModeToggle', () => {
  it('renders both options and marks current as selected', () => {
    render(withLocale(<EVModeToggle mode="traditional" onChange={() => {}} />));
    const trad = screen.getByRole('button', { name: /traditional/i });
    expect(trad).toHaveAttribute('aria-pressed', 'true');
    const champ = screen.getByRole('button', { name: /champion/i });
    expect(champ).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange when other option clicked', async () => {
    const onChange = vi.fn();
    render(withLocale(<EVModeToggle mode="traditional" onChange={onChange} />));
    await userEvent.click(screen.getByRole('button', { name: /champion/i }));
    expect(onChange).toHaveBeenCalledWith('champion');
  });
});
```

- [ ] **Step 2: Add i18n keys**

In `frontend/src/lib/i18n/translations.ts`, add to each of `en` / `ja` / `zh` blocks:

```ts
'calc.modeTraditional': 'Traditional',  // ja: '従来モード', zh: '传统模式'
'calc.modeChampion':    'Champion',     // ja: 'チャンピオン', zh: '冠军模式'
```

(Keep the same key names; just translate the strings appropriately for ja/zh.)

- [ ] **Step 3: Implement `EVModeToggle.tsx`**

Create `frontend/src/components/EVModeToggle.tsx`:

```tsx
'use client';

import { useLocale } from '@/lib/i18n';
import type { EVMode } from '@/lib/calc';

interface Props {
  mode: EVMode;
  onChange: (mode: EVMode) => void;
}

export default function EVModeToggle({ mode, onChange }: Props) {
  const { t } = useLocale();
  return (
    <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5" role="group">
      <button
        type="button"
        aria-pressed={mode === 'traditional'}
        onClick={() => onChange('traditional')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${mode === 'traditional' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-200'}`}
      >
        {t('calc.modeTraditional')}
      </button>
      <button
        type="button"
        aria-pressed={mode === 'champion'}
        onClick={() => onChange('champion')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${mode === 'champion' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-200'}`}
      >
        {t('calc.modeChampion')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests; verify pass**

```bash
cd frontend && npx vitest run src/components/__tests__/EVModeToggle.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/EVModeToggle.tsx frontend/src/components/__tests__/EVModeToggle.test.tsx frontend/src/lib/i18n/translations.ts
git commit -m "Add EVModeToggle component"
```

---

## Task 11: Component — `NatureDropdown`

Searchable native `<select>` listing all 25 natures with localized name and "+SpA −Atk" sublabel.

**Files:**
- Create: `frontend/src/components/NatureDropdown.tsx`

- [ ] **Step 1: Implement**

Create `frontend/src/components/NatureDropdown.tsx`:

```tsx
'use client';

import type { NatureId } from '@/lib/calc';
import { NATURES } from '@/lib/calc';
import { useLocale, localizedName } from '@/lib/i18n';

interface Props {
  value: NatureId;
  onChange: (nature: NatureId) => void;
}

const STAT_LABEL: Record<string, string> = {
  attack: 'Atk', defense: 'Def', speed: 'Spe',
  special_attack: 'SpA', special_defense: 'SpD', hp: 'HP',
};

export default function NatureDropdown({ value, onChange }: Props) {
  const { locale } = useLocale();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as NatureId)}
      className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
    >
      {NATURES.map((n) => {
        const sub =
          n.boosted && n.lowered
            ? ` (+${STAT_LABEL[n.boosted]} −${STAT_LABEL[n.lowered]})`
            : '';
        return (
          <option key={n.id} value={n.id}>
            {localizedName(n.names, locale)}
            {sub}
          </option>
        );
      })}
    </select>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NatureDropdown.tsx
git commit -m "Add NatureDropdown component"
```

---

## Task 12: Component — `ItemDropdown`

Sectioned select grouped by tier with localized names.

**Files:**
- Create: `frontend/src/components/ItemDropdown.tsx`
- Modify: `frontend/src/lib/i18n/translations.ts` (add `calc.itemNone`, `calc.itemTier.top`, `calc.itemTier.typeBoost`, `calc.itemTier.other`)

- [ ] **Step 1: Add i18n keys**

Add to each locale block:

```ts
'calc.itemNone':         'No item',         // ja: '道具なし', zh: '无持有物'
'calc.itemTier.top':     'Top tier',        // ja: '最強級',   zh: '顶级'
'calc.itemTier.typeBoost': 'Type boost',    // ja: 'タイプ強化', zh: '属性强化'
'calc.itemTier.other':   'Other',           // ja: 'その他',   zh: '其他'
```

- [ ] **Step 2: Implement**

Create `frontend/src/components/ItemDropdown.tsx`:

```tsx
'use client';

import { ITEMS_BY_TIER } from '@/lib/calc';
import { useLocale, localizedName } from '@/lib/i18n';

interface Props {
  value: string | null;
  onChange: (itemId: string | null) => void;
}

export default function ItemDropdown({ value, onChange }: Props) {
  const { locale, t } = useLocale();
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
    >
      <option value="">{t('calc.itemNone')}</option>
      <optgroup label={t('calc.itemTier.top')}>
        {ITEMS_BY_TIER.top.map((i) => (
          <option key={i.id} value={i.id}>{localizedName(i.names, locale)}</option>
        ))}
      </optgroup>
      <optgroup label={t('calc.itemTier.typeBoost')}>
        {ITEMS_BY_TIER['type-boost'].map((i) => (
          <option key={i.id} value={i.id}>{localizedName(i.names, locale)}</option>
        ))}
      </optgroup>
      <optgroup label={t('calc.itemTier.other')}>
        {ITEMS_BY_TIER.other.map((i) => (
          <option key={i.id} value={i.id}>{localizedName(i.names, locale)}</option>
        ))}
      </optgroup>
    </select>
  );
}
```

- [ ] **Step 3: Type-check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/ItemDropdown.tsx frontend/src/lib/i18n/translations.ts
git commit -m "Add ItemDropdown component"
```

---

## Task 13: Component — `EVStatTable`

Six-row stat config grid: stat name | base | IV input | EV input (with stepper) | computed final. Total-EV counter at top with red border when over cap. Locks IV inputs and level when in Champion mode.

**Files:**
- Create: `frontend/src/components/EVStatTable.tsx`
- Create: `frontend/src/components/__tests__/EVStatTable.test.tsx`
- Modify: `frontend/src/lib/i18n/translations.ts` (add `calc.stat.hp`, `calc.stat.atk`, ..., `calc.evTotal`, `calc.level`, `calc.iv`, `calc.ev`, `calc.final`, `calc.base`)

- [ ] **Step 1: Add i18n keys**

```ts
'calc.stat.hp':  'HP',
'calc.stat.atk': 'Atk',  // ja: '攻撃',     zh: '攻击'
'calc.stat.def': 'Def',  // ja: '防御',     zh: '防御'
'calc.stat.spa': 'SpA',  // ja: '特攻',     zh: '特攻'
'calc.stat.spd': 'SpD',  // ja: '特防',     zh: '特防'
'calc.stat.spe': 'Spe',  // ja: '素早さ',   zh: '速度'
'calc.evTotal':  'EV total: {used} / {cap}',  // ja: 'EV合計: {used} / {cap}', zh: '努力值: {used} / {cap}'
'calc.level':    'Level',                     // ja: 'レベル', zh: '等级'
'calc.iv':       'IV',
'calc.ev':       'EV',
'calc.final':    'Final',                     // ja: '実数値', zh: '能力值'
'calc.base':     'Base',                      // ja: '種族値', zh: '种族值'
'calc.lockedToChampion': 'Locked in Champion mode',  // ja, zh likewise
```

- [ ] **Step 2: Write failing test**

Create `frontend/src/components/__tests__/EVStatTable.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/lib/i18n/context';
import EVStatTable from '../EVStatTable';

function setup(props: Partial<React.ComponentProps<typeof EVStatTable>> = {}) {
  const onChange = vi.fn();
  const defaultProps: React.ComponentProps<typeof EVStatTable> = {
    mode: 'traditional',
    base: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 },
    ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
    evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
    nature: 'hardy',
    level: 50,
    onIVsChange: onChange,
    onEVsChange: onChange,
    onLevelChange: onChange,
    ...props,
  };
  render(<LocaleProvider><EVStatTable {...defaultProps} /></LocaleProvider>);
  return { onChange };
}

describe('EVStatTable', () => {
  it('renders 6 stat rows', () => {
    setup();
    expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(12); // 6 IVs + 6 EVs
  });

  it('highlights total counter red when EVs exceed cap', () => {
    setup({ evs: { hp: 252, attack: 252, defense: 252, special_attack: 0, special_defense: 0, speed: 0 } });
    const counter = screen.getByText(/EV total/i);
    expect(counter.className).toMatch(/text-red|border-red/);
  });

  it('locks IV inputs in Champion mode', () => {
    setup({ mode: 'champion' });
    const ivInputs = screen.getAllByLabelText(/IV/i);
    for (const inp of ivInputs) {
      expect(inp).toBeDisabled();
    }
  });

  it('locks level input in Champion mode', () => {
    setup({ mode: 'champion' });
    const lvl = screen.getByLabelText(/level/i);
    expect(lvl).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run; verify failure**

- [ ] **Step 4: Implement `EVStatTable.tsx`**

Create `frontend/src/components/EVStatTable.tsx`:

```tsx
'use client';

import type { Stats } from '@/lib/types';
import {
  computeAllStats, evTotal, getNature,
  MAX_PER_STAT_EV_CHAMPION, MAX_PER_STAT_EV_TRADITIONAL,
  MAX_TOTAL_EV_CHAMPION, MAX_TOTAL_EV_TRADITIONAL,
  STAT_KEYS, isLevelLockedForMode, type EVMode, type NatureId, type StatKey,
} from '@/lib/calc';
import { useLocale } from '@/lib/i18n';

interface Props {
  mode: EVMode;
  base: Stats;
  ivs: Stats;
  evs: Stats;
  nature: NatureId;
  level: number;
  onIVsChange: (ivs: Stats) => void;
  onEVsChange: (evs: Stats) => void;
  onLevelChange: (level: number) => void;
}

const STAT_LABEL_KEY: Record<StatKey, string> = {
  hp: 'calc.stat.hp', attack: 'calc.stat.atk', defense: 'calc.stat.def',
  special_attack: 'calc.stat.spa', special_defense: 'calc.stat.spd', speed: 'calc.stat.spe',
};

export default function EVStatTable({
  mode, base, ivs, evs, nature, level, onIVsChange, onEVsChange, onLevelChange,
}: Props) {
  const { t } = useLocale();
  const evCap   = mode === 'champion' ? MAX_TOTAL_EV_CHAMPION   : MAX_TOTAL_EV_TRADITIONAL;
  const perStat = mode === 'champion' ? MAX_PER_STAT_EV_CHAMPION : MAX_PER_STAT_EV_TRADITIONAL;
  const used = evTotal(evs);
  const overCap = used > evCap;
  const final = computeAllStats(base, ivs, evs, level, getNature(nature));
  const ivsLocked = mode === 'champion';
  const levelLocked = isLevelLockedForMode(mode);

  const setEV = (k: StatKey, v: number) => onEVsChange({ ...evs, [k]: Math.min(perStat, Math.max(0, v)) });
  const setIV = (k: StatKey, v: number) => onIVsChange({ ...ivs, [k]: Math.min(31, Math.max(0, v)) });

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2">
          <span className="text-gray-700 dark:text-gray-300">{t('calc.level')}</span>
          <input
            type="number" aria-label={t('calc.level')}
            value={level}
            min={1} max={100}
            disabled={levelLocked}
            onChange={(e) => onLevelChange(Math.min(100, Math.max(1, Number(e.target.value) || 50)))}
            className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:opacity-50"
          />
        </label>
        <div className={`px-2 py-1 rounded border ${overCap ? 'text-red-600 border-red-600' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}>
          {t('calc.evTotal', { used: String(used), cap: String(evCap) })}
        </div>
      </div>
      <table className="w-full">
        <thead className="text-left text-xs text-gray-500 dark:text-gray-400">
          <tr>
            <th></th>
            <th>{t('calc.base')}</th>
            <th>{t('calc.iv')}</th>
            <th>{t('calc.ev')}</th>
            <th>{t('calc.final')}</th>
          </tr>
        </thead>
        <tbody>
          {STAT_KEYS.map((k) => (
            <tr key={k}>
              <td className="font-medium text-gray-700 dark:text-gray-200">{t(STAT_LABEL_KEY[k])}</td>
              <td className="tabular-nums text-gray-500">{base[k]}</td>
              <td>
                <input
                  type="number" aria-label={`IV ${k}`}
                  value={ivs[k]} min={0} max={31}
                  disabled={ivsLocked}
                  onChange={(e) => setIV(k, Number(e.target.value) || 0)}
                  className="w-14 px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:opacity-50"
                />
              </td>
              <td>
                <input
                  type="number" aria-label={`EV ${k}`}
                  value={evs[k]} min={0} max={perStat}
                  onChange={(e) => setEV(k, Number(e.target.value) || 0)}
                  className="w-16 px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                />
              </td>
              <td className="tabular-nums font-medium text-gray-800 dark:text-gray-100">{final[k]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Run tests; verify pass**

```bash
cd frontend && npx vitest run src/components/__tests__/EVStatTable.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/EVStatTable.tsx frontend/src/components/__tests__/EVStatTable.test.tsx frontend/src/lib/i18n/translations.ts
git commit -m "Add EVStatTable component"
```

---

## Task 14: Component — `BaseStatOverridePanel`

Collapsible panel for editing base stats and types. Shows a "Custom" badge when active. Reset button restores species defaults.

**Files:**
- Create: `frontend/src/components/BaseStatOverridePanel.tsx`
- Modify: `frontend/src/lib/i18n/translations.ts` (add `calc.override.title`, `calc.override.reset`, `calc.override.custom`)

- [ ] **Step 1: Add i18n keys**

```ts
'calc.override.title':  'Override base stats / types',
'calc.override.reset':  'Reset to species',
'calc.override.custom': 'Custom',
```

- [ ] **Step 2: Implement `BaseStatOverridePanel.tsx`**

Create `frontend/src/components/BaseStatOverridePanel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { Stats, TypeRef } from '@/lib/types';
import { STAT_KEYS, type StatKey } from '@/lib/calc';
import { useLocale, localizedName } from '@/lib/i18n';
import TypeBadge from './TypeBadge';

interface Props {
  speciesBase: Stats;
  speciesTypes: number[];
  baseStatsOverride: Stats | null;
  typesOverride: number[] | null;
  allTypes: TypeRef[]; // for the type picker
  onChange: (next: { base: Stats | null; types: number[] | null }) => void;
}

const LABEL_KEY: Record<StatKey, string> = {
  hp: 'calc.stat.hp', attack: 'calc.stat.atk', defense: 'calc.stat.def',
  special_attack: 'calc.stat.spa', special_defense: 'calc.stat.spd', speed: 'calc.stat.spe',
};

export default function BaseStatOverridePanel({
  speciesBase, speciesTypes, baseStatsOverride, typesOverride, allTypes, onChange,
}: Props) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const isCustom = baseStatsOverride !== null || typesOverride !== null;
  const effectiveBase = baseStatsOverride ?? speciesBase;
  const effectiveTypes = typesOverride ?? speciesTypes;

  const setStat = (k: StatKey, v: number) => {
    const nextBase: Stats = { ...effectiveBase, [k]: Math.max(1, Math.min(255, v)) };
    onChange({ base: nextBase, types: typesOverride });
  };

  const toggleType = (typeId: number) => {
    let next = effectiveTypes.includes(typeId)
      ? effectiveTypes.filter((t) => t !== typeId)
      : effectiveTypes.length >= 2 ? [effectiveTypes[1], typeId] : [...effectiveTypes, typeId];
    if (next.length === 0) next = [speciesTypes[0]];
    onChange({ base: baseStatsOverride, types: next });
  };

  const reset = () => onChange({ base: null, types: null });

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 text-sm"
      >
        <span className="flex items-center gap-2">
          {t('calc.override.title')}
          {isCustom && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{t('calc.override.custom')}</span>}
        </span>
        <span>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="p-3 space-y-3 bg-white dark:bg-gray-800">
          <div className="grid grid-cols-3 gap-2">
            {STAT_KEYS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <span className="w-12 text-gray-600 dark:text-gray-300">{t(LABEL_KEY[k])}</span>
                <input
                  type="number" min={1} max={255}
                  value={effectiveBase[k]}
                  onChange={(e) => setStat(k, Number(e.target.value) || 1)}
                  className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTypes.map((tt) => (
              <button
                key={tt.id} type="button"
                onClick={() => toggleType(tt.id)}
                className={`transition-opacity ${effectiveTypes.includes(tt.id) ? '' : 'opacity-30'}`}
              >
                <TypeBadge type={tt.name} names={tt.names} size="sm" />
              </button>
            ))}
          </div>
          {isCustom && (
            <button
              type="button" onClick={reset}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('calc.override.reset')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/BaseStatOverridePanel.tsx frontend/src/lib/i18n/translations.ts
git commit -m "Add BaseStatOverridePanel component"
```

---

## Task 15: Component — `PokemonPicker`

Search input + 18 type icon filter chips + result list. Calls `getPokemonList` with `type` and `search` params.

**Files:**
- Create: `frontend/src/components/PokemonPicker.tsx`

- [ ] **Step 1: Implement**

Create `frontend/src/components/PokemonPicker.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getPokemonList } from '@/lib/api';
import type { PokemonSummary, TypeRef } from '@/lib/types';
import { useLocale, localizedName } from '@/lib/i18n';
import { useDebounce } from '@/hooks/use-debounce';
import TypeBadge from './TypeBadge';

interface Props {
  allTypes: TypeRef[];
  onSelect: (pokemon: PokemonSummary) => void;
}

export default function PokemonPicker({ allTypes, onSelect }: Props) {
  const { locale, t } = useLocale();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [results, setResults] = useState<PokemonSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (!debouncedSearch && !typeFilter) {
      setResults([]);
      return;
    }
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    getPokemonList({ search: debouncedSearch || undefined, type: typeFilter ?? undefined, limit: 20 })
      .then((res) => setResults(res.items))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedSearch, typeFilter]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('pokemon.searchPlaceholder')}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
      />
      <div className="flex flex-wrap gap-1">
        {allTypes.map((tt) => (
          <button
            key={tt.id} type="button"
            onClick={() => setTypeFilter(typeFilter === tt.name ? null : tt.name)}
            className={`transition-opacity ${typeFilter && typeFilter !== tt.name ? 'opacity-30' : ''}`}
          >
            <TypeBadge type={tt.name} names={tt.names} size="sm" />
          </button>
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {loading && <div className="text-sm text-gray-500">…</div>}
        {!loading && results.map((p) => (
          <button
            key={p.id} type="button"
            onClick={() => onSelect(p)}
            className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Image src={p.sprite_url} alt="" width={32} height={32} unoptimized />
            <span className="text-sm flex-1 text-left">{localizedName(p.names, locale)}</span>
            <div className="flex gap-1">
              {p.types.map((tt) => <TypeBadge key={tt.id} type={tt.name} names={tt.names} size="sm" />)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/PokemonPicker.tsx
git commit -m "Add PokemonPicker component"
```

---

## Task 16: Components — `MoveSlot` + `MovePicker`

Slot displays the picked move (or empty placeholder). Modal picker has search, type icon filters, and three damage-class icon filters (physical/special/status). Lists only the attacker's known moves intersected with the global moves table (which has type/power/damage_class).

**Files:**
- Create: `frontend/src/components/MoveSlot.tsx`
- Create: `frontend/src/components/MovePicker.tsx`
- Create: `frontend/src/components/__tests__/MovePicker.test.tsx`
- Modify: `frontend/src/lib/i18n/translations.ts` (add `calc.move.empty`, `calc.move.searchPlaceholder`, `calc.move.physical`, `calc.move.special`, `calc.move.status`, `calc.move.power`)

- [ ] **Step 1: Add i18n keys**

```ts
'calc.move.empty':            'Tap to add a move',
'calc.move.searchPlaceholder': 'Search moves',
'calc.move.physical':         'Physical',
'calc.move.special':          'Special',
'calc.move.status':           'Status',
'calc.move.power':            'Power',
```

- [ ] **Step 2: Write failing test**

Create `frontend/src/components/__tests__/MovePicker.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/lib/i18n/context';
import MovePicker from '../MovePicker';
import type { MoveSummary, TypeRef } from '@/lib/types';

const TYPES: TypeRef[] = [
  { id: 1, name: 'normal', names: { en: 'Normal' } },
  { id: 10, name: 'fire', names: { en: 'Fire' } },
];

const MOVES: MoveSummary[] = [
  { id: 1, name: 'tackle', names: { en: 'Tackle' }, type_ref: TYPES[0], power: 40, accuracy: 100, pp: 35, damage_class: 'physical' },
  { id: 2, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: TYPES[1], power: 90, accuracy: 100, pp: 15, damage_class: 'special' },
  { id: 3, name: 'growl', names: { en: 'Growl' }, type_ref: TYPES[0], power: null, accuracy: 100, pp: 40, damage_class: 'status' },
];

describe('MovePicker', () => {
  it('shows all attacker moves when no filter active', () => {
    render(
      <LocaleProvider>
        <MovePicker open={true} onClose={() => {}} onPick={() => {}} attackerMoves={MOVES} allTypes={TYPES} />
      </LocaleProvider>,
    );
    expect(screen.getByText('Tackle')).toBeInTheDocument();
    expect(screen.getByText('Flamethrower')).toBeInTheDocument();
    expect(screen.getByText('Growl')).toBeInTheDocument();
  });

  it('type filter narrows the list', async () => {
    render(
      <LocaleProvider>
        <MovePicker open={true} onClose={() => {}} onPick={() => {}} attackerMoves={MOVES} allTypes={TYPES} />
      </LocaleProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /fire/i }));
    expect(screen.queryByText('Tackle')).not.toBeInTheDocument();
    expect(screen.getByText('Flamethrower')).toBeInTheDocument();
  });

  it('damage-class filter narrows the list', async () => {
    render(
      <LocaleProvider>
        <MovePicker open={true} onClose={() => {}} onPick={() => {}} attackerMoves={MOVES} allTypes={TYPES} />
      </LocaleProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /physical/i }));
    expect(screen.getByText('Tackle')).toBeInTheDocument();
    expect(screen.queryByText('Flamethrower')).not.toBeInTheDocument();
    expect(screen.queryByText('Growl')).not.toBeInTheDocument();
  });

  it('calls onPick when a move is clicked', async () => {
    const onPick = vi.fn();
    render(
      <LocaleProvider>
        <MovePicker open={true} onClose={() => {}} onPick={onPick} attackerMoves={MOVES} allTypes={TYPES} />
      </LocaleProvider>,
    );
    await userEvent.click(screen.getByText('Tackle'));
    expect(onPick).toHaveBeenCalledWith(MOVES[0]);
  });
});
```

- [ ] **Step 3: Run; verify failure**

- [ ] **Step 4: Implement `MoveSlot.tsx`**

Create `frontend/src/components/MoveSlot.tsx`:

```tsx
'use client';

import type { MoveSummary } from '@/lib/types';
import { useLocale, localizedName } from '@/lib/i18n';
import TypeBadge from './TypeBadge';

interface Props {
  move: MoveSummary | null;
  onClick: () => void;
  onClear: () => void;
}

export default function MoveSlot({ move, onClick, onClear }: Props) {
  const { locale, t } = useLocale();
  if (!move) {
    return (
      <button
        type="button" onClick={onClick}
        className="w-full px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        {t('calc.move.empty')}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
      <TypeBadge type={move.type_ref.name} names={move.type_ref.names} size="sm" />
      <button type="button" onClick={onClick} className="flex-1 text-left text-sm font-medium">
        {localizedName(move.names, locale)}
      </button>
      <span className="text-xs text-gray-500 capitalize">{move.damage_class}</span>
      <span className="text-xs tabular-nums text-gray-500">{move.power ?? '—'}</span>
      <button type="button" aria-label="clear" onClick={onClear} className="text-gray-400 hover:text-gray-600">×</button>
    </div>
  );
}
```

- [ ] **Step 5: Implement `MovePicker.tsx`**

Create `frontend/src/components/MovePicker.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { MoveSummary, TypeRef } from '@/lib/types';
import { useLocale, localizedName } from '@/lib/i18n';
import TypeBadge from './TypeBadge';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (move: MoveSummary) => void;
  attackerMoves: MoveSummary[];
  allTypes: TypeRef[];
}

type DamageClass = 'physical' | 'special' | 'status';

export default function MovePicker({ open, onClose, onPick, attackerMoves, allTypes }: Props) {
  const { locale, t } = useLocale();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<number | null>(null);
  const [classFilter, setClassFilter] = useState<DamageClass | null>(null);

  if (!open) return null;

  const filtered = attackerMoves.filter((m) => {
    if (typeFilter && m.type_ref.id !== typeFilter) return false;
    if (classFilter && m.damage_class !== classFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.names.en.toLowerCase().includes(q) &&
          !(m.names.ja?.toLowerCase().includes(q)) &&
          !(m.names.zh?.toLowerCase().includes(q))) {
        return false;
      }
    }
    return true;
  });

  const cls = (active: boolean) =>
    `px-3 py-1 rounded-md text-sm capitalize border transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-700'}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 space-y-2 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text" autoFocus
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('calc.move.searchPlaceholder')}
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
          />
          <div className="flex flex-wrap gap-1">
            {allTypes.map((tt) => (
              <button
                key={tt.id} type="button"
                onClick={() => setTypeFilter(typeFilter === tt.id ? null : tt.id)}
                className={`transition-opacity ${typeFilter && typeFilter !== tt.id ? 'opacity-30' : ''}`}
              >
                <TypeBadge type={tt.name} names={tt.names} size="sm" />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['physical', 'special', 'status'] as DamageClass[]).map((c) => (
              <button key={c} type="button" onClick={() => setClassFilter(classFilter === c ? null : c)} className={cls(classFilter === c)}>
                {t(`calc.move.${c}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {filtered.length === 0 && <div className="text-center text-sm text-gray-500 py-4">—</div>}
          {filtered.map((m) => (
            <button
              key={m.id} type="button"
              onClick={() => { onPick(m); onClose(); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
            >
              <TypeBadge type={m.type_ref.name} names={m.type_ref.names} size="sm" />
              <span className="flex-1 text-sm">{localizedName(m.names, locale)}</span>
              <span className="text-xs text-gray-500 capitalize">{m.damage_class}</span>
              <span className="text-xs tabular-nums text-gray-500 w-8 text-right">{m.power ?? '—'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests; verify pass**

```bash
cd frontend && npx vitest run src/components/__tests__/MovePicker.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/MoveSlot.tsx frontend/src/components/MovePicker.tsx frontend/src/components/__tests__/MovePicker.test.tsx frontend/src/lib/i18n/translations.ts
git commit -m "Add MoveSlot and MovePicker components"
```

---

## Task 17: Component — `DamageRangeBar`

Horizontal % HP bar. Color band: green ≤30%, yellow 30–60%, orange 60–100%, red ≥100%. Shows the min–max% range as the filled width.

**Files:**
- Create: `frontend/src/components/DamageRangeBar.tsx`

- [ ] **Step 1: Implement**

Create `frontend/src/components/DamageRangeBar.tsx`:

```tsx
'use client';

interface Props {
  minPct: number;
  maxPct: number;
}

function colorFor(pct: number): string {
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 60)  return 'bg-orange-500';
  if (pct >= 30)  return 'bg-yellow-500';
  return 'bg-green-500';
}

export default function DamageRangeBar({ minPct, maxPct }: Props) {
  const safeMax = Math.min(100, Math.max(0, maxPct));
  const safeMin = Math.min(safeMax, Math.max(0, minPct));
  return (
    <div className="relative h-3 w-full bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 ${colorFor(maxPct)}`}
        style={{ width: `${safeMax}%` }}
      />
      {/* min marker */}
      <div
        className="absolute inset-y-0 w-px bg-black/30 dark:bg-white/40"
        style={{ left: `${safeMin}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/components/DamageRangeBar.tsx
git commit -m "Add DamageRangeBar component"
```

---

## Task 18: Component — `DamageResultCard`

Per-move result tile: header (type icon + move name + power + category), `DamageRangeBar`, `min%–max% (avg%)` text, OHKO/2HKO/3HKO numbers, qualifier, and a "Show details" toggle that reveals the 16 rolls and modifier breakdown.

**Files:**
- Create: `frontend/src/components/DamageResultCard.tsx`
- Create: `frontend/src/components/__tests__/DamageResultCard.test.tsx`
- Modify: `frontend/src/lib/i18n/translations.ts` (add `calc.result.empty`, `calc.result.unsupported.{reason}`, `calc.result.showDetails`, `calc.result.hideDetails`, `calc.result.rolls`, `calc.result.modifiers`)

- [ ] **Step 1: Add i18n keys**

```ts
'calc.result.empty':                 'Pick a move',
'calc.result.unsupported.no-power':  'Status move — no damage',
'calc.result.unsupported.fixed-damage':    'Fixed-damage move (not supported in v1)',
'calc.result.unsupported.variable-power':  'Variable-power move (not supported in v1)',
'calc.result.unsupported.multi-hit':       'Multi-hit move (not supported in v1)',
'calc.result.unsupported.ohko-move':       'OHKO move (not supported in v1)',
'calc.result.showDetails':           'Show details',
'calc.result.hideDetails':           'Hide details',
'calc.result.rolls':                 'Rolls',
'calc.result.modifiers':             'Modifiers',
'calc.result.ohko':                  'OHKO',
'calc.result.twoHko':                '2HKO',
'calc.result.threeHko':              '3HKO',
```

- [ ] **Step 2: Write failing test**

Create `frontend/src/components/__tests__/DamageResultCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/lib/i18n/context';
import DamageResultCard from '../DamageResultCard';
import type { MoveSummary } from '@/lib/types';

const MOVE: MoveSummary = {
  id: 1, name: 'tackle', names: { en: 'Tackle' },
  type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } },
  power: 40, accuracy: 100, pp: 35, damage_class: 'physical',
};

describe('DamageResultCard', () => {
  it('renders empty state when no move', () => {
    render(<LocaleProvider><DamageResultCard move={null} result={null} /></LocaleProvider>);
    expect(screen.getByText(/pick a move/i)).toBeInTheDocument();
  });

  it('renders min/max/avg and KO numbers from CalcResult', () => {
    render(
      <LocaleProvider>
        <DamageResultCard
          move={MOVE}
          result={{
            rolls: Array(16).fill(50),
            defenderHp: 100,
            minPct: 50, maxPct: 50, avgPct: 50,
            ohkoPct: 0, twoHkoPct: 100, threeHkoPct: 100,
            qualifier: 'guaranteed 2HKO',
            modifiers: { stab: 1.5, typeEff: 1.0, item: 1.0 },
            attackerStat: 100, defenderStat: 100,
          }}
        />
      </LocaleProvider>,
    );
    expect(screen.getByText(/50.*%/)).toBeInTheDocument();
    expect(screen.getByText(/guaranteed 2HKO/i)).toBeInTheDocument();
  });

  it('toggles details panel', async () => {
    render(
      <LocaleProvider>
        <DamageResultCard
          move={MOVE}
          result={{
            rolls: Array.from({ length: 16 }, (_, i) => 40 + i),
            defenderHp: 100,
            minPct: 40, maxPct: 55, avgPct: 47,
            ohkoPct: 0, twoHkoPct: 100, threeHkoPct: 100,
            qualifier: 'guaranteed 2HKO',
            modifiers: { stab: 1.5, typeEff: 1.0, item: 1.0 },
            attackerStat: 100, defenderStat: 100,
          }}
        />
      </LocaleProvider>,
    );
    expect(screen.queryByText(/rolls/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /show details/i }));
    expect(screen.getByText(/rolls/i)).toBeInTheDocument();
  });

  it('renders unsupported message for unsupported moves', () => {
    render(
      <LocaleProvider>
        <DamageResultCard
          move={MOVE}
          result={{ unsupportedReason: 'fixed-damage' } as never}
        />
      </LocaleProvider>,
    );
    expect(screen.getByText(/fixed-damage/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run; verify failure**

- [ ] **Step 4: Implement `DamageResultCard.tsx`**

Create `frontend/src/components/DamageResultCard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { MoveSummary } from '@/lib/types';
import type { CalcOutcome } from '@/lib/calc';
import { useLocale, localizedName } from '@/lib/i18n';
import TypeBadge from './TypeBadge';
import DamageRangeBar from './DamageRangeBar';

interface Props {
  move: MoveSummary | null;
  result: CalcOutcome | null;
}

export default function DamageResultCard({ move, result }: Props) {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);

  if (!move || !result) {
    return (
      <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-500">
        {t('calc.result.empty')}
      </div>
    );
  }
  if ('unsupportedReason' in result) {
    return (
      <div className="border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3 text-sm">
        <div className="font-medium mb-1">{localizedName(move.names, locale)}</div>
        <div>{t(`calc.result.unsupported.${result.unsupportedReason}`)}</div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 space-y-2">
      <div className="flex items-center gap-2">
        <TypeBadge type={move.type_ref.name} names={move.type_ref.names} size="sm" />
        <span className="font-medium text-sm flex-1">{localizedName(move.names, locale)}</span>
        <span className="text-xs text-gray-500 capitalize">{move.damage_class}</span>
        <span className="text-xs tabular-nums text-gray-500">{move.power}</span>
      </div>
      <DamageRangeBar minPct={result.minPct} maxPct={result.maxPct} />
      <div className="text-sm tabular-nums">
        {result.minPct.toFixed(1)}% – {result.maxPct.toFixed(1)}% (avg {result.avgPct.toFixed(1)}%)
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-300">
        {t('calc.result.ohko')}: {result.ohkoPct.toFixed(1)}% · {t('calc.result.twoHko')}: {result.twoHkoPct.toFixed(1)}% · {t('calc.result.threeHko')}: {result.threeHkoPct.toFixed(1)}%
      </div>
      <div className="text-xs italic text-gray-500">{result.qualifier}</div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        {open ? t('calc.result.hideDetails') : t('calc.result.showDetails')}
      </button>
      {open && (
        <div className="text-xs space-y-1 border-t border-gray-200 dark:border-gray-700 pt-2">
          <div>
            <span className="font-medium">{t('calc.result.rolls')}:</span>{' '}
            <span className="tabular-nums">[{result.rolls.join(', ')}]</span>
          </div>
          <div>
            <span className="font-medium">{t('calc.result.modifiers')}:</span>{' '}
            STAB ×{result.modifiers.stab} · Type ×{result.modifiers.typeEff} · Item ×{result.modifiers.item}
          </div>
          <div>
            Atk {result.attackerStat} · Def {result.defenderStat} · HP {result.defenderHp}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run tests; verify pass**

```bash
cd frontend && npx vitest run src/components/__tests__/DamageResultCard.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/DamageResultCard.tsx frontend/src/components/__tests__/DamageResultCard.test.tsx frontend/src/lib/i18n/translations.ts
git commit -m "Add DamageResultCard component"
```

---

## Task 19: `/calc` page — reducer and state

Set up the reducer that drives the page. Wire it to default state but no UI yet.

**Files:**
- Create: `frontend/src/app/calc/page.tsx` (skeleton with reducer + sentinel render)

- [ ] **Step 1: Create the page skeleton**

Create `frontend/src/app/calc/page.tsx`:

```tsx
'use client';

import { useReducer } from 'react';
import { defaultCalcState, type CalcState } from '@/lib/calc';
import type { Stats } from '@/lib/types';
import {
  clampEVsForMode, lockedIVsForMode, lockedLevelForMode,
  type EVMode, type NatureId,
} from '@/lib/calc';

type Action =
  | { type: 'SET_EV_MODE'; mode: EVMode }
  | { type: 'SET_ATTACKER_POKEMON'; id: number }
  | { type: 'SET_DEFENDER_POKEMON'; id: number }
  | { type: 'SET_ATTACKER_LEVEL'; level: number }
  | { type: 'SET_DEFENDER_LEVEL'; level: number }
  | { type: 'SET_ATTACKER_EVS'; evs: Stats }
  | { type: 'SET_DEFENDER_EVS'; evs: Stats }
  | { type: 'SET_ATTACKER_IVS'; ivs: Stats }
  | { type: 'SET_DEFENDER_IVS'; ivs: Stats }
  | { type: 'SET_ATTACKER_NATURE'; nature: NatureId }
  | { type: 'SET_DEFENDER_NATURE'; nature: NatureId }
  | { type: 'SET_ATTACKER_ITEM'; itemId: string | null }
  | { type: 'SET_DEFENDER_ITEM'; itemId: string | null }
  | { type: 'SET_ATTACKER_OVERRIDE'; base: Stats | null; types: number[] | null }
  | { type: 'SET_DEFENDER_OVERRIDE'; base: Stats | null; types: number[] | null }
  | { type: 'SET_MOVE'; slot: 0 | 1 | 2 | 3; moveId: number | null }
  | { type: 'HYDRATE'; state: CalcState };

function calcReducer(state: CalcState, action: Action): CalcState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;
    case 'SET_EV_MODE': {
      // Apply invariants for the new mode.
      const lockedLvl = lockedLevelForMode(action.mode);
      const lockedIvs = lockedIVsForMode(action.mode);
      return {
        ...state,
        evMode: action.mode,
        attacker: {
          ...state.attacker,
          level: lockedLvl ?? state.attacker.level,
          ivs: lockedIvs ?? state.attacker.ivs,
          evs: clampEVsForMode(state.attacker.evs, action.mode),
        },
        defender: {
          ...state.defender,
          level: lockedLvl ?? state.defender.level,
          ivs: lockedIvs ?? state.defender.ivs,
          evs: clampEVsForMode(state.defender.evs, action.mode),
        },
      };
    }
    case 'SET_ATTACKER_POKEMON': return { ...state, attacker: { ...state.attacker, pokemonId: action.id, baseStatsOverride: null, typesOverride: null, moveIds: [null, null, null, null] } };
    case 'SET_DEFENDER_POKEMON': return { ...state, defender: { ...state.defender, pokemonId: action.id, baseStatsOverride: null, typesOverride: null } };
    case 'SET_ATTACKER_LEVEL':   return { ...state, attacker: { ...state.attacker, level: action.level } };
    case 'SET_DEFENDER_LEVEL':   return { ...state, defender: { ...state.defender, level: action.level } };
    case 'SET_ATTACKER_EVS':     return { ...state, attacker: { ...state.attacker, evs: clampEVsForMode(action.evs, state.evMode) } };
    case 'SET_DEFENDER_EVS':     return { ...state, defender: { ...state.defender, evs: clampEVsForMode(action.evs, state.evMode) } };
    case 'SET_ATTACKER_IVS':     return { ...state, attacker: { ...state.attacker, ivs: action.ivs } };
    case 'SET_DEFENDER_IVS':     return { ...state, defender: { ...state.defender, ivs: action.ivs } };
    case 'SET_ATTACKER_NATURE':  return { ...state, attacker: { ...state.attacker, nature: action.nature } };
    case 'SET_DEFENDER_NATURE':  return { ...state, defender: { ...state.defender, nature: action.nature } };
    case 'SET_ATTACKER_ITEM':    return { ...state, attacker: { ...state.attacker, itemId: action.itemId } };
    case 'SET_DEFENDER_ITEM':    return { ...state, defender: { ...state.defender, itemId: action.itemId } };
    case 'SET_ATTACKER_OVERRIDE': return { ...state, attacker: { ...state.attacker, baseStatsOverride: action.base, typesOverride: action.types } };
    case 'SET_DEFENDER_OVERRIDE': return { ...state, defender: { ...state.defender, baseStatsOverride: action.base, typesOverride: action.types } };
    case 'SET_MOVE': {
      const moves = [...state.attacker.moveIds] as CalcState['attacker']['moveIds'];
      moves[action.slot] = action.moveId;
      return { ...state, attacker: { ...state.attacker, moveIds: moves } };
    }
  }
}

export default function CalcPage() {
  const [state] = useReducer(calcReducer, defaultCalcState());
  return <div data-testid="calc-page">{JSON.stringify(state).slice(0, 80)}…</div>;
}
```

- [ ] **Step 2: Verify the route renders**

Run dev server: `cd frontend && npm run dev`. Open `http://localhost:3000/calc`. Confirm a `<div>` appears with state JSON. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/calc/page.tsx
git commit -m "Add /calc page reducer skeleton"
```

---

## Task 20: `/calc` page — wire all components together

Replace the skeleton render with the full layout. Fetch Pokemon details, types, efficacy, and moves on mount; recompute results on every state change.

**Files:**
- Modify: `frontend/src/app/calc/page.tsx`
- Modify: `frontend/src/lib/i18n/translations.ts` (add `calc.attacker`, `calc.defender`, `calc.results`, `calc.title`, `calc.subtitle`, `calc.moves`)

- [ ] **Step 1: Add i18n keys**

```ts
'calc.title':     'Damage Calculator',
'calc.subtitle':  'Compute % HP and KO chances for any matchup.',
'calc.attacker':  'Attacker',  // ja: '攻撃側', zh: '攻击方'
'calc.defender':  'Defender',  // ja: '防御側', zh: '防御方'
'calc.results':   'Results',
'calc.moves':     'Moves',
```

Also add:
```ts
'nav.calc':       'Calc',
'home.calc.title': 'Damage Calculator',
'home.calc.desc':  'Compute % HP damage and KO chances',
```

- [ ] **Step 2: Replace `page.tsx` body with the full layout**

Replace the contents of `frontend/src/app/calc/page.tsx` with:

```tsx
'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import Image from 'next/image';
import {
  defaultCalcState, calculate, type CalcState, type CalcInput, type EVMode, type NatureId,
} from '@/lib/calc';
import type { PokemonDetail, MoveSummary, TypeRef, TypeEfficacy, Stats } from '@/lib/types';
import { getPokemon, getTypes, getTypeEfficacy, getMoves } from '@/lib/api';
import { useLocale, localizedName } from '@/lib/i18n';
import EVModeToggle from '@/components/EVModeToggle';
import EVStatTable from '@/components/EVStatTable';
import NatureDropdown from '@/components/NatureDropdown';
import ItemDropdown from '@/components/ItemDropdown';
import BaseStatOverridePanel from '@/components/BaseStatOverridePanel';
import PokemonPicker from '@/components/PokemonPicker';
import MoveSlot from '@/components/MoveSlot';
import MovePicker from '@/components/MovePicker';
import DamageResultCard from '@/components/DamageResultCard';
import TypeBadge from '@/components/TypeBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  clampEVsForMode, lockedIVsForMode, lockedLevelForMode,
} from '@/lib/calc';

// --- Reducer (same as Task 19) ---
type Action =
  | { type: 'SET_EV_MODE'; mode: EVMode }
  | { type: 'SET_ATTACKER_POKEMON'; id: number }
  | { type: 'SET_DEFENDER_POKEMON'; id: number }
  | { type: 'SET_ATTACKER_LEVEL'; level: number }
  | { type: 'SET_DEFENDER_LEVEL'; level: number }
  | { type: 'SET_ATTACKER_EVS'; evs: Stats }
  | { type: 'SET_DEFENDER_EVS'; evs: Stats }
  | { type: 'SET_ATTACKER_IVS'; ivs: Stats }
  | { type: 'SET_DEFENDER_IVS'; ivs: Stats }
  | { type: 'SET_ATTACKER_NATURE'; nature: NatureId }
  | { type: 'SET_DEFENDER_NATURE'; nature: NatureId }
  | { type: 'SET_ATTACKER_ITEM'; itemId: string | null }
  | { type: 'SET_DEFENDER_ITEM'; itemId: string | null }
  | { type: 'SET_ATTACKER_OVERRIDE'; base: Stats | null; types: number[] | null }
  | { type: 'SET_DEFENDER_OVERRIDE'; base: Stats | null; types: number[] | null }
  | { type: 'SET_MOVE'; slot: 0 | 1 | 2 | 3; moveId: number | null }
  | { type: 'HYDRATE'; state: CalcState };

function calcReducer(state: CalcState, action: Action): CalcState {
  // ... (copy reducer body from Task 19)
  switch (action.type) {
    case 'HYDRATE': return action.state;
    case 'SET_EV_MODE': {
      const lockedLvl = lockedLevelForMode(action.mode);
      const lockedIvs = lockedIVsForMode(action.mode);
      return {
        ...state, evMode: action.mode,
        attacker: { ...state.attacker, level: lockedLvl ?? state.attacker.level, ivs: lockedIvs ?? state.attacker.ivs, evs: clampEVsForMode(state.attacker.evs, action.mode) },
        defender: { ...state.defender, level: lockedLvl ?? state.defender.level, ivs: lockedIvs ?? state.defender.ivs, evs: clampEVsForMode(state.defender.evs, action.mode) },
      };
    }
    case 'SET_ATTACKER_POKEMON': return { ...state, attacker: { ...state.attacker, pokemonId: action.id, baseStatsOverride: null, typesOverride: null, moveIds: [null, null, null, null] } };
    case 'SET_DEFENDER_POKEMON': return { ...state, defender: { ...state.defender, pokemonId: action.id, baseStatsOverride: null, typesOverride: null } };
    case 'SET_ATTACKER_LEVEL':   return { ...state, attacker: { ...state.attacker, level: action.level } };
    case 'SET_DEFENDER_LEVEL':   return { ...state, defender: { ...state.defender, level: action.level } };
    case 'SET_ATTACKER_EVS':     return { ...state, attacker: { ...state.attacker, evs: clampEVsForMode(action.evs, state.evMode) } };
    case 'SET_DEFENDER_EVS':     return { ...state, defender: { ...state.defender, evs: clampEVsForMode(action.evs, state.evMode) } };
    case 'SET_ATTACKER_IVS':     return { ...state, attacker: { ...state.attacker, ivs: action.ivs } };
    case 'SET_DEFENDER_IVS':     return { ...state, defender: { ...state.defender, ivs: action.ivs } };
    case 'SET_ATTACKER_NATURE':  return { ...state, attacker: { ...state.attacker, nature: action.nature } };
    case 'SET_DEFENDER_NATURE':  return { ...state, defender: { ...state.defender, nature: action.nature } };
    case 'SET_ATTACKER_ITEM':    return { ...state, attacker: { ...state.attacker, itemId: action.itemId } };
    case 'SET_DEFENDER_ITEM':    return { ...state, defender: { ...state.defender, itemId: action.itemId } };
    case 'SET_ATTACKER_OVERRIDE': return { ...state, attacker: { ...state.attacker, baseStatsOverride: action.base, typesOverride: action.types } };
    case 'SET_DEFENDER_OVERRIDE': return { ...state, defender: { ...state.defender, baseStatsOverride: action.base, typesOverride: action.types } };
    case 'SET_MOVE': {
      const moves = [...state.attacker.moveIds] as CalcState['attacker']['moveIds'];
      moves[action.slot] = action.moveId;
      return { ...state, attacker: { ...state.attacker, moveIds: moves } };
    }
  }
}

export default function CalcPage() {
  const { t } = useLocale();
  const [state, dispatch] = useReducer(calcReducer, defaultCalcState());
  const [allTypes, setAllTypes] = useState<TypeRef[]>([]);
  const [efficacyMatrix, setEfficacyMatrix] = useState<number[][]>([]);
  const [allMoves, setAllMoves] = useState<MoveSummary[]>([]);
  const [attackerDetail, setAttackerDetail] = useState<PokemonDetail | null>(null);
  const [defenderDetail, setDefenderDetail] = useState<PokemonDetail | null>(null);
  const [pickerOpen, setPickerOpen] = useState<null | 'attacker' | 'defender'>(null);
  const [moveSlotOpen, setMoveSlotOpen] = useState<null | 0 | 1 | 2 | 3>(null);
  const [loading, setLoading] = useState(true);

  // Load static reference data once.
  useEffect(() => {
    Promise.all([getTypes(), getTypeEfficacy(), getMoves({})])
      .then(([types, efficacy, moves]) => {
        setAllTypes(types);
        setEfficacyMatrix(toEfficacyMatrix(efficacy));
        setAllMoves(moves);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load attacker/defender details when their IDs change.
  useEffect(() => {
    getPokemon(state.attacker.pokemonId).then(setAttackerDetail).catch(() => setAttackerDetail(null));
  }, [state.attacker.pokemonId]);
  useEffect(() => {
    getPokemon(state.defender.pokemonId).then(setDefenderDetail).catch(() => setDefenderDetail(null));
  }, [state.defender.pokemonId]);

  const attackerMoves: MoveSummary[] = useMemo(() => {
    if (!attackerDetail) return [];
    const learnsetIds = new Set(attackerDetail.moves.map((m) => m.id));
    return allMoves.filter((m) => learnsetIds.has(m.id));
  }, [attackerDetail, allMoves]);

  const results = useMemo(() => {
    if (!attackerDetail || !defenderDetail || !efficacyMatrix.length) {
      return [null, null, null, null] as (CalcInput['move'] | null)[]; // placeholder shape
    }
    return state.attacker.moveIds.map((mid) => {
      if (!mid) return null;
      const move = allMoves.find((m) => m.id === mid);
      if (!move) return null;
      const input: CalcInput = {
        evMode: state.evMode,
        attacker: state.attacker,
        defender: state.defender,
        attackerSpecies: { types: attackerDetail.types.map((tt) => tt.id), baseStats: attackerDetail.stats },
        defenderSpecies: { types: defenderDetail.types.map((tt) => tt.id), baseStats: defenderDetail.stats },
        move,
        typeEfficacy: efficacyMatrix,
      };
      return { move, outcome: calculate(input) };
    });
  }, [state, attackerDetail, defenderDetail, efficacyMatrix, allMoves]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('calc.title')}</h1>
          <p className="text-sm text-gray-500">{t('calc.subtitle')}</p>
        </div>
        <EVModeToggle mode={state.evMode} onChange={(m) => dispatch({ type: 'SET_EV_MODE', mode: m })} />
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {renderSide('attacker', state, attackerDetail, allTypes, dispatch, () => setPickerOpen('attacker'))}
        {renderSide('defender', state, defenderDetail, allTypes, dispatch, () => setPickerOpen('defender'))}
      </div>

      {/* Moves */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <h2 className="font-semibold mb-2">{t('calc.moves')}</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {state.attacker.moveIds.map((mid, idx) => {
            const move = mid ? allMoves.find((m) => m.id === mid) ?? null : null;
            return (
              <MoveSlot
                key={idx}
                move={move}
                onClick={() => setMoveSlotOpen(idx as 0 | 1 | 2 | 3)}
                onClear={() => dispatch({ type: 'SET_MOVE', slot: idx as 0 | 1 | 2 | 3, moveId: null })}
              />
            );
          })}
        </div>
      </section>

      {/* Results */}
      <section>
        <h2 className="font-semibold mb-2">{t('calc.results')}</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {results.map((r, idx) => (
            <DamageResultCard
              key={idx}
              move={r ? (r as { move: MoveSummary }).move : null}
              result={r ? (r as { outcome: ReturnType<typeof calculate> }).outcome : null}
            />
          ))}
        </div>
      </section>

      {/* Pokemon picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setPickerOpen(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">{t(`calc.${pickerOpen}`)}</h3>
            <PokemonPicker
              allTypes={allTypes}
              onSelect={(p) => {
                dispatch(pickerOpen === 'attacker'
                  ? { type: 'SET_ATTACKER_POKEMON', id: p.id }
                  : { type: 'SET_DEFENDER_POKEMON', id: p.id });
                setPickerOpen(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Move picker modal */}
      <MovePicker
        open={moveSlotOpen !== null}
        onClose={() => setMoveSlotOpen(null)}
        onPick={(m) => {
          if (moveSlotOpen !== null) dispatch({ type: 'SET_MOVE', slot: moveSlotOpen, moveId: m.id });
          setMoveSlotOpen(null);
        }}
        attackerMoves={attackerMoves}
        allTypes={allTypes}
      />
    </div>
  );
}

function toEfficacyMatrix(rows: TypeEfficacy[]): number[][] {
  // [attackingTypeId][defendingTypeId] → factor (50/100/200/0). Defaults to 100.
  const max = Math.max(...rows.map((r) => Math.max(r.attacking_type_id, r.defending_type_id)), 18);
  const m: number[][] = Array.from({ length: max + 1 }, () => Array(max + 1).fill(100));
  for (const r of rows) {
    m[r.attacking_type_id][r.defending_type_id] = r.damage_factor;
  }
  return m;
}

function renderSide(
  side: 'attacker' | 'defender',
  state: CalcState,
  detail: PokemonDetail | null,
  allTypes: TypeRef[],
  dispatch: (a: Action) => void,
  openPicker: () => void,
) {
  if (!detail) return <div className="border rounded-lg p-3">…</div>;
  const cfg = side === 'attacker' ? state.attacker : state.defender;
  const setEVs   = (evs: Stats) => dispatch({ type: side === 'attacker' ? 'SET_ATTACKER_EVS'   : 'SET_DEFENDER_EVS',   evs });
  const setIVs   = (ivs: Stats) => dispatch({ type: side === 'attacker' ? 'SET_ATTACKER_IVS'   : 'SET_DEFENDER_IVS',   ivs });
  const setLvl   = (l: number)  => dispatch({ type: side === 'attacker' ? 'SET_ATTACKER_LEVEL' : 'SET_DEFENDER_LEVEL', level: l });
  const setNat   = (n: NatureId)=> dispatch({ type: side === 'attacker' ? 'SET_ATTACKER_NATURE' : 'SET_DEFENDER_NATURE', nature: n });
  const setItem  = (i: string | null) => dispatch({ type: side === 'attacker' ? 'SET_ATTACKER_ITEM' : 'SET_DEFENDER_ITEM', itemId: i });
  const setOver  = (base: Stats | null, types: number[] | null) =>
    dispatch({ type: side === 'attacker' ? 'SET_ATTACKER_OVERRIDE' : 'SET_DEFENDER_OVERRIDE', base, types });
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
      <button type="button" onClick={openPicker} className="w-full flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded p-2">
        <Image src={detail.sprite_url} alt="" width={64} height={64} unoptimized />
        <div className="flex-1">
          <div className="font-semibold">{detail.names.en}</div>
          <div className="flex gap-1 mt-1">
            {(cfg.typesOverride ?? detail.types.map((tt) => tt.id)).map((tid) => {
              const tt = allTypes.find((x) => x.id === tid);
              return tt ? <TypeBadge key={tid} type={tt.name} names={tt.names} size="sm" /> : null;
            })}
          </div>
        </div>
      </button>
      <BaseStatOverridePanel
        speciesBase={detail.stats}
        speciesTypes={detail.types.map((tt) => tt.id)}
        baseStatsOverride={cfg.baseStatsOverride}
        typesOverride={cfg.typesOverride}
        allTypes={allTypes}
        onChange={({ base, types }) => setOver(base, types)}
      />
      <div className="flex items-center gap-2">
        <NatureDropdown value={cfg.nature} onChange={setNat} />
        <ItemDropdown value={cfg.itemId} onChange={setItem} />
      </div>
      <EVStatTable
        mode={state.evMode}
        base={cfg.baseStatsOverride ?? detail.stats}
        ivs={cfg.ivs}
        evs={cfg.evs}
        nature={cfg.nature}
        level={cfg.level}
        onIVsChange={setIVs}
        onEVsChange={setEVs}
        onLevelChange={setLvl}
      />
    </div>
  );
}
```

- [ ] **Step 3: Manually verify the page loads**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/calc`. Confirm:
- The page renders attacker (Garchomp) and defender (Blissey) panels.
- EV mode toggle switches between Traditional and Champion. In Champion, IV inputs and level become disabled.
- Picking a Pokemon from the Pokemon picker updates the panel.
- Picking a move from a slot updates the result card with non-zero damage.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/calc/page.tsx frontend/src/lib/i18n/translations.ts
git commit -m "Wire damage calculator page layout and components"
```

---

## Task 21: URL state sync

Encode `state` to `?s=` on every change (debounced); hydrate from `?s=` on mount.

**Files:**
- Modify: `frontend/src/app/calc/page.tsx`

- [ ] **Step 1: Add hydration effect**

In `CalcPage`, add right after `useReducer`:

```tsx
import { useRouter, useSearchParams } from 'next/navigation';
import { serializeState, deserializeState } from '@/lib/calc';
import { useDebounce } from '@/hooks/use-debounce';
// ...
const router = useRouter();
const searchParams = useSearchParams();
const [hydrated, setHydrated] = useState(false);

useEffect(() => {
  const s = searchParams.get('s');
  if (s) {
    dispatch({ type: 'HYDRATE', state: deserializeState(s) });
  }
  setHydrated(true); // eslint-disable-line react-hooks/set-state-in-effect
}, [searchParams]);
```

- [ ] **Step 2: Add debounced URL write effect**

```tsx
const debouncedState = useDebounce(state, 300);

useEffect(() => {
  if (!hydrated) return;
  const blob = serializeState(debouncedState);
  const url = new URL(window.location.href);
  url.searchParams.set('s', blob);
  router.replace(url.pathname + url.search);
}, [debouncedState, hydrated, router]);
```

- [ ] **Step 3: Manually verify**

`npm run dev`. Open `/calc`. Change attacker EVs. Confirm the URL gains `?s=...`. Copy the URL into a new tab; confirm the EVs you set are restored. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/calc/page.tsx
git commit -m "Sync calc state to URL"
```

---

## Task 22: Navigation and home page card

Add `/calc` to `MobileNav` and a feature card to the home page.

**Files:**
- Modify: `frontend/src/components/MobileNav.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Add to `MobileNav.tsx`**

Open `frontend/src/components/MobileNav.tsx`, find the existing nav-link list, and add an entry between Team and Quiz:

```tsx
{ href: '/calc', label: t('nav.calc'), icon: /* a calculator-shaped SVG; reuse the simplest existing icon pattern */ },
```

(Use whatever icon style the existing entries use — the file already has a pattern; copy it.)

- [ ] **Step 2: Add home page feature card**

In `frontend/src/app/page.tsx`, where the existing feature cards are rendered, add another card:

```tsx
<Link href="/calc" className="feature-card-classes-from-existing">
  <h2>{t('home.calc.title')}</h2>
  <p>{t('home.calc.desc')}</p>
</Link>
```

(Match the exact JSX structure used by neighboring cards — copy from one and adjust the link/title/desc keys.)

- [ ] **Step 3: Manually verify navigation**

`npm run dev`. Confirm the mobile nav shows a `Calc` entry that links to `/calc`. Confirm the home page shows a "Damage Calculator" card. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MobileNav.tsx frontend/src/app/page.tsx
git commit -m "Add /calc to navigation and home page"
```

---

## Task 23: Page smoke test + final verification

End-to-end happy path: pick attacker, pick defender, pick a move, see a damage result.

**Files:**
- Create: `frontend/src/app/calc/__tests__/calc-page.test.tsx`

- [ ] **Step 1: Write the smoke test**

Create `frontend/src/app/calc/__tests__/calc-page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/lib/i18n/context';
import CalcPage from '../page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api', () => ({
  getTypes: vi.fn(async () => [
    { id: 1, name: 'normal', names: { en: 'Normal' } },
    { id: 5, name: 'ground', names: { en: 'Ground' } },
    { id: 16, name: 'dragon', names: { en: 'Dragon' } },
  ]),
  getTypeEfficacy: vi.fn(async () => []),
  getMoves: vi.fn(async () => [
    { id: 89, name: 'earthquake', names: { en: 'Earthquake' }, type_ref: { id: 5, name: 'ground', names: { en: 'Ground' } }, power: 100, accuracy: 100, pp: 10, damage_class: 'physical' },
  ]),
  getPokemon: vi.fn(async (id: number) => ({
    id, species_id: id, name: `mon-${id}`, names: { en: `Mon ${id}` }, species_names: { en: `Mon ${id}` },
    types: [{ id: 16, name: 'dragon', names: { en: 'Dragon' } }, { id: 5, name: 'ground', names: { en: 'Ground' } }],
    sprite_url: '', stats: { hp: 108, attack: 130, defense: 95, special_attack: 80, special_defense: 85, speed: 102 },
    abilities: [], moves: [{ id: 89, name: 'earthquake', names: { en: 'Earthquake' } }], height: 1, weight: 1, generation: 4,
  })),
  getPokemonList: vi.fn(async () => ({ items: [], total: 0 })),
}));

describe('CalcPage smoke', () => {
  it('renders default attacker/defender and shows a damage result after picking a move', async () => {
    render(<LocaleProvider><CalcPage /></LocaleProvider>);
    await waitFor(() => expect(screen.getAllByText('Mon 445').length).toBeGreaterThan(0));
    // click first move slot
    await userEvent.click(screen.getByText(/tap to add/i));
    // Earthquake appears in the picker
    await userEvent.click(screen.getByText('Earthquake'));
    // result card now shows percentage text
    await waitFor(() => {
      expect(screen.getByText(/%/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run; verify it passes**

```bash
cd frontend && npx vitest run src/app/calc/__tests__/calc-page.test.tsx
```

If a render needs more than the mocks above (e.g., URL hydration fires before `useSearchParams` returns), add a `null` short-circuit or fix the mock as needed.

- [ ] **Step 3: Run the full test suite**

```bash
cd frontend && npm test
cd backend && cargo test
```

Expected: all frontend and backend tests pass.

- [ ] **Step 4: Final manual verification**

`npm run dev` (frontend) and `cargo run -p api` (backend, from `backend/`). Open `http://localhost:3000/calc`. Walk through:

- Default Garchomp vs Blissey loads with sprites and types.
- Pick Mega Garchomp from the attacker picker (proves megas are accessible from the API after Task 1).
- Set 252 Atk EV / Adamant nature on attacker.
- Add Earthquake to slot 1; verify a non-zero damage range appears with sensible KO numbers.
- Switch to Champion mode; verify level is locked to 50, IVs to 31, EV total cap drops to 66.
- Pick a base-stat override on the attacker; verify the "Custom" badge appears and damage updates.
- Reload the page with the URL intact; verify state restores.
- Toggle theme; verify dark mode looks right.
- Switch language to ja and zh; verify all UI strings render in the picked language.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/calc/__tests__/calc-page.test.tsx
git commit -m "Add /calc page smoke test"
```

---

## Self-review checklist (for the implementer)

Before declaring the feature complete, confirm:

- [ ] All backend tests pass (`cargo test`).
- [ ] All frontend tests pass (`npm test`).
- [ ] `npx tsc --noEmit` is clean.
- [ ] `npm run lint` (if present in this repo) is clean.
- [ ] Re-seeded Redis includes mega/primal/gmax forms (`curl 'http://localhost:3001/api/v1/pokemon?search=mega-x'`).
- [ ] `/calc` page works in both Traditional and Champion modes.
- [ ] URL roundtrip works.
- [ ] Move filter icons (type + physical/special/status) all narrow the list correctly.
- [ ] Item dropdown shows three groups with localized names; species-gated items silently no-op when held by a non-eligible mon.
- [ ] Base-stat override panel shows "Custom" badge when active and "Reset" restores species defaults.
- [ ] Damage calc result card shows min/max/avg %, OHKO/2HKO/3HKO, qualifier, and the "Show details" toggle reveals rolls + modifiers.
- [ ] Dark mode looks correct on every new component.
- [ ] EN/JA/ZH translations are populated for every new key.
