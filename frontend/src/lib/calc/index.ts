import type { CalcInput, CalcOutcome } from './types';
import { calculateDamage } from './damage';
import { computeKO, qualifier } from './ko';

export * from './types';
export { NATURES, getNature, NATURE_MULTIPLIER } from './natures';
export { ITEMS, ITEMS_BY_TIER, getItem } from './items';
export {
  computeStat, computeAllStats, clampEVsForMode, evTotal,
  isLevelLockedForMode, lockedLevelForMode, lockedIVsForMode,
  MAX_TOTAL_EV_TRADITIONAL, MAX_PER_STAT_EV_TRADITIONAL,
  MAX_TOTAL_EV_CHAMPION, MAX_PER_STAT_EV_CHAMPION,
} from './stats';
export { calculateDamage } from './damage';
export { computeKO, qualifier } from './ko';
export {
  defaultCalcState, serializeState, deserializeState,
  type CalcState, type AttackerState, type DefenderState,
} from './url';

export function calculate(input: CalcInput): CalcOutcome {
  const dmg = calculateDamage(input);
  if ('unsupportedReason' in dmg) return dmg;
  const ko = computeKO(dmg.rolls, dmg.defenderHp);
  return {
    ...dmg,
    ohkoPct: ko.ohkoPct,
    twoHkoPct: ko.twoHkoPct,
    threeHkoPct: ko.threeHkoPct,
    qualifier: qualifier(ko),
  };
}
