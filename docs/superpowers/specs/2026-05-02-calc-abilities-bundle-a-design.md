# Calc Abilities — Bundle A Design

First of two bundles adding ability support to `/calc`. Bundle A covers 36 abilities whose effects do not depend on weather. Bundle B will add the `weather` field, the four weather-setter abilities, weather-responder abilities, and the Weather Ball move.

Out of scope for both bundles:
- Status-conditional abilities (Guts, Toxic Boost, Flare Boost, Quick Feet, Marvel Scale) — deferred to a future status bundle.
- Per-turn state abilities (Slow Start, Truant, Defeatist HP threshold).
- Role-changing abilities (Mummy, Trace, Skill Swap, Imposter, Receiver).

In scope (Bundle A — 36 unique abilities; categories below cross-list multi-effect abilities like Flash Fire and Water Bubble):

| Category | Abilities |
|---|---|
| STAB / flat stat | Adaptability, Huge Power, Pure Power, Hustle |
| Conditional damage | Tough Claws (contact), Iron Fist (punch), Strong Jaw (bite), Mega Launcher (pulse), Sharpness (slicing), Reckless (recoil), Punk Rock (sound off + sound def), Technician (BP ≤ 60) |
| Type change | Aerilate, Pixilate, Refrigerate, Galvanize |
| Offense type boost | Steelworker, Water Bubble (off), Flash Fire (off, default-on) |
| Type immunity | Levitate, Sap Sipper, Water Absorb, Volt Absorb, Lightning Rod, Storm Drain, Motor Drive, Flash Fire (def-fire) |
| Type reduction | Thick Fat, Heatproof |
| Damage taken | Filter, Solid Rock, Prism Armor, Tinted Lens, Wonder Guard |
| Meta | Mold Breaker, Teravolt, Turboblaze |

---

## 1. State + URL

Add `abilityId: string | null` to `PokemonConfig`. Default `null` preserves today's behavior bit-for-bit.

```ts
// frontend/src/lib/calc/types.ts
export interface PokemonConfig {
  pokemonId: number;
  baseStatsOverride: Stats | null;
  typesOverride: number[] | null;
  level: number;
  ivs: Stats;
  evs: Stats;
  nature: NatureId;
  itemId: string | null;
  abilityId: string | null;   // NEW
  stages: StatStages;
}
```

**Reducer:** add `SET_ATTACKER_ABILITY` and `SET_DEFENDER_ABILITY` actions, mirroring the existing item actions. `SET_ATTACKER_POKEMON` / `SET_DEFENDER_POKEMON` does **not** clear `abilityId` — same convention as `itemId` today, so users can compare the same ability across attackers.

**URL:** add `ab` field to `packSide`/`unpackSide` next to `it`. Missing `ab` → `null`. URL version stays at `v: 1` (additive change; existing serialized URLs deserialize unchanged).

**Default:** `defaultCalcState()` sets `abilityId: null` on both sides.

## 2. Ability data model

New file `frontend/src/lib/calc/abilities.ts`, parallel to `items.ts`.

```ts
import type { LocalizedNames } from '@/lib/types';

export type MoveFlag = 'contact' | 'punch' | 'bite' | 'pulse' | 'slicing' | 'sound' | 'recoil';

export interface Ability {
  id: string;                  // kebab-case, e.g. 'tough-claws'
  names: LocalizedNames;       // en/ja/zh

  // ---- offensive effects ----
  stabFactor?: number;                                                   // Adaptability: 2.0
  flatAtkMult?: { stat: 'attack' | 'special_attack'; factor: number };   // Huge Power, Pure Power, Hustle
  conditionalDmgMult?:
    | { kind: 'flag'; flag: MoveFlag; factor: number }                   // Tough Claws, Iron Fist, Strong Jaw, Mega Launcher, Sharpness, Reckless, Punk Rock (off)
    | { kind: 'power-le'; powerThreshold: number; factor: number };      // Technician
  typeChange?: { from: number; to: number; boost: number };              // Aerilate/Pixilate/Refrigerate/Galvanize: from = Normal (1)
  offenseTypeBoost?: { typeId: number; factor: number };                 // Steelworker (Steel ×1.5), Water Bubble (Water ×2.0), Flash Fire (Fire ×1.5, default-on)
  notVeryEffectiveBoost?: number;                                        // Tinted Lens: 2.0

  // ---- defensive effects ----
  typeImmunity?: number;                                                 // Levitate, Sap Sipper, Water Absorb, Volt Absorb, Lightning Rod, Storm Drain, Motor Drive, Flash Fire (def-fire)
  typeReduction?: { typeId: number; factor: number }[];                  // Thick Fat (fire+ice ×0.5), Heatproof (fire ×0.5), Water Bubble (fire ×0.5)
  soundReduction?: number;                                               // Punk Rock (def): halves all sound moves regardless of type
  superEffectiveResist?: number;                                         // Filter, Solid Rock, Prism Armor: 0.75
  wonderGuard?: boolean;                                                 // Wonder Guard

  // ---- meta ----
  ignoresDefenderAbility?: boolean;                                      // Mold Breaker, Teravolt, Turboblaze
}

export const ABILITIES: Ability[] = [/* 36 entries (see roster table above) */];

const ABILITY_INDEX: Record<string, Ability> = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
export function getAbility(id: string | null | undefined): Ability | undefined {
  return id ? ABILITY_INDEX[id] : undefined;
}
```

