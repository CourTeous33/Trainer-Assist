'use client';

import TypeIcon from './TypeIcon';
import type { LocalizedNames } from '@/lib/types';
import { useLocale, localizedName } from '@/lib/i18n';

const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD',
};

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
  const color = TYPE_COLORS[name.toLowerCase()] ?? '#777';
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
