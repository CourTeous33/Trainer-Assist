'use client';

import type { NatureId } from '@/lib/calc';
import { NATURES } from '@/lib/calc';
import { useLocale, localizedName } from '@/lib/i18n';

interface Props {
  value: NatureId;
  onChange: (nature: NatureId) => void;
}

const STAT_LABEL: Record<string, string> = {
  attack: 'Atk', defense: 'Def', speed: 'Spe',
  special_attack: 'SpA', special_defense: 'SpD', hp: 'HP',
};

export default function NatureDropdown({ value, onChange }: Props) {
  const { locale } = useLocale();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as NatureId)}
      className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
    >
      {NATURES.map((n) => {
        const sub =
          n.boosted && n.lowered
            ? ` (+${STAT_LABEL[n.boosted]} −${STAT_LABEL[n.lowered]})`
            : '';
        return (
          <option key={n.id} value={n.id}>
            {localizedName(n.names, locale)}
            {sub}
          </option>
        );
      })}
    </select>
  );
}
