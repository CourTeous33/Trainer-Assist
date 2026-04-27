# Quiz Breakdown Neutralizers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the "neutralizing" matchups in the dual-subject defensive breakdown so users see why a single-type-weak attacker isn't in the combined correct set (e.g., Bug+Rock SE: Rock resists Fire/Flying, so neither is a combined weakness despite Bug being weak to both).

**Architecture:** Hoist a small pure helper `buildBreakdownRows(question, answer)` from the inline computation in `BreakdownSection`. The helper returns one row per subject with `primary` (existing weakness/resist list) and `neutralizers` (the new trap-explainer list). `BreakdownSection` becomes a thin renderer that consumes the helper's output and adds a divider + label + muted-multiplier-color neutralizer group when present. Neutralizers only exist for the defensive direction (offensive aggregation uses `max`, no trap structure), gated explicitly.

**Tech Stack:** TypeScript, React (Next.js 16), Vitest, Tailwind CSS v4. Frontend-only — `frontend/src/lib/quiz.ts`, `frontend/src/lib/__tests__/quiz.test.ts`, `frontend/src/app/quiz/page.tsx`, `frontend/src/lib/i18n/translations.ts`.

**Spec:** `docs/superpowers/specs/2026-04-27-quiz-breakdown-neutralizers-design.md`

---

## File Structure

| File | Responsibility | Change kind |
|---|---|---|
| `frontend/src/lib/quiz.ts` | Add `AttackerEntry`, `BreakdownRow` types and `buildBreakdownRows` pure helper | modify |
| `frontend/src/lib/__tests__/quiz.test.ts` | Add `buildBreakdownRows` tests (5 `it` blocks) | modify |
| `frontend/src/lib/i18n/translations.ts` | Add `quiz.breakdownNeutralizes` and `quiz.breakdownDoesntHelp` × 3 locales | modify |
| `frontend/src/app/quiz/page.tsx` | Refactor `BreakdownSection` to consume the helper and render the neutralizer group | modify |

No new files. The helper joins the family of pure functions in `quiz.ts` (`computeAnswer`, `checkAnswer`); tests join `quiz.test.ts`.

---

## Task 1: Hoist `buildBreakdownRows` helper (TDD)

Add the new types and a pure helper that computes the per-subject row data including neutralizers, with TDD-style tests using the existing fixture in `quiz.test.ts`.

**Files:**
- Modify: `frontend/src/lib/quiz.ts`
- Modify: `frontend/src/lib/__tests__/quiz.test.ts`

- [ ] **Step 1: Add new types and a stub `buildBreakdownRows` returning `[]`**

In `frontend/src/lib/quiz.ts`, find the existing exported types section (near the top, after `QuizAnswer`/`AnswerCheck`). Add:

```ts
export interface AttackerEntry {
  type: TypeRef;
  multiplier: number;
}

export interface BreakdownRow {
  subject: TypeRef;
  primary: AttackerEntry[];
  neutralizers: AttackerEntry[];
}
```

Then, at the bottom of the file (after `mulberry32`), add the stub:

```ts
export function buildBreakdownRows(
  question: QuizQuestion,
  answer: QuizAnswer,
): BreakdownRow[] {
  void question;
  void answer;
  return [];
}
```

The `void question; void answer;` lines silence "unused parameter" lint warnings on the stub. They'll be removed when the body is implemented in Step 4.

- [ ] **Step 2: Add failing tests for `buildBreakdownRows`**

In `frontend/src/lib/__tests__/quiz.test.ts`, update the import to include the new symbols. Find the existing import line (around line 2-8):

```ts
import {
  buildEfficacyLookup,
  computeAnswer,
  checkAnswer,
  pickQuestion,
  mulberry32,
} from '../quiz';
```

Replace with:

```ts
import {
  buildBreakdownRows,
  buildEfficacyLookup,
  computeAnswer,
  checkAnswer,
  pickQuestion,
  mulberry32,
} from '../quiz';
```

Then append the following `describe` block to the bottom of the file:

```ts
describe('buildBreakdownRows', () => {
  it('SE defensive — Bug/Rock: Rock row neutralizes Bug\'s weakness to Fire & Flying', () => {
    const q = {
      subject: [BUG, ROCK],
      direction: 'defensive' as const,
      polarity: 'super_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    const rows = buildBreakdownRows(q, a);

    expect(rows).toHaveLength(2);
    const bugRow = rows.find((r) => r.subject.id === BUG.id)!;
    const rockRow = rows.find((r) => r.subject.id === ROCK.id)!;

    // Bug's individual weaknesses (≥2x): Rock, Fire, Flying.
    expect(new Set(bugRow.primary.map((e) => e.type.name))).toEqual(
      new Set(['rock', 'fire', 'flying']),
    );
    // Bug doesn't resist any of Rock's weaknesses (Water, Grass) in the fixture.
    expect(bugRow.neutralizers).toEqual([]);

    // Rock's individual weaknesses (≥2x): Water, Grass.
    expect(new Set(rockRow.primary.map((e) => e.type.name))).toEqual(
      new Set(['water', 'grass']),
    );
    // Rock resists Fire (0.5x) and Flying (0.5x) — both are Bug's weaknesses,
    // so they're trap explainers in Rock's row.
    expect(new Set(rockRow.neutralizers.map((e) => e.type.name))).toEqual(
      new Set(['fire', 'flying']),
    );
    // Displayed multiplier is Rock's resist (0.5x), not Bug's weakness.
    expect(rockRow.neutralizers.find((e) => e.type.name === 'fire')!.multiplier).toBe(0.5);
    expect(rockRow.neutralizers.find((e) => e.type.name === 'flying')!.multiplier).toBe(0.5);
  });

  it('NE defensive — Rock/Fire: Rock row neutralizes its own weakness to Grass via Fire', () => {
    const q = {
      subject: [ROCK, FIRE],
      direction: 'defensive' as const,
      polarity: 'not_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    const rows = buildBreakdownRows(q, a);

    const rockRow = rows.find((r) => r.subject.id === ROCK.id)!;
    const fireRow = rows.find((r) => r.subject.id === FIRE.id)!;

    // Rock's individual resists (≤0.5x): Fire, Flying.
    expect(new Set(rockRow.primary.map((e) => e.type.name))).toEqual(
      new Set(['fire', 'flying']),
    );
    // Fire resists Grass (0.5x) but Rock is weak to Grass (2x) — combined 1x,
    // not in NE set. Trap explainer in Rock's row, displayed as Rock's weakness.
    expect(rockRow.neutralizers.map((e) => e.type.name)).toEqual(['grass']);
    expect(rockRow.neutralizers[0].multiplier).toBe(2);

    // Fire's individual resists (≤0.5x): Grass.
    expect(fireRow.primary.map((e) => e.type.name)).toEqual(['grass']);
    // Rock doesn't resist any of Fire's weaknesses (Water) in the fixture.
    expect(fireRow.neutralizers).toEqual([]);
  });

  it('SE primary sorted descending; SE neutralizers sorted ascending (strongest resist first)', () => {
    const q = {
      subject: [BUG, ROCK],
      direction: 'defensive' as const,
      polarity: 'super_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    const rows = buildBreakdownRows(q, a);

    const rockRow = rows.find((r) => r.subject.id === ROCK.id)!;
    // Primary: Water 2x, Grass 2x — both equal so sort is stable; just check
    // every primary multiplier is the threshold or stronger.
    rockRow.primary.forEach((e) => expect(e.multiplier).toBeGreaterThanOrEqual(2));
    // Neutralizers: Fire 0.5x, Flying 0.5x — both 0.5x; no immunities here.
    rockRow.neutralizers.forEach((e) => expect(e.multiplier).toBeLessThanOrEqual(0.5));
  });

  it('offensive smoke — neutralizers always empty', () => {
    const q = {
      subject: [FIRE, FLYING],
      direction: 'offensive' as const,
      polarity: 'super_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    const rows = buildBreakdownRows(q, a);

    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(row.neutralizers).toEqual([]);
    });
  });

  it('single-subject question — one row, neutralizers empty', () => {
    const q = {
      subject: [BUG],
      direction: 'defensive' as const,
      polarity: 'super_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    const rows = buildBreakdownRows(q, a);

    expect(rows).toHaveLength(1);
    expect(rows[0].subject.id).toBe(BUG.id);
    expect(rows[0].neutralizers).toEqual([]);
    // Primary still computed correctly.
    expect(new Set(rows[0].primary.map((e) => e.type.name))).toEqual(
      new Set(['rock', 'fire', 'flying']),
    );
  });
});
```

- [ ] **Step 3: Run tests — verify the 5 new tests fail**

Run from `/home/ubuntu/Trainer-Assist`:

```bash
docker run --rm -v $(pwd)/frontend:/app -w /app node:22-alpine sh -c "node node_modules/.bin/vitest run quiz 2>&1 | tail -30"
```

Expected: All 5 new `it` blocks FAIL. The stub returns `[]`, so `rows.toHaveLength(2)` and similar assertions fail. Existing 23 quiz tests still pass.

- [ ] **Step 4: Implement `buildBreakdownRows`**

