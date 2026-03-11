'use client';

import { useEffect, useState } from 'react';
import { getMoves, getTypes } from '@/lib/api';
import type { MoveSummary, TypeRef } from '@/lib/types';
import SearchInput from '@/components/SearchInput';
import TypeBadge from '@/components/TypeBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useLocale, localizedName } from '@/lib/i18n';

type SortKey = 'name' | 'power' | 'accuracy' | 'pp';
type SortDir = 'asc' | 'desc';

const DAMAGE_CLASSES = ['physical', 'special', 'status'];

const damageClassKey: Record<string, string> = {
  physical: 'moves.physical',
  special: 'moves.special',
  status: 'moves.status',
};

export default function MovesPage() {
  const { t, locale } = useLocale();
  const [allMoves, setAllMoves] = useState<MoveSummary[]>([]);
  const [types, setTypes] = useState<TypeRef[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<number | undefined>(undefined);
  const [classFilter, setClassFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch all moves and types on mount
  useEffect(() => {
    Promise.all([getMoves(), getTypes()])
      .then(([m, tp]) => {
        setAllMoves(m);
        setTypes(tp);
      })
      .catch((err) => setError(err.message || 'Failed to load moves'))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Filter and sort
  const filtered = allMoves
    .filter((m) => {
      if (search && !m.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (typeFilter && m.type_ref.id !== typeFilter) return false;
      if (classFilter && m.damage_class !== classFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name') return dir * a.name.localeCompare(b.name);
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
      return dir * (av - bv);
    });

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('moves.title')}</h1>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t('moves.search')}
        className="mb-4"
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Type filter */}
        <select
          value={typeFilter ?? ''}
          onChange={(e) =>
            setTypeFilter(e.target.value ? Number(e.target.value) : undefined)
          }
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="">{t('moves.allTypes')}</option>
          {types.map((tp) => (
            <option key={tp.id} value={tp.id}>
              {localizedName(tp.names, locale) || tp.name}
            </option>
          ))}
        </select>

        {/* Damage class filter */}
        <div className="flex gap-1">
          <button
            onClick={() => setClassFilter('')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              classFilter === ''
                ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {t('moves.all')}
          </button>
          {DAMAGE_CLASSES.map((dc) => (
            <button
              key={dc}
              onClick={() => setClassFilter(classFilter === dc ? '' : dc)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                classFilter === dc
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {t(damageClassKey[dc])}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{t('moves.count', { count: String(filtered.length) })}</p>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl bg-white shadow-md sm:block dark:bg-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50">
            <tr>
              <th
                className="cursor-pointer px-4 py-3 font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                onClick={() => handleSort('name')}
              >
                {t('moves.name')}{sortIndicator('name')}
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">{t('moves.type')}</th>
              <th
                className="cursor-pointer px-4 py-3 font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                onClick={() => handleSort('power')}
              >
                {t('moves.power')}{sortIndicator('power')}
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                onClick={() => handleSort('accuracy')}
              >
                {t('moves.accuracy')}{sortIndicator('accuracy')}
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                onClick={() => handleSort('pp')}
              >
                {t('moves.pp')}{sortIndicator('pp')}
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600">{t('moves.class')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-2.5 font-medium capitalize text-gray-800 dark:text-gray-200">
                  {localizedName(m.names, locale) || m.name}
                </td>
                <td className="px-4 py-2.5">
                  <TypeBadge name={m.type_ref.name} names={m.type_ref.names} />
                </td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                  {m.power ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                  {m.accuracy ? `${m.accuracy}%` : '—'}
                </td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{m.pp ?? '—'}</td>
                <td className="px-4 py-2.5 capitalize text-gray-700">
                  {m.damage_class}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {filtered.map((m) => (
          <div key={m.id} className="rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <p className="font-medium capitalize text-gray-800 dark:text-gray-200">{localizedName(m.names, locale) || m.name}</p>
              <TypeBadge name={m.type_ref.name} names={m.type_ref.names} />
            </div>
            <div className="mt-2 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>
                Power: <strong className="text-gray-700 dark:text-gray-300">{m.power ?? '—'}</strong>
              </span>
              <span>
                Acc: <strong className="text-gray-700 dark:text-gray-300">{m.accuracy ? `${m.accuracy}%` : '—'}</strong>
              </span>
              <span>
                PP: <strong className="text-gray-700 dark:text-gray-300">{m.pp ?? '—'}</strong>
              </span>
            </div>
            <p className="mt-1 text-xs capitalize text-gray-400 dark:text-gray-500">
              {m.damage_class}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
