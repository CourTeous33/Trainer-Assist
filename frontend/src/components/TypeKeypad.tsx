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

  const btnBase = 'flex items-center justify-center rounded-full p-2.5 sm:rounded-lg sm:px-2 sm:py-2.5 sm:gap-1.5 text-sm font-semibold transition-all';

  return (
    <div className={`flex flex-wrap justify-center gap-2 sm:grid sm:grid-cols-6 sm:gap-1.5 ${className}`}>
      {allLabel && onClearAll && (
        <button
          onClick={onClearAll}
          className={`${btnBase} ${
            selectedNames.length === 0
              ? 'bg-gray-800 text-white ring-2 ring-gray-800 dark:bg-gray-200 dark:text-gray-800 dark:ring-gray-200'
              : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 sm:hidden">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <span className="hidden sm:inline">{allLabel}</span>
        </button>
      )}
      {types.map((tp) => {
        const isSelected = selectedNames.includes(tp.name);
        return (
          <button
            key={tp.id}
            onClick={() => onToggle(tp)}
            className={`${btnBase} text-white ${
              isSelected
                ? 'ring-2 ring-offset-1 ring-gray-800 dark:ring-white'
                : selectedNames.length > 0
                  ? 'opacity-40 hover:opacity-70'
                  : 'hover:brightness-110'
            }`}
            style={{ backgroundColor: typeColor(tp.name) }}
          >
            <TypeIcon typeName={tp.name} className="h-5 w-5" />
            <span className="hidden sm:inline">
              {tp.names ? localizedName(tp.names, locale) : tp.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
