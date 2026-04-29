# Not-Effective Quiz Variant — Design

**Date:** 2026-04-27
**Status:** Approved (design phase); ready for implementation plan
**Scope:** Frontend only (`frontend/src/lib/quiz.ts`, `frontend/src/app/quiz/page.tsx`, `frontend/src/lib/i18n/translations.ts`, tests)

## Goal

Extend the existing Type Quiz with a second polarity: alongside today's "pick every super-effective (≥ 2×) type", add "pick every not-very-effective (≤ 0.5×) type". The new variant applies symmetrically to both existing directions (offensive and defensive) and both subject sizes (1 or 2 types), and is mixed into the same random rotation as the existing questions on `/quiz` — no separate page, no UI toggle.

## Non-goals

- No replacement of existing super-effective questions.
- No new threshold tier (e.g., neutral, immunity-only). Only ≤ 0.5×.
- No quiz mode selector / settings UI.
- No backend changes.

## Question shape

Add a `polarity` field to `QuizQuestion`:

```ts
export type QuizDirection = 'offensive' | 'defensive';
export type QuizPolarity = 'super_effective' | 'not_effective';

export interface QuizQuestion {
  subject: TypeRef[];           // 1 or 2 types (unchanged)
  direction: QuizDirection;     // unchanged
  polarity: QuizPolarity;       // NEW — required; set by `pickQuestion`
}
```

`pickQuestion` rolls polarity 50/50 independently of direction and subject size. The result is **2 directions × 2 polarities × 2 subject sizes = 8 question shapes** in the random pool.

The four prompt templates (one per direction × polarity combo):

| Direction | Polarity | Prompt (English) |
|-----------|----------|-------------------|
| defensive | super_effective | Which types deal super-effective damage to {types}? *(existing)* |
| offensive | super_effective | Which types take super-effective damage from {types}? *(existing)* |
| defensive | not_effective   | Which types deal not-very-effective damage to {types}? *(NEW)* |
| offensive | not_effective   | Which types take not-very-effective damage from {types}? *(NEW)* |

## Correctness logic

Aggregation across the (1 or 2) subject types is unchanged. Only the correctness threshold flips with polarity.

| | super_effective | not_effective |
|---|---|---|
| **defensive** (subject = defender; per-attacker multipliers are multiplied across subjects) | product ≥ 2× | product ≤ 0.5× |
| **offensive** (subject = attacker; per-defender multipliers take the max across subjects) | max ≥ 2× | max ≤ 0.5× |

### Why these definitions

