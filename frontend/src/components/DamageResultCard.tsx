'use client';

import { useState } from 'react';
import type { MoveSummary } from '@/lib/types';
import type { CalcOutcome } from '@/lib/calc';
import { useLocale, localizedName } from '@/lib/i18n';
import TypeBadge from './TypeBadge';
import DamageRangeBar from './DamageRangeBar';

interface Props {
  move: MoveSummary | null;
  result: CalcOutcome | null;
}

export default function DamageResultCard({ move, result }: Props) {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);

  if (!move || !result) {
    return (
      <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-500">
        {t('calc.result.empty')}
      </div>
    );
  }
  if ('unsupportedReason' in result) {
    return (
      <div className="border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-3 text-sm">
        <div className="font-medium mb-1">{localizedName(move.names, locale)}</div>
        <div>{t(`calc.result.unsupported.${result.unsupportedReason}`)}</div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800 space-y-2">
      <div className="flex items-center gap-2">
        <TypeBadge name={move.type_ref.name} names={move.type_ref.names} size="sm" />
        <span className="font-medium text-sm flex-1">{localizedName(move.names, locale)}</span>
        <span className="text-xs text-gray-500 capitalize">{move.damage_class}</span>
        <span className="text-xs tabular-nums text-gray-500">{move.power}</span>
      </div>
      <DamageRangeBar minPct={result.minPct} maxPct={result.maxPct} />
      <div className="text-sm tabular-nums">
        {result.minPct.toFixed(1)}% – {result.maxPct.toFixed(1)}% (avg {result.avgPct.toFixed(1)}%)
      </div>
      <div className="text-xs text-gray-600 dark:text-gray-300">
        {t('calc.result.ohko')}: {result.ohkoPct.toFixed(1)}% · {t('calc.result.twoHko')}: {result.twoHkoPct.toFixed(1)}% · {t('calc.result.threeHko')}: {result.threeHkoPct.toFixed(1)}%
      </div>
      <div className="text-xs italic text-gray-500">{result.qualifier}</div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        {open ? t('calc.result.hideDetails') : t('calc.result.showDetails')}
      </button>
      {open && (
        <div className="text-xs space-y-1 border-t border-gray-200 dark:border-gray-700 pt-2">
          <div>
            <span className="font-medium">{t('calc.result.rolls')}:</span>{' '}
            <span className="tabular-nums">[{result.rolls.join(', ')}]</span>
          </div>
          <div>
            <span className="font-medium">{t('calc.result.modifiers')}:</span>{' '}
            STAB ×{result.modifiers.stab} · Type ×{result.modifiers.typeEff} · Item ×{result.modifiers.item}
          </div>
          <div>
            Atk {result.attackerStat} · Def {result.defenderStat} · HP {result.defenderHp}
          </div>
        </div>
      )}
    </div>
  );
}
