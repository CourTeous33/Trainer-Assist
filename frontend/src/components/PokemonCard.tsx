'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { PokemonSummary } from '@/lib/types';
import TypeBadge from './TypeBadge';
import { useLocale, localizedName } from '@/lib/i18n';
import { formatPokemonId } from '@/lib/format';

interface PokemonCardProps {
  pokemon: PokemonSummary;
}

export default function PokemonCard({ pokemon }: PokemonCardProps) {
  const { locale } = useLocale();
  const formattedId = formatPokemonId(pokemon.species_id ?? pokemon.id);
  const displayName = localizedName(pokemon.names, locale) || pokemon.name;

  return (
    <Link href={`/pokemon/${pokemon.id}`}>
      <div className="flex flex-col items-center rounded-xl bg-white p-3 shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 dark:bg-gray-800">
        <Image
          src={pokemon.sprite_url}
          alt={displayName}
          width={96}
          height={96}
          unoptimized
          className="h-24 w-24"
        />
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{formattedId}</p>
        <p className="text-sm font-semibold capitalize text-gray-800 dark:text-gray-100">
          {displayName}
        </p>
        <div className="mt-1.5 flex gap-1">
          {pokemon.types.map((t) => (
            <TypeBadge key={t.id} name={t.name} names={t.names} responsiveIcon />
          ))}
        </div>
      </div>
    </Link>
  );
}
