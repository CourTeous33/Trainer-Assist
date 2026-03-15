'use client';

import TypeIcon from './TypeIcon';
import type { LocalizedNames } from '@/lib/types';
import { useLocale, localizedName } from '@/lib/i18n';
import { typeColor } from '@/lib/type-colors';

const SIZES = {
  sm: {
    badge: 'px-2 py-0.5 text-xs gap-1',
    responsive: 'p-1 sm:px-2 sm:py-0.5 sm:text-xs sm:gap-1',
    icon: 'h-3 w-3',
  },
  md: {
    badge: 'px-3 py-1 text-sm gap-1.5',
    responsive: 'p-1 sm:px-3 sm:py-1 sm:text-sm sm:gap-1.5',
    icon: 'h-4 w-4',
  },
  lg: {
    badge: 'px-4 py-1.5 text-base gap-2',
    responsive: 'p-1 sm:px-4 sm:py-1.5 sm:text-base sm:gap-2',
    icon: 'h-5 w-5',
  },
};

interface TypeBadgeProps {
  name: string;
  names?: LocalizedNames;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Show icon-only circle on mobile, full badge on sm+ */
  responsiveIcon?: boolean;
}

export default function TypeBadge({ name, names, size = 'md', className = '', responsiveIcon = false }: TypeBadgeProps) {
  const { locale } = useLocale();
  const color = typeColor(name);
  const s = SIZES[size];
  const displayName = names ? localizedName(names, locale) : name;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold capitalize text-white ${
        responsiveIcon ? s.responsive : s.badge
      } ${className}`}
      style={{ backgroundColor: color }}
    >
      <TypeIcon typeName={name} className={s.icon} />
      {responsiveIcon ? (
        <span className="hidden sm:inline">{displayName}</span>
      ) : (
        displayName
      )}
    </span>
  );
}
