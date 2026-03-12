'use client';

import TypeIcon from './TypeIcon';
import type { LocalizedNames } from '@/lib/types';
import { useLocale, localizedName } from '@/lib/i18n';
import { typeColor } from '@/lib/type-colors';

const SIZES = {
  sm: { badge: 'px-2 py-0.5 text-xs gap-1', icon: 'h-3 w-3' },
  md: { badge: 'px-3 py-1 text-sm gap-1.5', icon: 'h-4 w-4' },
  lg: { badge: 'px-4 py-1.5 text-base gap-2', icon: 'h-5 w-5' },
};

interface TypeBadgeProps {
  name: string;
  names?: LocalizedNames;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function TypeBadge({ name, names, size = 'md', className = '' }: TypeBadgeProps) {
  const { locale } = useLocale();
  const color = typeColor(name);
  const s = SIZES[size];
  const displayName = names ? localizedName(names, locale) : name;

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold capitalize text-white ${s.badge} ${className}`}
      style={{ backgroundColor: color }}
    >
      <TypeIcon typeName={name} className={s.icon} />
      {displayName}
    </span>
  );
}
