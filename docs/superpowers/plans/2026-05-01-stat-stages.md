# Stat Stages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add −6..+6 stat-stage steppers to the `/calc` page so users can model boosts/drops (Atk + SpA on attacker, Def + SpD on defender), with live damage updates and URL persistence.

**Architecture:** A new `StatStages` field on `PokemonConfig` flows from URL → reducer state → `damage.ts`, where it multiplies the relevant attacking/defending stat after item modifiers and before type effectiveness. The UI is a single `<StatStageRow>` component placed above `<EVStatTable>` in each `SidePanel`. URL serialization adds one new key (`st`) with backwards-compatible default.

**Tech Stack:** TypeScript, React (Next.js 16 App Router), Tailwind CSS v4, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-01-stat-stages-design.md`

---

## File Structure

**Create:**
- `frontend/src/components/StatStageRow.tsx` — the stepper row component

**Modify:**
- `frontend/src/lib/calc/types.ts` — add `StatStages`, `ZERO_STAGES`; extend `PokemonConfig`
- `frontend/src/lib/calc/stats.ts` — add `stageMultiplier` helper
- `frontend/src/lib/calc/index.ts` — re-export `stageMultiplier`, `StatStages`, `ZERO_STAGES`
- `frontend/src/lib/calc/url.ts` — `defaultCalcState` initializes `stages`; pack/unpack `st` key
- `frontend/src/lib/calc/damage.ts` — apply `stageMultiplier` to A and D
- `frontend/src/app/calc/page.tsx` — reducer actions, dispatch wiring, render `<StatStageRow>` in `SidePanel`
- `frontend/src/lib/i18n/translations.ts` — `calc.stages.*` keys for en/ja/zh

**Test (extend existing):**
- `frontend/src/lib/calc/__tests__/stats.test.ts`
- `frontend/src/lib/calc/__tests__/damage.test.ts`
- `frontend/src/lib/calc/__tests__/url.test.ts`
- `frontend/src/app/calc/__tests__/calc-page.test.tsx`

---

### Task 1: `stageMultiplier` helper (pure)

Build the formula in isolation first — every later task depends on it.

**Files:**
- Modify: `frontend/src/lib/calc/stats.ts` (append at end)
- Test: `frontend/src/lib/calc/__tests__/stats.test.ts` (append at end)

- [ ] **Step 1: Write the failing test**

Append to `frontend/src/lib/calc/__tests__/stats.test.ts`:

```ts
import { stageMultiplier } from '../stats';

