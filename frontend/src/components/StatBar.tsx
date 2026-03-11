const STAT_COLORS: Record<string, string> = {
  hp: '#FF5959',
  attack: '#F5AC78',
  defense: '#FAE078',
  'sp. atk': '#9DB7F5',
  'sp. def': '#A7DB8D',
  speed: '#FA92B2',
};

interface StatBarProps {
  label: string;
  value: number;
  maxValue?: number;
  color?: string;
}

export default function StatBar({
  label,
  value,
  maxValue = 255,
  color,
}: StatBarProps) {
  const barColor = color ?? STAT_COLORS[label.toLowerCase()] ?? '#6390F0';
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 shrink-0 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="w-8 shrink-0 text-right font-semibold text-gray-800 dark:text-gray-200">
        {value}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}
