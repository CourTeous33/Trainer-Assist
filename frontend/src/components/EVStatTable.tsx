'use client';

import type { Stats } from '@/lib/types';
import {
  computeAllStats, evTotal, getNature,
  MAX_PER_STAT_EV_CHAMPION, MAX_PER_STAT_EV_TRADITIONAL,
  MAX_TOTAL_EV_CHAMPION, MAX_TOTAL_EV_TRADITIONAL,
  STAT_KEYS, isLevelLockedForMode,
} from '@/lib/calc';
import type { EVMode, NatureId, StatKey } from '@/lib/calc';
import { useLocale } from '@/lib/i18n';

interface Props {
  mode: EVMode;
  base: Stats;
  ivs: Stats;
  evs: Stats;
  nature: NatureId;
  level: number;
  onIVsChange: (ivs: Stats) => void;
  onEVsChange: (evs: Stats) => void;
  onLevelChange: (level: number) => void;
}

const STAT_LABEL_KEY: Record<StatKey, string> = {
  hp: 'calc.stat.hp', attack: 'calc.stat.atk', defense: 'calc.stat.def',
  special_attack: 'calc.stat.spa', special_defense: 'calc.stat.spd', speed: 'calc.stat.spe',
};

export default function EVStatTable({
  mode, base, ivs, evs, nature, level, onIVsChange, onEVsChange, onLevelChange,
}: Props) {
  const { t } = useLocale();
  const evCap = mode === 'champion' ? MAX_TOTAL_EV_CHAMPION : MAX_TOTAL_EV_TRADITIONAL;
  const perStat = mode === 'champion' ? MAX_PER_STAT_EV_CHAMPION : MAX_PER_STAT_EV_TRADITIONAL;
  const used = evTotal(evs);
  const overCap = used > evCap;
  const final = computeAllStats(base, ivs, evs, level, getNature(nature));
  const ivsLocked = mode === 'champion';
  const levelLocked = isLevelLockedForMode(mode);

  const setEV = (k: StatKey, v: number) => onEVsChange({ ...evs, [k]: Math.min(perStat, Math.max(0, v)) });
  const setIV = (k: StatKey, v: number) => onIVsChange({ ...ivs, [k]: Math.min(31, Math.max(0, v)) });

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2">
          <span className="text-gray-700 dark:text-gray-300">{t('calc.level')}</span>
          <input
            type="number" aria-label={t('calc.level')}
            value={level}
            min={1} max={100}
            disabled={levelLocked}
            onChange={(e) => onLevelChange(Math.min(100, Math.max(1, Number(e.target.value) || 50)))}
            className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:opacity-50"
          />
        </label>
        <div className={`px-2 py-1 rounded border ${overCap ? 'text-red-600 border-red-600' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}>
          {t('calc.evTotal', { used: String(used), cap: String(evCap) })}
        </div>
      </div>
      <table className="w-full">
        <thead className="text-left text-xs text-gray-500 dark:text-gray-400">
          <tr>
            <th></th>
            <th>{t('calc.base')}</th>
            <th>{t('calc.iv')}</th>
            <th>{t('calc.ev')}</th>
            <th>{t('calc.final')}</th>
          </tr>
        </thead>
        <tbody>
          {STAT_KEYS.map((k) => (
            <tr key={k}>
              <td className="font-medium text-gray-700 dark:text-gray-200">{t(STAT_LABEL_KEY[k])}</td>
              <td className="tabular-nums text-gray-500">{base[k]}</td>
              <td>
                <input
                  type="number" aria-label={`IV ${k}`}
                  value={ivs[k] === 0 ? '' : ivs[k]} min={0} max={31}
                  placeholder="0"
                  disabled={ivsLocked}
                  onChange={(e) => setIV(k, e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-14 px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 disabled:opacity-50"
                />
              </td>
              <td>
                <input
                  type="number" aria-label={`EV ${k}`}
                  value={evs[k] === 0 ? '' : evs[k]} min={0} max={perStat}
                  placeholder="0"
                  onChange={(e) => setEV(k, e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-16 px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                />
              </td>
              <td className="tabular-nums font-medium text-gray-800 dark:text-gray-100">{final[k]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
