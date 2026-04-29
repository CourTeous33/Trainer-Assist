'use client';

import { useState } from 'react';
import type { Stats, TypeRef } from '@/lib/types';
import { STAT_KEYS, type StatKey } from '@/lib/calc';
import { useLocale } from '@/lib/i18n';
import TypeBadge from './TypeBadge';

interface Props {
  speciesBase: Stats;
  speciesTypes: number[];
  baseStatsOverride: Stats | null;
  typesOverride: number[] | null;
  allTypes: TypeRef[];
  onChange: (next: { base: Stats | null; types: number[] | null }) => void;
}

const LABEL_KEY: Record<StatKey, string> = {
  hp: 'calc.stat.hp', attack: 'calc.stat.atk', defense: 'calc.stat.def',
  special_attack: 'calc.stat.spa', special_defense: 'calc.stat.spd', speed: 'calc.stat.spe',
};

export default function BaseStatOverridePanel({
  speciesBase, speciesTypes, baseStatsOverride, typesOverride, allTypes, onChange,
}: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const isCustom = baseStatsOverride !== null || typesOverride !== null;
  const effectiveBase = baseStatsOverride ?? speciesBase;
  const effectiveTypes = typesOverride ?? speciesTypes;

  const setStat = (k: StatKey, v: number) => {
    const nextBase: Stats = { ...effectiveBase, [k]: Math.max(1, Math.min(255, v)) };
    onChange({ base: nextBase, types: typesOverride });
  };

  const toggleType = (typeId: number) => {
    let next = effectiveTypes.includes(typeId)
      ? effectiveTypes.filter((tid) => tid !== typeId)
      : effectiveTypes.length >= 2 ? [effectiveTypes[1], typeId] : [...effectiveTypes, typeId];
    if (next.length === 0) next = [speciesTypes[0]];
    onChange({ base: baseStatsOverride, types: next });
  };

  const reset = () => onChange({ base: null, types: null });

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 text-sm"
      >
        <span className="flex items-center gap-2">
          {t('calc.override.title')}
          {isCustom && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{t('calc.override.custom')}</span>}
        </span>
        <span>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="p-3 space-y-3 bg-white dark:bg-gray-800">
          <div className="grid grid-cols-3 gap-2">
            {STAT_KEYS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <span className="w-12 text-gray-600 dark:text-gray-300">{t(LABEL_KEY[k])}</span>
                <input
                  type="number" min={1} max={255}
                  value={effectiveBase[k]}
                  onChange={(e) => setStat(k, Number(e.target.value) || 1)}
                  className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTypes.map((tt) => (
              <button
                key={tt.id} type="button"
                onClick={() => toggleType(tt.id)}
                className={`transition-opacity ${effectiveTypes.includes(tt.id) ? '' : 'opacity-30'}`}
              >
                <TypeBadge name={tt.name} names={tt.names} size="sm" />
              </button>
            ))}
          </div>
          {isCustom && (
            <button
              type="button" onClick={reset}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('calc.override.reset')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
