import type { MoveSummary } from '@/lib/types';

export type MoveFlag = 'contact' | 'punch' | 'bite' | 'pulse' | 'slicing' | 'sound' | 'recoil';

export function hasMoveFlag(move: MoveSummary, flag: MoveFlag): boolean {
  return move.flags.includes(flag);
}