Multi-effect abilities just set multiple fields:
- **Water Bubble** → `offenseTypeBoost: { typeId: 11, factor: 2.0 }` + `typeReduction: [{ typeId: 10, factor: 0.5 }]`.
- **Punk Rock** → `conditionalDmgMult: { kind: 'flag', flag: 'sound', factor: 1.3 }` + `soundReduction: 0.5`.
- **Flash Fire** → `typeImmunity: 10` + `offenseTypeBoost: { typeId: 10, factor: 1.5 }` (offense boost is default-on; no toggle).
- **Thick Fat** → `typeReduction: [{ typeId: 10, factor: 0.5 }, { typeId: 15, factor: 0.5 }]`.

i18n: `names.en` / `names.ja` / `names.zh` are hand-curated for the 30 entries (matches the `items.ts` pattern). The backend already exposes ability names via `PokemonDetail.abilities[].names`, but the calc table is a curated subset — using the same data shape lets us swap to a backend-driven list later without changing call sites.

## 3. Damage pipeline integration

Edits land in `frontend/src/lib/calc/damage.ts`. New module `frontend/src/lib/calc/move-flags.ts` exporting `hasMoveFlag(move, flag)`.

The pipeline gets seven new ability touchpoints. Order is chosen so each step fits next to the existing analogue and so successive `Math.floor` operations match in-game ordering as closely as the existing item code.

