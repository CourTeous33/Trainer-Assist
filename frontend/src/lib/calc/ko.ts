export interface KOResult {
  ohkoPct: number;
  twoHkoPct: number;
  threeHkoPct: number;
}

export function computeKO(rolls: number[], hp: number): KOResult {
  const n = rolls.length;
  const ohkoCount = rolls.filter((r) => r >= hp).length;
  const ohkoPct = (ohkoCount / n) * 100;

  let twoHkoCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (rolls[i] + rolls[j] >= hp) twoHkoCount++;
    }
  }
  const twoHkoPct = (twoHkoCount / (n * n)) * 100;

  let threeHkoCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        if (rolls[i] + rolls[j] + rolls[k] >= hp) threeHkoCount++;
      }
    }
  }
  const threeHkoPct = (threeHkoCount / (n * n * n)) * 100;

  return { ohkoPct, twoHkoPct, threeHkoPct };
}

export function qualifier(ko: KOResult): string {
  if (ko.ohkoPct === 100) return 'guaranteed OHKO';
  if (ko.ohkoPct > 0)     return 'possible OHKO';
  if (ko.twoHkoPct === 100) return 'guaranteed 2HKO';
  if (ko.twoHkoPct > 0)     return 'possible 2HKO';
  if (ko.threeHkoPct === 100) return 'guaranteed 3HKO';
  return '4HKO or worse';
}
