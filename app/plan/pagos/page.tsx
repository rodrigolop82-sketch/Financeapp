'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { AppShell } from '@/components/layout/AppShell';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { getUserHousehold } from '@/lib/household';
import { fetchEffectivePlan } from '@/lib/plan-client';
import { localToday } from '@/lib/dates';
import { longMonth } from '@/lib/como-te-fue';
import { getEmoji } from '@/lib/categories-ui';
import { cleanAmountInput } from '@/lib/movimientos';
import { isSharedHousehold, type Person } from '@/lib/hogar';
import { loadPagos } from '@/lib/pagos-data';
import { pagoStatus, pagosSummary, shortDay, sortPending, statusBadge, type Pago } from '@/lib/pagos';
import { PageSkeleton } from '@/components/motion/PageSkeleton';
import {
  BADGE, BADGE_OK, BADGE_WARN, DANGER_TEXT_BUTTON, ErrorBox, FieldLabel, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, INPUT_48,
  ListCard, PageHeader, ROW_DIVIDER, RowBody, SheetHeader, Tile,
} from '@/components/layout/Pantalla';
import { DIVIDER, PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { AddRow, RowAmount } from '@/components/plan/ui';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast';
import { Switch } from '@/components/cuenta/AccountUI';
import { PremiumInline } from '@/components/premium/PremiumInline';
import { ANY, PairAvatar, PersonAvatar, PersonPick } from '@/components/hogar/PersonUI';

const BADGE_DANGER = `${BADGE} bg-danger-light text-danger-text dark:bg-[var(--zafi-error-bg)] dark:text-[var(--zafi-error-text)]`;
const BADGE_CLASS = { danger: BADGE_DANGER, warn: BADGE_WARN, ok: BADGE_OK } as const;
const BILL_EMOJIS = ['🏠', '💡', '💧', '📶', '📱', '🎒', '🚗', '🏋️', '🧾', '🩺'];

interface Cat { id: string; name: string; bucket: string; icon?: string | null; archived_at?: string | null }

export default function PagosPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fmt = useFormatMoney();
  const today = localToday();
  const month = today.slice(0, 7);

  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [me, setMe] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [premium, setPremium] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [items, setItems] = useState<Pago[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [open, setOpen] = useState<Pago | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const reload = useCallback(async (hh: string) => {
    setItems(await loadPagos(supabase, hh, month));
  }, [supabase, month]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setMe(user.id);
      const [hh, effective, peopleRes] = await Promise.all([
        getUserHousehold(supabase, user.id),
        fetchEffectivePlan(),
        fetch('/api/household/people', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!hh) { router.push('/onboarding'); return; }
      setHouseholdId(hh.id);
      setPremium(!!effective && effective.plan !== 'free');
      setReadOnly(effective?.access === 'view');
      setPeople(peopleRes?.people ?? []);
      const [, { data: catData }] = await Promise.all([
        reload(hh.id),
        supabase.from('budget_categories').select('id, name, bucket, icon, archived_at').eq('household_id', hh.id),
      ]);
      setCats(((catData ?? []) as Cat[]).filter((c) => !c.archived_at && c.bucket !== 'income'));
      setLoading(false);
    })();
  }, [supabase, router, reload]);

  if (loading) return <PageSkeleton variant="list" />;

  const shared = isSharedHousehold(people);
  const owner = people.find((p) => p.owner) ?? null;
  const personOf = (id: string | null) => (id ? people.find((p) => p.id === id) ?? null : null);
  const pending = sortPending(items, today);
  const done = items.filter((p) => p.paid).sort((a, b) => a.dueDay - b.dueDay);
  const sum = pagosSummary(items);
  const monthName = longMonth(month);
  const whoName = (p: Pago) => (p.responsibleId ? personOf(p.responsibleId)?.name ?? 'Alguien' : shared ? 'cualquiera' : null);

  const avatarFor = (p: Pago) => {
    if (!shared) return null;
    const who = personOf(p.responsibleId ?? (p.kind === 'debt' ? owner?.id ?? null : null));
    return who ? <PersonAvatar person={who} size={28} /> : <PairAvatar people={people.filter((x) => x.access === 'full')} size={28} />;
  };

  return (
    <AppShell title="Pagos del mes" currentPath="/plan" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col pb-8 lg:mx-0">
        <PageHeader back={{ href: '/plan', label: 'Plan' }} title="Pagos del mes" />

        <div className="mt-3.5 flex flex-col gap-[18px] zafi-stagger">
          {!premium && (
            <PremiumInline action="Ver Premium ›" onClick={() => router.push('/planes?from=reminders')}>
              <b>Recordatorios con Premium.</b> Te avisamos antes de que venza cada pago{shared ? ', a quien le toca' : ''}.
            </PremiumInline>
          )}

          <section className={`flex flex-col gap-1.5 ${HERO}`} style={{ ...HERO_STYLE, padding: '22px 22px 20px' }}>
            <span className={`text-[15px] ${HERO_MUTED}`}>Pagos de {monthName}</span>
            <p className="flex flex-wrap items-baseline gap-2">
              <span className="whitespace-nowrap font-outfit text-[46px] font-extrabold leading-none">{sum.paid} de {sum.total}</span>
              <span className="whitespace-nowrap text-base text-[#9FB3CB]">pagados</span>
            </p>
            <p className="text-sm text-[#9FB3CB]">{sum.pending > 0 ? `Faltan ${fmt(sum.pending)}` : sum.total > 0 ? 'Todo pagado este mes' : 'Agrega tus pagos fijos'}</p>
            <div className="mt-2.5 h-2 overflow-hidden rounded-[5px] bg-[#2A4A6E]" role="progressbar" aria-label="Pagos hechos" aria-valuemin={0} aria-valuemax={sum.total} aria-valuenow={sum.paid}>
              <div className="h-full rounded-[5px] bg-success transition-[width] duration-500" style={{ width: `${sum.total ? (sum.paid / sum.total) * 100 : 0}%` }} />
            </div>
          </section>

          <section>
            <GroupTitle className="mb-1.5">Por pagar</GroupTitle>
            <ListCard>
              {pending.map((p) => {
                const badge = statusBadge(p, today);
                const late = pagoStatus(p, today).status === 'late';
                const help = [`${late ? 'Venció' : 'Vence'} el ${p.dueDay}`, whoName(p), p.note].filter(Boolean).join(' · ');
                return (
                  <button key={`${p.kind}-${p.id}`} type="button" onClick={() => setOpen(p)} className={`flex w-full items-center gap-3 py-3 text-left ${ROW_DIVIDER}`}>
                    <RowBody tile={<Tile>{p.emoji}</Tile>} name={p.name} help={help} badge={badge && <span className={BADGE_CLASS[badge.tone]}>{badge.text}</span>} />
                    <span className="flex flex-none items-center gap-2">
                      <RowAmount>{p.approx ? '≈ ' : ''}{fmt(p.amount)}</RowAmount>
                      {avatarFor(p)}
                    </span>
                  </button>
                );
              })}
              {!readOnly && <AddRow label="Agregar pago fijo" onClick={() => setAdding(true)} />}
            </ListCard>
          </section>

          {done.length > 0 && (
            <section>
              <GroupTitle className="mb-1.5">Pagados</GroupTitle>
              <ListCard>
                {done.map((p) => (
                  <button key={`${p.kind}-${p.id}`} type="button" onClick={() => setOpen(p)} className={`flex w-full items-center gap-3 py-3 text-left ${ROW_DIVIDER}`}>
                    <RowBody
                      tile={<Tile>{p.emoji}</Tile>}
                      name={p.name}
                      badge={<span className={BADGE_OK}>Pagado</span>}
                      help={`Pagó ${personOf(p.paid!.by)?.name ?? 'alguien'} el ${shortDay(p.paid!.at)}`}
                    />
                    <RowAmount className={TEXT_MUTED}>{fmt(p.amount)}</RowAmount>
                  </button>
                ))}
              </ListCard>
            </section>
          )}

          <p className={`mx-1 text-[13px] ${TEXT_MUTED}`}>Las tarjetas y préstamos vienen de Deudas con su fecha de pago.</p>
        </div>
      </div>

      <BottomSheet themed open={!!open} onClose={() => setOpen(null)} label="Pago">
        {open && (
          <PagoSheet
            key={`${open.kind}-${open.id}`}
            pago={open}
            people={shared ? people.filter((p) => p.access === 'full') : []}
            me={me}
            premium={premium}
            readOnly={readOnly}
            onClose={() => setOpen(null)}
            onChanged={async (text) => {
              setOpen(null);
              await reload(householdId);
              if (text) setMessage({ text, tone: 'ok' });
            }}
            onError={(text) => setMessage({ text, tone: 'error' })}
          />
        )}
      </BottomSheet>

      <BottomSheet themed open={adding} onClose={() => setAdding(false)} label="Agregar pago fijo">
        {adding && (
          <AddBillSheet
            householdId={householdId}
            cats={cats}
            onDone={async (saved) => {
              setAdding(false);
              if (saved) { await reload(householdId); setMessage({ text: 'Agregamos el pago fijo', tone: 'ok' }); }
            }}
            onError={(text) => setMessage({ text, tone: 'error' })}
          />
        )}
      </BottomSheet>

      <StatusToast message={message} onDone={() => setMessage(null)} />
    </AppShell>
  );
}

function SwitchRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={`flex min-h-[52px] items-center gap-3 border-b py-2 ${DIVIDER} ${disabled ? 'opacity-50' : ''}`}>
      <span className={`flex-1 text-[15px] font-semibold ${TEXT_STRONG}`}>{label}</span>
      <Switch checked={checked} onChange={disabled ? () => {} : onChange} label={label} />
    </div>
  );
}

function PagoSheet({ pago, people, me, premium, readOnly, onClose, onChanged, onError }: {
  pago: Pago;
  people: Person[];
  me: string;
  premium: boolean;
  readOnly: boolean;
  onClose: () => void;
  onChanged: (toast?: string) => void;
  onError: (text: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fmt = useFormatMoney();
  const [who, setWho] = useState<string>(pago.responsibleId ?? (people.length ? ANY : me));
  const [r3, setR3] = useState(pago.remind3d);
  const [r0, setR0] = useState(pago.remind0d);
  const [tell, setTell] = useState(pago.notifyOther);
  const [register, setRegister] = useState(pago.kind === 'debt' || !!pago.categoryId);
  const [busy, setBusy] = useState(false);

  const shared = people.length >= 2;
  const responsible = who === ANY ? null : who;
  const target = responsible ? people.find((p) => p.id === responsible)?.name ?? 'ti' : 'los dos';
  const others = people.filter((p) => p.id !== responsible);
  const otherName = responsible ? others.map((p) => p.name).join(' y ') || 'el otro' : 'los dos';
  const table = pago.kind === 'bill' ? 'recurring_bills' : 'debts';

  async function saveSettings(): Promise<boolean> {
    const { error } = await supabase.from(table).update({
      ...(shared ? { responsible_id: responsible } : {}),
      remind_3d: r3,
      remind_0d: r0,
      notify_other: tell,
    }).eq('id', pago.id);
    if (error) { onError('No se pudo guardar. Intenta de nuevo.'); return false; }
    return true;
  }

  async function markPaid() {
    setBusy(true);
    if (!(await saveSettings())) { setBusy(false); return; }
    const res = await fetch('/api/pagos/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: pago.kind, id: pago.id, paidBy: responsible ?? me, register }),
    });
    setBusy(false);
    if (!res.ok) { onError((await res.json().catch(() => ({}))).error || 'No se pudo marcar como pagado.'); return; }
    onChanged(`${pago.name} · pagado`);
  }

  async function unpay() {
    setBusy(true);
    const res = await fetch('/api/pagos/pay', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: pago.kind, id: pago.id }),
    });
    setBusy(false);
    if (!res.ok) { onError('No se pudo cambiar. Intenta de nuevo.'); return; }
    onChanged();
  }

  async function removeBill() {
    setBusy(true);
    const { error } = await supabase.from('recurring_bills').update({ active: false }).eq('id', pago.id);
    setBusy(false);
    if (error) { onError('No se pudo quitar. Intenta de nuevo.'); return; }
    onChanged('Quitamos el pago fijo');
  }

  const subtitle = `${pago.approx ? '≈ ' : ''}${fmt(pago.amount)} · vence el ${pago.dueDay} de cada mes${pago.source ? ` · de ${pago.source}` : ''}`;

  return (
    <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pb-[calc(26px+env(safe-area-inset-bottom))] pt-2 [&>*]:shrink-0">
      <SheetHeader emoji={pago.emoji} title={pago.name} subtitle={subtitle} />

      {pago.paid ? (
        <>
          <p className={`text-sm ${TEXT_MUTED}`}>
            Pagado el {shortDay(pago.paid.at)}{pago.paid.transactionId ? ' · el gasto quedó en Movimientos' : ''}.
          </p>
          {!readOnly && (
            <button type="button" onClick={() => void unpay()} disabled={busy} className={DANGER_TEXT_BUTTON}>Marcar como no pagado</button>
          )}
          <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>Listo</button>
        </>
      ) : (
        <>
          {shared && !readOnly && (
            <PersonPick label="¿Quién se encarga?" people={people} value={who} onChange={setWho} withAny />
          )}
          <div className="flex flex-col">
            <FieldLabel>{premium ? `Recordarle a ${shared ? target : 'ti'}` : 'Recordatorios (Premium)'}</FieldLabel>
            <SwitchRow label="3 días antes" checked={premium && r3} onChange={setR3} disabled={!premium || readOnly} />
            <SwitchRow label="El día que vence" checked={premium && r0} onChange={setR0} disabled={!premium || readOnly} />
            {shared && <SwitchRow label={`Avisar a ${otherName} cuando se pague`} checked={tell} onChange={setTell} disabled={readOnly} />}
            {(pago.kind === 'debt' || pago.categoryId) && (
              <SwitchRow label="Registrar el gasto al pagar" checked={register} onChange={setRegister} disabled={readOnly} />
            )}
          </div>
          {!readOnly && (
            <>
              <button type="button" onClick={() => void markPaid()} disabled={busy} className={PRIMARY_BUTTON}>
                {busy ? 'Guardando…' : 'Marcar como pagado'}
              </button>
              <button
                type="button"
                onClick={async () => { setBusy(true); const ok = await saveSettings(); setBusy(false); if (ok) onChanged('Guardado'); }}
                disabled={busy}
                className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}
              >
                Guardar
              </button>
              {pago.kind === 'bill' && (
                <button type="button" onClick={() => void removeBill()} disabled={busy} className={DANGER_TEXT_BUTTON}>Quitar pago fijo</button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function AddBillSheet({ householdId, cats, onDone, onError }: {
  householdId: string;
  cats: Cat[];
  onDone: (saved: boolean) => void;
  onError: (text: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🧾');
  const [amount, setAmount] = useState('');
  const [approx, setApprox] = useState(false);
  const [day, setDay] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const d = Number(day);
    if (!name.trim()) { setError('Ponle nombre.'); return; }
    if (!(Number(amount) > 0)) { setError('Falta el monto.'); return; }
    if (!(d >= 1 && d <= 31)) { setError('El día de pago va del 1 al 31.'); return; }
    setBusy(true);
    const { error: err } = await supabase.from('recurring_bills').insert({
      household_id: householdId, name: name.trim(), emoji, amount: Number(amount), approx, due_day: d, category_id: categoryId,
    });
    setBusy(false);
    if (err) { onError('No se pudo guardar. Intenta de nuevo.'); return; }
    onDone(true);
  }

  return (
    <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pb-[calc(26px+env(safe-area-inset-bottom))] pt-2 [&>*]:shrink-0">
      <SheetHeader emoji={emoji} title="Agregar pago fijo" subtitle="Renta, luz, colegio… lo que se paga cada mes." />
      <div role="radiogroup" aria-label="Ícono" className="flex flex-wrap gap-1.5">
        {BILL_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={emoji === e}
            onClick={() => setEmoji(e)}
            className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${emoji === e ? 'border-2 border-electric bg-electric-ghost dark:bg-[#1B2B4D]' : 'border border-[var(--zafi-border)] bg-[var(--zafi-card)]'}`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="pago-nombre">Nombre</FieldLabel>
        <input id="pago-nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ej. Renta apartamento" className={INPUT_48} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="pago-monto">Monto</FieldLabel>
          <input id="pago-monto" inputMode="decimal" value={amount} onChange={(e) => setAmount(cleanAmountInput(e.target.value))} placeholder="0" className={`${INPUT_48} font-outfit`} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="pago-dia">Día de pago</FieldLabel>
          <input id="pago-dia" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="1–31" className={`${INPUT_48} font-outfit`} />
        </div>
      </div>
      <SwitchRow label="El monto cambia cada mes (aproximado)" checked={approx} onChange={setApprox} />
      {cats.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Categoría (para registrar el gasto)</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {cats.slice(0, 12).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                aria-pressed={categoryId === c.id}
                className={`h-9 rounded-full px-3 text-[13.5px] font-semibold ${TEXT_STRONG} ${categoryId === c.id ? 'border-2 border-electric bg-electric-ghost dark:bg-[#1B2B4D]' : 'border border-[var(--zafi-border)] bg-[var(--zafi-card)]'}`}
              >
                {getEmoji(c)} {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void save()} disabled={busy} className={PRIMARY_BUTTON}>{busy ? 'Guardando…' : 'Agregar'}</button>
    </div>
  );
}
