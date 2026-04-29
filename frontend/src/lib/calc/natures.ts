import type { Nature, NatureId, StatKey } from './types';

export const NATURES: Nature[] = [
  { id: 'hardy',   names: { en: 'Hardy',   ja: 'がんばりや', zh: '勤奋' }, boosted: null,             lowered: null },
  { id: 'docile',  names: { en: 'Docile',  ja: 'すなお',     zh: '坦率' }, boosted: null,             lowered: null },
  { id: 'bashful', names: { en: 'Bashful', ja: 'てれや',     zh: '害羞' }, boosted: null,             lowered: null },
  { id: 'quirky',  names: { en: 'Quirky',  ja: 'きまぐれ',   zh: '浮躁' }, boosted: null,             lowered: null },
  { id: 'serious', names: { en: 'Serious', ja: 'まじめ',     zh: '认真' }, boosted: null,             lowered: null },
  { id: 'lonely',  names: { en: 'Lonely',  ja: 'さみしがり', zh: '怕寂寞' }, boosted: 'attack',         lowered: 'defense' },
  { id: 'brave',   names: { en: 'Brave',   ja: 'ゆうかん',   zh: '勇敢' },   boosted: 'attack',         lowered: 'speed' },
  { id: 'adamant', names: { en: 'Adamant', ja: 'いじっぱり', zh: '固执' },   boosted: 'attack',         lowered: 'special_attack' },
  { id: 'naughty', names: { en: 'Naughty', ja: 'やんちゃ',   zh: '顽皮' },   boosted: 'attack',         lowered: 'special_defense' },
  { id: 'bold',    names: { en: 'Bold',    ja: 'ずぶとい',   zh: '大胆' },   boosted: 'defense',        lowered: 'attack' },
  { id: 'relaxed', names: { en: 'Relaxed', ja: 'のんき',     zh: '悠闲' },   boosted: 'defense',        lowered: 'speed' },
  { id: 'impish',  names: { en: 'Impish',  ja: 'わんぱく',   zh: '淘气' },   boosted: 'defense',        lowered: 'special_attack' },
  { id: 'lax',     names: { en: 'Lax',     ja: 'のうてんき', zh: '乐天' },   boosted: 'defense',        lowered: 'special_defense' },
  { id: 'timid',   names: { en: 'Timid',   ja: 'おくびょう', zh: '胆小' },   boosted: 'speed',          lowered: 'attack' },
  { id: 'hasty',   names: { en: 'Hasty',   ja: 'せっかち',   zh: '急躁' },   boosted: 'speed',          lowered: 'defense' },
  { id: 'jolly',   names: { en: 'Jolly',   ja: 'ようき',     zh: '爽朗' },   boosted: 'speed',          lowered: 'special_attack' },
  { id: 'naive',   names: { en: 'Naive',   ja: 'むじゃき',   zh: '天真' },   boosted: 'speed',          lowered: 'special_defense' },
  { id: 'modest',  names: { en: 'Modest',  ja: 'ひかえめ',   zh: '内敛' },   boosted: 'special_attack', lowered: 'attack' },
  { id: 'mild',    names: { en: 'Mild',    ja: 'おっとり',   zh: '慢吞吞' }, boosted: 'special_attack', lowered: 'defense' },
  { id: 'quiet',   names: { en: 'Quiet',   ja: 'れいせい',   zh: '冷静' },   boosted: 'special_attack', lowered: 'speed' },
  { id: 'rash',    names: { en: 'Rash',    ja: 'うっかりや', zh: '马虎' },   boosted: 'special_attack', lowered: 'special_defense' },
  { id: 'calm',    names: { en: 'Calm',    ja: 'おだやか',   zh: '温和' },   boosted: 'special_defense', lowered: 'attack' },
  { id: 'gentle',  names: { en: 'Gentle',  ja: 'おとなしい', zh: '温顺' },   boosted: 'special_defense', lowered: 'defense' },
  { id: 'sassy',   names: { en: 'Sassy',   ja: 'なまいき',   zh: '自大' },   boosted: 'special_defense', lowered: 'speed' },
  { id: 'careful', names: { en: 'Careful', ja: 'しんちょう', zh: '慎重' },   boosted: 'special_defense', lowered: 'special_attack' },
];

const NATURE_INDEX: Record<NatureId, Nature> = Object.fromEntries(
  NATURES.map((n) => [n.id, n]),
) as Record<NatureId, Nature>;

export function getNature(id: NatureId): Nature {
  return NATURE_INDEX[id];
}

export function NATURE_MULTIPLIER(nature: Nature, stat: StatKey): number {
  if (stat === 'hp') return 1.0;
  if (nature.boosted === stat) return 1.1;
  if (nature.lowered === stat) return 0.9;
  return 1.0;
}
