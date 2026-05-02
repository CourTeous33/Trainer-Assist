'use client';

import { ITEMS_BY_TIER } from '@/lib/calc';
import { useLocale, localizedName } from '@/lib/i18n';

interface Props {
  value: string | null;
  onChange: (itemId: string | null) => void;
}

export default function ItemDropdown({ value, onChange }: Props) {
  const { locale, t } = useLocale();
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
    >
      <option value="">{t('calc.itemNone')}</option>
      <optgroup label={t('calc.itemTier.top')}>
        {ITEMS_BY_TIER.top.map((i) => (
          <option key={i.id} value={i.id}>{localizedName(i.names, locale)}</option>
        ))}
      </optgroup>
      <optgroup label={t('calc.itemTier.typeBoost')}>
        {ITEMS_BY_TIER['type-boost'].map((i) => (
          <option key={i.id} value={i.id}>{localizedName(i.names, locale)}</option>
        ))}
      </optgroup>
      <optgroup label={t('calc.itemTier.resistBerry')}>
        {ITEMS_BY_TIER['resist-berry'].map((i) => (
          <option key={i.id} value={i.id}>{localizedName(i.names, locale)}</option>
        ))}
      </optgroup>
      <optgroup label={t('calc.itemTier.other')}>
        {ITEMS_BY_TIER.other.map((i) => (
          <option key={i.id} value={i.id}>{localizedName(i.names, locale)}</option>
        ))}
      </optgroup>
    </select>
  );
}
