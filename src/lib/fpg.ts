import fpgData from '../../assets/fpg.json';

export const FPG_YEAR: number = fpgData.year;
export const FPG_SOURCE: string = fpgData.source;

export interface PayClass {
  id: string;
  minPct: number;
  maxPct: number | null;
}

type Region = 'contiguous' | 'AK' | 'HI';

function region(state: string): Region {
  if (state === 'AK') return 'AK';
  if (state === 'HI') return 'HI';
  return 'contiguous';
}

export function getFpg(state: string, householdSize: number): number {
  const size = Math.max(1, Math.min(12, Math.round(householdSize)));
  const { base, increment } = fpgData.regions[region(state)];
  return base + increment * (size - 1);
}

export function getFpgPercent(annualIncome: number, state: string, householdSize: number): number {
  if (annualIncome < 0) return 0;
  return Math.round((annualIncome / getFpg(state, householdSize)) * 100);
}

export function getPayClass(pct: number): PayClass {
  const classes = fpgData.payClasses as PayClass[];
  for (const pc of classes) {
    if (pc.maxPct === null || pct <= pc.maxPct) return pc;
  }
  return classes[classes.length - 1];
}
