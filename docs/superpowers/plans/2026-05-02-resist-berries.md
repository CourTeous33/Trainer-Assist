# Resistance Berries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 18 resistance berries (17 super-effective resist berries + Chilan) to `/calc`. Berries are held by the defender and halve damage when their type-match condition is met.

**Architecture:** New optional `Item.defenderResistance` field, new `'resist-berry'` tier, defender-side item read in `damage.ts` after type effectiveness, new optgroup in `ItemDropdown`, single new i18n tier key per locale.

**Tech Stack:** TypeScript, React (Next.js 16), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-02-resist-berries-design.md`

---

## File Structure

**Modify:**
- `frontend/src/lib/calc/types.ts` — extend `Item` interface, extend `ItemTier` union
- `frontend/src/lib/calc/items.ts` — add 18 berry entries, extend `ITEMS_BY_TIER`
- `frontend/src/lib/calc/damage.ts` — apply `defenderResistance`; surface `modifiers.berry`
- `frontend/src/components/ItemDropdown.tsx` — render new tier
- `frontend/src/lib/i18n/translations.ts` — `calc.itemTier.resistBerry` for en/ja/zh

**Test (extend existing):**
- `frontend/src/lib/calc/__tests__/items.test.ts`
- `frontend/src/lib/calc/__tests__/damage.test.ts`

---

### Task 1: Item interface + new tier

**Files:**
- Modify: `frontend/src/lib/calc/types.ts`

- [ ] **Step 1: Extend `ItemTier`**

Find:
```ts
export type ItemTier = 'top' | 'type-boost' | 'other';
```

Change to:
```ts
export type ItemTier = 'top' | 'type-boost' | 'resist-berry' | 'other';
```

- [ ] **Step 2: Extend `Item`**

Find the `Item` interface. Add one optional field after `superEffectiveMult?:`:

```ts
  defenderResistance?: { typeId: number; factor: number; requireSuperEffective: boolean };
```

The full updated interface should read:

```ts
export interface Item {
  id: string;
  names: LocalizedNames;
  tier: ItemTier;
  damageMult?: number;
  attackMult?: { stat: 'attack' | 'special_attack'; factor: number };
  typeBoost?: { typeId: number; factor: number };
  superEffectiveMult?: number;
  defenderResistance?: { typeId: number; factor: number; requireSuperEffective: boolean };
  speciesGate?: number[];
  speciesGateNote?: string;
}
```

- [ ] **Step 3: Verify**

From `frontend/`:
```
npx tsc --noEmit
```
Expected: only the unrelated pre-existing pokemon-detail Mock errors. The change is purely additive — no existing items break because the field is optional.

- [ ] **Step 4: Commit**

```
git add frontend/src/lib/calc/types.ts
git commit -m "Add defenderResistance to Item and resist-berry tier"
```

---

### Task 2: Add 18 berry entries to items.ts

**Files:**
- Modify: `frontend/src/lib/calc/items.ts`
- Test: `frontend/src/lib/calc/__tests__/items.test.ts`

- [ ] **Step 1: Update existing items test mult check**

In `frontend/src/lib/calc/__tests__/items.test.ts`, find:
```ts
  it('every item has at least one multiplier defined', () => {
    for (const item of ITEMS) {
      const hasMult = item.damageMult || item.attackMult || item.typeBoost || item.superEffectiveMult;
      expect(hasMult, `${item.id} has no multiplier`).toBeTruthy();
    }
  });
```

Change `hasMult` to also include `defenderResistance`:

```ts
  it('every item has at least one multiplier defined', () => {
    for (const item of ITEMS) {
      const hasMult = item.damageMult || item.attackMult || item.typeBoost || item.superEffectiveMult || item.defenderResistance;
      expect(hasMult, `${item.id} has no multiplier`).toBeTruthy();
    }
  });
