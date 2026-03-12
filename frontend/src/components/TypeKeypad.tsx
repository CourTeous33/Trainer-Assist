'use client';

import type { TypeRef } from '@/lib/types';
import TypeIcon from './TypeIcon';
import { typeColor } from '@/lib/type-colors';
import { useLocale, localizedName } from '@/lib/i18n';

interface TypeKeypadProps {
  types: TypeRef[];
  selectedNames: string[];
  onToggle: (type: TypeRef) => void;
  allLabel?: string;
  onClearAll?: () => void;
  className?: string;
}

export default function TypeKeypad({
  types,
  selectedNames,
  onToggle,
  allLabel,
  onClearAll,
  className = '',
}: TypeKeypadProps) {
  const { locale } = useLocale();

  return (
    <div className={`grid grid-cols-3 gap-1.5 sm:grid-cols-6 ${className}`}>
      {allLabel && onClearAll && (
        <button
          onClick={onClearAll}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-semibold transition-all ${
            selectedNames.length === 0
              ? 'bg-gray-800 text-white ring-2 ring-gray-800 dark:bg-gray-200 dark:text-gray-800 dark:ring-gray-200'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {allLabel}
        </button>
      )}
      {types.map((tp) => {
        const isSelected = selectedNames.includes(tp.name);
        return (
          <button
            key={tp.id}
            onClick={() => onToggle(tp)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-semibold text-white transition-all ${
              isSelected
                ? 'ring-2 ring-offset-1 ring-gray-800 dark:ring-white'
                : selectedNames.length > 0
                  ? 'opacity-40 hover:opacity-70'
                  : 'hover:brightness-110'
            }`}
            style={{ backgroundColor: typeColor(tp.name) }}
          >
            <TypeIcon typeName={tp.name} className="h-5 w-5" />
            <span className="hidden min-[480px]:inline">
              {tp.names ? localizedName(tp.names, locale) : tp.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
