# Resistance Berries in /calc — Design

## Problem

The damage calculator on `/calc` already models attacker-side held items (Choice Band, Life Orb, type-boost plates, etc.). Defender-side held items are not modeled at all — `state.defender.itemId` exists but is never read by `damage.ts`. Real battles routinely involve resistance berries (Chople, Yache, Haban, Chilan, etc.) that halve damage from a specific type. Without them the calc cannot answer the very common "does my Gengar OHKO this Tyranitar through a Chople Berry?" question.

## Goal

Model the 18 resistance berries: 17 super-effective resist berries (one per type) and Chilan Berry (Normal, all-effectiveness). Stages are out of scope here — already shipped.

Out of scope: pinch berries (Salac/Liechi/etc.), Sitrus/Lum (HP/status), Ripen (ability we don't model), berries that boost stats post-consumption.

## Mechanics

Each resistance berry has the rule:

- **Type-resist berries (17):** when the incoming move's type matches the berry's type **AND** the move is super-effective (`typeEff > 1`), multiply damage by 0.5.
- **Chilan Berry:** when the incoming move is Normal-type, multiply damage by 0.5, regardless of effectiveness.

Berries are modeled as always-active (no consumption tracking, no first-hit-only logic). This matches how Pokémon Showdown's calc displays the "with berry" damage range.

## Type IDs

The 17 super-effective resist berries plus Chilan map to:

| Berry        | Type ID | Type    |
|--------------|---------|---------|
| Chilan       | 1       | Normal  |
| Chople       | 2       | Fighting|
| Coba         | 3       | Flying  |
| Kebia        | 4       | Poison  |
| Shuca        | 5       | Ground  |
| Charti       | 6       | Rock    |
| Tanga        | 7       | Bug     |
| Kasib        | 8       | Ghost   |
| Babiri       | 9       | Steel   |
| Occa         | 10      | Fire    |
| Passho       | 11      | Water   |
| Rindo        | 12      | Grass   |
| Wacan        | 13      | Electric|
| Payapa       | 14      | Psychic |
| Yache        | 15      | Ice     |
| Haban        | 16      | Dragon  |
| Colbur       | 17      | Dark    |
| Roseli       | 18      | Fairy   |

## Item interface change

Extend `Item` (in `frontend/src/lib/calc/types.ts`):

```ts
defenderResistance?: { typeId: number; factor: number; requireSuperEffective: boolean };
```

All 17 super-effective resist berries: `{ typeId: T, factor: 0.5, requireSuperEffective: true }`.
Chilan: `{ typeId: 1, factor: 0.5, requireSuperEffective: false }`.

## Tier

Extend the `ItemTier` union with a new tier:

```ts
export type ItemTier = 'top' | 'type-boost' | 'resist-berry' | 'other';
```

Berries get `tier: 'resist-berry'`. The new tier renders as a fourth section in `ItemDropdown`.

## Damage pipeline

In `frontend/src/lib/calc/damage.ts`, after the existing type-effectiveness + Expert Belt block, before returning the result, apply defender-side resistance:

```ts
let berryMultDamage = 1.0;
const defenderItem = defender.itemId ? getItem(defender.itemId) : undefined;
if (defenderItem?.defenderResistance) {
  const r = defenderItem.defenderResistance;
  const matchesType = move.type_ref.id === r.typeId;
  const meetsThreshold = !r.requireSuperEffective || typeEff > 1;
  if (matchesType && meetsThreshold) {
    berryMultDamage *= r.factor;
  }
}
```

Then incorporate `berryMultDamage` into the per-roll loop — multiply alongside `itemMultDamage`. Surface it on the result via `modifiers.berry: berryMultDamage` (sibling to `modifiers.item`).

## State / URL

No changes to state shape. `state.defender.itemId` already exists and already round-trips through the URL. Selecting a berry on the defender just reads the existing path.

Existing share URLs continue to work unchanged.

## UI

`ItemDropdown` already renders by tier. Add the new tier label `calc.itemTier.resistBerry` and ensure it appears in the tier ordering (after `type-boost`, before `other`).

The dropdown is shared between attacker and defender panels. We do **not** filter berries out of the attacker dropdown — keeping the dropdowns identical avoids per-side dropdown state. If a user selects a resistance berry on the attacker, the calc simply does not apply it (the `defenderResistance` field is only read for `defender.itemId`). This mirrors today's behavior where attacker-only items can be selected on the defender side and silently no-op.

## i18n

Add to `frontend/src/lib/i18n/translations.ts` for en/ja/zh:

- `calc.itemTier.resistBerry` — section heading
- 18 berry names (e.g., `item.chople-berry`, `item.yache-berry`, etc.) — but we already store names directly on each `Item` entry (`names: { en, ja, zh }`), so no separate translation keys are needed for berry names. Only the tier heading.

The 18 berry entries each include `names: { en, ja, zh }` matching the existing item style.

## Tests

Extend existing test files; no new test files.

**`frontend/src/lib/calc/__tests__/damage.test.ts`:**
- Chople Berry halves a super-effective Fighting move (`berryMultDamage === 0.5`).
- Chople Berry does NOT apply to a not-very-effective Fighting move (`berryMultDamage === 1`).
- Chople Berry does NOT apply to a super-effective non-Fighting move.
- Chilan Berry halves a Normal move regardless of effectiveness (test on neutral and super-effective).
- Berry multiplier composes correctly with item attack-mult on the attacker side (e.g., Choice Band + Chople yields the product).

**`frontend/src/lib/calc/__tests__/items.test.ts`:**
- `ITEMS_BY_TIER['resist-berry']` contains 18 entries.
- Spot-check a few berries have correct `defenderResistance` values (Chople → fighting/0.5/true; Chilan → normal/0.5/false).

## Risk + rollout

Low-risk additive change. The 18 new items are inert unless the user explicitly selects them. The damage formula change is a no-op when `defenderResistance` is absent. URL is unchanged. The new tier appears as an extra section in the item dropdown — non-breaking visual addition.
