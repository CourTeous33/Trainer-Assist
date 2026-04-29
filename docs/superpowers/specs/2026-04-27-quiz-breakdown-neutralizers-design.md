# Quiz Breakdown Neutralizers — Design

**Date:** 2026-04-27
**Status:** Approved (design phase); ready for implementation plan
**Scope:** Frontend only — `frontend/src/app/quiz/page.tsx` (`BreakdownSection`) and `frontend/src/lib/i18n/translations.ts`. No backend, no `quiz.ts` logic changes.
**Builds on:** `docs/superpowers/specs/2026-04-27-not-effective-quiz-design.md`

## Goal

When a quiz question has 2 subject types and is in the **defensive** direction, surface the *neutralizing* matchups in the breakdown section so users can understand why an apparently-correct guess is wrong. Worked example: Bug/Normal × super-effective. Normal is weak to Fighting (2×), but Bug resists Fighting (0.5×), so combined = 1× and Fighting is *not* a correct answer. Today's breakdown shows "Normal → Fighting 2×" but does not surface "Bug 0.5×". The user picks Fighting and is told they were wrong without seeing the explanation. This change adds those neutralizing entries to each subject's row.

The same trap structure exists for the not-effective polarity (one type resists, the other is weak), so the change applies symmetrically to both polarities.

## Non-goals

