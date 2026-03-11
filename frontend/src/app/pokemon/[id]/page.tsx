'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getPokemon, getTypeEfficacy, getTypes } from '@/lib/api';
import type { PokemonDetail, TypeRef, TypeEfficacy, LocalizedNames } from '@/lib/types';
import TypeBadge from '@/components/TypeBadge';
import StatBar from '@/components/StatBar';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { useLocale, localizedName } from '@/lib/i18n';
import { formatPokemonId } from '@/lib/format';
import { pokemonWikiUrl, typeWikiUrl, abilityWikiUrl, moveWikiUrl } from '@/lib/wiki';
import WikiLink from '@/components/WikiLink';

export default function PokemonDetailPage() {
  const { t, locale } = useLocale();
  const params = useParams();
  const id = Number(params.id);

  const [pokemon, setPokemon] = useState<PokemonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [types, setTypes] = useState<TypeRef[]>([]);
  const [efficacy, setEfficacy] = useState<TypeEfficacy[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([getPokemon(id), getTypes(), getTypeEfficacy()])
      .then(([data, tp, eff]) => {
        if (!cancelled) {
          setPokemon(data);
          setTypes(tp);
          setEfficacy(eff);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load Pokemon');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Type effectiveness analysis — hooks must be before early returns
  const efficacyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of efficacy) {
      m.set(`${e.attacking_type_id}:${e.defending_type_id}`, e.damage_factor);
    }
    return m;
  }, [efficacy]);

  const typeNamesMap = useMemo(
    () => new Map(types.map(tp => [tp.name, tp.names])),
    [types]
  );

  const typeAnalysis = useMemo(() => {
    if (!pokemon || types.length === 0 || efficacyMap.size === 0) return null;

    const defIds = pokemon.types.map(tp => tp.id);
    const typeMap = new Map(types.map(tp => [tp.id, tp.name]));

    const def4x: string[] = [];
    const def2x: string[] = [];
    const def1x: string[] = [];
    const def0_5x: string[] = [];
    const def0_25x: string[] = [];
    const def0x: string[] = [];

    for (const atkType of types) {
      let multiplier = 1;
      for (const defId of defIds) {
        const factor = efficacyMap.get(`${atkType.id}:${defId}`);
        if (factor !== undefined) multiplier *= factor / 100;
      }
      const name = typeMap.get(atkType.id) ?? '';
      if (multiplier === 0) def0x.push(name);
      else if (multiplier >= 4) def4x.push(name);
      else if (multiplier >= 2) def2x.push(name);
      else if (multiplier === 1) def1x.push(name);
      else if (multiplier >= 0.5) def0_5x.push(name);
      else def0_25x.push(name);
    }

    return { def4x, def2x, def1x, def0_5x, def0_25x, def0x };
  }, [pokemon, types, efficacyMap]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} retry={() => setLoading(true)} />;
  if (!pokemon) return null;

  const heightM = (pokemon.height / 10).toFixed(1);
  const weightKg = (pokemon.weight / 10).toFixed(1);
  const formattedId = formatPokemonId(pokemon.species_id ?? pokemon.id);

  const stats = [
    { label: t('stat.hp'), value: pokemon.stats.hp },
    { label: t('stat.attack'), value: pokemon.stats.attack },
    { label: t('stat.defense'), value: pokemon.stats.defense },
    { label: t('stat.spAtk'), value: pokemon.stats.special_attack },
    { label: t('stat.spDef'), value: pokemon.stats.special_defense },
    { label: t('stat.speed'), value: pokemon.stats.speed },
  ];

  return (
    <div className="py-6">
      {/* Back link */}
      <Link
        href="/pokemon"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t('pokemon.backToList')}
      </Link>

      <div className="rounded-xl bg-white p-6 shadow-md dark:bg-gray-800">
        {/* Header */}
        <div className="flex flex-col items-center">
          <Image
            src={pokemon.sprite_url}
            alt={localizedName(pokemon.names, locale) || pokemon.name}
            width={192}
            height={192}
            unoptimized
            className="h-48 w-48"
          />
          <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">{formattedId}</p>
          <h1 className="flex items-center gap-2 text-2xl font-bold capitalize text-gray-800 dark:text-gray-100">
            {localizedName(pokemon.names, locale) || pokemon.name}
            <WikiLink href={pokemonWikiUrl(pokemon.species_names, pokemon.names, locale)} />
          </h1>
          <div className="mt-2 flex gap-2">
            {pokemon.types.map((tp) => (
              <WikiLink key={tp.id} href={typeWikiUrl(tp.names, locale)}>
                <TypeBadge name={tp.name} names={tp.names} />
              </WikiLink>
            ))}
          </div>
        </div>

        {/* Stats */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-700 dark:text-gray-200">{t('pokemon.baseStats')}</h2>
          <div className="space-y-2">
            {stats.map((s) => (
              <StatBar key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        </section>

        {/* Type Effectiveness */}
        {typeAnalysis && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold text-gray-700 dark:text-gray-200">{t('pokemon.typeEffectiveness')}</h2>
            <div className="space-y-2">
              <TypeEffectRow label={t('types.weakTo4x')} items={typeAnalysis.def4x} color="text-red-700 dark:text-red-400" typeNamesMap={typeNamesMap} />
              <TypeEffectRow label={t('types.weakTo2x')} items={typeAnalysis.def2x} color="text-red-500 dark:text-red-300" typeNamesMap={typeNamesMap} />
              <TypeEffectRow label={t('types.normal1x')} items={typeAnalysis.def1x} color="text-gray-600 dark:text-gray-400" typeNamesMap={typeNamesMap} />
              <TypeEffectRow label={t('types.resists0_5x')} items={typeAnalysis.def0_5x} color="text-green-600 dark:text-green-400" typeNamesMap={typeNamesMap} />
              <TypeEffectRow label={t('types.resists0_25x')} items={typeAnalysis.def0_25x} color="text-green-700 dark:text-green-300" typeNamesMap={typeNamesMap} />
              <TypeEffectRow label={t('types.immuneTo')} items={typeAnalysis.def0x} color="text-blue-600 dark:text-blue-400" typeNamesMap={typeNamesMap} />
            </div>
          </section>
        )}

        {/* Info */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-700 dark:text-gray-200">{t('pokemon.info')}</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">{t('pokemon.height')}</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">{heightM} m</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">{t('pokemon.weight')}</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">{weightKg} kg</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">{t('pokemon.generation.label')}</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">{pokemon.generation}</p>
            </div>
          </div>
        </section>

        {/* Abilities */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-700 dark:text-gray-200">{t('pokemon.abilities')}</h2>
          <div className="space-y-3">
            {pokemon.abilities.map((ability, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <p className="font-medium capitalize text-gray-800 dark:text-gray-200">
                    {localizedName(ability.names, locale)}
                  </p>
                  <WikiLink href={abilityWikiUrl(ability.names, locale)} />
                  {ability.is_hidden && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                      {t('pokemon.hiddenAbility')}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {localizedName(ability.description, locale)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Moves */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-700 dark:text-gray-200">
            {t('pokemon.moves')} ({pokemon.moves.length})
          </h2>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {pokemon.moves.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 px-4 py-2 text-sm capitalize text-gray-700 dark:text-gray-300"
                >
                  {localizedName(m.names, locale) || m.name}
                  <WikiLink href={moveWikiUrl(m.names, locale)} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Add to Team */}
        <div className="mt-8 flex justify-center">
          <button className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            {t('pokemon.addToTeam')}
          </button>
        </div>
      </div>
    </div>
  );
}

function TypeEffectRow({
  label,
  items,
  color,
  typeNamesMap,
}: {
  label: string;
  items: string[];
  color: string;
  typeNamesMap: Map<string, LocalizedNames>;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={`text-xs font-medium ${color}`}>{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((name) => (
          <TypeBadge key={name} name={name} names={typeNamesMap.get(name)} />
        ))}
      </div>
    </div>
  );
}