Replace the stub in `frontend/src/lib/quiz.ts` with the full implementation:

```ts
export function buildBreakdownRows(
  question: QuizQuestion,
  answer: QuizAnswer,
): BreakdownRow[] {
  const isSE = question.polarity === 'super_effective';
  const passes = (m: number) => (isSE ? m >= 2 : m <= 0.5);
  const inverse = (m: number) => (isSE ? m <= 0.5 : m >= 2);
  const includeNeutralizers = question.direction === 'defensive' && question.subject.length === 2;

  return question.subject.map((subject) => {
    const other = question.subject.find((s) => s.id !== subject.id);

    type Joined = { type: TypeRef; multiplier: number; otherMult: number };
    const subjectParts: Joined[] = [];
    for (const slot of answer.all) {
      const part = slot.breakdown?.find((p) => p.subject.id === subject.id);
      if (!part) continue;
      const otherPart = other && slot.breakdown?.find((p) => p.subject.id === other.id);
      subjectParts.push({
        type: slot.type,
        multiplier: part.multiplier,
        otherMult: otherPart?.multiplier ?? 1,
      });
    }

    const primary: AttackerEntry[] = subjectParts
      .filter((m) => passes(m.multiplier))
      .map((m) => ({ type: m.type, multiplier: m.multiplier }))
      .sort((a, b) => (isSE ? b.multiplier - a.multiplier : a.multiplier - b.multiplier));

    const neutralizers: AttackerEntry[] = includeNeutralizers
      ? subjectParts
          .filter((m) => inverse(m.multiplier) && passes(m.otherMult))
          .map((m) => ({ type: m.type, multiplier: m.multiplier }))
          .sort((a, b) => (isSE ? a.multiplier - b.multiplier : b.multiplier - a.multiplier))
      : [];

    return { subject, primary, neutralizers };
  });
}
```

Notes on the implementation:
- The `includeNeutralizers` gate enforces the spec's defensive-only + dual-subject rule. Single-subject questions and offensive questions get empty `neutralizers` regardless of fixture data.
- `otherPart?.multiplier ?? 1` handles the single-subject case (no `other`); the resulting `1` never passes `passes(otherMult)` for either polarity, so it's a safe sentinel.
- `passes` and `inverse` mirror the existing predicate naming used in `computeAnswer` (the `passes` closure there) — same pattern, slightly different scope.

- [ ] **Step 5: Run tests — verify all 28 quiz tests pass**

Run from `/home/ubuntu/Trainer-Assist`:

```bash
docker run --rm -v $(pwd)/frontend:/app -w /app node:22-alpine sh -c "node node_modules/.bin/vitest run quiz 2>&1 | tail -10"
```

Expected: 28 quiz tests pass (23 existing + 5 new). No regressions.

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/Trainer-Assist
git add frontend/src/lib/quiz.ts frontend/src/lib/__tests__/quiz.test.ts
git commit -m "Add buildBreakdownRows helper for breakdown neutralizers"
```

---

## Task 2: Add i18n keys

Add 2 new keys × 3 locales (6 entries total). Mechanical change.

**Files:**
- Modify: `frontend/src/lib/i18n/translations.ts`

- [ ] **Step 1: Update the English block**

In `/home/ubuntu/Trainer-Assist/frontend/src/lib/i18n/translations.ts`, find the line `'quiz.breakdownOffensiveResisted': 'Each type resisted by:',` (added in the prior feature, around line 53). Insert these 2 new keys directly after it:

```ts
    'quiz.breakdownNeutralizes': 'neutralizes:',
    'quiz.breakdownDoesntHelp': 'doesn\'t help:',
```

- [ ] **Step 2: Update the Japanese block**

Find the Japanese `'quiz.breakdownOffensiveResisted': '...',` (around line 244). Insert directly after it:

```ts
    'quiz.breakdownNeutralizes': '無効化：',
    'quiz.breakdownDoesntHelp': '効かず：',
```

- [ ] **Step 3: Update the Chinese block**

Find the Chinese `'quiz.breakdownOffensiveResisted': '...',` (around line 377). Insert directly after it:

```ts
    'quiz.breakdownNeutralizes': '抵消：',
    'quiz.breakdownDoesntHelp': '无效：',