```

- [ ] **Step 2: Write failing tier-tests**

Append inside the existing `describe('ITEMS', ...)` block, before its closing `});`:

```ts
  it('groups resist berries into resist-berry tier', () => {
    expect(ITEMS_BY_TIER['resist-berry'].length).toBe(18);
  });

  it('Chople Berry resists super-effective Fighting (typeId 2)', () => {
    const chople = getItem('chople-berry');
    expect(chople?.defenderResistance).toEqual({ typeId: 2, factor: 0.5, requireSuperEffective: true });
  });

  it('Chilan Berry resists Normal (typeId 1) regardless of effectiveness', () => {
    const chilan = getItem('chilan-berry');
    expect(chilan?.defenderResistance).toEqual({ typeId: 1, factor: 0.5, requireSuperEffective: false });
  });
```

Run:
```
npm test -- items.test.ts
```
Expected: the three new tests fail; existing pass.

- [ ] **Step 3: Add the 18 berry entries**

In `frontend/src/lib/calc/items.ts`, append the entries to `ITEMS` AFTER the `pixie-plate` entry (the last `type-boost`) and BEFORE the `light-ball` entry (the first `other`). All berries get `tier: 'resist-berry'`.

```ts
  // Resistance berries — held by defender; halve damage from a type-matched move.
  // Super-effective resist berries (17): trigger only when typeEff > 1.
  { id: 'chople-berry',  names: { en: 'Chople Berry',  ja: 'ロゼルのみ',     zh: '蔷薇果' },     tier: 'resist-berry', defenderResistance: { typeId: 2,  factor: 0.5, requireSuperEffective: true } },
  { id: 'coba-berry',    names: { en: 'Coba Berry',    ja: 'ヨプのみ',       zh: '木子果' },     tier: 'resist-berry', defenderResistance: { typeId: 3,  factor: 0.5, requireSuperEffective: true } },
  { id: 'kebia-berry',   names: { en: 'Kebia Berry',   ja: 'ビアーのみ',     zh: '碧叶果' },     tier: 'resist-berry', defenderResistance: { typeId: 4,  factor: 0.5, requireSuperEffective: true } },
  { id: 'shuca-berry',   names: { en: 'Shuca Berry',   ja: 'シュカのみ',     zh: '宿木果' },     tier: 'resist-berry', defenderResistance: { typeId: 5,  factor: 0.5, requireSuperEffective: true } },
  { id: 'charti-berry',  names: { en: 'Charti Berry',  ja: 'チャーレのみ',   zh: '车厘果' },     tier: 'resist-berry', defenderResistance: { typeId: 6,  factor: 0.5, requireSuperEffective: true } },
  { id: 'tanga-berry',   names: { en: 'Tanga Berry',   ja: 'タンガのみ',     zh: '探戈果' },     tier: 'resist-berry', defenderResistance: { typeId: 7,  factor: 0.5, requireSuperEffective: true } },
  { id: 'kasib-berry',   names: { en: 'Kasib Berry',   ja: 'カシブのみ',     zh: '佳穗果' },     tier: 'resist-berry', defenderResistance: { typeId: 8,  factor: 0.5, requireSuperEffective: true } },
  { id: 'babiri-berry',  names: { en: 'Babiri Berry',  ja: 'バビリのみ',     zh: '芭芭果' },     tier: 'resist-berry', defenderResistance: { typeId: 9,  factor: 0.5, requireSuperEffective: true } },
  { id: 'occa-berry',    names: { en: 'Occa Berry',    ja: 'オッカのみ',     zh: '稚火果' },     tier: 'resist-berry', defenderResistance: { typeId: 10, factor: 0.5, requireSuperEffective: true } },
  { id: 'passho-berry',  names: { en: 'Passho Berry',  ja: 'ソクノのみ',     zh: '玻茶果' },     tier: 'resist-berry', defenderResistance: { typeId: 11, factor: 0.5, requireSuperEffective: true } },
  { id: 'rindo-berry',   names: { en: 'Rindo Berry',   ja: 'リンドのみ',     zh: '林芙果' },     tier: 'resist-berry', defenderResistance: { typeId: 12, factor: 0.5, requireSuperEffective: true } },
  { id: 'wacan-berry',   names: { en: 'Wacan Berry',   ja: 'ワカシのみ',     zh: '哇咔果' },     tier: 'resist-berry', defenderResistance: { typeId: 13, factor: 0.5, requireSuperEffective: true } },
  { id: 'payapa-berry',  names: { en: 'Payapa Berry',  ja: 'パヤパのみ',     zh: '木瓜果' },     tier: 'resist-berry', defenderResistance: { typeId: 14, factor: 0.5, requireSuperEffective: true } },
  { id: 'yache-berry',   names: { en: 'Yache Berry',   ja: 'ヤチェのみ',     zh: '亚开果' },     tier: 'resist-berry', defenderResistance: { typeId: 15, factor: 0.5, requireSuperEffective: true } },
  { id: 'haban-berry',   names: { en: 'Haban Berry',   ja: 'ハバンのみ',     zh: '哈班果' },     tier: 'resist-berry', defenderResistance: { typeId: 16, factor: 0.5, requireSuperEffective: true } },
  { id: 'colbur-berry',  names: { en: 'Colbur Berry',  ja: 'ナモのみ',       zh: '柯波果' },     tier: 'resist-berry', defenderResistance: { typeId: 17, factor: 0.5, requireSuperEffective: true } },
  { id: 'roseli-berry',  names: { en: 'Roseli Berry',  ja: 'ロゼルのみ',     zh: '玫瑰果' },     tier: 'resist-berry', defenderResistance: { typeId: 18, factor: 0.5, requireSuperEffective: true } },
  // Chilan: halves Normal moves regardless of effectiveness.
  { id: 'chilan-berry',  names: { en: 'Chilan Berry',  ja: 'チイラのみ',     zh: '奇拉果' },     tier: 'resist-berry', defenderResistance: { typeId: 1,  factor: 0.5, requireSuperEffective: false } },
