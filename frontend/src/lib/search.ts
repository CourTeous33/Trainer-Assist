/**
 * i18n-aware search matching with pinyin support.
 *
 * Matches against all localized names (en, ja, zh) and pinyin.
 * Uses pre-computed zh_pinyin from the backend when available,
 * falls back to client-side pinyin computation via pinyin-pro.
 *
 * e.g. searching "pikaqiu" or "pkq" matches 皮卡丘 (Pikachu).
 */

import { pinyin } from 'pinyin-pro';
import type { LocalizedNames } from '@/lib/types';

/**
 * Compute pinyin search text client-side (fallback when zh_pinyin is not available).
 * Returns "fullpinyin initials" e.g. "pikaqiu pkq".
 */
function clientPinyin(zh: string): string {
  const full = pinyin(zh, { toneType: 'none', type: 'array' }).join('');
  const initials = pinyin(zh, { pattern: 'first', toneType: 'none', type: 'array' }).join('');
  return `${full} ${initials}`;
}

/**
 * Check if a search query matches any of the localized names.
 * Supports: substring match on en/ja/zh, full pinyin, and pinyin initials.
 */
export function matchesSearch(query: string, names: LocalizedNames): boolean {
  if (!query) return true;
  const q = query.toLowerCase();

  // Match English name
  if (names.en.toLowerCase().includes(q)) return true;

  // Match Japanese name
  if (names.ja && names.ja.toLowerCase().includes(q)) return true;

  // Match Chinese name
  if (names.zh && names.zh.toLowerCase().includes(q)) return true;

  // Match pinyin (pre-computed or client-side)
  if (names.zh) {
    const pinyinText = names.zh_pinyin ?? clientPinyin(names.zh);
    if (pinyinText.includes(q)) return true;
  }

  return false;
}
