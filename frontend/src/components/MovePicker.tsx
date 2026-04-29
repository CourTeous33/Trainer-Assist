'use client';

import { useState } from 'react';
import type { MoveSummary, TypeRef } from '@/lib/types';
import { useLocale, localizedName } from '@/lib/i18n';
import TypeBadge from './TypeBadge';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (move: MoveSummary) => void;
  attackerMoves: MoveSummary[];
  allTypes: TypeRef[];
}

type DamageClass = 'physical' | 'special' | 'status';

export default function MovePicker({ open, onClose, onPick, attackerMoves, allTypes }: Props) {
  const { locale, t } = useLocale();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<number | null>(null);
  const [classFilter, setClassFilter] = useState<DamageClass | null>(null);

  if (!open) return null;

  const filtered = attackerMoves.filter((m) => {
    if (typeFilter && m.type_ref.id !== typeFilter) return false;
    if (classFilter && m.damage_class !== classFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.names.en.toLowerCase().includes(q) &&
          !(m.names.ja?.toLowerCase().includes(q)) &&
          !(m.names.zh?.toLowerCase().includes(q))) {
        return false;
      }
    }
    return true;
  });

  const cls = (active: boolean) =>
    `px-3 py-1 rounded-md text-sm capitalize border transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-700'}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 space-y-2 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text" autoFocus
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('calc.move.searchPlaceholder')}
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
          />
          <div className="flex flex-wrap gap-1">
            {allTypes.map((tt) => (
              <button
                key={tt.id} type="button"
                onClick={() => setTypeFilter(typeFilter === tt.id ? null : tt.id)}
                className={`transition-opacity ${typeFilter && typeFilter !== tt.id ? 'opacity-30' : ''}`}
              >
                <TypeBadge name={tt.name} names={tt.names} size="sm" />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['physical', 'special', 'status'] as DamageClass[]).map((c) => (
              <button key={c} type="button" onClick={() => setClassFilter(classFilter === c ? null : c)} className={cls(classFilter === c)}>
                {t(`calc.move.${c}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {filtered.length === 0 && <div className="text-center text-sm text-gray-500 py-4">—</div>}
          {filtered.map((m) => (
            <button
              key={m.id} type="button"
              onClick={() => { onPick(m); onClose(); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
            >
              <TypeBadge name={m.type_ref.name} names={m.type_ref.names} size="sm" />
              <span className="flex-1 text-sm">{localizedName(m.names, locale)}</span>
              <span className="text-xs text-gray-500 capitalize">{m.damage_class}</span>
              <span className="text-xs tabular-nums text-gray-500 w-8 text-right">{m.power ?? '—'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