```

NOTE: `chople-berry`'s JA name above is `ロゼルのみ` which is wrong — fix it to `チャーボのみ`. Pokemon name conventions vary; if you are uncertain about a JA/ZH name, use a placeholder that matches the `${en}` form (e.g. `Chople Berry`) — these can be polished later. The IMPORTANT thing is that each `names.en` is correct so the dropdown shows the right English label. Verify by spot-checking 2–3 names against the spec table.

Actually, simpler: use these corrected JA names from the official games:

| id              | en              | ja          | zh         |
|-----------------|-----------------|-------------|------------|
| chople-berry    | Chople Berry    | ヤタピのみ  | 恰魄果     |
| coba-berry      | Coba Berry      | ヤタピのみ  | 木子果     |

Wait — getting the exact official JA names per berry is research-heavy and out of scope. **Use English names as fallbacks for the JA and ZH fields** for berries you are not 100% sure about. The display layer falls back to `en` when a locale field is missing per the project's `localizedName` helper. Concretely:

```ts
{ id: 'chople-berry',  names: { en: 'Chople Berry' }, tier: 'resist-berry', defenderResistance: { typeId: 2,  factor: 0.5, requireSuperEffective: true } },
```

This omits `ja` and `zh` and lets `localizedName` fall back to en. Use this pattern for all 18 berries. Translations can be added later as a separate task.

- [ ] **Step 4: Run tests**

```
npm test -- items.test.ts
```
Expected: all items tests pass (including the three new resist-berry assertions).

- [ ] **Step 5: Commit**

```
git add frontend/src/lib/calc/items.ts frontend/src/lib/calc/__tests__/items.test.ts
git commit -m "Add 18 resistance berries to ITEMS"
```

---

### Task 3: Apply `defenderResistance` in damage.ts

**Files:**
- Modify: `frontend/src/lib/calc/damage.ts`
- Test: `frontend/src/lib/calc/__tests__/damage.test.ts`

- [ ] **Step 1: Write failing damage tests**

Append inside `describe('calculateDamage', ...)` in `frontend/src/lib/calc/__tests__/damage.test.ts`, just before its closing `});`:

```ts
  it('Chople Berry halves super-effective Fighting damage', () => {
    const eff = identityEfficacy();
    eff[2][1] = 200; // Fighting super-effective vs Normal
    const fightingMove = { id: 1, name: 'close-combat', names: { en: 'Close Combat' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 120, accuracy: 100, pp: 5, damage_class: 'physical' as const };
    const noBerry = calculateDamage(input({
      defenderSpecies: { types: [1], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: eff,
      move: fightingMove,
    })) as { rolls: number[]; modifiers: { berry: number } };
    const withBerry = calculateDamage(input({
      defenderSpecies: { types: [1], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: eff,
      move: fightingMove,
      defender: { ...input({}).defender, itemId: 'chople-berry' },
    })) as { rolls: number[]; modifiers: { berry: number } };
    expect(withBerry.modifiers.berry).toBe(0.5);
    expect(noBerry.modifiers.berry).toBe(1);
    for (let i = 0; i < 16; i++) {
      expect(withBerry.rolls[i]).toBeGreaterThanOrEqual(Math.floor(noBerry.rolls[i] * 0.5) - 1);
      expect(withBerry.rolls[i]).toBeLessThanOrEqual(Math.floor(noBerry.rolls[i] * 0.5) + 1);
    }
  });

  it('Chople Berry does NOT apply to a not-very-effective Fighting move', () => {
    const eff = identityEfficacy();
    eff[2][14] = 50; // Fighting not-very-effective vs Psychic
    const fightingMove = { id: 1, name: 'close-combat', names: { en: 'Close Combat' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 120, accuracy: 100, pp: 5, damage_class: 'physical' as const };
    const out = calculateDamage(input({
      defenderSpecies: { types: [14], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: eff,
      move: fightingMove,
      defender: { ...input({}).defender, itemId: 'chople-berry' },
    })) as { modifiers: { berry: number } };
    expect(out.modifiers.berry).toBe(1);
  });

  it('Chople Berry does NOT apply to non-Fighting super-effective move', () => {
    const eff = identityEfficacy();
    eff[10][7] = 200; // Fire super-effective vs Bug
    const fireMove = { id: 1, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const };
    const out = calculateDamage(input({
      defenderSpecies: { types: [7], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: eff,
      move: fireMove,
      defender: { ...input({}).defender, itemId: 'chople-berry' },
    })) as { modifiers: { berry: number } };
    expect(out.modifiers.berry).toBe(1);
  });

  it('Chilan Berry halves Normal moves regardless of effectiveness', () => {
    const normalMove = { id: 1, name: 'tackle', names: { en: 'Tackle' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 40, accuracy: 100, pp: 35, damage_class: 'physical' as const };
    // Neutral matchup: Normal vs Normal (default fixture).
    const neutral = calculateDamage(input({
      move: normalMove,
      defender: { ...input({}).defender, itemId: 'chilan-berry' },
    })) as { modifiers: { berry: number } };
    expect(neutral.modifiers.berry).toBe(0.5);
  });

  it('Chilan Berry does NOT apply to non-Normal moves', () => {
    const fireMove = { id: 1, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const };
    const out = calculateDamage(input({
      move: fireMove,
      defender: { ...input({}).defender, itemId: 'chilan-berry' },
    })) as { modifiers: { berry: number } };
    expect(out.modifiers.berry).toBe(1);
  });

  it('Choice Band on attacker composes with Chople on defender', () => {
    const eff = identityEfficacy();
    eff[2][1] = 200; // Fighting super-effective vs Normal
    const fightingMove = { id: 1, name: 'close-combat', names: { en: 'Close Combat' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 120, accuracy: 100, pp: 5, damage_class: 'physical' as const };
    const out = calculateDamage(input({
      defenderSpecies: { types: [1], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: eff,
      move: fightingMove,
      attacker: { ...input({}).attacker, itemId: 'choice-band' },
      defender: { ...input({}).defender, itemId: 'chople-berry' },
    })) as { modifiers: { berry: number; item: number }; attackerStat: number };
    expect(out.modifiers.berry).toBe(0.5);
    // Choice Band already encoded into attackerStat path, modifiers.item is unaffected by Choice Band.
  });
```

Run:
```
npm test -- damage.test.ts
```
Expected: at least the new tests fail because `modifiers.berry` doesn't exist on the result yet.

- [ ] **Step 2: Update `CalcResult` modifiers shape**

In `frontend/src/lib/calc/types.ts`, find:
```ts
modifiers: { stab: number; typeEff: number; item: number };
```

Add `berry`:
```ts
modifiers: { stab: number; typeEff: number; item: number; berry: number };
```

- [ ] **Step 3: Apply `defenderResistance` in `damage.ts`**

Open `frontend/src/lib/calc/damage.ts`. After the existing block:

```ts
  if (item && speciesOk && item.superEffectiveMult && typeEff > 1) {
    itemMultDamage *= item.superEffectiveMult;
  }
```

Insert the berry block:

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

In the per-roll loop, find:
```ts
const dmg = typeEff === 0 ? 0 : Math.floor(baseDamage * stab * typeEff * itemMultDamage * roll);
```

Multiply in `berryMultDamage`:
```ts
const dmg = typeEff === 0 ? 0 : Math.floor(baseDamage * stab * typeEff * itemMultDamage * berryMultDamage * roll);
```

In the result object, add `berry: berryMultDamage` to `modifiers`:
```ts
modifiers: { stab, typeEff, item: itemMultDamage, berry: berryMultDamage },
```

- [ ] **Step 4: Run tests**

```
npm test -- damage.test.ts
```
Expected: all damage tests pass (preexisting + 6 new berry tests).

- [ ] **Step 5: Run full suite**

```
npm test
npm run lint
npx tsc --noEmit
```
Expected: full suite green; lint clean; only pre-existing pokemon-detail Mock typecheck errors.

- [ ] **Step 6: Commit**

```
git add frontend/src/lib/calc/damage.ts frontend/src/lib/calc/types.ts frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Apply defender-side resistance berries in damage calc"
```

---

### Task 4: Render new tier in `ItemDropdown`

**Files:**
- Modify: `frontend/src/components/ItemDropdown.tsx`

- [ ] **Step 1: Add the new optgroup**

In `frontend/src/components/ItemDropdown.tsx`, find the existing `<optgroup>` for `'type-boost'`. After it (and before the `'other'` optgroup), insert:

```tsx
      <optgroup label={t('calc.itemTier.resistBerry')}>
        {ITEMS_BY_TIER['resist-berry'].map((i) => (
          <option key={i.id} value={i.id}>{localizedName(i.names, locale)}</option>
        ))}
      </optgroup>
```

- [ ] **Step 2: Verify**

```
npx tsc --noEmit
npm run lint
npm test
```

Expected: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/ItemDropdown.tsx
git commit -m "Render resist-berry tier in ItemDropdown"
```

---

### Task 5: i18n keys for the new tier

**Files:**
- Modify: `frontend/src/lib/i18n/translations.ts`

- [ ] **Step 1: Add keys in all three locale blocks**

In `frontend/src/lib/i18n/translations.ts`:

After the `en` block's `'calc.itemTier.typeBoost': 'Type boost',` line, insert:
```ts
    'calc.itemTier.resistBerry': 'Resist berry',
```

After the `ja` block's `'calc.itemTier.typeBoost': 'タイプ強化',` line, insert:
```ts
    'calc.itemTier.resistBerry': '半減きのみ',
```

After the `zh` block's `'calc.itemTier.typeBoost': '属性强化',` line, insert:
```ts
    'calc.itemTier.resistBerry': '抗性树果',
```

- [ ] **Step 2: Verify**

```
npm test
npm run lint
```

Expected: full suite still green; lint clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/lib/i18n/translations.ts
git commit -m "Add calc.itemTier.resistBerry i18n keys (en/ja/zh)"
```

---

### Task 6: Manual verification

**Files:** none.

- [ ] **Step 1: Boot the dev server**

From `frontend/`:
```
npm run dev
```

Open `http://localhost:3000/calc`.

- [ ] **Step 2: Verify**

- The defender's item dropdown has a new "Resist berry" section listing all 18 berries.
- Selecting Chople Berry on a Normal-type defender vs a Fighting attacker (e.g., picking a Fighting move) cuts the damage roughly in half.
- Selecting Chilan Berry on the defender cuts damage from a Normal move in half regardless of the defender's typing.
- Selecting Chople Berry on the **attacker** is allowed (no filtering) and silently has no effect on damage — same as today's behavior with attacker-only items selected on defender.
- After selecting a berry, copy the URL and paste in a fresh tab — the berry persists.

- [ ] **Step 3: Final commit (if cleanup needed)**

If manual verification surfaced anything, commit. Otherwise no commit required.
