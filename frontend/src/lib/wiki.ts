/**
 * Generate Bulbapedia wiki URLs.
 *
 * URL format: https://bulbapedia.bulbagarden.net/wiki/{Name}_(suffix)
 *
 * Pokemon: pass the English display name (e.g. "Calyrex") — this is the
 * species name, so alternate forms like Shadow Calyrex still link to the
 * base species page (which is how Bulbapedia organizes it).
 *
 * Moves/types/abilities: pass the kebab-case identifier (e.g. "thunder-shock").
 */

const BASE = 'https://bulbapedia.bulbagarden.net/wiki';

/** Known form prefixes to strip when building Pokemon wiki URLs. */
const FORM_PREFIXES = [
  'Shadow Rider', 'Ice Rider', 'Dawn Wings', 'Dusk Mane',
  'Origin Forme', 'Alolan', 'Galarian', 'Hisuian', 'Paldean',
  'Heat', 'Wash', 'Frost', 'Fan', 'Mow',
];

function toWikiName(kebabName: string): string {
  return kebabName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('_');
}

/**
 * Accepts the English species name (e.g. "Calyrex", "Mr. Mime").
 * If a form display name is passed instead (e.g. "Calyrex (Ice Rider)"
 * or "Shadow Rider Calyrex"), strips the parenthetical or known form
 * prefixes to get the base species name.
 */
export function pokemonWikiUrl(englishName: string): string {
  // Strip parenthetical form labels: "Calyrex (Ice Rider)" → "Calyrex"
  let name = englishName.replace(/\s*\(.*\)$/, '').trim();

  // Strip known form prefixes: "Shadow Rider Calyrex" → "Calyrex"
  for (const prefix of FORM_PREFIXES) {
    if (name.startsWith(prefix + ' ') && name.length > prefix.length + 1) {
      name = name.slice(prefix.length + 1);
      break;
    }
  }

  const wikiName = name.replace(/ /g, '_');
  return `${BASE}/${encodeURIComponent(wikiName)}_(Pok%C3%A9mon)`;
}

export function moveWikiUrl(name: string): string {
  return `${BASE}/${toWikiName(name)}_(move)`;
}

export function typeWikiUrl(name: string): string {
  return `${BASE}/${toWikiName(name)}_(type)`;
}

export function abilityWikiUrl(name: string): string {
  return `${BASE}/${toWikiName(name)}_(Ability)`;
}
