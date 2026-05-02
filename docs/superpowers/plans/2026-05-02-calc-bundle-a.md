# Calc Bundle A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Symmetric 4-stage steppers on both sides, Body Press / Foul Play / Psyshock-family stat overrides, stable form-button row, dual-type filter in `PokemonPicker`.

**Architecture:** Per-move stat-pick override table in `damage.ts` resolves which stat keys feed offense and defense; everything else (item mults, stages) gates on the resolved keys. UI changes are localized to `StatStageRow` (always 4 stats), `SidePanel` (reserved form row), and `PokemonPicker` (typeFilters array).

**Tech Stack:** TypeScript, React (Next.js 16), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-02-calc-bundle-a-design.md`

---

## File Structure

**Modify:**
- `frontend/src/lib/calc/damage.ts` — stat-override table; offense/defense key resolution
- `frontend/src/components/StatStageRow.tsx` — render 4 stats on both sides
- `frontend/src/components/__tests__/StatStageRow.test.tsx` — update side-renders to assert all 4
- `frontend/src/lib/calc/__tests__/damage.test.ts` — add Body Press / Foul Play / Psyshock cases
- `frontend/src/app/calc/page.tsx` — `min-h-7` form-button row
- `frontend/src/components/PokemonPicker.tsx` — dual-type filter, raised limit

**Create:**
- `frontend/src/components/__tests__/PokemonPicker.test.tsx`

---

### Task 1: Move stat overrides in damage.ts

**Files:**
- Modify: `frontend/src/lib/calc/damage.ts`
- Test: `frontend/src/lib/calc/__tests__/damage.test.ts`

This is TDD: write Body Press / Foul Play / Psyshock tests first, then implement.

- [ ] **Step 1: Append failing tests**

Append inside the existing `describe('calculateDamage', ...)` block in `frontend/src/lib/calc/__tests__/damage.test.ts`, just before its closing `});`. The fixture's default base stats are 100/100/100/100/100/100 — that gives equal computed Atk/Def/SpA/SpD. To make the override testable we set asymmetric base stats so the computed numbers differ:

```ts
  it('Body Press uses attacker Defense as offense stat', () => {
    const bodyPress = { id: 1, name: 'body-press', names: { en: 'Body Press' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 80, accuracy: 100, pp: 10, damage_class: 'physical' as const };
    // High Defense, low Attack on the attacker.
    const aDefHigh = { ...input({}).attacker, baseStatsOverride: { hp: 100, attack: 50, defense: 200, special_attack: 50, special_defense: 50, speed: 50 } };
    const aAtkHigh = { ...input({}).attacker, baseStatsOverride: { hp: 100, attack: 200, defense: 50, special_attack: 50, special_defense: 50, speed: 50 } };
    const bp = calculateDamage(input({ move: bodyPress, attacker: aDefHigh })) as { attackerStat: number };
    const tackleHighDef = calculateDamage(input({ attacker: aDefHigh })) as { attackerStat: number };
    const tackleHighAtk = calculateDamage(input({ attacker: aAtkHigh })) as { attackerStat: number };
    // Body Press attackerStat reflects Defense (high), not Attack (low).
    expect(bp.attackerStat).toBe(tackleHighAtk.attackerStat); // both read the "high" stat (200 base)
    expect(bp.attackerStat).toBeGreaterThan(tackleHighDef.attackerStat); // tackle on aDefHigh reads its low Attack
  });

  it('Body Press is unaffected by attacker Atk stage but reads attacker Def stage', () => {
    const bodyPress = { id: 1, name: 'body-press', names: { en: 'Body Press' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 80, accuracy: 100, pp: 10, damage_class: 'physical' as const };
    const baseline = calculateDamage(input({ move: bodyPress })) as { attackerStat: number };
    const atkBoosted = calculateDamage(input({
      move: bodyPress,
      attacker: { ...input({}).attacker, stages: { attack: 6, defense: 0, special_attack: 0, special_defense: 0 } },
    })) as { attackerStat: number };
    const defBoosted = calculateDamage(input({
      move: bodyPress,
      attacker: { ...input({}).attacker, stages: { attack: 0, defense: 6, special_attack: 0, special_defense: 0 } },
    })) as { attackerStat: number };
    expect(atkBoosted.attackerStat).toBe(baseline.attackerStat);
    expect(defBoosted.attackerStat).toBe(Math.floor(baseline.attackerStat * 4));
  });

  it('Choice Band does not boost Body Press', () => {
    const bodyPress = { id: 1, name: 'body-press', names: { en: 'Body Press' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 80, accuracy: 100, pp: 10, damage_class: 'physical' as const };
    const noItem = calculateDamage(input({ move: bodyPress })) as { attackerStat: number };
    const withBand = calculateDamage(input({
      move: bodyPress,
      attacker: { ...input({}).attacker, itemId: 'choice-band' },
    })) as { attackerStat: number };
    expect(withBand.attackerStat).toBe(noItem.attackerStat);
  });

  it('Foul Play uses defender Attack and defender Atk stage', () => {
    const foulPlay = { id: 1, name: 'foul-play', names: { en: 'Foul Play' }, type_ref: { id: 17, name: 'dark', names: { en: 'Dark' } }, power: 95, accuracy: 100, pp: 15, damage_class: 'physical' as const };
    // Defender has high Attack, low everything else.
    const dHighAtk = { ...input({}).defender, baseStatsOverride: { hp: 100, attack: 200, defense: 50, special_attack: 50, special_defense: 50, speed: 50 } };
    const baseline = calculateDamage(input({ move: foulPlay, defender: dHighAtk })) as { attackerStat: number };
    // Defender +6 Atk should ~4x attackerStat.
    const dBoosted = calculateDamage(input({
      move: foulPlay,
      defender: { ...dHighAtk, stages: { attack: 6, defense: 0, special_attack: 0, special_defense: 0 } },
    })) as { attackerStat: number };
    expect(dBoosted.attackerStat).toBe(Math.floor(baseline.attackerStat * 4));
    // Attacker stages don't affect Foul Play.
    const aBoosted = calculateDamage(input({
      move: foulPlay,
      defender: dHighAtk,
      attacker: { ...input({}).attacker, stages: { attack: 6, defense: 0, special_attack: 0, special_defense: 0 } },
    })) as { attackerStat: number };
    expect(aBoosted.attackerStat).toBe(baseline.attackerStat);
  });

  it('Psyshock divides by defender Defense (not SpD) and reads defender Def stage', () => {
    const psyshock = { id: 1, name: 'psyshock', names: { en: 'Psyshock' }, type_ref: { id: 14, name: 'psychic', names: { en: 'Psychic' } }, power: 80, accuracy: 100, pp: 10, damage_class: 'special' as const };
    const baseline = calculateDamage(input({ move: psyshock })) as { defenderStat: number };
    const defBoost = calculateDamage(input({
      move: psyshock,
      defender: { ...input({}).defender, stages: { attack: 0, defense: 2, special_attack: 0, special_defense: 0 } },
    })) as { defenderStat: number };
    const spdBoost = calculateDamage(input({
      move: psyshock,
      defender: { ...input({}).defender, stages: { attack: 0, defense: 0, special_attack: 0, special_defense: 6 } },
    })) as { defenderStat: number };
    expect(defBoost.defenderStat).toBe(Math.floor(baseline.defenderStat * 2));
    expect(spdBoost.defenderStat).toBe(baseline.defenderStat); // SpD stage irrelevant
  });
```

Run from `frontend/`:
```
npm test -- damage.test.ts
```
Expected: the five new tests fail.

- [ ] **Step 2: Implement the override table in damage.ts**

Open `frontend/src/lib/calc/damage.ts`. Add at the top of the file (after the existing constant tables):

```ts
type StatPickKey = 'attack' | 'defense' | 'special_attack' | 'special_defense';

interface MoveStatOverride {
  offenseSide?: 'attacker' | 'defender';
  offenseKey?: StatPickKey;
  defenseKey?: StatPickKey;
}

const MOVE_STAT_OVERRIDES: Record<string, MoveStatOverride> = {
  'body-press':   { offenseKey: 'defense' },
  'foul-play':    { offenseSide: 'defender', offenseKey: 'attack' },
  'psyshock':     { defenseKey: 'defense' },
  'psystrike':    { defenseKey: 'defense' },
  'secret-sword': { defenseKey: 'defense' },
};
```

In `calculateDamage`, replace the section that currently reads:

```ts
  const isPhysical = move.damage_class === 'physical';
  let A = isPhysical ? aStats.attack : aStats.special_attack;
  let D = isPhysical ? dStats.defense : dStats.special_defense;
```

With:

```ts
  const isPhysical = move.damage_class === 'physical';
  const ovr = MOVE_STAT_OVERRIDES[move.name];
  const offenseSide = ovr?.offenseSide ?? 'attacker';
  const offenseKey: StatPickKey = ovr?.offenseKey ?? (isPhysical ? 'attack' : 'special_attack');
  const defenseKey: StatPickKey = ovr?.defenseKey ?? (isPhysical ? 'defense' : 'special_defense');
  const offenseStats = offenseSide === 'attacker' ? aStats : dStats;
  const offenseStages = offenseSide === 'attacker' ? attacker.stages : defender.stages;
  let A = offenseStats[offenseKey];
  let D = dStats[defenseKey];
```

Update the item-attack-mult block. Find:

```ts
  if (item && speciesOk) {
    if (item.attackMult) {
      if (item.id === 'light-ball') {
        A = Math.floor(A * 2);
      } else if ((item.attackMult.stat === 'attack' && isPhysical) ||
                 (item.attackMult.stat === 'special_attack' && !isPhysical)) {
        A = Math.floor(A * item.attackMult.factor);
      }
    }
```

The item is read from the attacker — only apply if the offense source IS the attacker AND the offense key matches the item's stat. Replace with:

```ts
  if (item && speciesOk) {
    if (item.attackMult && offenseSide === 'attacker') {
      if (item.id === 'light-ball' && offenseKey === 'attack') {
        A = Math.floor(A * 2);
      } else if (item.attackMult.stat === offenseKey) {
        A = Math.floor(A * item.attackMult.factor);
      }
    }
```

(Note: `light-ball` doubles Pikachu's Attack stat in real game; if you wanted to also double SpA you'd need separate logic, but that's not what the existing code did, so preserve the Atk-only behavior.)

Update the stage application block. Find:

```ts
  // Stages applied after item mults (commutative under multiplication; sub-1% drift from Showdown's stage-first ordering due to Math.floor between steps).
  const aStageKey = isPhysical ? 'attack' : 'special_attack';
  const dStageKey = isPhysical ? 'defense' : 'special_defense';
  A = Math.floor(A * stageMultiplier(attacker.stages[aStageKey]));
  D = Math.floor(D * stageMultiplier(defender.stages[dStageKey]));
```

Replace with:

```ts
  // Stages applied after item mults (commutative under multiplication; sub-1% drift from Showdown's stage-first ordering due to Math.floor between steps).
  A = Math.floor(A * stageMultiplier(offenseStages[offenseKey]));
  D = Math.floor(D * stageMultiplier(defender.stages[defenseKey]));
```

- [ ] **Step 3: Run tests**

```
npm test -- damage.test.ts
```
Expected: all preexisting damage tests still pass + the 5 new tests pass.

- [ ] **Step 4: Run full suite**

```
npm test
npm run lint
npx tsc --noEmit
```
Expected: full suite green, lint clean, only the unrelated pre-existing pokemon-detail Mock errors.

- [ ] **Step 5: Commit**

```
git add frontend/src/lib/calc/damage.ts frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Add move stat overrides for Body Press, Foul Play, Psyshock-family"
```

---

### Task 2: Symmetric stages in StatStageRow

**Files:**
- Modify: `frontend/src/components/StatStageRow.tsx`
- Test: `frontend/src/components/__tests__/StatStageRow.test.tsx`

- [ ] **Step 1: Update tests**

In `frontend/src/components/__tests__/StatStageRow.test.tsx`:

Replace the two "renders attacker side"/"renders defender side" tests with two new ones that assert all four stat steppers per side. Find the existing block:

```tsx
  it('renders attacker side with Atk and SpA steppers', () => {
    renderRow({ side: 'attacker' });
    expect(screen.getByRole('button', { name: /Atk \+1/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /SpA \+1/i })).toBeTruthy();
  });

  it('renders defender side with Def and SpD steppers', () => {
    renderRow({ side: 'defender' });
    expect(screen.getByRole('button', { name: /Def \+1/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /SpD \+1/i })).toBeTruthy();
  });
```

(If the exact text differs slightly, match by intent.) Replace with:

```tsx
  it('attacker side renders all four stat steppers', () => {
    renderRow({ side: 'attacker' });
    for (const label of ['Atk', 'Def', 'SpA', 'SpD']) {
      expect(screen.getByRole('button', { name: new RegExp(`${label} \\+1`, 'i') })).toBeTruthy();
    }
  });

  it('defender side renders all four stat steppers', () => {
    renderRow({ side: 'defender' });
    for (const label of ['Atk', 'Def', 'SpA', 'SpD']) {
      expect(screen.getByRole('button', { name: new RegExp(`${label} \\+1`, 'i') })).toBeTruthy();
    }
  });
```

Run:
```
npm test -- StatStageRow
```
Expected: the two new tests fail (defender side currently doesn't render Atk/SpA; attacker doesn't render Def/SpD).

- [ ] **Step 2: Make the row symmetric**

Open `frontend/src/components/StatStageRow.tsx`. Find:

```tsx
const ATTACKER_KEYS: Array<{ stat: keyof StatStages; tKey: string }> = [
  { stat: 'attack', tKey: 'calc.stat.atk' },
  { stat: 'special_attack', tKey: 'calc.stat.spa' },
];

const DEFENDER_KEYS: Array<{ stat: keyof StatStages; tKey: string }> = [
  { stat: 'defense', tKey: 'calc.stat.def' },
  { stat: 'special_defense', tKey: 'calc.stat.spd' },
];
```

Replace with one shared array:

```tsx
const STAGE_KEYS: Array<{ stat: keyof StatStages; tKey: string }> = [
  { stat: 'attack', tKey: 'calc.stat.atk' },
  { stat: 'defense', tKey: 'calc.stat.def' },
  { stat: 'special_attack', tKey: 'calc.stat.spa' },
  { stat: 'special_defense', tKey: 'calc.stat.spd' },
];
```

In the component body, find:

```tsx
  const keys = side === 'attacker' ? ATTACKER_KEYS : DEFENDER_KEYS;
```

Remove this line (no longer needed). The `side` prop becomes unused inside `StatStageRow` itself — strip it from the `Props` interface and from the rendered JSX. The component now reads:

```tsx
'use client';

import type { StatStages } from '@/lib/calc';
import { useLocale } from '@/lib/i18n';

interface Props {
  stages: StatStages;
  onChange: (stat: keyof StatStages, value: number) => void;
}

const STAGE_KEYS: Array<{ stat: keyof StatStages; tKey: string }> = [
  { stat: 'attack', tKey: 'calc.stat.atk' },
  { stat: 'defense', tKey: 'calc.stat.def' },
  { stat: 'special_attack', tKey: 'calc.stat.spa' },
  { stat: 'special_defense', tKey: 'calc.stat.spd' },
];

export default function StatStageRow({ stages, onChange }: Props) {
  const { t } = useLocale();

  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      <span className="uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('calc.stages.label')}
      </span>
      <div className="flex flex-1 gap-3 flex-wrap">
        {STAGE_KEYS.map(({ stat, tKey }) => {
          const value = stages[stat];
          // ... unchanged stepper rendering
        })}
      </div>
    </div>
  );
}
```

Keep the body of the `STAGE_KEYS.map(...)` callback exactly as it is today — only the keys array and the prop signature change. The `flex-wrap` on the inner div lets four steppers wrap to a second row on narrow viewports.

- [ ] **Step 3: Update `StatStageRow` callsites**

The component is rendered in `frontend/src/app/calc/page.tsx`. Find:

```tsx
<StatStageRow side={side} stages={cfg.stages} onChange={setStage} />
```

Drop the `side` prop:

```tsx
<StatStageRow stages={cfg.stages} onChange={setStage} />
```

Also update the test helper in `StatStageRow.test.tsx` — the `renderRow` function currently passes `side`. Drop it from the helper signature and from each call. Tests that previously passed `side: 'attacker'` or `side: 'defender'` no longer need to.

- [ ] **Step 4: Run tests**

```
npm test
npm run lint
npx tsc --noEmit
```
Expected: full suite green, lint clean.

- [ ] **Step 5: Commit**

```
git add frontend/src/components/StatStageRow.tsx frontend/src/components/__tests__/StatStageRow.test.tsx frontend/src/app/calc/page.tsx
git commit -m "Render symmetric 4-stage stepper row on both sides"
```

---

### Task 3: Stable form-button row

**Files:**
- Modify: `frontend/src/app/calc/page.tsx`

- [ ] **Step 1: Reserve the row**

In `frontend/src/app/calc/page.tsx`, find the conditional form-button row inside `SidePanel`:

```tsx
{formButtons.length > 0 && (
  <div className="flex flex-wrap gap-1">
    {formButtons.map((f) => {
      ...
    })}
  </div>
)}
```

Replace with an always-rendered container, conditional on the buttons:

```tsx
<div className="flex flex-wrap gap-1 min-h-7">
  {formButtons.map((f) => {
    ...
  })}
</div>
```

(Move the `formButtons.map` body inside; do NOT change the per-button JSX — only remove the surrounding `formButtons.length > 0 &&` guard and add `min-h-7` to the div. When `formButtons` is empty, the div renders empty and reserves 1.75rem of vertical space matching the buttons' `h-7`.)

- [ ] **Step 2: Verify alignment in the browser**

Run from `frontend/`:
```
npm test
npm run lint
```
Expected: clean. (No test covers the visual alignment — manually verifying in the dev server is part of the final verification step.)

- [ ] **Step 3: Commit**

```
git add frontend/src/app/calc/page.tsx
git commit -m "Reserve form-button row height to stabilize SidePanel layout"
```

---

### Task 4: Dual-type filter in PokemonPicker

**Files:**
- Modify: `frontend/src/components/PokemonPicker.tsx`
- Create: `frontend/src/components/__tests__/PokemonPicker.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/components/__tests__/PokemonPicker.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/lib/i18n/context';
import PokemonPicker from '../PokemonPicker';
import type { TypeRef } from '@/lib/types';

const getPokemonList = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({ getPokemonList }));

const TYPES: TypeRef[] = [
  { id: 9, name: 'steel', names: { en: 'Steel' } },
  { id: 17, name: 'dark', names: { en: 'Dark' } },
  { id: 16, name: 'dragon', names: { en: 'Dragon' } },
];

beforeEach(() => {
  getPokemonList.mockReset();
  getPokemonList.mockResolvedValue({ items: [], total: 0 });
});

describe('PokemonPicker', () => {
  it('passes both type and type2 when two types are selected', async () => {
    render(<LocaleProvider><PokemonPicker allTypes={TYPES} onSelect={() => {}} /></LocaleProvider>);
    await userEvent.click(screen.getByRole('button', { name: /Dark/i }));
    await userEvent.click(screen.getByRole('button', { name: /Steel/i }));
    await waitFor(() => {
      expect(getPokemonList).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dark', type2: 'steel' }),
      );
    });
  });

  it('rotates out the oldest type when a third is added', async () => {
    render(<LocaleProvider><PokemonPicker allTypes={TYPES} onSelect={() => {}} /></LocaleProvider>);
    await userEvent.click(screen.getByRole('button', { name: /Dark/i }));
    await userEvent.click(screen.getByRole('button', { name: /Steel/i }));
    await userEvent.click(screen.getByRole('button', { name: /Dragon/i }));
    await waitFor(() => {
      const last = getPokemonList.mock.calls[getPokemonList.mock.calls.length - 1][0];
      // After rotation: Steel (kept) + Dragon (new). Dark was rotated out.
      expect(last.type).toBe('steel');
      expect(last.type2).toBe('dragon');
    });
  });

  it('clicking an already-selected type clears it', async () => {
    render(<LocaleProvider><PokemonPicker allTypes={TYPES} onSelect={() => {}} /></LocaleProvider>);
    await userEvent.click(screen.getByRole('button', { name: /Dark/i }));
    await userEvent.click(screen.getByRole('button', { name: /Dark/i }));
    await waitFor(() => {
      // After deselect, no fetch should happen with type=dark.
      const last = getPokemonList.mock.calls[getPokemonList.mock.calls.length - 1];
      // Either no calls or the last call has no type filter.
      if (last) {
        expect(last[0].type).toBeUndefined();
      }
    });
  });
});
```

NOTE: The existing PokemonPicker uses `<TypeBadge>` wrapped in a `<button>`. The accessible name of that button is the type's localized name (`Dark`, `Steel`, etc.). If the test fails to find the button by that name, inspect what `<TypeBadge>` renders and adjust the selector — the test isn't trying to assert on TypeBadge's rendering, only on the click behavior.

Run:
```
npm test -- PokemonPicker
```
Expected: tests fail (single-type filter currently).

- [ ] **Step 2: Implement dual-type filter**

Open `frontend/src/components/PokemonPicker.tsx`. Replace the `typeFilter` single-string state with an array. The full updated file:

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
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [fetched, setFetched] = useState<PokemonSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const active = !!(debouncedSearch || typeFilters.length > 0);
  const results = active ? fetched : [];

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- show loading before async fetch
    getPokemonList({
      search: debouncedSearch || undefined,
      type: typeFilters[0],
      type2: typeFilters[1],
      limit: 50,
    })
      .then((res) => { if (!cancelled) setFetched(res.items); })
      .catch(() => { if (!cancelled) setFetched([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active, debouncedSearch, typeFilters]);

  const toggleType = (name: string) => {
    setTypeFilters((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length < 2) return [...prev, name];
      // Rotate: drop oldest, append new.
      return [prev[1], name];
    });
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('pokemon.search')}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
      />
      <div className="flex flex-wrap gap-1">
        {allTypes.map((tt) => {
          const selected = typeFilters.includes(tt.name);
          const dim = typeFilters.length > 0 && !selected;
          return (
            <button
              key={tt.id} type="button"
              onClick={() => toggleType(tt.name)}
              className={`transition-opacity ${dim ? 'opacity-30' : ''}`}
            >
              <TypeBadge name={tt.name} names={tt.names} size="sm" />
            </button>
          );
        })}
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
              {p.types.map((tt) => <TypeBadge key={tt.id} name={tt.name} names={tt.names} size="sm" />)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

Key changes from the original: `typeFilter: string | null` → `typeFilters: string[]`; `getPokemonList` now passes `type: typeFilters[0]`, `type2: typeFilters[1]`, `limit: 50`; the toggle handler rotates when 3 types are selected; the dim class fires when any type is selected and this one isn't.

- [ ] **Step 3: Run tests**

```
npm test
npm run lint
npx tsc --noEmit
```
Expected: full suite green (including the three new PokemonPicker tests), lint clean.

- [ ] **Step 4: Commit**

```
git add frontend/src/components/PokemonPicker.tsx frontend/src/components/__tests__/PokemonPicker.test.tsx
git commit -m "Support dual-type filter in PokemonPicker; raise limit to 50"
```

---

### Task 5: Manual verification

**Files:** none.

- [ ] Boot dev stack (Postgres + Redis Docker, Rust API, frontend dev server) per CLAUDE.md.
- [ ] Open `http://localhost:3000/calc`.
- [ ] Verify all four stage steppers render on both attacker and defender sides.
- [ ] Pick Body Press as an attacker move on a Pokemon with high Defense (e.g., Skarmory) — bumping the attacker's Def stage should change the displayed damage; bumping the Atk stage should NOT.
- [ ] Pick Foul Play — bumping the defender's Atk stage should increase damage.
- [ ] Pick Psyshock — bumping the defender's Def stage should reduce damage; bumping SpD should not.
- [ ] Open the Pokemon picker. Click Dark, then Steel — Kingambit appears in the list.
- [ ] Click a third type — the first one rotates out.
- [ ] Switch between a base-form Pokemon and one with a mega form (e.g., Charizard) — the panel doesn't shift vertically when the mega button row appears.
