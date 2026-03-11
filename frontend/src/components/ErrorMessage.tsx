'use client';

import { useLocale } from '@/lib/i18n';

interface ErrorMessageProps {
  message: string;
  retry?: () => void;
}

export default function ErrorMessage({ message, retry }: ErrorMessageProps) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg bg-red-50 px-6 py-8 text-center dark:bg-red-900/20">
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          {t('error.tryAgain')}
        </button>
      )}
    </div>
  );
}
