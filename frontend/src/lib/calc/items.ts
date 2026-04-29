import type { Item, ItemTier } from './types';

export const ITEMS: Item[] = [
  { id: 'life-orb',     names: { en: 'Life Orb',     ja: 'いのちのたま',     zh: '生命宝珠' }, tier: 'top', damageMult: 1.3 },
  { id: 'choice-band',  names: { en: 'Choice Band',  ja: 'こだわりハチマキ', zh: '讲究头巾' }, tier: 'top', attackMult: { stat: 'attack', factor: 1.5 } },
  { id: 'choice-specs', names: { en: 'Choice Specs', ja: 'こだわりメガネ',   zh: '讲究眼镜' }, tier: 'top', attackMult: { stat: 'special_attack', factor: 1.5 } },
  { id: 'expert-belt',  names: { en: 'Expert Belt',  ja: 'たつじんのおび',   zh: '达人之带' }, tier: 'top', superEffectiveMult: 1.2 },
  { id: 'muscle-band',  names: { en: 'Muscle Band',  ja: 'ちからのハチマキ', zh: '力量头带' }, tier: 'top', damageMult: 1.1 },
  { id: 'wise-glasses', names: { en: 'Wise Glasses', ja: 'ものしりメガネ',   zh: '博识眼镜' }, tier: 'top', damageMult: 1.1 },

  { id: 'silk-scarf',     names: { en: 'Silk Scarf',     ja: 'シルクのスカーフ', zh: '丝绸围巾' }, tier: 'type-boost', typeBoost: { typeId: 1, factor: 1.2 } },
  { id: 'black-belt',     names: { en: 'Black Belt',     ja: 'くろおび',         zh: '黑带' },     tier: 'type-boost', typeBoost: { typeId: 2, factor: 1.2 } },
  { id: 'sharp-beak',     names: { en: 'Sharp Beak',     ja: 'するどいくちばし', zh: '锐利鸟嘴' }, tier: 'type-boost', typeBoost: { typeId: 3, factor: 1.2 } },
  { id: 'poison-barb',    names: { en: 'Poison Barb',    ja: 'どくバリ',         zh: '毒针' },     tier: 'type-boost', typeBoost: { typeId: 4, factor: 1.2 } },
  { id: 'soft-sand',      names: { en: 'Soft Sand',      ja: 'やわらかいすな',   zh: '柔软沙子' }, tier: 'type-boost', typeBoost: { typeId: 5, factor: 1.2 } },
  { id: 'hard-stone',     names: { en: 'Hard Stone',     ja: 'かたいいし',       zh: '硬石头' },   tier: 'type-boost', typeBoost: { typeId: 6, factor: 1.2 } },
  { id: 'silver-powder',  names: { en: 'Silver Powder',  ja: 'ぎんのこな',       zh: '银粉' },     tier: 'type-boost', typeBoost: { typeId: 7, factor: 1.2 } },
  { id: 'spell-tag',      names: { en: 'Spell Tag',      ja: 'のろいのおふだ',   zh: '诅咒之符' }, tier: 'type-boost', typeBoost: { typeId: 8, factor: 1.2 } },
  { id: 'metal-coat',     names: { en: 'Metal Coat',     ja: 'メタルコート',     zh: '金属膜' },   tier: 'type-boost', typeBoost: { typeId: 9, factor: 1.2 } },
  { id: 'charcoal',       names: { en: 'Charcoal',       ja: 'もくたん',         zh: '木炭' },     tier: 'type-boost', typeBoost: { typeId: 10, factor: 1.2 } },
  { id: 'mystic-water',   names: { en: 'Mystic Water',   ja: 'しんぴのしずく',   zh: '神秘水滴' }, tier: 'type-boost', typeBoost: { typeId: 11, factor: 1.2 } },
  { id: 'miracle-seed',   names: { en: 'Miracle Seed',   ja: 'きせきのタネ',     zh: '奇迹种子' }, tier: 'type-boost', typeBoost: { typeId: 12, factor: 1.2 } },
  { id: 'magnet',         names: { en: 'Magnet',         ja: 'じしゃく',         zh: '磁铁' },     tier: 'type-boost', typeBoost: { typeId: 13, factor: 1.2 } },
  { id: 'twisted-spoon',  names: { en: 'Twisted Spoon',  ja: 'まがったスプーン', zh: '弯曲的汤匙' }, tier: 'type-boost', typeBoost: { typeId: 14, factor: 1.2 } },
  { id: 'never-melt-ice', names: { en: 'Never-Melt Ice', ja: 'とけないこおり',   zh: '不融冰' },   tier: 'type-boost', typeBoost: { typeId: 15, factor: 1.2 } },
  { id: 'dragon-fang',    names: { en: 'Dragon Fang',    ja: 'りゅうのキバ',     zh: '龙之牙' },   tier: 'type-boost', typeBoost: { typeId: 16, factor: 1.2 } },
  { id: 'black-glasses',  names: { en: 'Black Glasses',  ja: 'くろいメガネ',     zh: '黑色眼镜' }, tier: 'type-boost', typeBoost: { typeId: 17, factor: 1.2 } },
  { id: 'pixie-plate',    names: { en: 'Pixie Plate',    ja: 'せいれいプレート', zh: '妖精石板' }, tier: 'type-boost', typeBoost: { typeId: 18, factor: 1.2 } },

  { id: 'light-ball', names: { en: 'Light Ball', ja: 'でんきだま',     zh: '电气球' }, tier: 'other',
    attackMult: { stat: 'attack', factor: 2.0 },
    speciesGate: [25],
    speciesGateNote: 'Light Ball: only Pikachu may hold this' },
  { id: 'thick-club', names: { en: 'Thick Club', ja: 'ふといホネ',     zh: '粗骨头' }, tier: 'other',
    attackMult: { stat: 'attack', factor: 2.0 },
    speciesGate: [104, 105],
    speciesGateNote: 'Thick Club: only Cubone or Marowak may hold this' },
  { id: 'soul-dew', names: { en: 'Soul Dew', ja: 'こころのしずく', zh: '心之水滴' }, tier: 'other',
    typeBoost: { typeId: 14, factor: 1.2 },
    speciesGate: [380, 381],
    speciesGateNote: 'Soul Dew: only Latias or Latios may hold this' },
];

const ITEM_INDEX: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): Item | undefined {
  return ITEM_INDEX[id];
}

export const ITEMS_BY_TIER: Record<ItemTier, Item[]> = {
  top: ITEMS.filter((i) => i.tier === 'top'),
  'type-boost': ITEMS.filter((i) => i.tier === 'type-boost'),
  other: ITEMS.filter((i) => i.tier === 'other'),
};