```ts
export function calculateDamage(input: CalcInput): CalcOutcome {
  // ... existing unsupported-move guards (no-power, fixed-damage, variable-power, multi-hit, ohko)

  // === NEW: resolve abilities (Mold Breaker family suppresses defender ability) ===
  const atkAbility = getAbility(attacker.abilityId);
  let defAbility = getAbility(defender.abilityId);
  if (atkAbility?.ignoresDefenderAbility) defAbility = undefined;

  // === NEW (1): resolve effective move type — Aerilate/Pixilate/Refrigerate/Galvanize ===
  let moveType = move.type_ref.id;
  let typeChangeBoost = 1.0;
  if (atkAbility?.typeChange && atkAbility.typeChange.from === moveType) {
    moveType = atkAbility.typeChange.to;
    typeChangeBoost = atkAbility.typeChange.boost;  // 1.2 for *ate
  }

  // ... existing stat picking via MOVE_STAT_OVERRIDES → A, D, offenseSide, offenseKey, defenseKey

  // === NEW (2): attacker flat stat mult — Huge Power, Pure Power, Hustle ===
  // Applied BEFORE item attackMult and BEFORE stages (matching existing item-mult ordering).
  if (atkAbility?.flatAtkMult
      && offenseSide === 'attacker'
      && atkAbility.flatAtkMult.stat === offenseKey) {
    A = Math.floor(A * atkAbility.flatAtkMult.factor);
  }

  // ... existing item attackMult, item damageMult, item typeBoost
  //     IMPORTANT: gate `item.typeBoost.typeId === moveType` (not `move.type_ref.id`)
  //     so that e.g. Pixie Plate boosts a Pixilate-converted move.
  // ... existing stage application

  // === Modified: type-effectiveness loop ===
  let typeEff = 1.0;
  if (defAbility?.typeImmunity === moveType) {
    typeEff = 0;
  } else {
    for (const dType of dTypes) {
      typeEff *= (typeEfficacy[moveType]?.[dType] ?? 100) / 100;
    }
    if (defAbility?.typeReduction) {
      for (const r of defAbility.typeReduction) {
        if (r.typeId === moveType) typeEff *= r.factor;
      }
    }
    if (defAbility?.wonderGuard && typeEff > 0 && typeEff <= 1) typeEff = 0;
    if (defAbility?.superEffectiveResist && typeEff > 1) typeEff *= defAbility.superEffectiveResist;
    if (atkAbility?.notVeryEffectiveBoost && typeEff > 0 && typeEff < 1) {
      typeEff *= atkAbility.notVeryEffectiveBoost;
    }
  }

  // ... existing super-effective item mult (Expert Belt) — uses typeEff > 1, no change
  // ... existing defender berry — IMPORTANT: gate berry typeId match on `moveType` not `move.type_ref.id`

  // === Modified: STAB — uses moveType + Adaptability factor ===
  const stabFactor = atkAbility?.stabFactor ?? 1.5;
  const stab = aTypes.includes(moveType) ? stabFactor : 1.0;

  // === NEW (3): conditional damage mult + offense type boost + typeChange boost ===
  let abilityDmgMult = typeChangeBoost;
  if (atkAbility?.conditionalDmgMult) {
    const c = atkAbility.conditionalDmgMult;
    const matches = c.kind === 'flag'
      ? hasMoveFlag(move, c.flag)
      : (move.power ?? 0) <= c.powerThreshold;
    if (matches) abilityDmgMult *= c.factor;
  }
  if (atkAbility?.offenseTypeBoost && atkAbility.offenseTypeBoost.typeId === moveType) {
    abilityDmgMult *= atkAbility.offenseTypeBoost.factor;
  }

  // === NEW (4): defender sound reduction — Punk Rock (def) ===
  let abilityDefMult = 1.0;
  if (defAbility?.soundReduction && hasMoveFlag(move, 'sound')) {
    abilityDefMult *= defAbility.soundReduction;
  }

  // ... existing baseDamage calc (uses A and D as currently)

  // === Modified: roll loop adds abilityDmgMult and abilityDefMult ===
  for (let i = 85; i <= 100; i++) {
    const dmg = typeEff === 0 ? 0
      : Math.floor(baseDamage * stab * typeEff * itemMultDamage * berryMultDamage
                   * abilityDmgMult * abilityDefMult * (i / 100));
    rolls.push(dmg);
  }

  // === Modified: result.modifiers gets ability fields ===
  const result: CalcResult = {
    rolls, defenderHp, minPct, maxPct, avgPct,
    ohkoPct: 0, twoHkoPct: 0, threeHkoPct: 0, qualifier: '',
    modifiers: {
      stab, typeEff, item: itemMultDamage, berry: berryMultDamage,
      abilityAtk: abilityDmgMult, abilityDef: abilityDefMult,  // NEW
    },
    attackerStat: A, defenderStat: D,
  };
  return result;
}
```

`CalcResult.modifiers` gains `abilityAtk` and `abilityDef` fields; the `DamageResultCard` doesn't need to change today (it doesn't render every modifier), but the data is there for future surfacing.

**Key invariants:**

- `moveType` replaces `move.type_ref.id` everywhere downstream — type-eff lookup, STAB membership check, item `typeBoost` gate, defender berry `typeId` match, item super-effective gate via `typeEff > 1`. This is the single sweep that makes Pixilate work end-to-end.
- Every new branch is gated on `atkAbility?.X` / `defAbility?.X`. With both `abilityId` values `null`: `moveType === move.type_ref.id`, `stabFactor === 1.5`, `abilityDmgMult === abilityDefMult === 1.0`, immunity/reduction/wonder-guard blocks all skipped. The calc reduces to today's code — every existing damage test must pass unmodified.
- Mold Breaker suppresses only the defender's *ability*. Defender items, defender berries, and the type chart are unaffected.
- `flatAtkMult` is gated on `offenseSide === 'attacker' && offenseKey === flatAtkMult.stat`. Consequence: Huge Power/Hustle do **not** boost Body Press (whose `offenseKey` is `defense` after Calc Bundle A) and do not boost Foul Play (whose `offenseSide` is the defender). This matches in-game behavior.

**Edge cases captured in tests** (Section 6):
- Pixilate Hyper Voice on Sylveon → effective type Fairy, ×1.2, STAB applies, Fairy chart used vs defender.
- Levitate vs Earthquake → 0 damage. With Mold Breaker attacker → goes through.
- Wonder Guard: neutral → 0; SE → through; with Mold Breaker → through normally.
- Tinted Lens: ×0.5 → ×1.0; ×0.25 → ×0.5.
- Choice Band + Huge Power stack: `attackerStat` reflects two successive floors — `Math.floor(×2.0)` from Huge Power, then `Math.floor(×1.5)` from Choice Band.

## 4. UI

New component `frontend/src/components/AbilityDropdown.tsx`. Mirrors `ItemDropdown.tsx` (single `<select>` element, leading "(none)" option, `onChange(id | null)`). Located in `SidePanel`, on the same row as Nature + Item.

