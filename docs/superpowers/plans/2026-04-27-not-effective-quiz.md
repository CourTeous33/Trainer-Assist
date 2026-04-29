# Not-Effective Quiz Variant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "not very effective (≤ 0.5×)" polarity to the existing Type Quiz on `/quiz`, mirrored across both directions (offensive/defensive) and both subject sizes (1 or 2 types), mixed into the same random rotation as today's super-effective questions.

**Architecture:** Single `polarity: 'super_effective' | 'not_effective'` field added to `QuizQuestion`. `pickQuestion` rolls it 50/50. `computeAnswer` keeps its existing aggregation rules (product across defenders, max across attackers) and only flips the threshold (`≥ 2×` vs `≤ 0.5×`). The `/quiz` page selects polarity-aware translation keys for the prompt, tag, breakdown label, empty-state copy, and the "extra-selection" feedback line. No new pages, no toggles, no backend changes.

**Tech Stack:** TypeScript, React (Next.js 16 App Router), Vitest, Tailwind CSS v4. Frontend-only — `frontend/src/lib/quiz.ts`, `frontend/src/lib/__tests__/quiz.test.ts`, `frontend/src/app/quiz/page.tsx`, `frontend/src/lib/i18n/translations.ts`.

**Spec:** `docs/superpowers/specs/2026-04-27-not-effective-quiz-design.md`

---

## File Structure

| File | Responsibility | Change kind |
|---|---|---|
| `frontend/src/lib/quiz.ts` | `QuizQuestion` shape, `pickQuestion`, `computeAnswer`, `checkAnswer` | modify |
| `frontend/src/lib/__tests__/quiz.test.ts` | Unit tests for the above | modify |
| `frontend/src/lib/i18n/translations.ts` | en/ja/zh strings | modify (add 8 keys × 3 locales, edit `quiz.subtitle` × 3) |
| `frontend/src/app/quiz/page.tsx` | `QuizPage` component, `BreakdownSection` | modify |

No new files. All work happens in-place.

---

## Task 1: Add `QuizPolarity` type and field (compile-only)

Add the new type and field, but keep `pickQuestion` always emitting `'super_effective'` so behavior is unchanged. This is a TypeScript-only step that lets every downstream task compile cleanly without test regressions.

**Files:**
- Modify: `frontend/src/lib/quiz.ts`
- Modify: `frontend/src/lib/__tests__/quiz.test.ts`

- [ ] **Step 1: Add `QuizPolarity` and extend `QuizQuestion`**

In `frontend/src/lib/quiz.ts`, replace:

```ts
export type QuizDirection = 'offensive' | 'defensive';

export interface QuizQuestion {
  subject: TypeRef[];
  direction: QuizDirection;
}
```

with:

```ts
export type QuizDirection = 'offensive' | 'defensive';
export type QuizPolarity = 'super_effective' | 'not_effective';

export interface QuizQuestion {
  subject: TypeRef[];
  direction: QuizDirection;
  polarity: QuizPolarity;
}
```

- [ ] **Step 2: Update `pickQuestion` to always set `polarity: 'super_effective'`**

In the same file, find the `return { subject, direction };` line at the end of `pickQuestion` and replace with:

```ts
return { subject, direction, polarity: 'super_effective' };
```

- [ ] **Step 3: Add `polarity` to every `QuizQuestion` literal in the test file**

In `frontend/src/lib/__tests__/quiz.test.ts`, every literal of the form `{ subject: [...], direction: '...' as const }` needs `polarity: 'super_effective' as const` appended. The literals are at:

- Line ~81 (`computeAnswer — defensive`, Fire/Flying):
  `{ subject: [FIRE, FLYING], direction: 'defensive' as const }`
  →
  `{ subject: [FIRE, FLYING], direction: 'defensive' as const, polarity: 'super_effective' as const }`
