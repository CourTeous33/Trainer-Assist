'use client';

import { useEffect, useState, useMemo } from 'react';
import { getTypes, getTypeEfficacy, getTypePokemon } from '@/lib/api';
import type { TypeRef, TypeEfficacy, PokemonSummary, LocalizedNames } from '@/lib/types';
import TypeBadge from '@/components/TypeBadge';
import TypeKeypad from '@/components/TypeKeypad';
import PokemonCard from '@/components/PokemonCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useLocale, localizedName } from '@/lib/i18n';

export default function TypesPage() {
  const { t: tr, locale } = useLocale();
  const [types, setTypes] = useState<TypeRef[]>([]);
  const [efficacy, setEfficacy] = useState<TypeEfficacy[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<TypeRef[]>([]);
  const [typePokemon, setTypePokemon] = useState<PokemonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pokemonLoading, setPokemonLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch types and efficacy on mount
  useEffect(() => {
    Promise.all([getTypes(), getTypeEfficacy()])
      .then(([t, e]) => {
        setTypes(t);
        setEfficacy(e);
      })
      .catch((err) => setError(err.message || 'Failed to load types'))
      .finally(() => setLoading(false));
  }, []);

  // Fetch pokemon with selected types
  useEffect(() => {
    if (selectedTypes.length === 0) {
      setTypePokemon([]);
      return;
    }

    setPokemonLoading(true);
    getTypePokemon(selectedTypes[0].id)
      .then((pokemon) => {
        if (selectedTypes.length === 2) {
          // Filter to only pokemon that also have the second type
          const secondTypeName = selectedTypes[1].name.toLowerCase();
          setTypePokemon(
            pokemon.filter((p) =>
              p.types.some((t) => t.name.toLowerCase() === secondTypeName)
            )
          );
        } else {
          setTypePokemon(pokemon);
        }
      })
      .catch(() => setTypePokemon([]))
      .finally(() => setPokemonLoading(false));
  }, [selectedTypes]);

  const toggleType = (t: TypeRef) => {
    setSelectedTypes((prev) => {
      const exists = prev.find((s) => s.id === t.id);
      if (exists) return prev.filter((s) => s.id !== t.id);
      if (prev.length >= 2) return [prev[1], t];
      return [...prev, t];
    });
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
    () => new Map(types.map(t => [t.name, t.names])),
    [types]
  );

  // Build efficacy analysis
  const analysis = useMemo(() => {
    if (selectedTypes.length === 0 || efficacyMap.size === 0) return null;

    const selectedIds = selectedTypes.map((t) => t.id);
    const typeMap = new Map(types.map((t) => [t.id, t.name]));

    // Defensive: how much damage each attacking type does to our type combo
    const def4x: string[] = [];
    const def2x: string[] = [];
    const def1x: string[] = [];
    const def0_5x: string[] = [];
    const def0_25x: string[] = [];
    const def0x: string[] = [];

    for (const t of types) {
      let multiplier = 1;
      for (const defId of selectedIds) {
        const factor = efficacyMap.get(`${t.id}:${defId}`);
        if (factor !== undefined) multiplier *= factor / 100;
      }
      const name = typeMap.get(t.id) ?? '';
      if (multiplier === 0) def0x.push(name);
      else if (multiplier >= 4) def4x.push(name);
      else if (multiplier >= 2) def2x.push(name);
      else if (multiplier === 1) def1x.push(name);
      else if (multiplier >= 0.5) def0_5x.push(name);
      else def0_25x.push(name);
    }

    // Offensive: how much damage our types deal to each defending type
    const offSuper: string[] = [];
    const offNormal: string[] = [];
    const offNotVery: string[] = [];
    const offNone: string[] = [];

    for (const defType of types) {
      let bestMult = 0;
      for (const atkId of selectedIds) {
        const factor = efficacyMap.get(`${atkId}:${defType.id}`);
        const mult = factor !== undefined ? factor / 100 : 1;
        bestMult = Math.max(bestMult, mult);
      }
      const name = typeMap.get(defType.id) ?? '';
      if (bestMult > 1) offSuper.push(name);
      else if (bestMult === 1) offNormal.push(name);
      else if (bestMult === 0) offNone.push(name);
      else offNotVery.push(name);
    }

    // Offensive vs dual-type defenders
    // For each possible defender type combo (single + dual), find the best multiplier
    // our attacking types can achieve, and flag combos that wall or resist us
    const offDualWalls: { types: string[]; best: number }[] = []; // best = 0
    const offDualResists: { types: string[]; best: number }[] = []; // best < 1

    // Single-type defenders (already covered above, but needed for dual combos)
    // Check all dual-type combos
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const defIds = [types[i].id, types[j].id];
        let bestMult = 0;

        for (const atkId of selectedIds) {
          // Calculate this attack type's multiplier against the dual defender
          let mult = 1;
          for (const defId of defIds) {
            const factor = efficacyMap.get(`${atkId}:${defId}`);
            if (factor !== undefined) mult *= factor / 100;
          }
          bestMult = Math.max(bestMult, mult);
        }

        const names = [typeMap.get(types[i].id) ?? '', typeMap.get(types[j].id) ?? ''];
        if (bestMult === 0) offDualWalls.push({ types: names, best: bestMult });
        else if (bestMult < 1) offDualResists.push({ types: names, best: bestMult });
      }
    }

    // Sort resists by best multiplier ascending (worst coverage first)
    offDualResists.sort((a, b) => a.best - b.best);

    return {
      def4x, def2x, def1x, def0_5x, def0_25x, def0x,
      offSuper, offNormal, offNotVery, offNone,
      offDualWalls, offDualResists,
    };
  }, [selectedTypes, types, efficacyMap]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="py-6">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{tr('types.title')}</h1>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        {tr('types.instruction')}
      </p>

      {/* Type selector keypad */}
      <TypeKeypad
        types={types}
        selectedNames={selectedTypes.map((s) => s.name)}
        onToggle={toggleType}
        className="mb-6"
      />

      {/* Analysis */}
      {analysis && (
        <div className="space-y-6">
          {/* Defensive */}
          <div className="rounded-xl bg-white p-5 shadow-md dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-700 dark:text-gray-200">
              {tr('types.defensive')}
            </h2>
            <EffectList label={tr('types.weakTo4x')} items={analysis.def4x} color="text-red-700 dark:text-red-400" typeNamesMap={typeNamesMap} />
            <EffectList label={tr('types.weakTo2x')} items={analysis.def2x} color="text-red-500 dark:text-red-300" typeNamesMap={typeNamesMap} />
            <EffectList label={tr('types.normal1x')} items={analysis.def1x} color="text-gray-600 dark:text-gray-400" typeNamesMap={typeNamesMap} />
            <EffectList label={tr('types.resists0_5x')} items={analysis.def0_5x} color="text-green-600 dark:text-green-400" typeNamesMap={typeNamesMap} />
            <EffectList label={tr('types.resists0_25x')} items={analysis.def0_25x} color="text-green-700 dark:text-green-300" typeNamesMap={typeNamesMap} />
            <EffectList label={tr('types.immuneTo')} items={analysis.def0x} color="text-blue-600 dark:text-blue-400" typeNamesMap={typeNamesMap} />
          </div>

          {/* Offensive */}
          <div className="rounded-xl bg-white p-5 shadow-md dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-700 dark:text-gray-200">
              {tr('types.offensive')}
            </h2>
            <EffectList label={tr('types.offensiveSuperEffective')} items={analysis.offSuper} color="text-green-600 dark:text-green-400" typeNamesMap={typeNamesMap} />
            <EffectList label={tr('types.offensiveNormal')} items={analysis.offNormal} color="text-gray-600 dark:text-gray-400" typeNamesMap={typeNamesMap} />
            <EffectList label={tr('types.offensiveNotVeryEffective')} items={analysis.offNotVery} color="text-orange-600 dark:text-orange-400" typeNamesMap={typeNamesMap} />
            <EffectList label={tr('types.offensiveNoEffect')} items={analysis.offNone} color="text-red-600 dark:text-red-400" typeNamesMap={typeNamesMap} />
          </div>

          {/* Offensive vs Dual-Type Defenders */}
          {(analysis.offDualWalls.length > 0 || analysis.offDualResists.length > 0) && (
            <div className="rounded-xl bg-white p-5 shadow-md dark:bg-gray-800">
              <h2 className="mb-1 text-lg font-semibold text-gray-700 dark:text-gray-200">
                {tr('types.offDualTitle')}
              </h2>
              <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                {tr('types.offDualDesc')}
              </p>

              {analysis.offDualWalls.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">{tr('types.offDualWalls')}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {analysis.offDualWalls.map((combo) => (
                      <TypeCombo key={combo.types.join('+')} types={combo.types} typeNamesMap={typeNamesMap} />
                    ))}
                  </div>
                </div>
              )}

              {analysis.offDualResists.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">{tr('types.offDualResists')}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {analysis.offDualResists.map((combo) => (
                      <span key={combo.types.join('+')} className="inline-flex items-center gap-0.5">
                        <TypeCombo types={combo.types} typeNamesMap={typeNamesMap} />
                        <span className="text-xs font-bold text-orange-500 dark:text-orange-400">
                          {combo.best}x
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pokemon with selected type(s) */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-700 dark:text-gray-200">
              {tr('types.pokemonWith', { types: selectedTypes.map((t) => localizedName(t.names, locale) || t.name).join(' / ') })}
              {pokemonLoading ? '' : ` (${typePokemon.length})`}
            </h2>
            {pokemonLoading ? (
              <LoadingSpinner />
            ) : typePokemon.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{tr('types.noPokemon')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {typePokemon.slice(0, 24).map((p) => (
                  <PokemonCard key={p.id} pokemon={p} />
                ))}
                {typePokemon.length > 24 && (
                  <p className="col-span-full text-center text-sm text-gray-400">
                    ...and {typePokemon.length - 24} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TypeCombo({
  types: typeNames,
  typeNamesMap,
}: {
  types: string[];
  typeNamesMap?: Map<string, LocalizedNames>;
}) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1 py-0.5 dark:bg-gray-700">
      {typeNames.map((name, i) => (
        <span key={name} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-xs text-gray-400">/</span>}
          <TypeBadge name={name} names={typeNamesMap?.get(name)} />
        </span>
      ))}
    </span>
  );
}

function EffectList({
  label,
  items,
  color,
  typeNamesMap,
}: {
  label: string;
  items: string[];
  color: string;
  typeNamesMap?: Map<string, LocalizedNames>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <p className={`text-sm font-medium ${color}`}>{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((name) => (
          <TypeBadge key={name} name={name} names={typeNamesMap?.get(name)} />
        ))}
      </div>
    </div>
  );
}
