import type { LocalizedNames } from '@/lib/types';
import type { MoveFlag } from './move-flags';

export interface Ability {
  id: string;
  names: LocalizedNames;

  stabFactor?: number;
  flatAtkMult?: { stat: 'attack' | 'special_attack'; factor: number };
  conditionalDmgMult?:
    | { kind: 'flag'; flag: MoveFlag; factor: number }
    | { kind: 'power-le'; powerThreshold: number; factor: number };
  typeChange?: { from: number; to: number; boost: number };
  offenseTypeBoost?: { typeId: number; factor: number };
  notVeryEffectiveBoost?: number;

  typeImmunity?: number;
  typeReduction?: { typeId: number; factor: number }[];
  soundReduction?: number;
  superEffectiveResist?: number;
  wonderGuard?: boolean;

  ignoresDefenderAbility?: boolean;
}

export const ABILITIES: Ability[] = [
  { id: 'adaptability', names: { en: 'Adaptability', ja: 'てきおうりょく', zh: '适应力' }, stabFactor: 2.0 },
  { id: 'huge-power',   names: { en: 'Huge Power',   ja: 'ちからもち',   zh: '大力士' }, flatAtkMult: { stat: 'attack', factor: 2.0 } },
  { id: 'pure-power',   names: { en: 'Pure Power',   ja: 'ヨガパワー',   zh: '瑜伽之力' }, flatAtkMult: { stat: 'attack', factor: 2.0 } },
  { id: 'hustle',       names: { en: 'Hustle',       ja: 'はりきり',     zh: '活力' },     flatAtkMult: { stat: 'attack', factor: 1.5 } },

  { id: 'tough-claws',  names: { en: 'Tough Claws',  ja: 'かたいツメ',   zh: '硬爪' },     conditionalDmgMult: { kind: 'flag', flag: 'contact', factor: 1.3 } },
  { id: 'iron-fist',    names: { en: 'Iron Fist',    ja: 'てつのこぶし', zh: '铁拳' },     conditionalDmgMult: { kind: 'flag', flag: 'punch',   factor: 1.2 } },
  { id: 'strong-jaw',   names: { en: 'Strong Jaw',   ja: 'がんじょうあご', zh: '强壮之颚' }, conditionalDmgMult: { kind: 'flag', flag: 'bite',    factor: 1.5 } },
  { id: 'mega-launcher',names: { en: 'Mega Launcher',ja: 'メガランチャー', zh: '超级发射器' }, conditionalDmgMult: { kind: 'flag', flag: 'pulse',  factor: 1.5 } },
  { id: 'sharpness',    names: { en: 'Sharpness',    ja: 'きれあじ',     zh: '锋锐' },     conditionalDmgMult: { kind: 'flag', flag: 'slicing', factor: 1.5 } },
  { id: 'reckless',     names: { en: 'Reckless',     ja: 'すてみ',       zh: '舍身' },     conditionalDmgMult: { kind: 'flag', flag: 'recoil',  factor: 1.2 } },
  { id: 'punk-rock',    names: { en: 'Punk Rock',    ja: 'パンクロック', zh: '朋克摇滚' }, conditionalDmgMult: { kind: 'flag', flag: 'sound',   factor: 1.3 }, soundReduction: 0.5 },
  { id: 'technician',   names: { en: 'Technician',   ja: 'テクニシャン', zh: '技术高手' }, conditionalDmgMult: { kind: 'power-le', powerThreshold: 60, factor: 1.5 } },

  { id: 'aerilate',     names: { en: 'Aerilate',     ja: 'スカイスキン', zh: '飞行皮肤' }, typeChange: { from: 1, to: 3,  boost: 1.2 } },
  { id: 'pixilate',     names: { en: 'Pixilate',     ja: 'フェアリースキン', zh: '妖精皮肤' }, typeChange: { from: 1, to: 18, boost: 1.2 } },
  { id: 'refrigerate',  names: { en: 'Refrigerate',  ja: 'フリーズスキン', zh: '冰冻皮肤' }, typeChange: { from: 1, to: 15, boost: 1.2 } },
  { id: 'galvanize',    names: { en: 'Galvanize',    ja: 'エレキスキン', zh: '电气皮肤' }, typeChange: { from: 1, to: 13, boost: 1.2 } },

  { id: 'steelworker',  names: { en: 'Steelworker',  ja: 'はがねつかい', zh: '钢能力者' }, offenseTypeBoost: { typeId: 9,  factor: 1.5 } },
  { id: 'water-bubble', names: { en: 'Water Bubble', ja: 'すいほう',     zh: '水泡' },     offenseTypeBoost: { typeId: 11, factor: 2.0 }, typeReduction: [{ typeId: 10, factor: 0.5 }] },
  { id: 'flash-fire',   names: { en: 'Flash Fire',   ja: 'もらいび',     zh: '引火' },     typeImmunity: 10, offenseTypeBoost: { typeId: 10, factor: 1.5 } },

  { id: 'levitate',      names: { en: 'Levitate',      ja: 'ふゆう',         zh: '飘浮' },     typeImmunity: 5  },
  { id: 'sap-sipper',    names: { en: 'Sap Sipper',    ja: 'そうしょく',     zh: '食草' },     typeImmunity: 12 },
  { id: 'water-absorb',  names: { en: 'Water Absorb',  ja: 'ちょすい',       zh: '储水' },     typeImmunity: 11 },
  { id: 'volt-absorb',   names: { en: 'Volt Absorb',   ja: 'ちくでん',       zh: '蓄电' },     typeImmunity: 13 },
  { id: 'lightning-rod', names: { en: 'Lightning Rod', ja: 'ひらいしん',     zh: '避雷针' },   typeImmunity: 13 },
  { id: 'storm-drain',   names: { en: 'Storm Drain',   ja: 'よびみず',       zh: '引水' },     typeImmunity: 11 },
  { id: 'motor-drive',   names: { en: 'Motor Drive',   ja: 'でんきエンジン', zh: '电气引擎' }, typeImmunity: 13 },

  { id: 'thick-fat', names: { en: 'Thick Fat', ja: 'あついしぼう', zh: '厚脂肪' }, typeReduction: [{ typeId: 10, factor: 0.5 }, { typeId: 15, factor: 0.5 }] },
  { id: 'heatproof', names: { en: 'Heatproof', ja: 'たいねつ',     zh: '耐热' },   typeReduction: [{ typeId: 10, factor: 0.5 }] },

  { id: 'filter',       names: { en: 'Filter',       ja: 'フィルター',     zh: '过滤' },     superEffectiveResist: 0.75 },
  { id: 'solid-rock',   names: { en: 'Solid Rock',   ja: 'ハードロック',   zh: '坚硬岩石' }, superEffectiveResist: 0.75 },
  { id: 'prism-armor',  names: { en: 'Prism Armor',  ja: 'プリズムアーマー', zh: '棱镜护甲' }, superEffectiveResist: 0.75 },
  { id: 'tinted-lens',  names: { en: 'Tinted Lens',  ja: 'いろめがね',     zh: '有色眼镜' }, notVeryEffectiveBoost: 2.0 },
  { id: 'wonder-guard', names: { en: 'Wonder Guard', ja: 'ふしぎなまもり', zh: '神奇守护' }, wonderGuard: true },

  { id: 'mold-breaker', names: { en: 'Mold Breaker', ja: 'かたやぶり',     zh: '破格' },     ignoresDefenderAbility: true },
  { id: 'teravolt',     names: { en: 'Teravolt',     ja: 'テラボルテージ', zh: '兆级电压' }, ignoresDefenderAbility: true },
  { id: 'turboblaze',   names: { en: 'Turboblaze',   ja: 'ターボブレイズ', zh: '涡轮火焰' }, ignoresDefenderAbility: true },
];

const ABILITY_INDEX: Record<string, Ability> = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

export function getAbility(id: string | null | undefined): Ability | undefined {
  return id ? ABILITY_INDEX[id] : undefined;
}
