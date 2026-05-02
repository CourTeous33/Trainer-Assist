# Calc Bundle A — Design

Bundle of four user-reported gaps on `/calc`:

1. Defender-side stage controls only — no Def/SpD steppers on attacker, breaks Body Press use cases
2. Mega-form button row is conditional, so panels shift vertically when it appears
3. Pokemon picker filter is single-type — can't surface dual-type Pokemon like Kingambit (Dark/Steel) without a textual search
4. Body-Press-family moves use the wrong stat in the damage formula because the calc reads `attack`/`special_attack` unconditionally

Out of scope: abilities (separate brainstorm).

---

## 1. Symmetric stat stages

**Today:** `StatStageRow` renders 2 stat triplets per side — attacker shows Atk + SpA, defender shows Def + SpD. The state already holds all 4 keys for both sides; only the UI is asymmetric.

**Change:** Render all 4 stat triplets (Atk, Def, SpA, SpD) on both sides.

**Why:** Body Press uses Defense as the offense stat — the user needs a Def stepper on the attacker side. Symmetric layout also reads cleaner.

**Implementation:** drop the `side`-based key picking in `StatStageRow.tsx`; render a single `STAGE_KEYS` constant with all four stats regardless of side. The `side` prop survives only as the discriminator for which side's `stages` to read from and which reducer action to dispatch (handled in `SidePanel`, not here).

## 2. Move-based stat overrides in damage.ts

**Today:**

```ts
const isPhysical = move.damage_class === 'physical';
let A = isPhysical ? aStats.attack : aStats.special_attack;
let D = isPhysical ? dStats.defense : dStats.special_defense;
```

This hard-codes the stat-key choice from the move's damage class. Several moves break this convention.

**Change:** Introduce a per-move override table:

```ts
type StatPickKey = 'attack' | 'defense' | 'special_attack' | 'special_defense';

interface MoveStatOverride {
  offenseSide?: 'attacker' | 'defender';   // default 'attacker'
  offenseKey?: StatPickKey;                // default by damage_class
  defenseKey?: StatPickKey;                // default by damage_class
}

const MOVE_STAT_OVERRIDES: Record<string, MoveStatOverride> = {
  'body-press':  { offenseKey: 'defense' },
  'foul-play':   { offenseSide: 'defender', offenseKey: 'attack' },
  'psyshock':    { defenseKey: 'defense' },
  'psystrike':   { defenseKey: 'defense' },
  'secret-sword':{ defenseKey: 'defense' },
};
```

Resolve the override at the top of `calculateDamage` and use `offenseKey`/`defenseKey` everywhere `attack`/`special_attack`/`defense`/`special_defense` was hardcoded:

- A starts from `(offenseSide === 'defender' ? dStats : aStats)[offenseKey]`
- D starts from `dStats[defenseKey]`
- Stage application reads from the **same source as the stat**: offense stage from attacker.stages or defender.stages keyed by `offenseKey`; defense stage always from defender.stages keyed by `defenseKey`
- Item attack-mults (Choice Band, Choice Specs, Light Ball etc.) gate on `offenseKey === item.attackMult.stat` AND offense source must be attacker. So Choice Band on the user does NOT boost Body Press (offense stat is `defense`) and does NOT boost Foul Play (offense source is defender).

When a move has no override, `MOVE_STAT_OVERRIDES[move.name]` is undefined → all defaults apply → existing behavior preserved bit-for-bit.

Adaptive moves (Photon Geyser, Shell Side Arm) are out of scope for this bundle.

## 3. Stable layout — mega/form button row

**Today:** in `SidePanel`, the form button row only renders when `formButtons.length > 0`. Pokemon with mega forms get an extra row of vertical space that base-form Pokemon don't.

**Change:** always render the row container with a fixed height; only the buttons appear conditionally. A 1.75rem (28px) min-height matches the existing button height. The buttons use `border` + `text-xs` so the empty container would otherwise collapse.

```tsx
<div className="flex flex-wrap gap-1 min-h-7">
  {formButtons.map(...)}
</div>
```

This pins both columns at the same baseline regardless of which Pokemon are selected.

## 4. Dual-type filter in PokemonPicker

**Today:** `PokemonPicker.tsx` keeps a single string `typeFilter` and toggles on click. Backend already accepts `type` and `type2` (the `/pokemon` page uses both).

**Change:** mirror the `/pokemon` page's pattern — `typeFilters: string[]` capped at length 2. Clicking a third type rotates out the oldest. Pass `type: filters[0]`, `type2: filters[1]` in `getPokemonList`.

Also raise the picker's `limit` from 20 → 50. Single-type filters surface 50–100 results — 20 routinely cuts off mid-Gen3 and hides species like Kingambit. Trade-off: dropdown gets longer, but it's already scrollable.

## Tests

Extend existing files; no new test files.

**`frontend/src/lib/calc/__tests__/damage.test.ts`:**

- Body Press: `move.name === 'body-press'`, attacker base 100 base stats with high `defense`, low `attack`. Damage matches a hand-computed run using Defense as A. Attacker's `attack` stage has no effect; attacker's `defense` stage scales A.
- Choice Band on attacker doesn't boost Body Press (`attackerStat` unchanged from no-item baseline).
- Foul Play: defender base stats with high `attack` drive the damage; attacker's `attack` is irrelevant; defender's `attack` stage scales A; attacker's stages don't affect A.
- Psyshock: defender's `defense` stat is what gets divided into damage (not `special_defense`); defender's `defense` stage scales D; defender's `special_defense` stage doesn't affect D.
- Default unchanged: existing damage tests must still pass without modification.

**`frontend/src/components/__tests__/StatStageRow.test.tsx`:**

- Both sides render 4 buttons each (Atk, Def, SpA, SpD `+1`).
- Rename the existing "Renders defender side: Def + SpD" test to assert all 4.
- Defender-side click still dispatches with the right stat key (e.g., `Atk +1` calls `onChange('attack', value+1)`).

**`frontend/src/components/__tests__/PokemonPicker.test.tsx`:** (new file)

- Clicking two type buttons issues a request with both `type` and `type2`.
- Clicking a third type rotates out the first.
- Clicking an already-selected type clears it.

## Risk + rollout

- Stat-override change has a `MOVE_STAT_OVERRIDES` lookup that is empty for almost all moves — no behavior change for un-mapped moves; preexisting damage tests must stay green to prove this.
- Layout change is a pure CSS shift; no behavioral risk.
- Picker change widens the type filter set but the backend already supports it.
- Bundle is additive; no migration; no URL-format change.
