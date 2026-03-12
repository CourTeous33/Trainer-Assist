'use client';

import { useEffect, useState } from 'react';
import { getPokemonList, getTypes } from '@/lib/api';
import type { PokemonSummary, TypeRef } from '@/lib/types';
import SearchInput from '@/components/SearchInput';
import TypeKeypad from '@/components/TypeKeypad';
import PokemonCard from '@/components/PokemonCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useLocale } from '@/lib/i18n';

const LIMIT = 24;
const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function PokemonPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [generation, setGeneration] = useState<number | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  const [pokemon, setPokemon] = useState<PokemonSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [types, setTypes] = useState<TypeRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch types on mount
  useEffect(() => {
    getTypes()
      .then(setTypes)
      .catch(() => {});
  }, []);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [search, typeFilters, generation]);

  // Fetch pokemon list
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getPokemonList({
      offset,
      limit: LIMIT,
      search: search || undefined,
      type: typeFilters.length > 0 ? typeFilters[0] : undefined,
      type2: typeFilters.length > 1 ? typeFilters[1] : undefined,
      generation,
    })
      .then((res) => {
        if (!cancelled) {
          setPokemon(res.items);
          setTotal(res.total);
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
  }, [search, typeFilters, generation, offset]);

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + LIMIT, total);
  const hasPrev = offset > 0;
  const hasNext = offset + LIMIT < total;

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('pokemon.title')}</h1>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t('pokemon.search')}
        className="mb-4"
      />

      {/* Type filter keypad (select up to 2) */}
      <TypeKeypad
        types={types}
        selectedNames={typeFilters}
        onToggle={(tp) => {
          setTypeFilters((prev) => {
            if (prev.includes(tp.name)) return prev.filter((n) => n !== tp.name);
            if (prev.length >= 2) return [prev[1], tp.name];
            return [...prev, tp.name];
          });
        }}
        allLabel={t('pokemon.allTypes')}
        onClearAll={() => setTypeFilters([])}
        className="mb-4"
      />

      {/* Generation filter */}
      <div className="mb-6">
        <select
          value={generation ?? ''}
          onChange={(e) =>
            setGeneration(e.target.value ? Number(e.target.value) : undefined)
          }
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="">{t('pokemon.allGenerations')}</option>
          {GENERATIONS.map((g) => (
            <option key={g} value={g}>
              {`${t('pokemon.generation')} ${g}`}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <ErrorMessage
          message={error}
          retry={() => setOffset((prev) => prev)}
        />
      ) : pokemon.length === 0 ? (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">{t('pokemon.noResults')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pokemon.map((p) => (
              <PokemonCard key={p.id} pokemon={p} />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={!hasPrev}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {t('pokemon.previous')}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {rangeStart}–{rangeEnd} {t('pokemon.of')} {total}
            </span>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={!hasNext}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {t('pokemon.next')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