- Line ~96 (Normal/Ghost): same pattern.
- Line ~108 (single Fire defensive): same pattern.
- Line ~117 (Fire/Flying offensive): same pattern.
- Line ~126 (single Water offensive): same pattern.
- Line ~135 (`computeAnswer — breakdown`, dual + single): both literals.
- Line ~146 (Fire/Flying defensive in breakdown defensive test): same.
- Line ~162 (Fire/Flying offensive breakdown): same.
- Line ~177 (`checkAnswer`, Fire/Flying defensive): same.

Update each. There are 9 literals in total to amend.

- [ ] **Step 4: Run frontend tests — should still pass**

Run: `cd frontend && npm test`
Expected: All 63 existing tests pass; no new ones added yet.

- [ ] **Step 5: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/quiz.ts frontend/src/lib/__tests__/quiz.test.ts
git commit -m "Add QuizPolarity scaffold to quiz model"
```

---

## Task 2: `pickQuestion` rolls polarity (TDD)

Make `pickQuestion` emit both polarities. Test-first.

**Files:**
- Modify: `frontend/src/lib/__tests__/quiz.test.ts`
- Modify: `frontend/src/lib/quiz.ts`

- [ ] **Step 1: Add a failing test for polarity rolling**

In `frontend/src/lib/__tests__/quiz.test.ts`, find the existing `describe('pickQuestion', ...)` block (near line 209). Inside it, append two new test cases:

```ts
it('produces both polarities across many rolls', () => {
  const rng = mulberry32(7);
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    seen.add(pickQuestion(TYPES, rng).polarity);
    if (seen.size === 2) break;
  }
  expect(seen).toEqual(new Set(['super_effective', 'not_effective']));
});

it('polarity is deterministic given a seeded RNG', () => {
  const a = pickQuestion(TYPES, mulberry32(42));
  const b = pickQuestion(TYPES, mulberry32(42));
  expect(a.polarity).toBe(b.polarity);
});
```

Also extend the existing `it('produces a 1- or 2-type subject and a valid direction', ...)` test to assert polarity is valid:

```ts
expect(['super_effective', 'not_effective']).toContain(q.polarity);
```

(Add this line just below the existing `expect(['offensive', 'defensive']).toContain(q.direction);`.)

- [ ] **Step 2: Run the new tests — verify "produces both polarities" fails**

Run: `cd frontend && npm test -- --run quiz`
Expected: The new "produces both polarities across many rolls" test FAILS because `pickQuestion` only ever returns `super_effective`. The other two assertions pass already (single value is in the set; same-seed determinism is trivially true).

- [ ] **Step 3: Update `pickQuestion` to roll polarity**

In `frontend/src/lib/quiz.ts`, change the body of `pickQuestion`. Replace the existing direction roll + return with:

```ts
const numTypes = rng() < 0.5 ? 1 : 2;
const direction: QuizDirection = rng() < 0.5 ? 'offensive' : 'defensive';
const polarity: QuizPolarity = rng() < 0.5 ? 'super_effective' : 'not_effective';

const pool = types.slice();
const subject: TypeRef[] = [];
for (let i = 0; i < numTypes; i++) {
  const idx = Math.floor(rng() * pool.length);
  subject.push(pool.splice(idx, 1)[0]);
}
return { subject, direction, polarity };
```

(Only the `polarity` line and the return-tuple change; the rest is the same logic as before.)

- [ ] **Step 4: Run all quiz tests — verify pass**

Run: `cd frontend && npm test -- --run quiz`
Expected: All quiz tests (existing + 2 new + 1 amended) pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/quiz.ts frontend/src/lib/__tests__/quiz.test.ts
git commit -m "Roll polarity in pickQuestion"
```

---

## Task 3: `computeAnswer` filters by polarity (TDD)

Update `computeAnswer` so the correct-answer threshold flips with polarity. The aggregation across subjects (product for defensive, max for offensive) is unchanged.

**Files:**
- Modify: `frontend/src/lib/__tests__/quiz.test.ts`
- Modify: `frontend/src/lib/quiz.ts`

- [ ] **Step 1: Add failing tests for `not_effective` polarity**

At the bottom of `frontend/src/lib/__tests__/quiz.test.ts` (after the existing `describe('checkAnswer', ...)` block but before the `pickQuestion` block — or simply append; ordering of `describe` blocks does not matter), add:

```ts
describe('computeAnswer — defensive × not_effective', () => {
  it('single-type defender — picks attackers with ≤ 0.5× into Fire', () => {
    const q = {
      subject: [FIRE],
      direction: 'defensive' as const,
      polarity: 'not_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    // From the fixture: Grass→Fire = 0.5x. (No others ≤ 0.5x in fixture.)
    const correctNames = a.correct.map((s) => s.type.name).sort();
    expect(correctNames).toEqual(['grass']);
  });

  it('dual-type defender — multiplied product ≤ 0.5× (Fire/Flying resists Grass at 0.25×)', () => {
    const q = {
      subject: [FIRE, FLYING],
      direction: 'defensive' as const,
      polarity: 'not_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    const grass = a.all.find((s) => s.type.name === 'grass')!;
    expect(grass.multiplier).toBe(0.25);
    expect(a.correct.some((s) => s.type.name === 'grass')).toBe(true);
  });

  it('immunity — 0× attackers count as not_effective (Normal/Ghost resists Fighting & Ghost)', () => {
    const q = {
      subject: [NORMAL, GHOST],
      direction: 'defensive' as const,
      polarity: 'not_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    const correctNames = a.correct.map((s) => s.type.name).sort();
    expect(correctNames).toContain('fighting');
    expect(correctNames).toContain('ghost');
  });
});

describe('computeAnswer — offensive × not_effective', () => {
  it('single-type attacker — picks defenders that take ≤ 0.5× from Fire', () => {
    const q = {
      subject: [FIRE],
      direction: 'offensive' as const,
      polarity: 'not_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    // Fire→Rock = 0.5x and Fire→Water = 0.5x in the fixture.
    const correctNames = a.correct.map((s) => s.type.name).sort();
    expect(correctNames).toEqual(['rock', 'water']);
  });

  it('dual-type attacker — defender resists both (Fire/Flying are both ≤ 0.5× into Rock)', () => {
    const q = {
      subject: [FIRE, FLYING],
      direction: 'offensive' as const,
      polarity: 'not_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    // Fire→Rock = 0.5, Flying→Rock = 0.5, max = 0.5 → in set.
    expect(a.correct.some((s) => s.type.name === 'rock')).toBe(true);
    // Fire→Grass = 2x, so Grass is NOT in the resisted set even though Flying→Grass = 2x.
    expect(a.correct.some((s) => s.type.name === 'grass')).toBe(false);
  });
});

describe('checkAnswer — not_effective polarity', () => {
  it('flags a perfect resisted answer', () => {
    const q = {
      subject: [FIRE],
      direction: 'offensive' as const,
      polarity: 'not_effective' as const,
    };
    const ans = computeAnswer(TYPES, lookup, q);
    const result = checkAnswer([ROCK.id, WATER.id], ans);
    expect(result.isPerfect).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify the new ones fail**

Run: `cd frontend && npm test -- --run quiz`
Expected: The 6 new test cases FAIL (all because `correct` is currently filtered with `>= 2` regardless of polarity, so resisted matchups never appear in `correct`).

- [ ] **Step 3: Update `computeAnswer` to use a polarity-aware predicate**

In `frontend/src/lib/quiz.ts`, replace the existing body of `computeAnswer`:

```ts
export function computeAnswer(
  types: TypeRef[],
  lookup: EfficacyLookup,
  question: QuizQuestion,
): QuizAnswer {
  const isDual = question.subject.length === 2;
  const all: AnswerSlot[] = types.map((t) => {
    const parts: SubjectMultiplier[] = question.subject.map((s) => ({
      subject: s,
      multiplier: question.direction === 'defensive' ? lookup(t.id, s.id) : lookup(s.id, t.id),
    }));
    const mult = question.direction === 'defensive'
      ? parts.reduce((acc, p) => acc * p.multiplier, 1)
      : parts.reduce((acc, p) => Math.max(acc, p.multiplier), 0);
    return isDual
      ? { type: t, multiplier: mult, breakdown: parts }
      : { type: t, multiplier: mult };
  });
  const passes = (m: number) =>
    question.polarity === 'super_effective' ? m >= 2 : m <= 0.5;
  const correct = all.filter((slot) => passes(slot.multiplier));
  return { correct, all };
}
```

(The only change: `const passes = ...` and the `correct` filter now uses it.)

- [ ] **Step 4: Run all frontend tests — verify pass**

Run: `cd frontend && npm test`
Expected: All tests pass (63 existing + 6 new = 69 in the quiz file's coverage; total frontend count rises by 6).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/quiz.ts frontend/src/lib/__tests__/quiz.test.ts
git commit -m "Branch computeAnswer threshold on polarity"
```

