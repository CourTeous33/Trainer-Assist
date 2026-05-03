'use client';

import { getAbility } from '@/lib/calc';
import type { AbilityInfo } from '@/lib/types';
import { useLocale, localizedName } from '@/lib/i18n';

interface Props {
  value: string | null;
  onChange: (abilityId: string | null) => void;
  speciesAbilities: AbilityInfo[];
}

export default function AbilityDropdown({ value, onChange, speciesAbilities }: Props) {
  const { locale, t } = useLocale();
  return (
    <select
      aria-label={t('calc.ability')}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
    >
      <option value="">{t('calc.ability.none')}</option>
      {speciesAbilities.map((a) => {
        const label = localizedName(a.names, locale);
        const tags: string[] = [];
        if (a.is_hidden) tags.push(t('calc.ability.hidden'));
        if (!getAbility(a.name)) tags.push(t('calc.ability.noEffect'));
        const display = tags.length ? `${label} (${tags.join(', ')})` : label;
        return <option key={a.name} value={a.name}>{display}</option>;
      })}
    </select>
  );
}
