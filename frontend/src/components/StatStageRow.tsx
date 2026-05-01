'use client';

import type { StatStages } from '@/lib/calc';
import { useLocale } from '@/lib/i18n';

interface Props {
  side: 'attacker' | 'defender';
  stages: StatStages;
  onChange: (stat: keyof StatStages, value: number) => void;
}

const ATTACKER_KEYS: Array<{ stat: keyof StatStages; tKey: string }> = [
  { stat: 'attack', tKey: 'calc.stages.atk' },
  { stat: 'special_attack', tKey: 'calc.stages.spa' },
];

const DEFENDER_KEYS: Array<{ stat: keyof StatStages; tKey: string }> = [
  { stat: 'defense', tKey: 'calc.stages.def' },
  { stat: 'special_defense', tKey: 'calc.stages.spd' },
];

export default function StatStageRow({ side, stages, onChange }: Props) {
  const { t } = useLocale();
  const keys = side === 'attacker' ? ATTACKER_KEYS : DEFENDER_KEYS;

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('calc.stages.label')}
      </span>
      <div className="flex flex-1 gap-3">
        {keys.map(({ stat, tKey }) => {
          const value = stages[stat];
          const display = value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0';
          const tone = value > 0
            ? 'text-green-600 dark:text-green-400'
            : value < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-gray-400';
          return (
            <div key={stat} className="flex items-center gap-1">
              <span className="text-gray-700 dark:text-gray-200 w-8">{t(tKey)}</span>
              <button
                type="button"
                onClick={() => onChange(stat, value - 1)}
                disabled={value <= -6}
                aria-label={`${t(tKey)} -1`}
                className="h-7 w-7 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => onChange(stat, 0)}
                title={t('calc.stages.reset')}
                className={`h-7 w-8 font-semibold tabular-nums ${tone} hover:underline`}
              >
                {display}
              </button>
              <button
                type="button"
                onClick={() => onChange(stat, value + 1)}
                disabled={value >= 6}
                aria-label={`${t(tKey)} +1`}
                className="h-7 w-7 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
