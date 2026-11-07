'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BudgetCategory } from '@/types';
import {
  findDuplicatePairs, keepNote, mergePatch, originLabel, pairTitle,
  type DuplicatePair, type DupTx,
} from '@/lib/duplicates/find';
import {
  applyMerges, dismissPairs, loadDismissedKeys, loadDuplicateCandidates,
  type DuplicateScope, type MergeUndo,
} from '@/lib/duplicates/data';
import { BORDER, CARD_BG, PRIMARY_BUTTON, TEXT_BODY, TEXT_MUTED, TEXT_STRONG } from './ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any>;
type Decision = 'same' | 'different';

interface Props {
  supabase: Client;
  householdId: string;
  from: string;
  to: string;
  scope: DuplicateScope;
  categories: BudgetCategory[];
  fmt: (n: number) => string;
  /** Texto del periodo revisado, p. ej. "todo 2026". */
  periodText: string;
  onClose: () => void;
  /** Se borraron repetidos: el padre recarga y ofrece "Deshacer". */
  onApplied: (count: number, undo: MergeUndo) => void;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]}`;
}

function swapKeeper(p: DuplicatePair): DuplicatePair {
  return { ...p, a: p.b, b: p.a, keepId: p.dropId, dropId: p.keepId, patch: mergePatch(p.b, p.a) };
}

function TxLine({ t, other, kept, catName, fmt }: { t: DupTx; other: DupTx; kept: boolean; catName: string; fmt: (n: number) => string }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${kept ? 'border-electric bg-electric-ghost dark:bg-[#1B2B4D]' : BORDER}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[12px] font-bold ${kept ? 'text-electric-dark dark:text-electric-soft' : TEXT_MUTED}`}>
          {kept ? 'Se queda' : 'Se borra'}
        </span>
        <span className={`text-[12px] ${TEXT_MUTED}`}>{originLabel(t, other)}</span>
      </div>
      <p className={`mt-1 text-[14px] font-semibold truncate ${TEXT_STRONG}`}>{t.description || t.bank_description || 'Movimiento'}</p>
      <p className={`text-[12.5px] ${TEXT_MUTED}`}>
        {shortDate(t.date)} · {catName} · {fmt(Number(t.amount))}
      </p>
    </div>
  );
}