- Offensive direction. Offensive aggregation uses `max`, not product, so there is no "trap" structure — if any single attacker is super-effective, the answer is in the set regardless of the other attacker. No work needed there.
- Single-subject questions. The breakdown section only renders when `question.subject.length === 2`, so this change is automatically scoped to dual-subject questions.
- Changes to `computeAnswer`, `pickQuestion`, or any other data-layer function in `frontend/src/lib/quiz.ts`. The new view derives from data already in `answer.all[i].breakdown`.
- New empty-state copy. Rows that have no neutralizers render exactly as today (the divider and neutralizer group simply don't appear).

## Definitions

For a dual-subject defensive question with subjects A and B and a candidate attacker T (a per-row entry from the OTHER perspective in the breakdown):

- `mult_A(T) = lookup(T.id, A.id)` — A's individual multiplier vs T (already in `slot.breakdown`).
- `mult_B(T) = lookup(T.id, B.id)` — B's individual multiplier vs T.
- `combined(T) = mult_A(T) * mult_B(T)` (product, since direction is defensive).

**Primary entries** (existing, unchanged) for subject A's row:
- super_effective: `mult_A(T) >= 2`
- not_effective: `mult_A(T) <= 0.5`

**Neutralizing entries** (new) for subject A's row:
- super_effective: `mult_B(T) >= 2` AND `mult_A(T) <= 0.5` AND `combined(T) < 2`. The displayed multiplier is `mult_A(T)` (A's resist of T).
- not_effective: `mult_B(T) <= 0.5` AND `mult_A(T) >= 2` AND `combined(T) > 0.5`. The displayed multiplier is `mult_A(T)` (A's weakness to T).

The `combined(T)` clauses are technically redundant with the `mult_A` thresholds — `mult_A ≤ 0.5` and `mult_B ≥ 2` already guarantee the combined product can't reach 2 unless `mult_B ≥ 4`, which doesn't occur on a single matchup; ditto for the NE direction. They're listed for clarity and as a defensive guard.

A primary entry and a neutralizing entry are mutually exclusive within a single row by construction (the multiplier thresholds are disjoint at the `mult_A` level).

## Architecture

`BreakdownSection` currently maps each subject to `{ subject, matchups: AttackerMatchup[] }`. The change widens that to `{ subject, primary: AttackerMatchup[], neutralizers: AttackerMatchup[] }` and renders both groups inline with a visual divider between them. Both groups are sorted in the same order as today: descending by multiplier for super_effective, ascending for not_effective.

Construction logic, in JSX-ready pseudocode:

```ts
const rows = question.subject.map((subject) => {
  const other = question.subject.find((s) => s.id !== subject.id);
  const subjectParts = answer.all
    .map((slot) => {
      const part = slot.breakdown?.find((p) => p.subject.id === subject.id);
      const otherPart = other && slot.breakdown?.find((p) => p.subject.id === other.id);
      return part && otherPart
        ? { type: slot.type, multiplier: part.multiplier, otherMult: otherPart.multiplier }
        : null;
    })
    .filter((m): m is { type: TypeRef; multiplier: number; otherMult: number } => m !== null);

  const isSE = question.polarity === 'super_effective';
  const passes = (m: number) => (isSE ? m >= 2 : m <= 0.5);
  const inverse = (m: number) => (isSE ? m <= 0.5 : m >= 2);

  const primary = subjectParts
    .filter((m) => passes(m.multiplier))
    .sort((a, b) => (isSE ? b.multiplier - a.multiplier : a.multiplier - b.multiplier));

  const neutralizers = subjectParts
    .filter((m) => inverse(m.multiplier) && passes(m.otherMult))
    .sort((a, b) => (isSE ? a.multiplier - b.multiplier : b.multiplier - a.multiplier));
    // SE: A's resist sorted strongest-resist-first (smallest)
    // NE: A's weakness sorted strongest-weakness-first (largest)

  return { subject, primary, neutralizers };
});
```

The "single-subject" code path (which this section never renders, but worth noting) is unaffected because the section is gated on `question.subject.length === 2`.

## UI

Each row renders as a single horizontal flex-wrap line with the existing layout:

```
[subject TypeBadge] → [primary entries...]   │   <label> [neutralizer entries...]
```

The divider (`│`, U+2502) and the neutralizer label only render when `neutralizers.length > 0`. The divider sits in a small container with `text-gray-300 dark:text-gray-600` to keep it visually quiet.

The neutralizer label:
- super_effective: `quiz.breakdownNeutralizes` ("neutralizes:" / "無効化：" / "抵消：")
- not_effective: `quiz.breakdownDoesntHelp` ("doesn't help:" / "効かず：" / "无效：")

Each neutralizer entry uses the same `TypeBadge` component as the primary entries. The multiplier text alongside it uses a muted color: `text-gray-400 dark:text-gray-500` (today's primary entries use `text-gray-500 dark:text-gray-400`). This signals "secondary information" without changing badge sizing or layout. No icon, no strikethrough, no different border — the muted multiplier color is the only visual difference.

Highlighting (`MISSED_HIGHLIGHT` ring) applies to neutralizer entries the same way it applies to primary entries today: if the candidate type is in `missedIds`, the badge gets the red ring. Highlighting in the neutralizer group is unusual (a missed answer is one the user didn't pick that's actually correct, and neutralizers are by definition not in the combined correct set) but the rule stays consistent.

## i18n

Two new keys per locale:

| Key | English | Japanese | Chinese |
|---|---|---|---|
| `quiz.breakdownNeutralizes` | `neutralizes:` | `相殺：` | `抵消：` |
| `quiz.breakdownDoesntHelp` | `doesn't help:` | `効かず：` | `没帮助：` |

(Japanese `相殺` and Chinese `没帮助` were chosen during code-quality review over the originally drafted `無効化` and `无效`. `無効化` reads stiff next to the casual surrounding keys; `相殺` mirrors the Chinese `抵消` semantically. `无效` carries an in-game 0×-immunity connotation in Chinese Pokemon localizations; `没帮助` more precisely conveys "doesn't help" without that overload.)

Inserted in each locale block immediately after the existing `quiz.breakdownOffensiveResisted` key.

## Tests

Extend `frontend/src/lib/__tests__/quiz.test.ts`. The current test file targets `pickQuestion`, `computeAnswer`, and `checkAnswer`. The neutralizer logic lives in `BreakdownSection`'s render path, not in `quiz.ts`, so the natural test approach is to either:

**Option 1 (preferred): Hoist a tiny pure helper.** Extract the row-building logic into an exported helper from `quiz.ts`, e.g.:

```ts
export interface BreakdownRow {
  subject: TypeRef;
  primary: AttackerEntry[];
  neutralizers: AttackerEntry[];
}
export interface AttackerEntry {
  type: TypeRef;
  multiplier: number;
}
export function buildBreakdownRows(question: QuizQuestion, answer: QuizAnswer): BreakdownRow[];
```

Then `BreakdownSection` calls `buildBreakdownRows(question, answer)` and renders the result. Tests live in `quiz.test.ts` alongside the others, exercise both defensive polarities (super_effective and not_effective) on dual-subject questions, and assert primary + neutralizer membership. Offensive questions are not exercised separately — the helper still returns rows for them, but neutralizers are always empty by construction (offensive aggregation uses `max`, so no trap structure exists). One offensive case is included as a smoke test to confirm `neutralizers` is empty.

This is mildly preferred because:
- The function is pure and trivially testable.
- It removes the per-render lambda churn from `BreakdownSection`.
- It keeps the `quiz.ts` ↔ `quiz.test.ts` pattern that already covers the rest of the data shape.

The function is small (~20 lines) and has one clear purpose — turn a question + answer into the breakdown's row data. It joins the family of pure helpers (`computeAnswer`, `checkAnswer`) cleanly.

**Option 2 (fallback): React Testing Library on `BreakdownSection`.** Render the component with synthetic props and assert on the rendered text/badges. Heavier setup, slower, and crosses the data/render boundary needlessly when the logic is trivially extractable.

**This spec adopts Option 1.** Tests added to `quiz.test.ts`:

The fixture in `quiz.test.ts` already defines Bug, Normal, Fire, Flying, Rock, Electric, Water, Grass, Fighting, Ghost, Dark, plus an `EFFICACY` table covering the relevant matchups. The new tests reuse it without expansion. Concrete cases:

- `buildBreakdownRows — defensive × super_effective`:
  - Bug/Normal: Bug row has primary `{Rock, Fire, Flying}` (Bug's weaknesses in fixture) and neutralizers `{Fighting (0.5×)}` (Normal weak to Fighting at 2×; Bug resists Fighting at 0.5×). Normal row has primary `{Fighting}` and empty neutralizers (Normal does not resist any of Bug's weaknesses in the fixture).
  - Empty-neutralizer pair: pick a pair from the fixture where neither subject resists any of the other's weaknesses (e.g., Rock/Bug both weak to Rock and Fire — no cross-type resistance), and assert both rows return empty `neutralizers`. If no such pair exists in the fixture, omit this case rather than expand the fixture.
- `buildBreakdownRows — defensive × not_effective`:
  - Symmetric case: subject A row's primary is A's resists at ≤0.5×; neutralizers are attackers B resists at ≤0.5× but A is weak to at ≥2×. Use Fire/Flying or Normal/Ghost depending on which combination produces a non-empty neutralizer set in the fixture; if neither does, write the test using a freshly-constructed local fixture inline (a small `TypeEfficacy[]` array passed to `buildEfficacyLookup`).
- `buildBreakdownRows — offensive smoke`:
  - One offensive question (any direction-of-attack and polarity) returns rows with empty `neutralizers` for both subjects. This documents the structural guarantee.
- `buildBreakdownRows — single-subject question`:
  - For 1-subject questions, the helper returns one row whose `primary` matches today's behavior and whose `neutralizers` is empty. (The component never invokes this in production since the section is gated on `subject.length === 2`, but the helper should not crash.)
- Sort order:
  - SE primary sorted descending by multiplier; SE neutralizers sorted ascending (strongest resist first — smallest multiplier).
  - NE primary sorted ascending by multiplier; NE neutralizers sorted descending (strongest weakness first — largest multiplier).

Existing breakdown tests in `BreakdownSection`'s render path are not affected — the JSX layer stays simple.

## File Structure

| File | Change |
|---|---|
| `frontend/src/lib/quiz.ts` | Add `buildBreakdownRows` and supporting types (`BreakdownRow`, `AttackerEntry`). |
| `frontend/src/lib/__tests__/quiz.test.ts` | New `describe` block for `buildBreakdownRows` covering both polarities and the single-subject edge case. |
| `frontend/src/app/quiz/page.tsx` | `BreakdownSection` calls `buildBreakdownRows`, renders the new neutralizer group with divider + label + muted multiplier styling. |
| `frontend/src/lib/i18n/translations.ts` | Add `quiz.breakdownNeutralizes` and `quiz.breakdownDoesntHelp` to en, ja, zh. |

## Risks / edge cases

- **Long rows.** If both groups are non-empty and the type pool is large, a row may wrap onto multiple lines. The existing layout uses `flex-wrap items-center gap-1.5`, so wrapping is already handled gracefully — neutralizers would simply wrap below the primary group. The divider should ideally stay inline with the primary group; if wrapping pushes the divider to a new line that's acceptable visual behavior.
- **A subject with no neutralizers and a subject with several.** This is asymmetric and will look uneven (one row long, one row short). That is expected and informative — it's literally the data telling the user "subject X is doing all the neutralizing here."
- **Mutual neutralization.** It's possible (rare) for both subjects to have neutralizer entries. In that case both rows show their respective neutralizer groups and the user sees the full picture.
- **Highlight ring on neutralizer entries.** As described in the UI section, the `MISSED_HIGHLIGHT` ring would appear if a neutralizer entry's type happens to be in `missedIds`. By construction this can't happen (a missed type is in the correct set; a neutralizer type is not in the correct set), so the ring effectively never renders on neutralizer entries — but the code path stays consistent rather than special-casing it.
- **Single-attacker pair where the "trap" is shared by both subjects.** Possible if both A and B individually resist different attackers that the other is weak to. The two rows render independently; no cross-row interaction. Each subject explains its half of the cancellation.

## Out of Scope (future)

- Visual cue connecting a primary entry on one row to its neutralizer entry on the other row (e.g., a hover-link or color-match). Not needed for V1.
- Tooltip on neutralizer entries explaining the math. The mute styling + label is enough.
- Surfacing neutralizers for offensive questions. They don't structurally exist (`max` doesn't have a "trap" structure).
