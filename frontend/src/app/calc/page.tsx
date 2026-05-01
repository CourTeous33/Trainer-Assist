'use client';

import { Suspense, useEffect, useMemo, useReducer, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  defaultCalcState, calculate, serializeState, deserializeState,
  clampEVsForMode, convertEVsBetweenModes, lockedIVsForMode, lockedLevelForMode,
  type CalcState, type CalcInput, type EVMode, type NatureId, type StatStages,
} from '@/lib/calc';
import type { PokemonDetail, PokemonSummary, MoveSummary, TypeRef, TypeEfficacy, Stats } from '@/lib/types';
import { getPokemon, getPokemonList, getTypes, getTypeEfficacy, getMoves } from '@/lib/api';
import { useLocale, localizedName } from '@/lib/i18n';
import { useDebounce } from '@/hooks/use-debounce';
import EVModeToggle from '@/components/EVModeToggle';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import EVStatTable from '@/components/EVStatTable';
import NatureDropdown from '@/components/NatureDropdown';
import ItemDropdown from '@/components/ItemDropdown';
import BaseStatOverridePanel from '@/components/BaseStatOverridePanel';
import PokemonPicker from '@/components/PokemonPicker';
import MoveSlot from '@/components/MoveSlot';
import MovePicker from '@/components/MovePicker';
import DamageResultCard from '@/components/DamageResultCard';
import TypeBadge from '@/components/TypeBadge';
import LoadingSpinner from '@/components/LoadingSpinner';

type Action =
  | { type: 'SET_EV_MODE'; mode: EVMode }
  | { type: 'SET_ATTACKER_POKEMON'; id: number; preserveMoves?: boolean }
  | { type: 'SET_DEFENDER_POKEMON'; id: number }
  | { type: 'SET_ATTACKER_LEVEL'; level: number }
  | { type: 'SET_DEFENDER_LEVEL'; level: number }
  | { type: 'SET_ATTACKER_EVS'; evs: Stats }
  | { type: 'SET_DEFENDER_EVS'; evs: Stats }
  | { type: 'SET_ATTACKER_IVS'; ivs: Stats }
  | { type: 'SET_DEFENDER_IVS'; ivs: Stats }
  | { type: 'SET_ATTACKER_NATURE'; nature: NatureId }
  | { type: 'SET_DEFENDER_NATURE'; nature: NatureId }
  | { type: 'SET_ATTACKER_ITEM'; itemId: string | null }
  | { type: 'SET_DEFENDER_ITEM'; itemId: string | null }
  | { type: 'SET_ATTACKER_OVERRIDE'; base: Stats | null; types: number[] | null }
  | { type: 'SET_DEFENDER_OVERRIDE'; base: Stats | null; types: number[] | null }
  | { type: 'SET_ATTACKER_STAGE'; stat: keyof StatStages; value: number }
  | { type: 'SET_DEFENDER_STAGE'; stat: keyof StatStages; value: number }
  | { type: 'SET_MOVE'; slot: 0 | 1 | 2 | 3; moveId: number | null }
  | { type: 'HYDRATE'; state: CalcState };

