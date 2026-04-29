'use client';

interface Props {
  minPct: number;
  maxPct: number;
}

function colorFor(pct: number): string {
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 60)  return 'bg-orange-500';
  if (pct >= 30)  return 'bg-yellow-500';
  return 'bg-green-500';
}

export default function DamageRangeBar({ minPct, maxPct }: Props) {
  const safeMax = Math.min(100, Math.max(0, maxPct));
  const safeMin = Math.min(safeMax, Math.max(0, minPct));
  return (
    <div className="relative h-3 w-full bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 ${colorFor(maxPct)}`}
        style={{ width: `${safeMax}%` }}
      />
      <div
        className="absolute inset-y-0 w-px bg-black/30 dark:bg-white/40"
        style={{ left: `${safeMin}%` }}
      />
    </div>
  );
}