- **Defensive × not_effective** (matches the user's spec verbatim): "do ≤ 0.5× damage to the combined types" is exactly the multiplied product against a (potentially dual) defender. 4× is the worst weakness; 0.25× is the strongest resistance; 0× immunities are included since 0 ≤ 0.5.
- **Offensive × not_effective**: `max(Fire→D, Flying→D) ≤ 0.5×` ⟺ both Fire and Flying individually do ≤ 0.5× to D ⟺ D resists both attackers. This is the natural mirror of the existing offensive-uses-max rule and represents the "walls that switch in safely against this attacker pair" intuition.

### Implementation in `computeAnswer`

`computeAnswer` already builds the per-candidate aggregated `multiplier`. Only the filter step needs to branch on polarity:

```ts
const passes = (m: number) =>
  question.polarity === 'super_effective' ? m >= 2 : m <= 0.5;
const correct = all.filter((slot) => passes(slot.multiplier));
```

`BreakdownSection` in `page.tsx` currently filters per-subject matchups with `multiplier >= 2`; this becomes the same `passes()` predicate so the breakdown shows "the relevant matchups" for whichever polarity the question is in.

## UI

The quiz page (`/quiz`) keeps its current layout. Three localized strings change behavior, plus the prompt and tag.

### Tag

Today the tag above the prompt is one of two strings: `quiz.tagDefensive` ("Defensive") / `quiz.tagOffensive` ("Offensive"). Extend to a 2-token tag combining direction and polarity, e.g. "Defensive · Super-effective" or "Offensive · Resisted". Implementation: render direction tag + a separator + a polarity tag (`quiz.tagSuperEffective` / `quiz.tagResisted`), so existing translations can be reused for the direction half.

### Prompt

Pick from one of four `quiz.directionXxx` keys based on `direction` × `polarity`. Reuse the existing `{types}` interpolation (split before/after the placeholder, render `TypeBadge`s in between). Existing keys stay; two new ones are added.

### Subtitle

Today: "A random matchup. Pick every super-effective (≥2x) type." This is no longer accurate for half the questions. Replace with a polarity-neutral subtitle: "A random matchup. Read the prompt and pick every type that fits." (`quiz.subtitle`)

### Empty-answer copy

Today's `quiz.noSuperEffective` ("No types are super-effective here.") fires when `answer.correct.length === 0`. Add a parallel `quiz.noResisted` ("No types resist this matchup.") and select based on polarity. Both empty cases occur in practice (e.g., a single offensive Normal type has no super-effective coverage; some matchups have no resists at the ≤ 0.5× threshold).

### Feedback text

`quiz.feedbackExtra` is currently "Not super-effective" (it labels selections that *aren't* in the correct set). For not-effective questions the meaning is "Not resisted". Add `quiz.feedbackExtraResisted` and pick based on polarity. `quiz.feedbackPerfect`, `quiz.feedbackPartial`, `quiz.feedbackCorrectAnswer`, `quiz.feedbackMissed` are polarity-neutral and stay unchanged.

### Breakdown labels

`quiz.breakdownDefensive` ("Each type weak to:") and `quiz.breakdownOffensive` ("Each type super-effective vs:") need not-effective parallels: `quiz.breakdownDefensiveResisted` ("Each type resists:") and `quiz.breakdownOffensiveResisted` ("Each type resisted by:"). Choose based on direction × polarity.

## i18n keys (added)

In all three locales (en / ja / zh):

- `quiz.tagSuperEffective`
- `quiz.tagResisted`
- `quiz.directionDefensiveResisted`
- `quiz.directionOffensiveResisted`
- `quiz.noResisted`
- `quiz.feedbackExtraResisted`
- `quiz.breakdownDefensiveResisted`
- `quiz.breakdownOffensiveResisted`

i18n keys (modified):

- `quiz.subtitle` — changed in all three locales to a polarity-neutral phrasing.

## Tests

`frontend/src/lib/__tests__/quiz.test.ts` extends with:

- **`pickQuestion`**: rolls polarity, both values reachable; deterministic given a seeded RNG.
- **`computeAnswer` — defensive × not_effective**:
  - Single-type defender (e.g., Fire alone) — correct set = attackers with ≤ 0.5× into Fire.
  - Dual-type defender (Fire/Flying) — correct set = attackers whose multiplied product ≤ 0.5×; verify a known case (e.g., Grass → Fire/Flying = 0.5 × 0.5 = 0.25× → in set).
  - Immunity case (Ghost included as defender) — 0× attackers appear in the not_effective set.
- **`computeAnswer` — offensive × not_effective**:
  - Single-type attacker — correct set = defenders that take ≤ 0.5× from that attacker.
  - Dual-type attacker (Fire/Flying) — correct set = defenders where `max(Fire→D, Flying→D) ≤ 0.5`. Verify a known wall.
- **Breakdown**: per-subject parts honor the polarity threshold.
- **`checkAnswer`**: existing tests still pass since they're polarity-agnostic; add one perfect/missed/extra case in the not-effective polarity for symmetry.

Existing tests need their `QuizQuestion` fixtures updated with `polarity: 'super_effective'` for compile-time correctness.

## Risks / edge cases

- **Empty correct sets** are common in not-effective questions (e.g., a dual offensive attacker with type-coverage few defenders resist). Handled by the `quiz.noResisted` empty-state copy and the existing perfect-when-no-selection check (`checkAnswer` already returns `isPerfect: true` when both `missed` and `extra` are empty).
- **Backward compatibility**: external code that constructs `QuizQuestion` literals will need the new `polarity` field. The only such code today is the test file and `page.tsx`'s call to `pickQuestion`, both of which are updated in this change.
- **Score semantics** are unchanged — perfect-or-not toggles `score.correct` regardless of polarity.

## Out of scope (future)

- A polarity selector or "drill mode" (e.g., "only show me not-effective questions").
- Threshold variants (e.g., a "strict" mode that requires 4× / 0.25× only).
- Streak / per-polarity stats.