```

- [ ] **Step 4: Verify typecheck and i18n tests**

Run from `/home/ubuntu/Trainer-Assist`:

```bash
docker run --rm -v $(pwd)/frontend:/app -w /app node:22-alpine sh -c "node node_modules/typescript/bin/tsc --noEmit 2>&1 | tail -10"
```

Expected: only the 3 pre-existing errors in `pokemon-detail.test.tsx`. No new errors. (If you see errors complaining about missing keys in the locale literal types, double-check that all 3 locales got both new keys.)

```bash
docker run --rm -v $(pwd)/frontend:/app -w /app node:22-alpine sh -c "node node_modules/.bin/vitest run i18n 2>&1 | tail -10"
```

Expected: 7 i18n tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/Trainer-Assist
git add frontend/src/lib/i18n/translations.ts
git commit -m "Add neutralizer breakdown translation keys (en/ja/zh)"
```

---

## Task 3: Refactor `BreakdownSection` to render neutralizers

Replace the inline matchups computation in `BreakdownSection` with a call to `buildBreakdownRows`, and extend the JSX to render the neutralizer group with a divider, label, and muted multiplier styling.

**Files:**
- Modify: `frontend/src/app/quiz/page.tsx`

- [ ] **Step 1: Replace the inline row computation with the helper call**

In `/home/ubuntu/Trainer-Assist/frontend/src/app/quiz/page.tsx`, update the import. Find the existing import block from `'@/lib/quiz'` (around lines 6-16):

```tsx
import {
  buildEfficacyLookup,
  checkAnswer,
  computeAnswer,
  pickQuestion,
  type AnswerCheck,
  type AnswerSlot,
  type EfficacyLookup,
  type QuizAnswer,
  type QuizQuestion,
} from '@/lib/quiz';
```

Replace with:

```tsx
import {
  buildBreakdownRows,
  buildEfficacyLookup,
  checkAnswer,
  computeAnswer,
  pickQuestion,
  type AnswerCheck,
  type AnswerSlot,
  type AttackerEntry,
  type EfficacyLookup,
  type QuizAnswer,
  type QuizQuestion,
} from '@/lib/quiz';
```

(`AttackerEntry` is needed for the JSX type below.)

- [ ] **Step 2: Replace the body of `BreakdownSection` to use the helper and render neutralizers**

Find the entire `BreakdownSection` function (currently around lines 282-345). Replace it in full with:

```tsx
function BreakdownSection({
  question,
  answer,
  typeNamesMap,
  label,
  highlightIds,
}: {
  question: QuizQuestion;
  answer: QuizAnswer;
  typeNamesMap: Map<string, LocalizedNames>;
  label: string;
  highlightIds?: Set<number>;
}) {
  const { t: tr } = useLocale();
  const rows = buildBreakdownRows(question, answer);
  const neutralizerLabel = tr(
    question.polarity === 'super_effective'
      ? 'quiz.breakdownNeutralizes'
      : 'quiz.breakdownDoesntHelp',
  );

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      <div className="space-y-2">
        {rows.map(({ subject, primary, neutralizers }) => (
          <div key={subject.id} className="flex flex-wrap items-center gap-2">
            <TypeBadge name={subject.name} names={subject.names} size="md" />
            <span className="text-xs text-gray-400">→</span>
            <BreakdownEntries
              entries={primary}
              typeNamesMap={typeNamesMap}
              highlightIds={highlightIds}
              muted={false}
            />
            {neutralizers.length > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">│</span>
                <span className="text-xs italic text-gray-500 dark:text-gray-400">
                  {neutralizerLabel}
                </span>
                <BreakdownEntries
                  entries={neutralizers}
                  typeNamesMap={typeNamesMap}
                  highlightIds={highlightIds}
                  muted={true}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakdownEntries({
  entries,
  typeNamesMap,
  highlightIds,
  muted,
}: {
  entries: AttackerEntry[];
  typeNamesMap: Map<string, LocalizedNames>;
  highlightIds?: Set<number>;
  muted: boolean;
}) {
  const multClass = muted
    ? 'text-gray-400 dark:text-gray-500'
    : 'text-gray-500 dark:text-gray-400';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entries.map((m) => (
        <span key={m.type.id} className="inline-flex items-center gap-1">
          <TypeBadge
            name={m.type.name}
            names={typeNamesMap.get(m.type.name)}
            className={highlightIds?.has(m.type.id) ? MISSED_HIGHLIGHT : ''}
          />
          <span className={`text-xs font-semibold ${multClass}`}>
            {formatMultiplier(m.multiplier)}
          </span>
        </span>
      ))}
    </div>
  );
}
```

Key changes vs the previous `BreakdownSection`:
- Inline `rows = question.subject.map(...)` block replaced with `const rows = buildBreakdownRows(question, answer);` — a single line.
- The component pulls `tr` via `useLocale()` to look up the neutralizer label.
- Each row renders: subject badge, arrow, primary entries, then conditionally a divider + label + neutralizer entries.
- Entries rendering extracted into a small `BreakdownEntries` component with a `muted` prop controlling the multiplier color. This avoids duplicating the entry-row JSX twice in the same component.
- `useLocale` was already imported at the top of `page.tsx` (used by `QuizPage`); no new import needed.