function calcReducer(state: CalcState, action: Action): CalcState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;
    case 'SET_EV_MODE': {
      const lockedLvl = lockedLevelForMode(action.mode);
      const lockedIvs = lockedIVsForMode(action.mode);
      return {
        ...state, evMode: action.mode,
        attacker: { ...state.attacker, level: lockedLvl ?? state.attacker.level, ivs: lockedIvs ?? state.attacker.ivs, evs: convertEVsBetweenModes(state.attacker.evs, state.evMode, action.mode) },
        defender: { ...state.defender, level: lockedLvl ?? state.defender.level, ivs: lockedIvs ?? state.defender.ivs, evs: convertEVsBetweenModes(state.defender.evs, state.evMode, action.mode) },
      };
    }
    case 'SET_ATTACKER_POKEMON': {
      const moveIds: CalcState['attacker']['moveIds'] = action.preserveMoves
        ? state.attacker.moveIds
        : [null, null, null, null];
      return { ...state, attacker: { ...state.attacker, pokemonId: action.id, baseStatsOverride: null, typesOverride: null, moveIds } };
    }
    case 'SET_DEFENDER_POKEMON': return { ...state, defender: { ...state.defender, pokemonId: action.id, baseStatsOverride: null, typesOverride: null } };
    case 'SET_ATTACKER_LEVEL':   return { ...state, attacker: { ...state.attacker, level: action.level } };
    case 'SET_DEFENDER_LEVEL':   return { ...state, defender: { ...state.defender, level: action.level } };
    case 'SET_ATTACKER_EVS':     return { ...state, attacker: { ...state.attacker, evs: clampEVsForMode(action.evs, state.evMode) } };
    case 'SET_DEFENDER_EVS':     return { ...state, defender: { ...state.defender, evs: clampEVsForMode(action.evs, state.evMode) } };
    case 'SET_ATTACKER_IVS':     return { ...state, attacker: { ...state.attacker, ivs: action.ivs } };
    case 'SET_DEFENDER_IVS':     return { ...state, defender: { ...state.defender, ivs: action.ivs } };
    case 'SET_ATTACKER_NATURE':  return { ...state, attacker: { ...state.attacker, nature: action.nature } };
    case 'SET_DEFENDER_NATURE':  return { ...state, defender: { ...state.defender, nature: action.nature } };
    case 'SET_ATTACKER_ITEM':    return { ...state, attacker: { ...state.attacker, itemId: action.itemId } };
    case 'SET_DEFENDER_ITEM':    return { ...state, defender: { ...state.defender, itemId: action.itemId } };
    case 'SET_ATTACKER_OVERRIDE': return { ...state, attacker: { ...state.attacker, baseStatsOverride: action.base, typesOverride: action.types } };
    case 'SET_DEFENDER_OVERRIDE': return { ...state, defender: { ...state.defender, baseStatsOverride: action.base, typesOverride: action.types } };
    case 'SET_ATTACKER_STAGE': {
      const clamped = Math.max(-6, Math.min(6, Math.floor(action.value)));
      return { ...state, attacker: { ...state.attacker, stages: { ...state.attacker.stages, [action.stat]: clamped } } };
    }
    case 'SET_DEFENDER_STAGE': {
      const clamped = Math.max(-6, Math.min(6, Math.floor(action.value)));
      return { ...state, defender: { ...state.defender, stages: { ...state.defender.stages, [action.stat]: clamped } } };
    }
    case 'SET_MOVE': {
      const moves = [...state.attacker.moveIds] as CalcState['attacker']['moveIds'];
      moves[action.slot] = action.moveId;
      return { ...state, attacker: { ...state.attacker, moveIds: moves } };
    }
  }
}

function toEfficacyMatrix(rows: TypeEfficacy[]): number[][] {
  const max = Math.max(...rows.map((r) => Math.max(r.attacking_type_id, r.defending_type_id)), 18);
  const m: number[][] = Array.from({ length: max + 1 }, () => Array(max + 1).fill(100));
  for (const r of rows) {
    m[r.attacking_type_id][r.defending_type_id] = r.damage_factor;
  }
  return m;
}

export default function CalcPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CalcPageInner />
    </Suspense>
  );
}

