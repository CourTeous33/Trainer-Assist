export { LocaleProvider, useLocale } from './context';
export type { Locale } from './translations';

import type { LocalizedNames } from '@/lib/types';

export function localizedName(names: LocalizedNames | undefined, locale: string): string {
  if (!names) return '';
  if (locale === 'ja' && names.ja) return names.ja;
  if (locale === 'zh' && names.zh) return names.zh;
  return names.en;
}