---

## Task 4: Add new i18n keys + rewrite `quiz.subtitle`

Add 8 new keys to each of the en/ja/zh blocks and rewrite `quiz.subtitle` so it's polarity-neutral. Each locale block lives at a different range in the file.

**Files:**
- Modify: `frontend/src/lib/i18n/translations.ts`

The 8 new keys (English copy shown; ja/zh provided in steps below):

| Key | English |
|---|---|
| `quiz.tagSuperEffective` | Super-effective |
| `quiz.tagResisted` | Resisted |
| `quiz.directionDefensiveResisted` | Which types deal not-very-effective damage to {types}? |
| `quiz.directionOffensiveResisted` | Which types take not-very-effective damage from {types}? |
| `quiz.noResisted` | No types resist this matchup. |
| `quiz.feedbackExtraResisted` | Not resisted |
| `quiz.breakdownDefensiveResisted` | Each type resists: |
| `quiz.breakdownOffensiveResisted` | Each type resisted by: |

The new `quiz.subtitle` (all locales): "A random matchup. Read the prompt and pick every type that fits." (translated per-locale below).

- [ ] **Step 1: Update the English block**

In `frontend/src/lib/i18n/translations.ts`, find the line `'quiz.subtitle': 'A random matchup. Pick every super-effective (≥2x) type.',` (around line 30). Replace it with:

```ts
    'quiz.subtitle': 'A random matchup. Read the prompt and pick every type that fits.',
```

Then find the line `'quiz.breakdownOffensive': 'Each type super-effective vs:',` (around line 45). Insert these 8 new keys directly after it (preserving the trailing comma on the previous line):

```ts
    'quiz.tagSuperEffective': 'Super-effective',
    'quiz.tagResisted': 'Resisted',
    'quiz.directionDefensiveResisted': 'Which types deal not-very-effective damage to {types}?',
    'quiz.directionOffensiveResisted': 'Which types take not-very-effective damage from {types}?',
    'quiz.noResisted': 'No types resist this matchup.',
    'quiz.feedbackExtraResisted': 'Not resisted',
    'quiz.breakdownDefensiveResisted': 'Each type resists:',
    'quiz.breakdownOffensiveResisted': 'Each type resisted by:',
```

- [ ] **Step 2: Update the Japanese block**

Find the existing `'quiz.subtitle': '...'` line in the Japanese block (around line 213). Replace it with:

```ts
    'quiz.subtitle': 'ランダムなマッチアップ。プロンプトを読んで該当するタイプをすべて選んでください。',
```

Then find `'quiz.breakdownOffensive': '...',` in the Japanese block (around line 228). Insert after it:

```ts
    'quiz.tagSuperEffective': '効果抜群',
    'quiz.tagResisted': 'いまひとつ',
    'quiz.directionDefensiveResisted': '{types}に効果がいまひとつとなるタイプは？',
    'quiz.directionOffensiveResisted': '{types}が効果がいまひとつで攻撃するタイプは？',
    'quiz.noResisted': 'このマッチアップに耐性タイプはありません。',
    'quiz.feedbackExtraResisted': '耐性ではない',
    'quiz.breakdownDefensiveResisted': '各タイプが耐えるタイプ：',
    'quiz.breakdownOffensiveResisted': '各タイプが耐えられる相手：',
```

- [ ] **Step 3: Update the Chinese block**

Find the existing `'quiz.subtitle': '...'` line in the Chinese block (around line 338). Replace it with:

