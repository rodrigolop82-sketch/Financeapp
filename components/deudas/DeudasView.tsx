'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { getUserHousehold } from '@/lib/household';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { formatMonths, monthlyInterest, simulatePayoff, type DebtStrategy } from '@/lib/deudas';
import type { Debt } from '@/types';
import {
  BADGE_OK, DANGER_TEXT_BUTTON, ErrorBox, FieldLabel, GroupTitle, INPUT_48, ListCard, PILL_OUTLINE,
  PillButton, ROW_DIVIDER, RowBody, Segmented, SheetHeader, Tile,
} from '@/components/layout/Pantalla';
import { CARD, GREEN_TEXT } from '@/components/resumen/ctf-ui';
import { PRIMARY_BUTTON, SOFT_BG, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { AddRow, Note, PlanHero, RowAmount, TwoCells } from '@/components/plan/ui';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { UndoToast } from '@/components/transactions/UndoToast';
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast';
import { SkeletonRows } from '@/components/motion/PageSkeleton';

type DebtType = Debt['type'];

const DEBT_TYPES: Record<DebtType, { emoji: string; label: string }> = {
  credit: { emoji: '💳', label: 'Tarjeta' },
  loan: { emoji: '🏦', label: 'Préstamo' },
  informal: { emoji: '🤝', label: 'Informal' },
};

const STRATEGY_HELP: Record<DebtStrategy, string> = {
  snowball: 'Pagas primero la deuda más pequeña: ganas rápido y te motiva.',
  avalanche: 'Pagas primero la de más interés: pagas menos en total.',
};

interface DebtDraft {
  name: string;
  type: DebtType;
  balance: string;
  min_payment: string;
  interest_rate: string;
  due_day: string;
}

function num(v: string): number {
  return parseFloat(v.replace(/[^0-9.]/g, '')) || 0;
}

/** Deudas: cuerpo de la sección "Deudas" en /plan. */
export function DeudasView() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fmt = useFormatMoney();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [strategy, setStrategy] = useState<DebtStrategy>('snowball');
  const [extraInput, setExtraInput] = useState('500');
  const [openId, setOpenId] = useState<string | null>(null);
  // null: hoja cerrada; debt null: deuda nueva.
  const [sheet, setSheet] = useState<{ debt: Debt | null; key: number } | null>(null);
  const [paid, setPaid] = useState<Debt | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const hh = await getUserHousehold(supabase, user.id);
      if (!hh) { router.push('/onboarding'); return; }
      const { data } = await supabase
        .from('debts').select('*').eq('household_id', hh.id).order('balance', { ascending: true });
      if (cancelled) return;
      const rows = (data || []) as Debt[];
      setHouseholdId(hh.id);
      setDebts(rows);
      setOpenId(rows.find((d) => !d.is_paid)?.id ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supabase, router]);

  const openNew = useCallback(() => setSheet({ debt: null, key: Date.now() }), []);

  const fail = () => setMessage({ text: 'No se pudo guardar. Intenta de nuevo.', tone: 'error' });

  async function saveDebt(debt: Debt | null, d: Omit<Debt, 'id' | 'household_id' | 'strategy' | 'is_paid' | 'created_at'>) {
    if (debt) {
      const { error } = await supabase.from('debts').update(d).eq('id', debt.id);
      if (error) { fail(); return; }
      setDebts((list) => list.map((x) => (x.id === debt.id ? { ...x, ...d } : x)));
      setMessage({ text: 'Deuda actualizada', tone: 'ok' });
    } else {
      const { data, error } = await supabase.from('debts').insert({ household_id: householdId, ...d }).select().single();
      if (error || !data) { fail(); return; }
      setDebts((list) => [...list, data as Debt]);
      setOpenId((data as Debt).id);
      setMessage({ text: 'Deuda agregada', tone: 'ok' });
    }
    setSheet(null);
  }

  async function deleteDebt(debt: Debt) {
    const { error } = await supabase.from('debts').delete().eq('id', debt.id);
    if (error) { fail(); return; }
    setDebts((list) => list.filter((x) => x.id !== debt.id));
    setSheet(null);
    setMessage({ text: `Quitamos ${debt.name}`, tone: 'ok' });
  }

  async function setPaidFlag(debt: Debt, isPaid: boolean) {
    setDebts((list) => list.map((x) => (x.id === debt.id ? { ...x, is_paid: isPaid } : x)));
    const { error } = await supabase.from('debts').update({ is_paid: isPaid }).eq('id', debt.id);
    if (error) {
      setDebts((list) => list.map((x) => (x.id === debt.id ? { ...x, is_paid: !isPaid } : x)));
      fail();
      return false;
    }
    return true;
  }

  async function markPaid(debt: Debt) {
    if (await setPaidFlag(debt, true)) setPaid(debt);
  }

  const dismissPaid = useCallback(() => setPaid(null), []);

  if (loading) return <SkeletonRows count={4} className="mt-3.5" />;

  const active = debts.filter((d) => !d.is_paid);
  const done = debts.filter((d) => d.is_paid);
  const extra = num(extraInput);
  const totalBalance = active.reduce((s, d) => s + Number(d.balance), 0);
  const totalMin = active.reduce((s, d) => s + Number(d.min_payment), 0);

  const simSnowball = simulatePayoff(active, extra, 'snowball');
  const simAvalanche = simulatePayoff(active, extra, 'avalanche');
  const sim = strategy === 'snowball' ? simSnowball : simAvalanche;
  const baseline = simulatePayoff(active, 0, strategy);
  const monthsSaved = baseline.totalMonths - sim.totalMonths;
  const interestSaved = baseline.totalInterest - sim.totalInterest;
  const avalancheSavings = simSnowball.totalInterest - simAvalanche.totalInterest;
  const snowballFirst = simSnowball.order[0]?.months ?? 999;
  const avalancheFirst = simAvalanche.order[0]?.months ?? 999;

  return (
    <>
      <div className="flex max-w-2xl flex-col zafi-stagger">
        {active.length === 0 ? (
          <>
            <Note tone="ok" className="mt-3.5">
              <b>No tienes deudas activas.</b> Excelente, sigue así.
            </Note>
            <ListCard className="mt-3">
              <AddRow label="Agregar una deuda" onClick={openNew} />
            </ListCard>
          </>
        ) : (
          <>
            <PlanHero
              label="Debes en total"
              amount={fmt(totalBalance)}
              sub={`Libre de deudas en ${formatMonths(sim.totalMonths)} pagando ${fmt(totalMin + extra)} al mes.`}
              chip={{ text: `${active.length} ${active.length === 1 ? 'deuda' : 'deudas'}`, dot: '#F59E0B' }}
            />

            <section>
              <GroupTitle>Tus deudas</GroupTitle>
              <ListCard>
                {active.map((d) => {
                  const t = DEBT_TYPES[d.type] ?? DEBT_TYPES.credit;
                  const interest = monthlyInterest(d);
                  const rate = Number(d.interest_rate);
                  const isOpen = openId === d.id;
                  const notCovered = rate > 0 && Number(d.min_payment) <= interest;
                  return (
                    <div key={d.id} className={`flex flex-col gap-2.5 py-3 ${ROW_DIVIDER}`}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenId(isOpen ? null : d.id)}
                        className="flex w-full items-center gap-3 text-left transition duration-150 active:scale-[0.98]"
                      >
                        <RowBody
                          tile={<Tile>{t.emoji}</Tile>}
                          name={d.name}
                          help={`${t.label} · ${rate ? `${rate}% anual` : 'sin interés'}${d.due_day ? ` · vence el ${d.due_day}` : ''}`}
                        />
                        <RowAmount>{fmt(Number(d.balance))}</RowAmount>
                      </button>
                      {isOpen && (
                        <div className="flex flex-col gap-2.5">
                          <div className={`grid grid-cols-2 gap-1 rounded-xl px-3 py-2.5 ${SOFT_BG}`}>
                            <span className={`text-[13px] ${TEXT_MUTED}`}>
                              Pago mínimo
                              <b className={`block font-outfit text-[15px] ${TEXT_STRONG}`}>{fmt(Number(d.min_payment))}/mes</b>
                            </span>
                            <span className={`text-[13px] ${TEXT_MUTED}`}>
                              Interés al mes
                              <b className={`block font-outfit text-[15px] ${interest > 0 ? 'text-warning-text dark:text-warning' : TEXT_STRONG}`}>
                                {fmt(Math.round(interest))}
                              </b>
                            </span>
                          </div>
                          {notCovered && (
                            <Note tone="warn" className="">
                              El pago mínimo no cubre los intereses del mes. Esta deuda va a crecer si no pagas más.
                            </Note>
                          )}
                          <div className="flex gap-1.5">
                            <PillButton onClick={() => setSheet({ debt: d, key: Date.now() })}>Editar</PillButton>
                            <PillButton className={PILL_OUTLINE} onClick={() => void markPaid(d)}>Ya la pagué</PillButton>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <AddRow label="Agregar una deuda" onClick={openNew} />
              </ListCard>
            </section>

            <section>
              <GroupTitle>Cómo salir más rápido</GroupTitle>
              <div className={`flex flex-col gap-3.5 px-3.5 py-4 ${CARD}`}>
                <Segmented
                  label="Estrategia"
                  options={[{ value: 'snowball', label: 'Bola de nieve' }, { value: 'avalanche', label: 'Avalancha' }]}
                  value={strategy}
                  onChange={setStrategy}
                />
                <p className={`text-[13.5px] leading-[1.45] ${TEXT_MUTED}`}>{STRATEGY_HELP[strategy]}</p>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel htmlFor="deudas-extra">Pago extra al mes</FieldLabel>
                  <input
                    id="deudas-extra"
                    inputMode="decimal"
                    value={extraInput}
                    onChange={(e) => setExtraInput(e.target.value)}
                    placeholder="Q 0"
                    className={INPUT_48}
                  />
                </div>
                <TwoCells
                  cells={[
                    { label: 'Solo mínimos', value: formatMonths(baseline.totalMonths) },
                    { label: extra > 0 ? `Con ${fmt(extra)} extra` : 'Con tu plan', value: formatMonths(sim.totalMonths), valueClass: GREEN_TEXT },
                  ]}
                />
                {sim.order.length > 0 && (
                  <ol className="flex flex-col gap-2.5" aria-label="Orden de pago">
                    {sim.order.map((o, i) => (
                      <li key={o.name} className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-electric-ghost text-xs font-bold text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft">
                          {i + 1}
                        </span>
                        <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${TEXT_STRONG}`}>{o.name}</span>
                        <span className={`flex-none text-[13px] ${TEXT_MUTED}`}>
                          {o.months >= 360 ? 'más de 30 años' : `en ${formatMonths(o.months)}`}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>

            {sim.warnings.length > 0 && (
              <Note tone="warn">
                {sim.warnings.map((w) => <span key={w} className="block">{w}</span>)}
              </Note>
            )}

            {extra > 0 && (monthsSaved > 0 || interestSaved > 0) && (
              <Note tone="ok">
                Ahorras <b>{fmt(interestSaved)}</b> en intereses
                {monthsSaved > 0 && <> y terminas <b>{monthsSaved} {monthsSaved === 1 ? 'mes' : 'meses'} antes</b></>}.
              </Note>
            )}

            {active.length > 1 && (avalancheSavings > 0 || snowballFirst < avalancheFirst) && (
              <Note tone="info">
                <b>Zafi te recomienda: </b>
                {avalancheSavings > 500 ? (
                  <>
                    Avalancha te ahorra <b>{fmt(avalancheSavings)}</b> en intereses.
                    {snowballFirst < avalancheFirst && (
                      <> Bola de nieve elimina tu primera deuda antes ({formatMonths(snowballFirst)} · Avalancha en {formatMonths(avalancheFirst)}) y eso ayuda a seguir motivado.</>
                    )}
                  </>
                ) : avalancheSavings > 0 ? (
                  <>Las dos estrategias se parecen mucho en tu caso: la diferencia es {fmt(avalancheSavings)} en intereses. Elige la que te motive más.</>
                ) : (
                  <>Bola de nieve te da victorias rápidas: eliminas la deuda más pequeña en {formatMonths(snowballFirst)}.</>
                )}
              </Note>
            )}
          </>
        )}

        {done.length > 0 && (
          <section>
            <GroupTitle>Ya pagadas</GroupTitle>
            <ListCard>
              {done.map((d) => (
                <div key={d.id} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                  <RowBody
                    tile={<Tile>{(DEBT_TYPES[d.type] ?? DEBT_TYPES.credit).emoji}</Tile>}
                    name={d.name}
                    badge={<span className={BADGE_OK}>Pagada</span>}
                    help={fmt(Number(d.balance))}
                  />
                </div>
              ))}
            </ListCard>
          </section>
        )}
      </div>

      <BottomSheet themed open={!!sheet} onClose={() => setSheet(null)} label={sheet?.debt ? 'Editar deuda' : 'Nueva deuda'}>
        {sheet && (
          <DebtSheet
            key={sheet.key}
            debt={sheet.debt}
            onSave={(d) => saveDebt(sheet.debt, d)}
            onDelete={sheet.debt ? () => deleteDebt(sheet.debt!) : undefined}
          />
        )}
      </BottomSheet>

      <UndoToast
        key={paid?.id}
        visible={!!paid}
        title="¡Una deuda menos!"
        subtitle={paid?.name}
        onUndo={() => {
          const d = paid;
          setPaid(null);
          if (d) void setPaidFlag(d, false);
        }}
        onDismiss={dismissPaid}
      />
      <StatusToast message={message} onDone={() => setMessage(null)} />
    </>
  );
}

function DebtSheet({ debt, onSave, onDelete }: {
  debt: Debt | null;
  onSave: (d: Omit<Debt, 'id' | 'household_id' | 'strategy' | 'is_paid' | 'created_at'>) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [f, setF] = useState<DebtDraft>(() => ({
    name: debt?.name ?? '',
    type: debt?.type ?? 'credit',
    balance: debt ? String(debt.balance) : '',
    min_payment: debt ? String(debt.min_payment) : '',
    interest_rate: debt ? String(debt.interest_rate) : '',
    due_day: debt?.due_day ? String(debt.due_day) : '',
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof DebtDraft) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    if (!f.name.trim() || !num(f.balance)) { setError('Escribe el nombre y cuánto debes.'); return; }
    const day = Math.round(num(f.due_day));
    setError('');
    setSaving(true);
    await onSave({
      name: f.name.trim(),
      type: f.type,
      balance: num(f.balance),
      min_payment: num(f.min_payment),
      interest_rate: num(f.interest_rate),
      due_day: day >= 1 && day <= 31 ? day : 1,
    });
    setSaving(false);
  }

  const field = (id: keyof DebtDraft, label: string, placeholder: string, mode: 'decimal' | 'numeric' = 'decimal') => (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <FieldLabel htmlFor={`deuda-${id}`}>{label}</FieldLabel>
      <input id={`deuda-${id}`} inputMode={mode} value={f[id]} onChange={set(id)} placeholder={placeholder} className={INPUT_48} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2 [&>*]:shrink-0">
      <SheetHeader
        emoji={DEBT_TYPES[f.type].emoji}
        title={debt ? 'Editar deuda' : 'Nueva deuda'}
        subtitle="Tarjeta, préstamo o lo que debas"
      />
      <Segmented
        label="Tipo"
        options={(Object.keys(DEBT_TYPES) as DebtType[]).map((v) => ({ value: v, label: DEBT_TYPES[v].label }))}
        value={f.type}
        onChange={(type) => setF((s) => ({ ...s, type }))}
      />
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="deuda-name">Nombre</FieldLabel>
        <input id="deuda-name" value={f.name} onChange={set('name')} placeholder="Ej: Tarjeta Visa, Préstamo del tío" className={INPUT_48} />
      </div>
      <div className="flex gap-3">
        {field('balance', 'Saldo', 'Q 0.00')}
        {field('min_payment', 'Pago mínimo', 'Q 0.00')}
      </div>
      <div className="flex gap-3">
        {field('interest_rate', 'Interés anual', '0 %')}
        {field('due_day', 'Vence el día', '15', 'numeric')}
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void save()} disabled={saving} className={PRIMARY_BUTTON}>
        {saving ? 'Guardando…' : debt ? 'Guardar cambios' : 'Agregar deuda'}
      </button>
      {onDelete && (
        <button type="button" onClick={() => void onDelete()} disabled={saving} className={DANGER_TEXT_BUTTON}>
          Eliminar deuda
        </button>
      )}
    </div>
  );
}