describe('stageMultiplier', () => {
  it('returns 1 at stage 0', () => {
    expect(stageMultiplier(0)).toBe(1);
  });

  it('returns (2+n)/2 for positive stages', () => {
    expect(stageMultiplier(1)).toBeCloseTo(1.5, 10);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(6)).toBe(4);
  });

  it('returns 2/(2+|n|) for negative stages', () => {
    expect(stageMultiplier(-1)).toBeCloseTo(2 / 3, 10);
    expect(stageMultiplier(-2)).toBe(0.5);
    expect(stageMultiplier(-6)).toBe(0.25);
  });

  it('clamps inputs outside [-6, 6]', () => {
    expect(stageMultiplier(7)).toBe(stageMultiplier(6));
    expect(stageMultiplier(-99)).toBe(stageMultiplier(-6));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `frontend/`:
```bash
npm test -- stats.test.ts
```
Expected: FAIL — `stageMultiplier` is not exported from `../stats`.

- [ ] **Step 3: Implement `stageMultiplier`**

Append to `frontend/src/lib/calc/stats.ts`:

```ts
export function stageMultiplier(n: number): number {
  const c = Math.max(-6, Math.min(6, n));
  return c >= 0 ? (2 + c) / 2 : 2 / (2 + -c);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `frontend/`:
```bash
npm test -- stats.test.ts
```
Expected: PASS — all `stageMultiplier` cases plus all preexisting `stats.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/calc/stats.ts frontend/src/lib/calc/__tests__/stats.test.ts
git commit -m "Add stageMultiplier helper for Pokemon stat stages"
```

---

### Task 2: `StatStages` type + `ZERO_STAGES`

Add the type and the zero constant — no consumers yet, so this only needs a typecheck pass.

**Files:**
- Modify: `frontend/src/lib/calc/types.ts`
- Modify: `frontend/src/lib/calc/index.ts`

- [ ] **Step 1: Add the type and constant**

In `frontend/src/lib/calc/types.ts`, after the `MAX_IVS` constant at the bottom of the file, append:

```ts
export interface StatStages {
  attack: number;
  defense: number;
  special_attack: number;
  special_defense: number;
}

export const ZERO_STAGES: StatStages = {
  attack: 0, defense: 0, special_attack: 0, special_defense: 0,
};
```

Then, in the same file, extend the `PokemonConfig` interface by adding one field after `itemId: string | null;`:

```ts
  stages: StatStages;
```

The full updated `PokemonConfig` should read:

```ts
export interface PokemonConfig {
  pokemonId: number;
  baseStatsOverride: Stats | null;
  typesOverride: number[] | null;
  level: number;
  ivs: Stats;
  evs: Stats;
  nature: NatureId;
  itemId: string | null;
  stages: StatStages;
}
```

- [ ] **Step 2: Re-export from the calc index**

Open `frontend/src/lib/calc/stats.ts` exports — `stageMultiplier` is already re-exported via `./types` chain? No: `index.ts` re-exports stats explicitly. Update `frontend/src/lib/calc/index.ts`. Find the line:

```ts
export {
  computeStat, computeAllStats, clampEVsForMode, convertEVsBetweenModes, evTotal,
  isLevelLockedForMode, lockedLevelForMode, lockedIVsForMode,
  MAX_TOTAL_EV_TRADITIONAL, MAX_PER_STAT_EV_TRADITIONAL,
  MAX_TOTAL_EV_CHAMPION, MAX_PER_STAT_EV_CHAMPION,
} from './stats';
```

Add `stageMultiplier` to that export list:

```ts
export {
  computeStat, computeAllStats, clampEVsForMode, convertEVsBetweenModes, evTotal,
  isLevelLockedForMode, lockedLevelForMode, lockedIVsForMode, stageMultiplier,
  MAX_TOTAL_EV_TRADITIONAL, MAX_PER_STAT_EV_TRADITIONAL,
  MAX_TOTAL_EV_CHAMPION, MAX_PER_STAT_EV_CHAMPION,
} from './stats';
```

`StatStages` and `ZERO_STAGES` are already covered by the existing `export * from './types';` line — no edit needed there.

- [ ] **Step 3: Verify the project still compiles**

The file is currently broken because `PokemonConfig` requires `stages` but no caller supplies it. We will fix all callers in subsequent tasks. To confirm only the expected typecheck errors exist, run from `frontend/`:

```bash
npx tsc --noEmit
```
Expected: errors only in callers we are about to fix — `damage.ts`, `url.ts`, `app/calc/page.tsx`, and the calc test files. No errors in `types.ts`, `stats.ts`, or `index.ts` themselves.

Do **not** commit yet — the project doesn't compile. Move directly to Task 3.

---

### Task 3: `defaultCalcState` initializes `stages`; URL pack/unpack

Make the type compile by populating `stages` in the URL/state layer.

**Files:**
- Modify: `frontend/src/lib/calc/url.ts`
- Test: `frontend/src/lib/calc/__tests__/url.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `frontend/src/lib/calc/__tests__/url.test.ts` (inside the existing `describe('url serialization', ...)` block):

```ts
  it('roundtrips non-zero stages', () => {
    const base = defaultCalcState();
    const s: CalcState = {
      ...base,
      attacker: { ...base.attacker, stages: { attack: 0, defense: 0, special_attack: 2, special_defense: 0 } },
      defender: { ...base.defender, stages: { attack: 0, defense: 0, special_attack: 0, special_defense: 1 } },
    };
    expect(deserializeState(serializeState(s))).toEqual(s);
  });

  it('legacy URL without `st` unpacks to zero stages', () => {
    const legacy = btoa(JSON.stringify({
      v: 1, m: 't',
      a: { p: 1, l: 50,
        e: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
        i: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
        n: 'hardy', it: null, mv: [null, null, null, null] },
      d: { p: 1, l: 50,
        e: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
        i: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
        n: 'hardy', it: null },
    }));
    const s = deserializeState(legacy);
    expect(s.attacker.stages).toEqual({ attack: 0, defense: 0, special_attack: 0, special_defense: 0 });
    expect(s.defender.stages).toEqual({ attack: 0, defense: 0, special_attack: 0, special_defense: 0 });
  });

  it('clamps stage values outside [-6, 6] on deserialize', () => {
    const blob = btoa(JSON.stringify({
      v: 1, m: 't',
      a: { p: 1, l: 50,
        e: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
        i: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
        n: 'hardy', it: null, mv: [null, null, null, null],
        st: { attack: 99, defense: -99, special_attack: 7, special_defense: -8 } },
      d: { p: 1, l: 50,
        e: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
        i: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
        n: 'hardy', it: null,
        st: { attack: 0, defense: 0, special_attack: 0, special_defense: 0 } },
    }));
    const s = deserializeState(blob);
    expect(s.attacker.stages).toEqual({ attack: 6, defense: -6, special_attack: 6, special_defense: -6 });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `frontend/`:
```bash
npm test -- url.test.ts
```
Expected: FAIL — `stages` is missing on default state, or unpacking ignores `st`.

- [ ] **Step 3: Update `url.ts`**

Open `frontend/src/lib/calc/url.ts`. At the top, add `StatStages` and `ZERO_STAGES` to the existing types import:

```ts
import type { Stats } from '@/lib/types';
import type { EVMode, NatureId, StatStages } from './types';
import { ZERO_STAGES } from './types';
import { clampEVsForMode, lockedIVsForMode, lockedLevelForMode } from './stats';
```

In `defaultCalcState`, add `stages: { ...ZERO_STAGES }` to **both** sides. The full function should read:

```ts
export function defaultCalcState(): CalcState {
  const zero: Stats = { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 };
  const max31: Stats = { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 };
  return {
    evMode: 'traditional',
    attacker: {
      pokemonId: DEFAULT_ATTACKER_ID,
      baseStatsOverride: null, typesOverride: null,
      level: 50, ivs: { ...max31 }, evs: { ...zero }, nature: 'hardy', itemId: null,
      stages: { ...ZERO_STAGES },
      moveIds: [null, null, null, null],
    },
    defender: {
      pokemonId: DEFAULT_DEFENDER_ID,
      baseStatsOverride: null, typesOverride: null,
      level: 50, ivs: { ...max31 }, evs: { ...zero }, nature: 'hardy', itemId: null,
      stages: { ...ZERO_STAGES },
    },
  };
}
```

Add a `clampStages` helper next to the existing `clampStats` helper:

```ts
function clampStages(input: unknown): StatStages {
  const obj = (input ?? {}) as Partial<StatStages>;
  const c = (n: unknown) => Math.max(-6, Math.min(6, Math.floor(Number(n) || 0)));
  return {
    attack: c(obj.attack),
    defense: c(obj.defense),
    special_attack: c(obj.special_attack),
    special_defense: c(obj.special_defense),
  };
}
```

In `packSide`, add `st: side.stages` to the `base` object so it serializes:

```ts
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
    st: side.stages,
  };
  if (isAttacker) base.mv = (side as AttackerState).moveIds;
  return base;
}
```

In `unpackSide`, parse `st` and include it in the returned object. Find the `const side: DefenderState = {...}` line and replace it with:

```ts
  const stages = clampStages(r.st);
  const side: DefenderState = { pokemonId, level, ivs, evs: evsClamped, nature, itemId, baseStatsOverride, typesOverride, stages };
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `frontend/`:
```bash
npm test -- url.test.ts
```
Expected: PASS — new stage tests green; existing `roundtrips a default state`, `roundtrips a fully specified traditional state`, `enforces Champion invariants on load`, etc., still green.

- [ ] **Step 5: Commit**

The build still has typecheck errors elsewhere (damage.ts, page.tsx). Commit anyway — this task is internally self-consistent:

```bash
git add frontend/src/lib/calc/url.ts frontend/src/lib/calc/__tests__/url.test.ts
git commit -m "Add StatStages to calc state and URL serialization"
```

---

### Task 4: Wire `stageMultiplier` into `damage.ts`

Apply the multiplier to `A` and `D` based on the move's damage class.

**Files:**
- Modify: `frontend/src/lib/calc/damage.ts`
- Test: `frontend/src/lib/calc/__tests__/damage.test.ts`

- [ ] **Step 1: Update the test fixture to include zero stages**

In `frontend/src/lib/calc/__tests__/damage.test.ts`, the helper `input(over)` builds attacker and defender configs without `stages`. With the new required field, this fails to typecheck. Update both sides — locate the `attacker:` and `defender:` literals in the helper and add `stages:` after `itemId: null`:

```ts
    attacker: {
      pokemonId: 1, baseStatsOverride: null, typesOverride: null, level: 50,
      ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      nature: 'hardy', itemId: null,
      stages: { attack: 0, defense: 0, special_attack: 0, special_defense: 0 },
    },
    defender: {
      pokemonId: 2, baseStatsOverride: null, typesOverride: null, level: 50,
      ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      nature: 'hardy', itemId: null,
      stages: { attack: 0, defense: 0, special_attack: 0, special_defense: 0 },
    },
```

- [ ] **Step 2: Write failing tests for stage application**

Append four new cases inside the existing `describe('calculateDamage', ...)` block in `frontend/src/lib/calc/__tests__/damage.test.ts`:

```ts
  it('+2 SpA roughly doubles rolls vs the same defender on a special move', () => {
    const specialMove = { id: 94, name: 'psychic', names: { en: 'Psychic' }, type_ref: { id: 14, name: 'psychic', names: { en: 'Psychic' } }, power: 90, accuracy: 100, pp: 10, damage_class: 'special' as const };
    const baseline = calculateDamage(input({ move: specialMove })) as { rolls: number[] };
    const boosted = calculateDamage(input({
      move: specialMove,
      attacker: { ...input({}).attacker, stages: { attack: 0, defense: 0, special_attack: 2, special_defense: 0 } },
    })) as { rolls: number[] };
    expect(boosted.rolls[0]).toBeGreaterThan(baseline.rolls[0] * 1.9);
    expect(boosted.rolls[15]).toBeLessThan(baseline.rolls[15] * 2.1);
  });

  it('-1 defender SpD increases damage from a special move', () => {
    const specialMove = { id: 94, name: 'psychic', names: { en: 'Psychic' }, type_ref: { id: 14, name: 'psychic', names: { en: 'Psychic' } }, power: 90, accuracy: 100, pp: 10, damage_class: 'special' as const };
    const baseline = calculateDamage(input({ move: specialMove })) as { rolls: number[] };
    const dropped = calculateDamage(input({
      move: specialMove,
      defender: { ...input({}).defender, stages: { attack: 0, defense: 0, special_attack: 0, special_defense: -1 } },
    })) as { rolls: number[] };
    expect(dropped.rolls[0]).toBeGreaterThan(baseline.rolls[0]);
  });

  it('+6 attacker Atk produces ~4x rolls on a physical move', () => {
    const baseline = calculateDamage(input({})) as { rolls: number[] };
    const max = calculateDamage(input({
      attacker: { ...input({}).attacker, stages: { attack: 6, defense: 0, special_attack: 0, special_defense: 0 } },
    })) as { rolls: number[] };
    expect(max.rolls[0]).toBeGreaterThan(baseline.rolls[0] * 3.9);
    expect(max.rolls[0]).toBeLessThan(baseline.rolls[0] * 4.1);
  });

  it('stages on stats irrelevant to the move do not change damage', () => {
    const baseline = calculateDamage(input({})) as { rolls: number[]; attackerStat: number; defenderStat: number };
    const irrelevant = calculateDamage(input({
      attacker: { ...input({}).attacker, stages: { attack: 0, defense: 6, special_attack: 6, special_defense: 6 } },
      defender: { ...input({}).defender, stages: { attack: 6, defense: 0, special_attack: 6, special_defense: 6 } },
    })) as { rolls: number[]; attackerStat: number; defenderStat: number };
    expect(irrelevant.attackerStat).toBe(baseline.attackerStat);
    expect(irrelevant.defenderStat).toBe(baseline.defenderStat);
    expect(irrelevant.rolls).toEqual(baseline.rolls);
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run from `frontend/`:
```bash
npm test -- damage.test.ts
```
Expected: FAIL — boosted/dropped/+6/irrelevant cases fail because no stage multiplier is applied yet.

- [ ] **Step 4: Apply `stageMultiplier` in `damage.ts`**

Open `frontend/src/lib/calc/damage.ts`. Update the import line at the top to also pull `stageMultiplier`:

```ts
import { computeAllStats, stageMultiplier } from './stats';
```

Locate the section that initializes `A` and `D`:

```ts
  const isPhysical = move.damage_class === 'physical';
  let A = isPhysical ? aStats.attack : aStats.special_attack;
  const D = isPhysical ? dStats.defense : dStats.special_defense;
```

Change `const D` to `let D`:

```ts
  const isPhysical = move.damage_class === 'physical';
  let A = isPhysical ? aStats.attack : aStats.special_attack;
  let D = isPhysical ? dStats.defense : dStats.special_defense;
```

Find the end of the existing item-attack-mult block — the line just before `let typeEff = 1.0;` — and insert the stage application **after** the `if (item && speciesOk) { ... }` closing brace, **before** `let typeEff = 1.0;`:

```ts
  const aStageKey = isPhysical ? 'attack' : 'special_attack';
  const dStageKey = isPhysical ? 'defense' : 'special_defense';
  A = Math.floor(A * stageMultiplier(attacker.stages[aStageKey]));
  D = Math.floor(D * stageMultiplier(defender.stages[dStageKey]));
```

- [ ] **Step 5: Run tests to verify they pass**

Run from `frontend/`:
```bash
npm test -- damage.test.ts
```
Expected: PASS — all preexisting tests (16 rolls, STAB, type effectiveness, Life Orb, Choice Band, Expert Belt, baseStatsOverride, Mega Garchomp) still green; new four cases also green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/calc/damage.ts frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Apply stat-stage multipliers to attacker and defender in damage calc"
```

---

### Task 5: Reducer actions for stat stages

Wire stage updates through the reducer in `app/calc/page.tsx`. No UI yet — only state plumbing.

**Files:**
- Modify: `frontend/src/app/calc/page.tsx`

- [ ] **Step 1: Extend the `Action` union and types import**

In `frontend/src/app/calc/page.tsx`, update the import from `@/lib/calc` to also pull `StatStages`:

```ts
import {
  defaultCalcState, calculate, serializeState, deserializeState,
  clampEVsForMode, convertEVsBetweenModes, lockedIVsForMode, lockedLevelForMode,
  type CalcState, type CalcInput, type EVMode, type NatureId, type StatStages,
} from '@/lib/calc';
```

Add two new action variants to the existing `Action` union, after the `SET_DEFENDER_OVERRIDE` line and before `SET_MOVE`:

```ts
  | { type: 'SET_ATTACKER_STAGE'; stat: keyof StatStages; value: number }
  | { type: 'SET_DEFENDER_STAGE'; stat: keyof StatStages; value: number }
```

- [ ] **Step 2: Handle the new actions in the reducer**

In `calcReducer`, add two cases inside the `switch` block. Place them next to the other attacker/defender pairs (e.g., after `SET_DEFENDER_OVERRIDE`, before `SET_MOVE`):

```ts
    case 'SET_ATTACKER_STAGE': {
      const v = Math.max(-6, Math.min(6, action.value));
      return { ...state, attacker: { ...state.attacker, stages: { ...state.attacker.stages, [action.stat]: v } } };
    }
    case 'SET_DEFENDER_STAGE': {
      const v = Math.max(-6, Math.min(6, action.value));
      return { ...state, defender: { ...state.defender, stages: { ...state.defender.stages, [action.stat]: v } } };
    }
```

- [ ] **Step 3: Verify typecheck and existing tests still pass**

Run from `frontend/`:
```bash
npx tsc --noEmit
npm test
```
Expected: clean typecheck; full suite (existing 63 + 7 new from tasks 1, 3, 4) green.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/calc/page.tsx
git commit -m "Add stage reducer actions to calc page"
```

---

### Task 6: i18n keys for `calc.stages.*`

Add the strings the UI will use, before writing the UI itself.

**Files:**
- Modify: `frontend/src/lib/i18n/translations.ts`

- [ ] **Step 1: Add English keys**

In `frontend/src/lib/i18n/translations.ts`, find the line `'calc.stat.spe': 'Spe',` (around line 49 of the English block). Insert these keys immediately after that line:

```ts
    'calc.stages.label': 'Stages',
    'calc.stages.atk': 'Atk',
    'calc.stages.def': 'Def',
    'calc.stages.spa': 'SpA',
    'calc.stages.spd': 'SpD',
    'calc.stages.reset': 'Reset',
```

- [ ] **Step 2: Add Japanese keys**

In the same file, find the line `'calc.stat.spe': '素早さ',` (around line 243 of the Japanese block). Insert immediately after:

```ts
    'calc.stages.label': 'ランク',
    'calc.stages.atk': '攻撃',
    'calc.stages.def': '防御',
    'calc.stages.spa': '特攻',
    'calc.stages.spd': '特防',
    'calc.stages.reset': 'リセット',
```

- [ ] **Step 3: Add Simplified Chinese keys**

Find `'calc.stat.spe': '速度',` (around line 429 of the Chinese block). Insert immediately after:

```ts
    'calc.stages.label': '能力等级',
    'calc.stages.atk': '攻击',
    'calc.stages.def': '防御',
    'calc.stages.spa': '特攻',
    'calc.stages.spd': '特防',
    'calc.stages.reset': '重置',
```

- [ ] **Step 4: Verify build**

Run from `frontend/`:
```bash
npm run lint
npm test
```
Expected: lint clean; tests still pass (no behavioral change yet).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/i18n/translations.ts
git commit -m "Add calc.stages.* i18n keys (en/ja/zh)"
```

---

### Task 7: `StatStageRow` component

Build the compact stepper component. Renderable in isolation; consumed by `SidePanel` in Task 8.

**Files:**
- Create: `frontend/src/components/StatStageRow.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/StatStageRow.tsx`:

```tsx
'use client';

import type { StatStages } from '@/lib/calc';
import { useLocale } from '@/lib/i18n';

interface Props {
  side: 'attacker' | 'defender';
  stages: StatStages;
  onChange: (stat: keyof StatStages, value: number) => void;
}

const ATTACKER_KEYS: Array<{ stat: keyof StatStages; tKey: string }> = [
  { stat: 'attack', tKey: 'calc.stages.atk' },
  { stat: 'special_attack', tKey: 'calc.stages.spa' },
];

const DEFENDER_KEYS: Array<{ stat: keyof StatStages; tKey: string }> = [
  { stat: 'defense', tKey: 'calc.stages.def' },
  { stat: 'special_defense', tKey: 'calc.stages.spd' },
];

export default function StatStageRow({ side, stages, onChange }: Props) {
  const { t } = useLocale();
  const keys = side === 'attacker' ? ATTACKER_KEYS : DEFENDER_KEYS;

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('calc.stages.label')}
      </span>
      <div className="flex flex-1 gap-3">
        {keys.map(({ stat, tKey }) => {
          const value = stages[stat];
          const display = value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0';
          const tone = value > 0
            ? 'text-green-600 dark:text-green-400'
            : value < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-gray-400';
          return (
            <div key={stat} className="flex items-center gap-1">
              <span className="text-gray-700 dark:text-gray-200 w-8">{t(tKey)}</span>
              <button
                type="button"
                onClick={() => onChange(stat, value - 1)}
                disabled={value <= -6}
                aria-label={`${t(tKey)} -1`}
                className="h-7 w-7 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => onChange(stat, 0)}
                title={t('calc.stages.reset')}
                className={`h-7 w-8 font-semibold tabular-nums ${tone} hover:underline`}
              >
                {display}
              </button>
              <button
                type="button"
                onClick={() => onChange(stat, value + 1)}
                disabled={value >= 6}
                aria-label={`${t(tKey)} +1`}
                className="h-7 w-7 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: clean — no errors. The component is unused, which is fine.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StatStageRow.tsx
git commit -m "Add StatStageRow stepper component"
```

---

### Task 8: Render `StatStageRow` in `SidePanel`

Hook the component into both panels and dispatch the new actions.

**Files:**
- Modify: `frontend/src/app/calc/page.tsx`

- [ ] **Step 1: Import the new component and `StatStages`**

Near the other component imports at the top of `frontend/src/app/calc/page.tsx`, add:

```tsx
import StatStageRow from '@/components/StatStageRow';
```

(`StatStages` was already added to the `@/lib/calc` import in Task 5.)

- [ ] **Step 2: Wire dispatcher and render in `SidePanel`**

Inside the `SidePanel` function, just below the existing setter declarations (`setItem`, `setOver`), add:

```ts
  const setStage = (stat: keyof StatStages, value: number) => dispatch(
    side === 'attacker'
      ? { type: 'SET_ATTACKER_STAGE', stat, value }
      : { type: 'SET_DEFENDER_STAGE', stat, value },
  );
```

Then, in the JSX returned by `SidePanel`, add the `<StatStageRow>` immediately **before** the `<EVStatTable>` element:

```tsx
      <StatStageRow side={side} stages={cfg.stages} onChange={setStage} />
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
```

- [ ] **Step 3: Verify typecheck + lint + tests**

Run from `frontend/`:
```bash
npx tsc --noEmit
npm run lint
npm test
```
Expected: all clean. Existing calc-page smoke test still passes (the new row renders extra controls but does not interfere with the move-pick flow).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/calc/page.tsx
git commit -m "Render StatStageRow in calc SidePanel"
```

---

### Task 9: End-to-end smoke test for the stepper

Confirm the UI actually changes the displayed damage.

**Files:**
- Test: `frontend/src/app/calc/__tests__/calc-page.test.tsx`

- [ ] **Step 1: Add the smoke test**

Append a new `it` inside the existing `describe('CalcPage smoke', ...)` block in `frontend/src/app/calc/__tests__/calc-page.test.tsx`:

```ts
  it('clicking attacker SpA + changes the displayed damage', async () => {
    render(<LocaleProvider><CalcPage /></LocaleProvider>);
    await waitFor(() => expect(screen.getAllByText('Mon 94').length).toBeGreaterThan(0));

    // Pick Earthquake into slot 1 so a result renders.
    await userEvent.click(screen.getAllByText(/tap to add/i)[0]);
    await userEvent.click(screen.getByText('Earthquake'));
    await waitFor(() => expect(screen.getAllByText(/%/).length).toBeGreaterThan(0));

    // Capture the first percentage displayed.
    const firstPctBefore = screen.getAllByText(/%/)[0].textContent;

    // Attacker side: click the "+1" button labelled "Atk +1" (Earthquake is physical).
    const plusBtn = screen.getByRole('button', { name: /Atk \+1/i });
    await userEvent.click(plusBtn);

    await waitFor(() => {
      const firstPctAfter = screen.getAllByText(/%/)[0].textContent;
      expect(firstPctAfter).not.toBe(firstPctBefore);
    });
  });
```

- [ ] **Step 2: Run the test**

Run from `frontend/`:
```bash
npm test -- calc-page
```
Expected: PASS — both the existing smoke test and the new one are green.

- [ ] **Step 3: Run the full test suite once more**

Run from `frontend/`:
```bash
npm test
```
Expected: full suite green (existing 63 plus all new cases from this plan).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/calc/__tests__/calc-page.test.tsx
git commit -m "Add stat-stage smoke test for /calc page"
```

---

### Task 10: Manual verification + final lint

Confirm the UI is usable in a real browser before declaring done.

**Files:** none.

- [ ] **Step 1: Boot the frontend dev server**

In one terminal, from `frontend/`:
```bash
npm run dev
```
Open `http://localhost:3000/calc` in a browser.

- [ ] **Step 2: Verify the controls render and behave**

Confirm in the browser:

- A "Stages" row sits above the EV/IV table on **both** attacker and defender panels.
- The attacker row shows `Atk` and `SpA` steppers; the defender row shows `Def` and `SpD`.
- `+` and `−` buttons increment/decrement; centre label shows `+N`, `0`, or `−N` and is colored green/gray/red.
- `+` is disabled at `+6` and `−` is disabled at `−6`.
- Clicking the centre label resets that stat to `0`.
- Picking a damaging move (e.g., Earthquake) and bumping the relevant attacker stat by `+2` visibly increases the percentage shown in the result card; bumping a defender's matching defense reduces it.
- After making changes, copy the URL and paste it in a fresh tab — stages restore to the same values.
- An old share URL with no `s` param, or a manually crafted URL with no `st` key in the payload, loads with all stages at 0.
- Toggle EV mode (Traditional ↔ Champion) and confirm stages survive the toggle.

- [ ] **Step 3: Final lint and test pass**

Run from `frontend/`:
```bash
npm run lint
npm test
```
Expected: lint clean; full suite green.

- [ ] **Step 4: Final commit (only if any cleanup needed)**

If the manual check surfaced styling or copy fixes, commit them:

```bash
git add -A
git commit -m "Polish stat-stage UI based on manual verification"
```

Otherwise no commit is required for this task.