```tsx
<div className="flex items-center gap-2 flex-wrap">
  <NatureDropdown   value={cfg.nature}    onChange={setNat} />
  <ItemDropdown     value={cfg.itemId}    onChange={setItem} />
  <AbilityDropdown  value={cfg.abilityId} onChange={setAbility}      // NEW
                    speciesAbilities={detail.abilities} />
</div>
```

Two `<optgroup>` sections:

1. **"This Pokémon"** — abilities from `PokemonDetail.abilities` whose `id` matches a Bundle A roster entry. Hidden entirely when the species has no Bundle-A abilities (no empty header).
2. **"All abilities"** — the full Bundle A roster, sorted alphabetically by current locale's `localizedName`.

Picking a new Pokémon does not clear `abilityId` (matches `itemId` convention). If the user holds an ability not in the new Pokémon's species (e.g., Adaptability then switch to Charizard which can't legally have it), the calc still applies it — calc is a what-if tool, not a legality checker, same as items.

New `t()` keys:
- `calc.ability` — label.
- `calc.ability.none` — "(none)".
- `calc.ability.thisPokemon` — group 1 header.
- `calc.ability.all` — group 2 header.

All three locales (en/ja/zh) get entries, matching the existing `calc.item.*` pattern.

`SidePanel`'s Nature/Item row already uses `flex-wrap`, so adding a third dropdown wraps cleanly on narrow widths.

## 5. Backend move-flag plumbing

Seven Bundle A abilities gate on a move property: contact, punch, bite, pulse, slicing, sound, and recoil. PokeAPI ships these in CSVs we don't currently fetch. Add `flags: Vec<String>` to `MoveSummary`.

**Touched files:**

- `backend/crates/seed/src/fetch.rs` — add to the parallel CSV download list:
  - `move_flag_map.csv` (move_id, move_flag_id)
  - `move_flags.csv` (id, identifier)
  - `move_meta.csv` if not already fetched, for the `drain` column (negative value = recoil move)
- `backend/crates/seed/src/parse.rs` — three new parsers, mirroring existing CSV parsers.
- `backend/crates/seed/src/transform.rs` — when building each `MoveSummary`, attach `flags`. Whitelist filter:

  ```rust
  let mut flags: Vec<String> = move_flag_map.get(&move_id)
      .iter().flat_map(|ids| ids.iter())
      .filter_map(|fid| flag_identifiers.get(fid).cloned())
      .filter(|name| matches!(name.as_str(),
          "contact" | "punch" | "bite" | "pulse" | "sound" | "slicing"))
      .collect();
  if move_meta.get(&move_id).is_some_and(|m| m.drain < 0) {
      flags.push("recoil".into());
  }
  flags.sort();
  flags.dedup();
  ```

  Whitelist scope keeps `MoveSummary` JSON small and avoids leaking flags Bundle A would never check.
- `backend/crates/shared/src/models.rs` — `pub flags: Vec<String>` on `MoveSummary` with `#[serde(default)]` so old payloads deserialize.
- `frontend/src/lib/types.ts` — `flags: string[]` on `MoveSummary`.

**Frontend `move-flags.ts`:**

```ts
import type { MoveSummary } from '@/lib/types';

export type MoveFlag = 'contact' | 'punch' | 'bite' | 'pulse' | 'slicing' | 'sound' | 'recoil';

export function hasMoveFlag(move: MoveSummary, flag: MoveFlag): boolean {
  return move.flags.includes(flag);
}
```

**Re-seed required:** `make seed-local` then restart API per CLAUDE.md.

## 6. Tests

### Backend (extend, no new files)

- `seed/tests/parse_tests.rs` — fixture-based: `parse_move_flag_map`, `parse_move_flags`, `parse_move_meta_drain`.
- `seed/tests/transform_tests.rs` — `move_flags_attached`, `recoil_derived_from_negative_drain`, `flags_whitelisted` (irrelevant flags like `mirror`/`charge` filtered out), `flags_sorted_and_deduped`.
- `shared/tests/models_tests.rs` — `move_summary_flags_roundtrip`, `move_summary_default_empty_flags` (proves `#[serde(default)]` allows old payloads to deserialize).

### Frontend `lib/calc/__tests__/damage.test.ts` (extend)

One test per ability category plus the cross-cutting cases:

- **Adaptability**: STAB ×2.0 on STAB move; non-STAB unchanged.
- **Huge Power**: physical Atk doubled; does **not** apply to Body Press (gated on `offenseKey === 'attack'`); does **not** apply to Foul Play (gated on `offenseSide === 'attacker'`).
- **Hustle**: same gates; no accuracy penalty modeled.
- **Tough Claws**: contact-flag move ×1.3; non-contact unchanged.
- **Iron Fist / Strong Jaw / Mega Launcher / Sharpness**: one each.
- **Reckless**: recoil-flag move ×1.2.
- **Punk Rock**: sound move ×1.3 offense, ×0.5 defense; non-sound unchanged.
- **Technician**: power=60 ×1.5; power=61 unchanged.
- **Pixilate Hyper Voice on Sylveon**: effective type Fairy, ×1.2 typeChange boost, STAB applies, Fairy chart used.
- **Aerilate Body Slam on Salamence-Mega**: effective type Flying, ×1.2 + STAB. (Return is in `VARIABLE_POWER_MOVES`, so the test must use a fixed-power Normal move.)
- **Levitate vs Earthquake** → 0; with Mold Breaker attacker → goes through.
- **Wonder Guard**: neutral → 0; SE → through; with Mold Breaker → through normally.
- **Filter / Solid Rock**: SE ×0.75; with Mold Breaker → no reduction.
- **Tinted Lens**: ×0.5 → ×1.0; ×0.25 → ×0.5.
- **Thick Fat**: Fire ×0.5, Ice ×0.5, others unchanged.
- **Heatproof**: Fire ×0.5 only.
- **Water Absorb / Sap Sipper / Volt Absorb / Storm Drain / Lightning Rod / Motor Drive**: matching type → 0 dmg.
- **Flash Fire**: Fire move from defender → 0; Flash Fire offense ×1.5 on user's Fire moves (default-on).
- **Steelworker**: Steel move ×1.5.
- **Water Bubble**: offense ×2 on Water moves; defense ×0.5 on Fire moves.
- **Choice Band + Huge Power stack**: `attackerStat` reflects two successive floors — `Math.floor(A × 2)` from Huge Power, then `Math.floor(× 1.5)` from Choice Band. (Adaptability + Pixilate cannot be tested as a "stack" — they share the single ability slot.)
- **Defaults preserved**: every existing damage test passes unmodified with `abilityId: null` on both sides.

### Frontend `lib/calc/__tests__/url.test.ts` (extend)

- `abilityId` round-trips through serialize / deserialize on both sides.
- URL without `ab` field → `abilityId === null` (backward compat).
- Unknown ability id string round-trips as-is; calc treats unknown id as no-ability via `getAbility`.

### Frontend `components/__tests__/AbilityDropdown.test.tsx` (new)

- Renders "(none)" + "This Pokémon" group + "All abilities" group.
- When species has no Bundle-A-known abilities, "This Pokémon" group is hidden.
- `onChange(null)` fires when "(none)" picked.
- Locale switch re-labels options via `localizedName`.

### Frontend `app/calc/__tests__/calc-page.test.tsx` (extend)

Smoke test: pick Sylveon attacker, set ability to Pixilate, set move to Hyper Voice, defender = Goodra (Dragon). Result is a non-zero damage card. Mirrors the existing stat-stages smoke test.

## 7. Risk + rollout

- **Backwards compatibility**: every new code path is gated on `abilityId !== null` (frontend) or `flags` defaulting to empty (backend `#[serde(default)]`). Existing serialized URLs missing `ab` deserialize to `null`. Old Redis `MoveSummary` payloads missing `flags` deserialize to `[]` — but seed runs as part of deploy, so this is belt-and-suspenders.
- **Required ops**: re-run `make seed-local` (or `make seed` in Docker) before restarting the API, per CLAUDE.md.
- **Implementation sequencing inside the bundle**:
  1. Backend (move flags) — adds the data the frontend will consume.
  2. State + URL — additive, gated by null.
  3. Damage pipeline — testable in isolation against a fixed `MoveSummary` shape.
  4. UI — last; uses everything above.

  Each step is independently testable.
- **Bundle B seams left clean**: the future `weather: WeatherKind | null` will live on `CalcState` (battlefield-level, not per-side). `weatherSetter` and weather-conditional effect fields on `Ability` will be additive to the same flat-fields shape. Weather Ball will get its own special case in the move-type/power resolution step (where Pixilate already lives), not a new pipeline phase.
- **Out-of-scope deferrals** (not in Bundle A and not in Bundle B):
  - Status-conditional abilities (Guts, Toxic Boost, Flare Boost, Quick Feet, Marvel Scale).
  - Per-turn state (Slow Start, Truant, Defeatist HP threshold).
  - Role-changing (Mummy, Trace, Skill Swap, Imposter, Receiver).
  - Adaptive moves (Photon Geyser, Shell Side Arm) — already deferred by Calc Bundle A.