/** Pantalla completa: revisa pares de movimientos que parecen repetidos y borra los que el usuario confirma. */
export function DuplicatesReview({ supabase, householdId, from, to, scope, categories, fmt, periodText, onClose, onApplied }: Props) {
  const [phase, setPhase] = useState<'scanning' | 'review' | 'error'>('scanning');
  const [scanned, setScanned] = useState(0);
  const [pairs, setPairs] = useState<DuplicatePair[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const savingRef = useRef(false);

  const scopeKey = `${scope.paidBy ?? ''}|${scope.personal ? 'p' : ''}`;
  useEffect(() => {
    let cancelled = false;
    setPhase('scanning');
    (async () => {
      try {
        const [txs, dismissed] = await Promise.all([
          loadDuplicateCandidates(supabase, householdId, from, to, scope),
          loadDismissedKeys(supabase, householdId),
        ]);
        if (cancelled) return;
        setScanned(txs.length);
        setPairs(findDuplicatePairs(txs, dismissed));
        setDecisions({});
        setPhase('review');
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, householdId, from, to, scopeKey, attempt]);

  const catNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const catName = (id: string | null) => (id ? catNames.get(id) ?? 'Sin categoría' : 'Sin categoría');

  const sameCount = pairs.filter((p) => decisions[p.key] === 'same').length;
  const pending = pairs.filter((p) => !decisions[p.key]).length;
  const strongPending = pairs.filter((p) => p.confidence === 'strong' && decisions[p.key] !== 'same');

  function decide(key: string, d: Decision) {
    setDecisions((prev) => {
      const next = { ...prev };
      if (prev[key] === d) delete next[key];
      else next[key] = d;
      return next;
    });
  }

  async function confirm() {
    if (savingRef.current || pending > 0) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const different = pairs.filter((p) => decisions[p.key] === 'different').map((p) => p.key);
      const same = pairs.filter((p) => decisions[p.key] === 'same');
      const undo = same.length > 0 ? await applyMerges(supabase, same) : null;
      // Los descartes se guardan después: si el borrado falla no se pierde nada.
      if (different.length > 0) await dismissPairs(supabase, householdId, different).catch(() => {});
      if (undo) onApplied(same.length, undo);
      onClose();
    } catch {
      setSaveError('No pudimos borrar los repetidos. No se cambió nada, intenta de nuevo.');
      savingRef.current = false;
      setSaving(false);
    }
  }

  const confirmLabel = saving
    ? 'Guardando…'
    : pending > 0
      ? `Faltan ${pending} por revisar`
      : sameCount > 0
        ? `Borrar ${sameCount} ${sameCount === 1 ? 'repetido' : 'repetidos'}`
        : 'Listo, no borrar nada';

  return (
    <div role="dialog" aria-modal="true" aria-label="Buscar duplicados" className="fixed inset-0 z-[80] flex flex-col bg-[var(--zafi-bg)]">
      <header className={`flex items-center gap-2 px-3 h-14 flex-none border-b ${BORDER} ${CARD_BG}`}>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--zafi-hover)]">
          <ArrowLeft size={20} aria-hidden />
        </button>
        <h2 className={`font-serif text-[20px] ${TEXT_STRONG}`}>Duplicados</h2>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4 flex flex-col gap-3">
          {phase === 'scanning' && (
            <div className={`rounded-2xl px-6 py-10 text-center ${CARD_BG}`}>
              <Loader2 size={22} className="mx-auto animate-spin text-electric" aria-hidden />
              <p className={`mt-3 font-semibold ${TEXT_STRONG}`}>Revisando tus movimientos…</p>
              <p className={`text-sm ${TEXT_MUTED}`}>Periodo: {periodText}</p>
            </div>
          )}

          {phase === 'error' && (
            <div role="alert" className={`rounded-2xl px-6 py-10 text-center ${CARD_BG}`}>
              <p className={`font-semibold ${TEXT_STRONG}`}>No pudimos revisar tus movimientos.</p>
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`mt-4 ${PRIMARY_BUTTON}`}>
                Reintentar
              </button>
            </div>
          )}

          {phase === 'review' && pairs.length === 0 && (
            <div className={`rounded-2xl px-6 py-10 text-center ${CARD_BG}`}>
              <Check size={22} className="mx-auto text-success-text" aria-hidden />
              <p className={`mt-3 font-semibold ${TEXT_STRONG}`}>No encontramos repetidos en este periodo.</p>
              <p className={`text-sm ${TEXT_MUTED}`}>Revisamos {scanned} movimientos de {periodText}.</p>
            </div>
          )}

          {phase === 'review' && pairs.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm ${TEXT_BODY}`}>
                  Encontramos <b>{pairs.length}</b> {pairs.length === 1 ? 'posible repetido' : 'posibles repetidos'} en {periodText}.
                </p>
                {strongPending.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDecisions((prev) => ({ ...prev, ...Object.fromEntries(strongPending.map((p) => [p.key, 'same' as Decision])) }))}
                    className="flex-none text-[13px] font-semibold text-electric"
                  >
                    Marcar todos como el mismo
                  </button>
                )}
              </div>

              {pairs.map((p) => {
                const d = decisions[p.key];
                return (
                  <section key={p.key} className={`rounded-2xl p-3.5 flex flex-col gap-2.5 ${CARD_BG} ${d === 'different' ? 'opacity-70' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-[15px] font-bold truncate ${TEXT_STRONG}`}>{pairTitle(p)}</h3>
                      <span className={`flex-none rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${p.confidence === 'strong' ? 'bg-success-light text-success-text' : 'bg-warning-light text-warning-text'}`}>
                        {p.confidence === 'strong' ? 'Muy probable' : 'Revisa con cuidado'}
                      </span>
                    </div>
                    {p.reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.reasons.map((r) => (
                          <span key={r} className={`rounded-full border px-2 py-0.5 text-[11.5px] ${BORDER} ${TEXT_MUTED}`}>{r}</span>
                        ))}
                      </div>
                    )}
                    <TxLine t={p.a} other={p.b} kept catName={catName(p.a.category_id)} fmt={fmt} />
                    <TxLine t={p.b} other={p.a} kept={false} catName={catName(p.b.category_id)} fmt={fmt} />
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[12.5px] ${TEXT_MUTED}`}>{keepNote(p)}</p>
                      <button
                        type="button"
                        onClick={() => setPairs((prev) => prev.map((x) => (x.key === p.key ? swapKeeper(x) : x)))}
                        className="flex-none text-[13px] font-semibold text-electric"
                      >
                        Cambiar
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2" role="group" aria-label="¿Es el mismo movimiento?">
                      <button
                        type="button"
                        aria-pressed={d === 'same'}
                        onClick={() => decide(p.key, 'same')}
                        className={`h-11 rounded-full border text-[14px] font-semibold ${d === 'same' ? 'bg-navy border-navy text-white dark:bg-electric dark:border-electric' : `${BORDER} ${TEXT_BODY}`}`}
                      >
                        Es el mismo
                      </button>
                      <button
                        type="button"
                        aria-pressed={d === 'different'}
                        onClick={() => decide(p.key, 'different')}
                        className={`h-11 rounded-full border text-[14px] font-semibold ${d === 'different' ? 'bg-navy border-navy text-white dark:bg-electric dark:border-electric' : `${BORDER} ${TEXT_BODY}`}`}
                      >
                        Son distintos
                      </button>
                    </div>
                  </section>
                );
              })}
            </>
          )}
        </div>
      </div>

      {phase === 'review' && pairs.length > 0 && (
        <footer className={`flex-none border-t px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] ${BORDER} ${CARD_BG}`}>
          <div className="mx-auto max-w-3xl flex flex-col gap-2">
            {saveError && <p role="alert" className="text-sm text-danger-text">{saveError}</p>}
            <button
              type="button"
              onClick={confirm}
              disabled={saving || pending > 0}
              className={`${PRIMARY_BUTTON} w-full disabled:opacity-50`}
            >
              {confirmLabel}
            </button>
          </div>
        </footer>
      )}
      {phase !== 'review' || pairs.length === 0 ? (
        <footer className={`flex-none border-t px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] ${BORDER} ${CARD_BG}`}>
          <div className="mx-auto max-w-3xl">
            <button type="button" onClick={onClose} className={`${PRIMARY_BUTTON} w-full`}>Cerrar</button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
