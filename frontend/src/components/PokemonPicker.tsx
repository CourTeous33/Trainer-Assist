'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getPokemonList } from '@/lib/api';
import type { PokemonSummary, TypeRef } from '@/lib/types';
import { useLocale, localizedName } from '@/lib/i18n';
import { useDebounce } from '@/hooks/use-debounce';
import TypeBadge from './TypeBadge';

interface Props {
  allTypes: TypeRef[];
  onSelect: (pokemon: PokemonSummary) => void;
}

export default function PokemonPicker({ allTypes, onSelect }: Props) {
  const { locale, t } = useLocale();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [fetched, setFetched] = useState<PokemonSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const active = !!(debouncedSearch || typeFilter);
  const results = active ? fetched : [];

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect -- show loading before async fetch
    getPokemonList({ search: debouncedSearch || undefined, type: typeFilter ?? undefined, limit: 20 })
      .then((res) => { if (!cancelled) setFetched(res.items); })
      .catch(() => { if (!cancelled) setFetched([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active, debouncedSearch, typeFilter]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('pokemon.search')}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
      />
      <div className="flex flex-wrap gap-1">
        {allTypes.map((tt) => (
          <button
            key={tt.id} type="button"
            onClick={() => setTypeFilter(typeFilter === tt.name ? null : tt.name)}
            className={`transition-opacity ${typeFilter && typeFilter !== tt.name ? 'opacity-30' : ''}`}
          >
            <TypeBadge name={tt.name} names={tt.names} size="sm" />
          </button>
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {loading && <div className="text-sm text-gray-500">…</div>}
        {!loading && results.map((p) => (
          <button
            key={p.id} type="button"
            onClick={() => onSelect(p)}
            className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Image src={p.sprite_url} alt="" width={32} height={32} unoptimized />
            <span className="text-sm flex-1 text-left">{localizedName(p.names, locale)}</span>
            <div className="flex gap-1">
              {p.types.map((tt) => <TypeBadge key={tt.id} name={tt.name} names={tt.names} size="sm" />)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