- [ ] **Step 3: Run typecheck**

Run from `/home/ubuntu/Trainer-Assist`:

```bash
docker run --rm -v $(pwd)/frontend:/app -w /app node:22-alpine sh -c "node node_modules/typescript/bin/tsc --noEmit 2>&1 | tail -10"
```

Expected: only the 3 pre-existing errors in `pokemon-detail.test.tsx`. No new errors.

- [ ] **Step 4: Run all frontend tests**

```bash
docker run --rm -v $(pwd)/frontend:/app -w /app node:22-alpine sh -c "node node_modules/.bin/vitest run 2>&1 | tail -10"
```

Expected: all 91 tests pass (86 prior + 5 from Task 1).

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/Trainer-Assist
git add frontend/src/app/quiz/page.tsx
git commit -m "Render neutralizer entries in quiz breakdown section"
```

---

## Task 4: Final verification

Cross-cut verification + production build + manual UI smoke test.

**Files:** none (verification only).

- [ ] **Step 1: Run all frontend tests**

```bash
docker run --rm -v /home/ubuntu/Trainer-Assist/frontend:/app -w /app node:22-alpine sh -c "node node_modules/.bin/vitest run 2>&1 | tail -10"
```

Expected: 91 tests pass (10 test files).

- [ ] **Step 2: Lint**

```bash
docker run --rm -v /home/ubuntu/Trainer-Assist/frontend:/app -w /app node:22-alpine sh -c "node node_modules/.bin/eslint . 2>&1; echo EXIT $?"
```

Expected: `EXIT 0`. Empty stdout = no lint errors.

- [ ] **Step 3: Typecheck**

```bash
docker run --rm -v /home/ubuntu/Trainer-Assist/frontend:/app -w /app node:22-alpine sh -c "node node_modules/typescript/bin/tsc --noEmit 2>&1 | tail -10"
```

Expected: only the 3 pre-existing errors in `pokemon-detail.test.tsx`. No new errors.

- [ ] **Step 4: Production build**

```bash
docker run --rm -v /home/ubuntu/Trainer-Assist/frontend:/app -w /app -e NEXT_PUBLIC_API_URL=http://localhost:3001 node:22-alpine sh -c "node node_modules/.bin/next build 2>&1 | tail -10"
```

Expected: "Compiled successfully" and the static page list including `/quiz`.

- [ ] **Step 5: Rebuild frontend container so new code is served**

```bash
cd /home/ubuntu/Trainer-Assist
docker compose build frontend
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d frontend
sleep 5
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/quiz
```

Expected: HTTP 200.

The dev overlay is needed to publish port 3000 to the host (the base compose only exposes the port internally to caddy).

- [ ] **Step 6: Manual UI smoke test**

Open `http://localhost:3000/quiz` in a browser. Click "Next question" until you see a 2-subject defensive question. Then:

1. **SE 2-subject defensive trap visible**: when the question is super-effective × defensive × dual-subject, click "Check answer" with no selection. The breakdown should render. If the type pair has any neutralizer matchups (e.g., Fire/Flying defender — Rock 4× shows in primary, but if any single-type weakness is cancelled by the other type, it appears with the "neutralizes:" label and a muted multiplier).
2. **NE 2-subject defensive trap visible**: similar, but for not-effective questions. The "doesn't help:" label appears when applicable.
3. **No neutralizers when none exist**: 1-subject questions and offensive questions should render the breakdown exactly as before, with no divider, label, or neutralizer entries.
4. **Language switch (en/ja/zh)**: the labels "neutralizes:", "doesn't help:", "無効化：", "効かず：", "抵消：", "无效：" all render correctly when the language is switched.
5. **Dark mode**: the divider (`│`) and muted multiplier color are visible but quieter than primary entries in both light and dark modes.

If the breakdown doesn't render any neutralizers at all over ~10 questions, you may have unlucky rolls — try different pairs or refresh. Bug+Rock and Fire/Flying are common pairs that should show them.

- [ ] **Step 7: Done**

No final commit unless something needed fixing in earlier steps. Each task in the plan committed independently, so the branch is ready as-is.

---

## Out of Scope (per spec)

- Visual cues connecting primary entries on one row to neutralizer entries on the other row.
- Hover tooltips explaining the math.
- Surfacing neutralizers for offensive questions (no trap structure exists there).
