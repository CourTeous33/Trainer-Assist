'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  getTeams,
  createTeam,
  updateTeam,
  deleteTeam,
} from '@/lib/team-store';
import { getPokemonList, getTypeEfficacy, getTypes } from '@/lib/api';
import type { Team, PokemonSummary, TypeRef, TypeEfficacy } from '@/lib/types';
import TypeBadge from '@/components/TypeBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useLocale, localizedName } from '@/lib/i18n';
import { useDebounce } from '@/hooks/use-debounce';

export default function TeamBuilderPage() {
  const { t, locale } = useLocale();
  const [teams, setTeams] = useState<Team[]>([]);
  const [types, setTypes] = useState<TypeRef[]>([]);
  const [efficacy, setEfficacy] = useState<TypeEfficacy[]>([]);
  const [loading, setLoading] = useState(true);

  // Slot picker state
  const [pickerOpen, setPickerOpen] = useState<{
    teamId: string;
    slotIndex: number;
  } | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerResults, setPickerResults] = useState<PokemonSummary[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const debouncedPickerSearch = useDebounce(pickerSearch, 300);

  const resetPicker = () => {
    setPickerOpen(null);
    setPickerSearch('');
    setPickerResults([]);
  };

  useEffect(() => {
    setTeams(getTeams());
    Promise.all([getTypes(), getTypeEfficacy()])
      .then(([tp, e]) => {
        setTypes(tp);
        setEfficacy(e);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Search pokemon for picker
  useEffect(() => {
    if (!pickerOpen || !debouncedPickerSearch.trim()) {
      setPickerResults([]);
      return;
    }

    setPickerLoading(true);
    getPokemonList({ search: debouncedPickerSearch, limit: 10 })
      .then((res) => setPickerResults(res.items))
      .catch(() => setPickerResults([]))
      .finally(() => setPickerLoading(false));
  }, [debouncedPickerSearch, pickerOpen]);

  const handleCreateTeam = () => {
    const team = createTeam(`Team ${teams.length + 1}`);
    setTeams([...teams, team]);
  };

  const handleDeleteTeam = (id: string) => {
    deleteTeam(id);
    setTeams(teams.filter((tp) => tp.id !== id));
  };

  const handleRenameTeam = (id: string, name: string) => {
    const team = teams.find((tp) => tp.id === id);
    if (!team) return;
    const updated = { ...team, name };
    updateTeam(updated);
    setTeams(teams.map((tp) => (tp.id === id ? updated : tp)));
  };

  const handleRemovePokemon = (teamId: string, slotIndex: number) => {
    const team = teams.find((tp) => tp.id === teamId);
    if (!team) return;
    const pokemon = [...team.pokemon];
    pokemon[slotIndex] = null;
    const updated = { ...team, pokemon };
    updateTeam(updated);
    setTeams(teams.map((tp) => (tp.id === teamId ? updated : tp)));
  };

  const handleSelectPokemon = (pokemon: PokemonSummary) => {
    if (!pickerOpen) return;
    const team = teams.find((tp) => tp.id === pickerOpen.teamId);
    if (!team) return;
    const slots = [...team.pokemon];
    slots[pickerOpen.slotIndex] = pokemon;
    const updated = { ...team, pokemon: slots };
    updateTeam(updated);
    setTeams(teams.map((tp) => (tp.id === pickerOpen.teamId ? updated : tp)));
    resetPicker();
  };

  // Pre-compute efficacy lookup map for O(1) access
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

  // Type coverage analysis
  const getTeamCoverage = useCallback(
    (team: Team) => {
      if (types.length === 0 || efficacyMap.size === 0) return null;

      const memberTypes: number[][] = [];
      for (const p of team.pokemon) {
        if (p) memberTypes.push(p.types.map((tp) => tp.id));
      }

      if (memberTypes.length === 0) return null;

      const typeMap = new Map(types.map((tp) => [tp.id, tp.name]));

      // For each type, calculate how many team members are weak to it
      const weaknessCounts = new Map<string, number>();
      const resistances: string[] = [];

      for (const atkType of types) {
        let anyResist = false;
        let anyWeak = false;

        for (const pTypes of memberTypes) {
          let mult = 1;
          for (const defTypeId of pTypes) {
            const factor = efficacyMap.get(`${atkType.id}:${defTypeId}`);
            if (factor !== undefined) mult *= factor / 100;
          }
          if (mult > 1) {
            anyWeak = true;
            const name = typeMap.get(atkType.id) ?? '';
            weaknessCounts.set(name, (weaknessCounts.get(name) ?? 0) + 1);
          }
          if (mult < 1) anyResist = true;
        }

        const name = typeMap.get(atkType.id) ?? '';
        if (anyResist && !anyWeak) resistances.push(name);
      }

      const sharedWeaknesses: { name: string; count: number }[] = [];
      const singleWeaknesses: string[] = [];
      weaknessCounts.forEach((count, name) => {
        if (count >= 2) sharedWeaknesses.push({ name, count });
        else singleWeaknesses.push(name);
      });
      sharedWeaknesses.sort((a, b) => b.count - a.count);

      return { sharedWeaknesses, singleWeaknesses, resistances };
    },
    [types, efficacyMap]
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('team.title')}</h1>
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
        <button
          onClick={handleCreateTeam}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {t('team.newTeam')}
        </button>
      </div>

      {teams.length === 0 && (
        <p className="py-12 text-center text-gray-500 dark:text-gray-400">
          {t('team.noTeams')}
        </p>
      )}

      <div className="space-y-6">
        {teams.map((team) => {
          const coverage = getTeamCoverage(team);
          return (
            <div key={team.id} className="rounded-xl bg-white p-5 shadow-md dark:bg-gray-800">
              {/* Team header */}
              <div className="mb-4 flex items-center justify-between">
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => handleRenameTeam(team.id, e.target.value)}
                  className="border-b border-transparent bg-transparent text-lg font-semibold text-gray-800 outline-none focus:border-blue-500 dark:text-gray-100"
                />
                <button
                  onClick={() => handleDeleteTeam(team.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  {t('team.delete')}
                </button>
              </div>

              {/* Pokemon slots */}
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {team.pokemon.map((p, i) => (
                  <div key={i} className="relative">
                    {p ? (
                      <div className="flex flex-col items-center rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                        <button
                          onClick={() => handleRemovePokemon(team.id, i)}
                          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow hover:bg-red-600"
                          title="Remove"
                        >
                          &times;
                        </button>
                        <Image
                          src={p.sprite_url}
                          alt={localizedName(p.names, locale) || p.name}
                          width={56}
                          height={56}
                          unoptimized
                          className="h-14 w-14"
                        />
                        <p className="mt-1 truncate text-xs capitalize text-gray-700 dark:text-gray-300">
                          {localizedName(p.names, locale) || p.name}
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setPickerOpen({ teamId: team.id, slotIndex: i });
                          setPickerSearch('');
                        }}
                        className="flex h-full min-h-[88px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-gray-600 dark:text-gray-500 dark:hover:border-blue-500"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="h-8 w-8"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4.5v15m7.5-7.5h-15"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Type coverage */}
              {coverage && (
                <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700">
                  <h3 className="mb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                    {t('team.typeCoverage')}
                  </h3>

                  {coverage.sharedWeaknesses.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-red-600">
                        {t('team.sharedWeaknesses')}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {coverage.sharedWeaknesses.map((w) => (
                          <span key={w.name} className="flex items-center gap-1">
                            <TypeBadge name={w.name} names={typeNamesMap.get(w.name)} />
                            <span className="text-xs font-bold text-red-500">
                              x{w.count}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {coverage.singleWeaknesses.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-orange-600">
                        {t('team.weaknesses')}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {coverage.singleWeaknesses.map((name) => (
                          <TypeBadge key={name} name={name} names={typeNamesMap.get(name)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {coverage.resistances.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-600">
                        {t('team.teamResists')}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {coverage.resistances.map((name) => (
                          <TypeBadge key={name} name={name} names={typeNamesMap.get(name)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pokemon Picker Modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                {t('team.addPokemon')}
              </h3>
              <button
                onClick={resetPicker}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              type="text"
              placeholder={t('team.searchPokemon')}
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              autoFocus
              className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            />
            <div className="max-h-64 overflow-y-auto">
              {pickerLoading ? (
                <div className="flex justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
                </div>
              ) : pickerResults.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">
                  {pickerSearch
                    ? t('team.noPokemonFound')
                    : t('team.typeToSearch')}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {pickerResults.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => handleSelectPokemon(p)}
                        className="flex w-full items-center gap-3 px-2 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <Image
                          src={p.sprite_url}
                          alt={localizedName(p.names, locale) || p.name}
                          width={40}
                          height={40}
                          unoptimized
                          className="h-10 w-10"
                        />
                        <span className="text-sm font-medium capitalize text-gray-800 dark:text-gray-200">
                          {localizedName(p.names, locale) || p.name}
                        </span>
                        <span className="ml-auto flex gap-1">
                          {p.types.map((tp) => (
                            <TypeBadge key={tp.id} name={tp.name} names={tp.names} />
                          ))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
