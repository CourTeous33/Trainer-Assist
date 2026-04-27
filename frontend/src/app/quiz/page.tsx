'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getTypes, getTypeEfficacy } from '@/lib/api';
import type { TypeRef, LocalizedNames } from '@/lib/types';
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
import TypeBadge from '@/components/TypeBadge';
import TypeKeypad from '@/components/TypeKeypad';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useLocale } from '@/lib/i18n';

export default function QuizPage() {
  const { t: tr } = useLocale();
  const [types, setTypes] = useState<TypeRef[]>([]);
  const lookupRef = useRef<EfficacyLookup | null>(null);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [answer, setAnswerState] = useState<QuizAnswer | null>(null);
  const [selected, setSelected] = useState<TypeRef[]>([]);
  const [result, setResult] = useState<AnswerCheck | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getTypes(), getTypeEfficacy()])
      .then(([t, e]) => {
        setTypes(t);
        const lookup = buildEfficacyLookup(e);
        lookupRef.current = lookup;
        const q = pickQuestion(t);
        setQuestion(q);
        setAnswerState(computeAnswer(t, lookup, q));
      })
      .catch((err) => setError(err.message || 'Failed to load types'))
      .finally(() => setLoading(false));
  }, []);

  const typeNamesMap = useMemo(
    () => new Map(types.map((t) => [t.name, t.names])),
    [types],
  );

  const toggle = (t: TypeRef) => {
    if (result) return;
    setSelected((prev) =>
      prev.find((s) => s.id === t.id)
        ? prev.filter((s) => s.id !== t.id)
        : [...prev, t],
    );
  };

  const check = () => {
    if (!answer) return;
    const r = checkAnswer(selected.map((s) => s.id), answer);
    setResult(r);
    setScore((s) => ({
      correct: s.correct + (r.isPerfect ? 1 : 0),
      total: s.total + 1,
    }));
  };

  const next = () => {
    const lookup = lookupRef.current;
    if (!lookup || types.length === 0) return;
    const q = pickQuestion(types);
    setQuestion(q);
    setAnswerState(computeAnswer(types, lookup, q));
    setSelected([]);
    setResult(null);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!question || !answer) return null;

  const missedIds = result ? new Set(result.missed.map((m) => m.type.id)) : undefined;

  const isResisted = question.polarity === 'not_effective';
  const promptKey =
    question.direction === 'defensive'
      ? isResisted
        ? 'quiz.directionDefensiveResisted'
        : 'quiz.directionDefensive'
      : isResisted
        ? 'quiz.directionOffensiveResisted'
        : 'quiz.directionOffensive';

  const [promptBefore, promptAfter] = tr(promptKey).split('{types}');

  return (
    <div className="py-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {tr('quiz.title')}
        </h1>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        {tr('quiz.subtitle')}
      </p>

      {/* Question card */}
      <div className="mb-6 rounded-xl bg-white p-5 shadow-md dark:bg-gray-800">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
            {question.direction === 'defensive'
              ? tr('quiz.tagDefensive')
              : tr('quiz.tagOffensive')}
            {' · '}
            {isResisted ? tr('quiz.tagResisted') : tr('quiz.tagSuperEffective')}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {tr('quiz.score', { correct: String(score.correct), total: String(score.total) })}
          </span>
        </div>

        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-base text-gray-700 dark:text-gray-200">
          {promptBefore && <span>{promptBefore}</span>}
          {question.subject.map((s, i) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              {i > 0 && <span className="text-gray-400">/</span>}
              <TypeBadge name={s.name} names={s.names} size="lg" />
            </span>
          ))}
          {promptAfter && <span>{promptAfter}</span>}
        </p>
      </div>

      {/* Answer keypad */}
      <TypeKeypad
        types={types}
        selectedNames={selected.map((s) => s.name)}
        onToggle={toggle}
        className="mb-4"
      />

      {/* Action button */}
      <div className="mb-6 flex justify-center">
        {result ? (
          <button
            onClick={next}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {tr('quiz.next')}
          </button>
        ) : (
          <button
            onClick={check}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {tr('quiz.check')}
          </button>
        )}
      </div>

      {/* Feedback */}
      {result && (
        <div className="rounded-xl bg-white p-5 shadow-md dark:bg-gray-800">
          <h2
            className={`mb-3 text-lg font-semibold ${
              result.isPerfect
                ? 'text-green-600 dark:text-green-400'
                : 'text-orange-600 dark:text-orange-400'
            }`}
          >
            {result.isPerfect ? tr('quiz.feedbackPerfect') : tr('quiz.feedbackPartial')}
          </h2>

          {answer.correct.length === 0 ? (
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              {tr('quiz.noSuperEffective')}
            </p>
          ) : (
            <FeedbackList
              label={tr('quiz.feedbackCorrectAnswer')}
              slots={answer.correct}
              color="text-green-600 dark:text-green-400"
              typeNamesMap={typeNamesMap}
              highlightIds={missedIds}
            />
          )}

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

          {result.missed.length > 0 && (
            <FeedbackList
              label={tr('quiz.feedbackMissed')}
              slots={result.missed}
              color="text-red-600 dark:text-red-400"
              typeNamesMap={typeNamesMap}
            />
          )}
          {result.extra.length > 0 && (
            <FeedbackList
              label={tr('quiz.feedbackExtra')}
              slots={result.extra}
              color="text-orange-600 dark:text-orange-400"
              typeNamesMap={typeNamesMap}
            />
          )}
        </div>
      )}
    </div>
  );
}

