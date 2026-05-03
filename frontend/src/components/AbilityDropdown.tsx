'use client';

import { ABILITIES } from '@/lib/calc';
import type { AbilityInfo } from '@/lib/types';
import { useLocale, localizedName } from '@/lib/i18n';

interface Props {
  value: string | null;
  onChange: (abilityId: string | null) => void;
  speciesAbilities: AbilityInfo[];
}

export default function AbilityDropdown({ value, onChange, speciesAbilities }: Props) {
  const { locale, t } = useLocale();
  const rosterIds = new Set(ABILITIES.map((a) => a.id));
  const speciesRoster = ABILITIES.filter((a) =>
    speciesAbilities.some((s) => s.name === a.id) && rosterIds.has(a.id),
  );
  const allSorted = [...ABILITIES].sort((a, b) =>
    localizedName(a.names, locale).localeCompare(localizedName(b.names, locale)),
  );
  return (
    <select
      aria-label={t('calc.ability')}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
    >
      <option value="">{t('calc.ability.none')}</option>
      {speciesRoster.length > 0 && (
        <optgroup label={t('calc.ability.thisPokemon')}>
          {speciesRoster.map((a) => (
            <option key={a.id} value={a.id}>{localizedName(a.names, locale)}</option>
          ))}
        </optgroup>
      )}
      <optgroup label={t('calc.ability.all')}>
        {allSorted.map((a) => (
          <option key={a.id} value={a.id}>{localizedName(a.names, locale)}</option>
        ))}
      </optgroup>
    </select>
  );
}