```ts
    'quiz.subtitle': '随机组合。请阅读题目并选出所有符合的属性。',
```

Then find `'quiz.breakdownOffensive': '...',` in the Chinese block (around line 353). Insert after it:

```ts
    'quiz.tagSuperEffective': '效果拔群',
    'quiz.tagResisted': '抵抗',
    'quiz.directionDefensiveResisted': '哪些属性对{types}效果不佳？',
    'quiz.directionOffensiveResisted': '{types}对哪些属性效果不佳？',
    'quiz.noResisted': '没有属性能抵抗这个组合。',
    'quiz.feedbackExtraResisted': '并非抵抗',
    'quiz.breakdownDefensiveResisted': '每个属性抵抗：',
    'quiz.breakdownOffensiveResisted': '每个属性被以下属性抵抗：',
```

- [ ] **Step 4: Run typecheck and i18n tests**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors. (The translations file is a typed object literal; missing keys would surface here.)

Run: `cd frontend && npm test -- --run i18n`
Expected: All i18n tests pass. (They check key consistency across locales.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/i18n/translations.ts
git commit -m "Add not-effective quiz translation keys (en/ja/zh)"
```

---

## Task 5: Page renders polarity-aware prompt and subtitle

Wire `polarity` into the prompt-key selection in `QuizPage`. The subtitle copy already changed in Task 4 — no JSX change needed there.

**Files:**
- Modify: `frontend/src/app/quiz/page.tsx`

- [ ] **Step 1: Switch prompt-key selection to a 4-way table**

Find the block:

```tsx
const promptKey =
  question.direction === 'defensive'
    ? 'quiz.directionDefensive'
    : 'quiz.directionOffensive';
```

(around line 91-94). Replace with:

```tsx
const isResisted = question.polarity === 'not_effective';
const promptKey =
  question.direction === 'defensive'
    ? isResisted
      ? 'quiz.directionDefensiveResisted'
      : 'quiz.directionDefensive'
    : isResisted
      ? 'quiz.directionOffensiveResisted'
      : 'quiz.directionOffensive';
```

Note: `isResisted` is reused in Task 6 and Task 7 — keep it on this single declaration.

- [ ] **Step 2: Run typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Manual browser verification**

Start the dev server (in a separate terminal, leave running):

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/quiz`. Click "Next question" 8–10 times. Confirm:
- Some prompts read "Which types deal/take **super-effective** damage…" (existing).
- Some prompts read "Which types deal/take **not-very-effective** damage…" (new).
- Both directions × both polarities all appear at least once.
- Switch language to JA and ZH; confirm new prompts render in those languages.

If a polarity doesn't show up after ~10 clicks, refresh and try again — that's coincidence, not a bug. (50/50 roll, so each combination has ~12.5% chance per question.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/quiz/page.tsx
git commit -m "Render polarity-aware quiz prompt"
```

---

## Task 6: Compose direction + polarity tag

Today the small uppercase label above the prompt is one of two strings. After this task it's a 2-token composition: `<direction> · <polarity>` (e.g., "Defensive · Resisted").

**Files:**
- Modify: `frontend/src/app/quiz/page.tsx`

- [ ] **Step 1: Replace the single tag span with two tag tokens**

Find the tag span block (around line 116-120):

```tsx
<span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
  {question.direction === 'defensive'
    ? tr('quiz.tagDefensive')
    : tr('quiz.tagOffensive')}
</span>
```

Replace with:

```tsx
<span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
  {question.direction === 'defensive'
    ? tr('quiz.tagDefensive')
    : tr('quiz.tagOffensive')}
  {' · '}
  {isResisted ? tr('quiz.tagResisted') : tr('quiz.tagSuperEffective')}
</span>
```

(Reuses `isResisted` from Task 5. Confirm it's declared above this JSX — Task 5 placed it just before `return`, so it is in scope.)

- [ ] **Step 2: Manual browser verification**

With the dev server still running, refresh `/quiz`. Click "Next question" several times. Confirm:
- Tag now reads "DEFENSIVE · SUPER-EFFECTIVE", "DEFENSIVE · RESISTED", "OFFENSIVE · SUPER-EFFECTIVE", or "OFFENSIVE · RESISTED" depending on the question.
- Test in EN, JA, ZH — each language renders both tokens correctly.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/quiz/page.tsx
git commit -m "Compose direction and polarity into quiz tag"
```

---

## Task 7: Polarity-aware empty-state copy and "extra" feedback label

Two strings flip with polarity:
- The empty-state line (`quiz.noSuperEffective` ↔ `quiz.noResisted`) shown when `answer.correct.length === 0`.
- The "extra selection" feedback header (`quiz.feedbackExtra` ↔ `quiz.feedbackExtraResisted`).

**Files:**
- Modify: `frontend/src/app/quiz/page.tsx`

- [ ] **Step 1: Polarity-aware empty-state line**

Find the conditional that renders the empty-state paragraph (around line 178-181):

```tsx
{answer.correct.length === 0 ? (
  <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
    {tr('quiz.noSuperEffective')}
  </p>
) : (
```

Change the `tr(...)` call:

```tsx
{answer.correct.length === 0 ? (
  <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
    {tr(isResisted ? 'quiz.noResisted' : 'quiz.noSuperEffective')}
  </p>
) : (
```

- [ ] **Step 2: Polarity-aware "extra" feedback label**

Find the `result.extra.length > 0` block that renders `<FeedbackList ... label={tr('quiz.feedbackExtra')} ... />` (around line 214-220):

```tsx
{result.extra.length > 0 && (
  <FeedbackList
    label={tr('quiz.feedbackExtra')}
    slots={result.extra}
    color="text-orange-600 dark:text-orange-400"
    typeNamesMap={typeNamesMap}
  />
)}
```

Change `label`:

```tsx
{result.extra.length > 0 && (
  <FeedbackList
    label={tr(isResisted ? 'quiz.feedbackExtraResisted' : 'quiz.feedbackExtra')}
    slots={result.extra}
    color="text-orange-600 dark:text-orange-400"
    typeNamesMap={typeNamesMap}
  />
)}
```

- [ ] **Step 3: Manual browser verification**

With the dev server running, refresh `/quiz`. Steps to exercise both:
1. **Empty-state copy on a not_effective question:** click "Next question" until you find an offensive×not_effective question with no resists in the type pool, or a single attacking type with no resisted defenders. (Normal alone offensively reaches this.) Click "Check answer" with nothing selected → empty-state line should read "No types resist this matchup." (and not the super-effective version). Switch to JA/ZH to confirm.
2. **"Extra" label on a not_effective question:** find any not_effective question. Select a type that ISN'T in the correct set. Click "Check answer". The "extras" feedback should read "Not resisted" (not "Not super-effective").
3. Re-verify the existing super-effective questions still show "Not super-effective" / "No types are super-effective here."

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/quiz/page.tsx
git commit -m "Polarity-aware empty-state and extra-selection labels"
```

---

## Task 8: `BreakdownSection` — polarity-aware label and threshold

The breakdown section currently filters per-subject matchups with `multiplier >= 2` and chooses between `quiz.breakdownDefensive` / `quiz.breakdownOffensive`. Both must become polarity-aware.

**Files:**
- Modify: `frontend/src/app/quiz/page.tsx`

- [ ] **Step 1: Update the `BreakdownSection` invocation to pass polarity-aware label**

Find the invocation (around line 192-204):

```tsx
{question.subject.length === 2 && (
  <BreakdownSection
    question={question}
    answer={answer}
    typeNamesMap={typeNamesMap}
    label={tr(
      question.direction === 'defensive'
        ? 'quiz.breakdownDefensive'
        : 'quiz.breakdownOffensive',
    )}
    highlightIds={missedIds}
  />
)}
```

Replace the `label` expression so the four-way mapping is explicit:

```tsx
{question.subject.length === 2 && (
  <BreakdownSection
    question={question}
    answer={answer}
    typeNamesMap={typeNamesMap}
    label={tr(
      question.direction === 'defensive'
        ? isResisted
          ? 'quiz.breakdownDefensiveResisted'
          : 'quiz.breakdownDefensive'
        : isResisted
          ? 'quiz.breakdownOffensiveResisted'
          : 'quiz.breakdownOffensive',
    )}
    highlightIds={missedIds}
  />
)}
```

- [ ] **Step 2: Update the per-subject matchup filter inside `BreakdownSection`**

Find the `BreakdownSection` body (around line 271 onward). Inside the `rows = question.subject.map(...)` block, locate:

```tsx
.filter((m): m is { type: TypeRef; multiplier: number } => m !== null && m.multiplier >= 2)
.sort((a, b) => b.multiplier - a.multiplier);
```

(around line 290-291). Replace the predicate:

```tsx
.filter((m): m is { type: TypeRef; multiplier: number } => {
  if (m === null) return false;
  return question.polarity === 'super_effective'
    ? m.multiplier >= 2
    : m.multiplier <= 0.5;
})
.sort((a, b) =>
  question.polarity === 'super_effective'
    ? b.multiplier - a.multiplier
    : a.multiplier - b.multiplier,
);
```

The sort flips so the strongest-resists (lowest multipliers) appear first on a not_effective question, matching the existing "strongest weaknesses first" ordering on super_effective questions.

`BreakdownSection` already receives `question` as a prop, so `question.polarity` is in scope without any signature change.

- [ ] **Step 3: Manual browser verification**

With the dev server running, click "Next question" until you get a **dual-subject not_effective** question (e.g., Fire/Flying × resisted, or any 2-attacker offensive resisted). Click "Check answer" (with any selection — even empty is fine). Confirm:
- The breakdown section title reads "Each type resists:" (defensive) or "Each type resisted by:" (offensive) instead of the existing "weak to" / "super-effective vs".
- Each row shows that subject's per-type matchups at multipliers ≤ 0.5× (e.g., 0.5×, 0.25×, 0×) — not ≥ 2× values.
- Existing super_effective dual-subject questions still show ≥ 2× rows.
- Test in EN, JA, ZH.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/quiz/page.tsx
git commit -m "Polarity-aware breakdown threshold and label"
```

---

## Task 9: Final verification

Cross-cut verification. No code changes expected; if anything fails, fix in place and re-run.

**Files:** none (verification only).

- [ ] **Step 1: Run all frontend tests**

Run: `cd frontend && npm test`
Expected: All tests pass. Total count rises from 63 to 71 (Task 2 added 2 new `it` blocks, Task 3 added 6 new `it` blocks, Task 1 only amended one existing assertion).

If any fail, stop and fix before proceeding.

- [ ] **Step 2: Lint**

Run: `cd frontend && npm run lint`
Expected: No errors. (ESLint should not complain about the changes; if it does, fix in place.)

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Backend tests sanity**

Run: `cd backend && cargo test`
Expected: All 52 tests pass. (Backend was untouched; this is a paranoid sanity check.)

- [ ] **Step 5: Manual smoke test of `/quiz`**

With the dev server running on `http://localhost:3000`, do a final pass:
1. Click through 15-20 quiz questions. Confirm at least one of each of the 8 shapes appears (offensive × {SE, NE} × {1-type, 2-type}; defensive × {SE, NE} × {1-type, 2-type}).
2. For each shape, click "Check answer" with both correct and partial-correct selections. Confirm:
   - Tag, prompt, breakdown title, empty-state line, and extra-selection label all match polarity.
   - "Score: X / Y" increments only on a perfect answer.
3. Switch language EN → JA → ZH. Confirm all new strings translate.
4. Toggle dark mode. Confirm contrast on new strings is fine (no extra `dark:` classes were added; reusing existing wrappers).

- [ ] **Step 6: Done**

No final commit unless something needed fixing in earlier steps. Each task in the plan committed independently, so the branch is ready for review/merge as-is.

---

## Out of Scope (per spec)

- Polarity selector UI / drill mode.
- Stricter threshold tiers (4× / 0.25× only).
- Per-polarity score tracking.
