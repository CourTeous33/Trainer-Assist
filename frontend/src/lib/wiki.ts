/**
 * Generate Pokemon wiki URLs, localized per language.
 *
 * English  → Bulbapedia (bulbapedia.bulbagarden.net)
 * Japanese → ポケモンWiki (wiki.xn--rckteqa2e.com)
 * Chinese  → 神奇宝贝百科 (wiki.52poke.com)
 */

import type { LocalizedNames } from '@/lib/types';

const WIKIS = {
  en: {
    base: 'https://bulbapedia.bulbagarden.net/wiki',
    pokemon: '_(Pok%C3%A9mon)',
    move: '_(move)',
    type: '_(type)',
    ability: '_(Ability)',
  },
  ja: {
    base: 'https://wiki.xn--rckteqa2e.com/wiki',
    pokemon: '',
    move: '',
    type: '',
    ability: '',
  },
  zh: {
    base: 'https://wiki.52poke.com/wiki',
    pokemon: '',
    move: '',
    type: '',
    ability: '',
  },
} as const;

type WikiLocale = keyof typeof WIKIS;

function getWiki(locale: string) {
  return WIKIS[locale as WikiLocale] ?? WIKIS.en;
}

/** Known form prefixes to strip when building English Pokemon wiki URLs. */
const FORM_PREFIXES = [
  'Shadow Rider', 'Ice Rider', 'Dawn Wings', 'Dusk Mane',
  'Origin Forme', 'Alolan', 'Galarian', 'Hisuian', 'Paldean',
  'Heat', 'Wash', 'Frost', 'Fan', 'Mow',
];

/** Convert kebab-case to Title_Case for Bulbapedia URLs. */
function toWikiName(kebabName: string): string {
  return kebabName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('_');
}

/** Pick the localized name, falling back to English. */
function pickName(names: LocalizedNames, locale: string): string {
  if (locale === 'ja' && names.ja) return names.ja;
  if (locale === 'zh' && names.zh) return names.zh;
  return names.en;
}

/**
 * Strip form labels from an English display name to get the base species name.
 * e.g. "Calyrex (Ice Rider)" → "Calyrex", "Shadow Rider Calyrex" → "Calyrex"
 */
function stripFormName(name: string): string {
  let result = name.replace(/\s*\(.*\)$/, '').trim();
  for (const prefix of FORM_PREFIXES) {
    if (result.startsWith(prefix + ' ') && result.length > prefix.length + 1) {
      result = result.slice(prefix.length + 1);
      break;
    }
  }
  return result;
}

/** Encode a display name for use in a wiki URL path. */
function encodeWikiPath(name: string): string {
  return encodeURIComponent(name.replace(/ /g, '_'));
}

/**
 * Pokemon wiki URL. Pass species_names (base species) and locale.
 * Falls back to stripping form labels from the English name if species_names is unavailable.
 */
export function pokemonWikiUrl(speciesNames: LocalizedNames | undefined, displayNames: LocalizedNames, locale: string): string {
  const wiki = getWiki(locale);

  if (locale !== 'en' && speciesNames) {
    const name = pickName(speciesNames, locale);
    return `${wiki.base}/${encodeWikiPath(name)}${wiki.pokemon}`;
  }

  // English: use species name, strip form labels as fallback
  const enName = speciesNames?.en ?? stripFormName(displayNames.en);
  return `${wiki.base}/${encodeWikiPath(enName)}${wiki.pokemon}`;
}

/** Move wiki URL. */
export function moveWikiUrl(names: LocalizedNames, locale: string): string {
  const wiki = getWiki(locale);
  if (locale !== 'en') {
    const name = pickName(names, locale);
    return `${wiki.base}/${encodeWikiPath(name)}${wiki.move}`;
  }
  return `${wiki.base}/${toWikiName(names.en)}${wiki.move}`;
}

/** Type wiki URL. */
export function typeWikiUrl(names: LocalizedNames, locale: string): string {
  const wiki = getWiki(locale);
  if (locale !== 'en') {
    const name = pickName(names, locale);
    return `${wiki.base}/${encodeWikiPath(name)}${wiki.type}`;
  }
  return `${wiki.base}/${toWikiName(names.en)}${wiki.type}`;
}

/** Ability wiki URL. */
export function abilityWikiUrl(names: LocalizedNames, locale: string): string {
  const wiki = getWiki(locale);
  if (locale !== 'en') {
    const name = pickName(names, locale);
    return `${wiki.base}/${encodeWikiPath(name)}${wiki.ability}`;
  }
  return `${wiki.base}/${toWikiName(names.en)}${wiki.ability}`;
}
