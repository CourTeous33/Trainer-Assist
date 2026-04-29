'use client';

import { useLocale } from '@/lib/i18n';
import type { EVMode } from '@/lib/calc';

interface Props {
  mode: EVMode;
  onChange: (mode: EVMode) => void;
}

export default function EVModeToggle({ mode, onChange }: Props) {
  const { t } = useLocale();
  return (
    <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5" role="group">
      <button
        type="button"
        aria-pressed={mode === 'traditional'}
        onClick={() => onChange('traditional')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${mode === 'traditional' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-200'}`}
      >
        {t('calc.modeTraditional')}
      </button>
      <button
        type="button"
        aria-pressed={mode === 'champion'}
        onClick={() => onChange('champion')}
        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${mode === 'champion' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-200'}`}
      >
        {t('calc.modeChampion')}
      </button>
    </div>
  );
}
