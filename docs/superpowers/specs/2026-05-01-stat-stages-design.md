# Stat Stages in /calc — Design

## Problem

The damage calculator on `/calc` currently computes Atk/SpA and Def/SpD from base stats, EVs, IVs, level, and nature, but offers no way to model in-battle stat boosts/drops. Real battles routinely involve Nasty Plot, Swords Dance, Intimidate, Calm Mind, etc., and a calc that ignores them is incomplete for the most common "can my Gengar OHKO this Incineroar after one Nasty Plot?" question.

## Goal

Let users adjust each side's stat stages (−6..+6) for the four damage-relevant stats and see the rolls update. Specifically:

- Attacker exposes Atk and SpA stages
- Defender exposes Def and SpD stages
- Stages persist across navigation by riding the existing URL share token

Out of scope: Speed stages, accuracy/evasion, abilities/moves that modify stages (Intimidate, Sticky Web), end-of-turn boost wear-off, baton-pass UI.

## Mechanics

Standard Pokemon stat-stage formula, range **−6..+6**:

- `n ≥ 0` → multiplier = `(2 + n) / 2`
- `n < 0`  → multiplier = `2 / (2 + |n|)`

Multiplier is applied **after** the existing nature/EV/IV stat computation and **after** item-based attack multipliers (Light Ball, Choice Specs, etc.), with a `Math.floor` after multiplying — same order as Gen-VI+ in-game behavior.

For each move resolution:
- If physical: apply attacker `attack` stage to `A`, defender `defense` stage to `D`.
- If special: apply attacker `special_attack` stage to `A`, defender `special_defense` stage to `D`.

The two stages on each side that don't apply to the current move are stored but inert — they only matter if the user toggles to a move of the other damage class.

## State

Add `StatStages` and `ZERO_STAGES` to `frontend/src/lib/calc/types.ts`:

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

Extend `PokemonConfig` (same file) with one field:

```ts
stages: StatStages;
```

`defaultCalcState()` in `url.ts` initializes both sides' `stages` to `{ ...ZERO_STAGES }`.

## URL serialization

In `url.ts`, `packSide` adds a `st` key holding the four-number stages object. `unpackSide` reads `st`, clamps each value to `[-6, 6]` via `Math.max(-6, Math.min(6, ...))`, defaults to `ZERO_STAGES` when missing or malformed. Existing share links (no `st` key) round-trip cleanly to zero stages — no version bump needed.

## Reducer actions

Two new actions in `app/calc/page.tsx`:

```ts
| { type: 'SET_ATTACKER_STAGE'; stat: keyof StatStages; value: number }
| { type: 'SET_DEFENDER_STAGE'; stat: keyof StatStages; value: number }
```

Each replaces one field on the relevant side's `stages` object. Value is clamped to `[-6, 6]` in the reducer.

## Damage pipeline

In `frontend/src/lib/calc/damage.ts`, after the existing item-attack-mult block and before the type-effectiveness loop:

```ts
const aStageKey = isPhysical ? 'attack' : 'special_attack';
const dStageKey = isPhysical ? 'defense' : 'special_defense';
A = Math.floor(A * stageMultiplier(attacker.stages[aStageKey]));
D = Math.floor(D * stageMultiplier(defender.stages[dStageKey]));
```

(`D` becomes `let` instead of `const`.)

`stageMultiplier(n)` is a pure helper exported from `frontend/src/lib/calc/stats.ts`:

```ts
export function stageMultiplier(n: number): number {
  const c = Math.max(-6, Math.min(6, n));
  return c >= 0 ? (2 + c) / 2 : 2 / (2 + -c);
}
```

Re-exported from `frontend/src/lib/calc/index.ts`.

## UI

New component `frontend/src/components/StatStageRow.tsx`. Props:

```ts
interface Props {
  side: 'attacker' | 'defender';
  stages: StatStages;
  onChange: (stat: keyof StatStages, value: number) => void;
}
```

Renders one row with two steppers, picked by `side`:
- `attacker` → Atk + SpA
- `defender` → Def + SpD

Each stepper:
- `−` button (disabled at −6) and `+` button (disabled at +6) flanking a center label
- Label shows the current value with sign: `+2`, `0`, `−1` (use the Unicode minus `−` for visual symmetry with `+`)
- Color: `text-green-600 dark:text-green-400` for positive, `text-red-600 dark:text-red-400` for negative, `text-gray-500 dark:text-gray-400` at 0
- Clicking the label resets that stat to 0
- Compact: `text-xs`, button height `h-7`, matches the existing dark-mode palette used by `EVStatTable` and `NatureDropdown`

`SidePanel` in `app/calc/page.tsx` renders `<StatStageRow>` directly above `<EVStatTable>`, passing `cfg.stages` and an `onChange` that dispatches the appropriate stage action.

## i18n

Add to `frontend/src/lib/i18n/translations/{en,ja,zh}.ts`:

- `calc.stages.label` — section/aria label (e.g. `"Stages"` / `"ランク"` / `"能力等级"`)
- `calc.stages.atk`, `calc.stages.spa`, `calc.stages.def`, `calc.stages.spd` — short stat labels matching the existing `EVStatTable` style

## Tests

Extend existing test files; no new test files.

**`frontend/src/lib/calc/__tests__/damage.test.ts`**:
- +2 SpA on Gengar roughly doubles the rolls vs the same special defender
- −1 SpD on the defender increases damage taken from a special move
- +6 Atk produces ~4× the unboosted rolls (sanity)
- Stages on stats that don't apply to the move (e.g., +6 Def on attacker for a physical hit) don't change the result

**`frontend/src/lib/calc/__tests__/stats.test.ts`** (extend or add `stageMultiplier` block):
- Returns 1 at 0, 2 at +2, 0.5 at −2, 4 at +6, 0.25 at −6
- Clamps inputs outside `[-6, 6]`

**`frontend/src/lib/calc/__tests__/url.test.ts`**:
- Round-trip with non-zero stages
- Legacy URL (no `st` key) unpacks to `ZERO_STAGES`
- Out-of-range values in URL are clamped on read

**`frontend/src/app/calc/__tests__/calc-page.test.tsx`**:
- Smoke check: the new stepper row renders for both sides
- Clicking `+` on attacker SpA changes the displayed damage value

## Backend

No changes. Stat stages are calc-time state only, not persisted server-side.

## Risk + rollout

Low-risk additive change. No data migration. The URL is forward-compatible: missing `st` defaults to zero, so users with existing share links see identical results. The damage formula change is gated by user input — at zero stages the multiplier is `1` and damage is byte-identical to today's output (verified by leaving the existing damage tests untouched).