function CalcPageInner() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(calcReducer, defaultCalcState());
  const [hydrated, setHydrated] = useState(false);
  const [allTypes, setAllTypes] = useState<TypeRef[]>([]);
  const [efficacyMatrix, setEfficacyMatrix] = useState<number[][]>([]);
  const [allMoves, setAllMoves] = useState<MoveSummary[]>([]);
  const [formsBySpecies, setFormsBySpecies] = useState<Map<number, PokemonSummary[]>>(new Map());
  const [attackerDetail, setAttackerDetail] = useState<PokemonDetail | null>(null);
  const [defenderDetail, setDefenderDetail] = useState<PokemonDetail | null>(null);
  const [pickerOpen, setPickerOpen] = useState<null | 'attacker' | 'defender'>(null);
  const [moveSlotOpen, setMoveSlotOpen] = useState<null | 0 | 1 | 2 | 3>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from URL on mount.
  useEffect(() => {
    const s = searchParams.get('s');
    if (s) {
      dispatch({ type: 'HYDRATE', state: deserializeState(s) });
    }
    setHydrated(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, [searchParams]);

  // Debounced URL sync.
  const debouncedState = useDebounce(state, 300);
  useEffect(() => {
    if (!hydrated) return;
    const blob = serializeState(debouncedState);
    const url = new URL(window.location.href);
    url.searchParams.set('s', blob);
    router.replace(url.pathname + url.search);
  }, [debouncedState, hydrated, router]);

  // Static reference data.
  useEffect(() => {
    Promise.all([getTypes(), getTypeEfficacy(), getMoves({}), getPokemonList({ limit: 2000 })])
      .then(([types, efficacy, moves, pokemonList]) => {
        setAllTypes(types);
        setEfficacyMatrix(toEfficacyMatrix(efficacy));
        setAllMoves(moves);
        const map = new Map<number, PokemonSummary[]>();
        for (const p of pokemonList.items) {
          const arr = map.get(p.species_id) ?? [];
          arr.push(p);
          map.set(p.species_id, arr);
        }
        setFormsBySpecies(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Attacker detail.
  useEffect(() => {
    let cancelled = false;
    getPokemon(state.attacker.pokemonId)
      .then((d) => { if (!cancelled) setAttackerDetail(d); })
      .catch(() => { if (!cancelled) setAttackerDetail(null); });
    return () => { cancelled = true; };
  }, [state.attacker.pokemonId]);

  // Defender detail.
  useEffect(() => {
    let cancelled = false;
    getPokemon(state.defender.pokemonId)
      .then((d) => { if (!cancelled) setDefenderDetail(d); })
      .catch(() => { if (!cancelled) setDefenderDetail(null); });
    return () => { cancelled = true; };
  }, [state.defender.pokemonId]);

  const attackerMoves: MoveSummary[] = useMemo(() => {
    if (!attackerDetail) return [];
    const learnsetIds = new Set(attackerDetail.moves.map((m) => m.id));
    return allMoves.filter((m) => learnsetIds.has(m.id));
  }, [attackerDetail, allMoves]);

  const results = useMemo(() => {
    if (!attackerDetail || !defenderDetail || !efficacyMatrix.length) {
      return [null, null, null, null] as Array<{ move: MoveSummary; outcome: ReturnType<typeof calculate> } | null>;
    }
    return state.attacker.moveIds.map((mid) => {
      if (!mid) return null;
      const move = allMoves.find((m) => m.id === mid);
      if (!move) return null;
      const input: CalcInput = {
        evMode: state.evMode,
        attacker: state.attacker,
        defender: state.defender,
        attackerSpecies: { types: attackerDetail.types.map((tt) => tt.id), baseStats: attackerDetail.stats },
        defenderSpecies: { types: defenderDetail.types.map((tt) => tt.id), baseStats: defenderDetail.stats },
        move,
        typeEfficacy: efficacyMatrix,
      };
      return { move, outcome: calculate(input) };
    });
  }, [state, attackerDetail, defenderDetail, efficacyMatrix, allMoves]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto p-4 space-y-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('calc.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('calc.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <EVModeToggle mode={state.evMode} onChange={(m) => dispatch({ type: 'SET_EV_MODE', mode: m })} />
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <SidePanel
          side="attacker"
          state={state}
          detail={attackerDetail}
          allTypes={allTypes}
          dispatch={dispatch}
          openPicker={() => setPickerOpen('attacker')}
          locale={locale}
          label={t('calc.attacker')}
          formsBySpecies={formsBySpecies}
        />
        <SidePanel
          side="defender"
          state={state}
          detail={defenderDetail}
          allTypes={allTypes}
          dispatch={dispatch}
          openPicker={() => setPickerOpen('defender')}
          locale={locale}
          label={t('calc.defender')}
          formsBySpecies={formsBySpecies}
        />
      </div>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <h2 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">{t('calc.moves')}</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {state.attacker.moveIds.map((mid, idx) => {
            const move = mid ? allMoves.find((m) => m.id === mid) ?? null : null;
            return (
              <MoveSlot
                key={idx}
                move={move}
                onClick={() => setMoveSlotOpen(idx as 0 | 1 | 2 | 3)}
                onClear={() => dispatch({ type: 'SET_MOVE', slot: idx as 0 | 1 | 2 | 3, moveId: null })}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">{t('calc.results')}</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {results.map((r, idx) => (
            <DamageResultCard
              key={idx}
              move={r ? r.move : null}
              result={r ? r.outcome : null}
            />
          ))}
        </div>
      </section>

      {pickerOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setPickerOpen(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">{t(`calc.${pickerOpen}`)}</h3>
            <PokemonPicker
              allTypes={allTypes}
              onSelect={(p) => {
                dispatch(pickerOpen === 'attacker'
                  ? { type: 'SET_ATTACKER_POKEMON', id: p.id }
                  : { type: 'SET_DEFENDER_POKEMON', id: p.id });
                setPickerOpen(null);
              }}
            />
          </div>
        </div>
      )}

      <MovePicker
        open={moveSlotOpen !== null}
        onClose={() => setMoveSlotOpen(null)}
        onPick={(m) => {
          if (moveSlotOpen !== null) dispatch({ type: 'SET_MOVE', slot: moveSlotOpen, moveId: m.id });
          setMoveSlotOpen(null);
        }}
        attackerMoves={attackerMoves}
        allTypes={allTypes}
      />
    </div>
  );
}

interface SidePanelProps {
  side: 'attacker' | 'defender';
  state: CalcState;
  detail: PokemonDetail | null;
  allTypes: TypeRef[];
  dispatch: (a: Action) => void;
  openPicker: () => void;
  locale: string;
  label: string;
  formsBySpecies: Map<number, PokemonSummary[]>;
}

function isMegaForm(p: { name: string }): boolean {
  return p.name.startsWith('Mega ') || p.name.startsWith('Primal ');
}

function SidePanel({ side, state, detail, allTypes, dispatch, openPicker, locale, label, formsBySpecies }: SidePanelProps) {
  if (!detail) {
    return (
      <div className="border rounded-lg p-3 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{label}</div>
        <div className="text-sm text-gray-500">…</div>
      </div>
    );
  }
  const cfg = side === 'attacker' ? state.attacker : state.defender;
  const siblings = formsBySpecies.get(detail.species_id) ?? [];
  const megaForms = siblings.filter(isMegaForm);
  const baseForm = siblings.find((p) => !isMegaForm(p));
  const currentIsMega = isMegaForm(detail);
  const formButtons: PokemonSummary[] = [];
  if (currentIsMega && baseForm) formButtons.push(baseForm);
  formButtons.push(...megaForms);
  const setPokemon = (id: number, preserveMoves = false) => dispatch(
    side === 'attacker'
      ? { type: 'SET_ATTACKER_POKEMON', id, preserveMoves }
      : { type: 'SET_DEFENDER_POKEMON', id },
  );
  const setEVs = (evs: Stats) => dispatch({ type: side === 'attacker' ? 'SET_ATTACKER_EVS' : 'SET_DEFENDER_EVS', evs });
  const setIVs = (ivs: Stats) => dispatch({ type: side === 'attacker' ? 'SET_ATTACKER_IVS' : 'SET_DEFENDER_IVS', ivs });
  const setLvl = (l: number) => dispatch({ type: side === 'attacker' ? 'SET_ATTACKER_LEVEL' : 'SET_DEFENDER_LEVEL', level: l });
  const setNat = (n: NatureId) => dispatch({ type: side === 'attacker' ? 'SET_ATTACKER_NATURE' : 'SET_DEFENDER_NATURE', nature: n });
  const setItem = (i: string | null) => dispatch({ type: side === 'attacker' ? 'SET_ATTACKER_ITEM' : 'SET_DEFENDER_ITEM', itemId: i });
  const setOver = (base: Stats | null, types: number[] | null) =>
    dispatch({ type: side === 'attacker' ? 'SET_ATTACKER_OVERRIDE' : 'SET_DEFENDER_OVERRIDE', base, types });
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <button type="button" onClick={openPicker} className="w-full flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded p-2">
        <Image src={detail.sprite_url} alt="" width={64} height={64} unoptimized />
        <div className="flex-1">
          <div className="font-semibold text-gray-800 dark:text-gray-100">{localizedName(detail.names, locale)}</div>
          <div className="flex gap-1 mt-1">
            {(cfg.typesOverride ?? detail.types.map((tt) => tt.id)).map((tid) => {
              const tt = allTypes.find((x) => x.id === tid);
              return tt ? <TypeBadge key={tid} name={tt.name} names={tt.names} size="sm" /> : null;
            })}
          </div>
        </div>
      </button>
      {formButtons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {formButtons.map((f) => {
            const active = f.id === detail.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setPokemon(f.id, true)}
                disabled={active}
                className={`px-2 py-1 text-xs rounded border ${
                  active
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'border-purple-400 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30'
                }`}
              >
                {localizedName(f.names, locale)}
              </button>
            );
          })}
        </div>
      )}
      <BaseStatOverridePanel
        speciesBase={detail.stats}
        speciesTypes={detail.types.map((tt) => tt.id)}
        baseStatsOverride={cfg.baseStatsOverride}
        typesOverride={cfg.typesOverride}
        allTypes={allTypes}
        onChange={({ base, types }) => setOver(base, types)}
      />
      <div className="flex items-center gap-2">
        <NatureDropdown value={cfg.nature} onChange={setNat} />
        <ItemDropdown value={cfg.itemId} onChange={setItem} />
      </div>
      <EVStatTable
        mode={state.evMode}
        base={cfg.baseStatsOverride ?? detail.stats}
        ivs={cfg.ivs}
        evs={cfg.evs}
        nature={cfg.nature}
        level={cfg.level}
        onIVsChange={setIVs}
        onEVsChange={setEVs}
        onLevelChange={setLvl}
      />
    </div>
  );
}