const MISSED_HIGHLIGHT = 'ring-2 ring-offset-1 ring-red-500 dark:ring-red-400 dark:ring-offset-gray-800';

function formatMultiplier(m: number): string {
  if (m === 0.25) return '¼x';
  if (m === 0.5) return '½x';
  return `${m}x`;
}

function FeedbackList({
  label,
  slots,
  color,
  typeNamesMap,
  highlightIds,
}: {
  label: string;
  slots: AnswerSlot[];
  color: string;
  typeNamesMap: Map<string, LocalizedNames>;
  highlightIds?: Set<number>;
}) {
  if (slots.length === 0) return null;
  return (
    <div className="mb-3">
      <p className={`text-sm font-medium ${color}`}>{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {slots.map((slot) => (
          <span key={slot.type.id} className="inline-flex items-center gap-1">
            <TypeBadge
              name={slot.type.name}
              names={typeNamesMap.get(slot.type.name)}
              className={highlightIds?.has(slot.type.id) ? MISSED_HIGHLIGHT : ''}
            />
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
              {formatMultiplier(slot.multiplier)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

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
  const rows = question.subject.map((subject) => {
    const matchups = answer.all
      .map((slot) => {
        const part = slot.breakdown?.find((p) => p.subject.id === subject.id);
        return part ? { type: slot.type, multiplier: part.multiplier } : null;
      })
      .filter((m): m is { type: TypeRef; multiplier: number } => m !== null && m.multiplier >= 2)
      .sort((a, b) => b.multiplier - a.multiplier);
    return { subject, matchups };
  });

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      <div className="space-y-2">
        {rows.map(({ subject, matchups }) => (
          <div key={subject.id} className="flex flex-wrap items-center gap-2">
            <TypeBadge name={subject.name} names={subject.names} size="md" />
            <span className="text-xs text-gray-400">→</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {matchups.map((m) => (
                <span key={m.type.id} className="inline-flex items-center gap-1">
                  <TypeBadge
                    name={m.type.name}
                    names={typeNamesMap.get(m.type.name)}
                    className={highlightIds?.has(m.type.id) ? MISSED_HIGHLIGHT : ''}
                  />
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {formatMultiplier(m.multiplier)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
