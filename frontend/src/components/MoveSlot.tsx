'use client';

import type { MoveSummary } from '@/lib/types';
import { useLocale, localizedName } from '@/lib/i18n';
import TypeBadge from './TypeBadge';

interface Props {
  move: MoveSummary | null;
  onClick: () => void;
  onClear: () => void;
}

export default function MoveSlot({ move, onClick, onClear }: Props) {
  const { locale, t } = useLocale();
  if (!move) {
    return (
      <button
        type="button" onClick={onClick}
        className="w-full px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        {t('calc.move.empty')}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
      <TypeBadge name={move.type_ref.name} names={move.type_ref.names} size="sm" />
      <button type="button" onClick={onClick} className="flex-1 text-left text-sm font-medium">
        {localizedName(move.names, locale)}
      </button>
      <span className="text-xs text-gray-500 capitalize">{move.damage_class}</span>
      <span className="text-xs tabular-nums text-gray-500">{move.power ?? '—'}</span>
      <button type="button" aria-label="clear" onClick={onClear} className="text-gray-400 hover:text-gray-600">×</button>
    </div>
  );
}
