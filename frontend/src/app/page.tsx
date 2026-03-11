'use client';

import Link from 'next/link';
import { useLocale } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const FEATURES = [
  {
    href: '/pokemon',
    titleKey: 'home.pokemon.title',
    descKey: 'home.pokemon.desc',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    href: '/types',
    titleKey: 'home.types.title',
    descKey: 'home.types.desc',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10">
        <path d="M12 2l8 4v5c0 5.25-3.5 9.74-8 11-4.5-1.26-8-5.75-8-11V6l8-4z" />
      </svg>
    ),
  },
  {
    href: '/moves',
    titleKey: 'home.moves.title',
    descKey: 'home.moves.desc',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    href: '/team-builder',
    titleKey: 'home.team.title',
    descKey: 'home.team.desc',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const { t } = useLocale();

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>
      <h1 className="mb-2 text-3xl font-bold text-gray-800 dark:text-gray-100">{t('app.title')}</h1>
      <p className="mb-8 text-gray-500 dark:text-gray-400">{t('app.subtitle')}</p>
      <div className="grid w-full max-w-lg grid-cols-2 gap-4">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href}>
            <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-6 text-center shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 dark:bg-gray-800">
              <div className="text-blue-600 dark:text-blue-400">{f.icon}</div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t(f.titleKey)}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t(f.descKey)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
