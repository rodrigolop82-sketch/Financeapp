'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { AppShell } from '@/components/layout/AppShell';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { getUserHousehold } from '@/lib/household';
import { fetchEffectivePlan } from '@/lib/plan-client';
import type { Access, Plan } from '@/lib/plans';
import { localMonth, localToday } from '@/lib/dates';
import { monthRange } from '@/lib/movimientos';
import { longMonth } from '@/lib/como-te-fue';
import { getEmoji } from '@/lib/categories-ui';
import { firstName, isSharedHousehold, type Person } from '@/lib/hogar';
import { refreshHouseholdPeople } from '@/lib/hooks/useHouseholdPeople';
import {
  SPLIT_MODES, balanceHelp, balanceOf, splitLabel, summarizeMonth,
  type HomeTx, type Settlement, type SplitMode,
} from '@/lib/cuentas-claras';
import { PageSkeleton } from '@/components/motion/PageSkeleton';
import {
  BADGE_INFO, BADGE_NEUTRAL, ErrorBox, FieldLabel, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, INPUT_48, LINK_TEXT, ListCard, PageHeader,
  PILL_OUTLINE, PillButton, ROW_DIVIDER, RowBody, Segmented, SheetHeader, Tile,
} from '@/components/layout/Pantalla';
import { DIVIDER, PRIMARY_BUTTON, TEXT_MUTED } from '@/components/movimientos/ui';
import { Note, RowAmount } from '@/components/plan/ui';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { UndoToast } from '@/components/transactions/UndoToast';
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast';
import { PremiumInline } from '@/components/premium/PremiumInline';
import { PremiumSheet } from '@/components/premium/PremiumSheet';
import { openViewOnlySheet } from '@/components/premium/ViewOnlySheet';
import { PersonAvatar, SplitBar, personClass } from '@/components/hogar/PersonUI';
import Link from 'next/link';
import { Chevron } from '@/components/layout/Pantalla';
import { loadPagos } from '@/lib/pagos-data';
import { dueWeekday, pagoStatus, pagosSummary, sortPending, type Pago } from '@/lib/pagos';

interface Cat { id: string; name: string; bucket: string; icon?: string | null }

type Who = 'all' | string;

export default function FamiliaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fmt = useFormatMoney();
  const month = localMonth();

  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [me, setMe] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [plan, setPlan] = useState<Plan>('free');
  const [myAccess, setMyAccess] = useState<Access>('full');
  const [people, setPeople] = useState<Person[]>([]);
  const [mode, setMode] = useState<SplitMode>('pool');
  const [txs, setTxs] = useState<HomeTx[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [settled, setSettled] = useState<Settlement[]>([]);
  const [justSettled, setJustSettled] = useState<{ from: string; to: string; amount: number } | null>(null);
  const [who, setWho] = useState<Who>('all');
  const [splitOpen, setSplitOpen] = useState(false);
  const [inviteKey, setInviteKey] = useState<number | null>(null);
  const [removed, setRemoved] = useState<Person | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [familySheet, setFamilySheet] = useState<string | null>(null);
  const [pagos, setPagos] = useState<Pago[]>([]);
  // Unión de cuentas activa (para deshacerla en 30 días o salir del hogar).
  const [merge, setMerge] = useState<{ id: string; guest_user_id: string; undo_until: string } | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const loadPeople = useCallback(async () => {
    const res = await fetch('/api/household/people', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setPeople(data.people ?? []);
    void refreshHouseholdPeople();
  }, []);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setMe(user.id);

    const [effective, hh] = await Promise.all([fetchEffectivePlan(), getUserHousehold(supabase, user.id)]);
    if (!hh) { router.push('/onboarding'); return; }
    setPlan(effective?.plan ?? 'free');
    setMyAccess(effective?.access ?? 'full');
    setHouseholdId(hh.id);
    setHouseholdName(hh.name ?? '');
    setIsOwner(hh.owner_id === user.id);

    const { from, to } = monthRange(month);
    const [, { data: hhRow }, { data: txData }, { data: catData }, { data: setData }] = await Promise.all([
      loadPeople(),
      supabase.from('households').select('*').eq('id', hh.id).single(),
      supabase
        .from('transactions')
        .select('amount, paid_by, scope, category_id, date')
        .eq('household_id', hh.id)
        .eq('type', 'expense')
        .gte('date', from)
        .lte('date', to),
      supabase.from('budget_categories').select('id, name, bucket, icon').eq('household_id', hh.id),
      supabase.from('settlements').select('from_user, to_user, amount').eq('household_id', hh.id).eq('month', `${month}-01`),
    ]);
    const row = hhRow as { split_mode?: string; family_since?: string | null } | null;
    setMode(row?.split_mode === 'half' || row?.split_mode === 'income' ? row.split_mode : 'pool');
    // Cuentas claras y "Este mes en casa" cuentan desde que son hogar (PR de unir cuentas).
    const since = row?.family_since ? row.family_since.slice(0, 10) : null;
    const list = ((txData ?? []) as (HomeTx & { date: string })[]).filter((t) => !since || t.date >= since);
    setTxs(list);
    setCats((catData ?? []) as Cat[]);
    setSettled((setData ?? []) as Settlement[]);
    setLoading(false);
    loadPagos(supabase, hh.id, month).then(setPagos).catch(() => setPagos([]));
    supabase
      .from('household_merges')
      .select('id, guest_user_id, undo_until')
      .eq('host_household_id', hh.id)
      .is('undone_at', null)
      .order('merged_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => setMerge(!error && data?.[0] ? data[0] : null));
  }, [supabase, router, month, loadPeople]);

  useEffect(() => { void load(); }, [load]);

  async function addByEmail(email: string): Promise<string | null> {
    const res = await fetch('/api/familia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || 'No se pudo agregar. Intenta de nuevo.';
    await loadPeople();
    // Entró en solo ver: se le cuenta al dueño qué cambia con Familiar.
    if (data.access === 'view') setFamilySheet(data.name || email.split('@')[0]);
    return null;
  }

  async function undoMerge() {
    if (!merge) return;
    setUndoing(true);
    const res = await fetch('/api/household/unmerge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mergeId: merge.id }),
    });
    setUndoing(false);
    setUndoOpen(false);
    if (!res.ok) { setMessage({ text: (await res.json().catch(() => ({}))).error || 'No pudimos deshacer la unión.', tone: 'error' }); return; }
    void refreshHouseholdPeople();
    // Quien se fue vuelve a su hogar; quien se queda ve su hogar sin la otra persona.
    if (merge.guest_user_id === me) { window.location.href = '/dashboard'; return; }
    setMerge(null);
    setMessage({ text: 'Deshicimos la unión. Cada quien tiene lo suyo.', tone: 'ok' });
    void load();
  }

  async function removeMember(p: Person) {
    // Si entró uniendo su cuenta, quitarlo es deshacer la unión (se lleva lo suyo).
    if (merge?.guest_user_id === p.id) { setUndoOpen(true); return; }
    const res = await fetch('/api/familia', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, userId: p.id }),
    });
    if (!res.ok) { setMessage({ text: 'No se pudo quitar. Intenta de nuevo.', tone: 'error' }); return; }
    setPeople((list) => list.filter((x) => x.id !== p.id));
    setRemoved(p);
  }

  async function undoRemove() {
    const p = removed;
    setRemoved(null);
    if (!p?.email) return;
    const error = await addByEmail(p.email);
    if (error) setMessage({ text: error, tone: 'error' });
  }
  const dismissRemoved = useCallback(() => setRemoved(null), []);

  async function settle(fromId: string, toId: string, amount: number) {
    const rounded = Math.round(amount * 100) / 100;
    const { error } = await supabase.from('settlements').insert({
      household_id: householdId, month: `${month}-01`, from_user: fromId, to_user: toId, amount: rounded,
    });
    if (error) { setMessage({ text: 'No se pudo registrar. Intenta de nuevo.', tone: 'error' }); return; }
    setSettled((s) => [...s, { from_user: fromId, to_user: toId, amount: rounded }]);
    setJustSettled({ from: fromId, to: toId, amount: rounded });
  }

  async function saveSplit(next: SplitMode, incomes: Record<string, number>) {
    const res = await fetch('/api/household/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: next, incomes }),
    });
    if (!res.ok) { setMessage({ text: 'No se pudo guardar. Intenta de nuevo.', tone: 'error' }); return false; }
    setMode(next);
    setJustSettled(null);
    setPeople((list) => list.map((p) => (incomes[p.id] !== undefined ? { ...p, monthlyIncome: incomes[p.id] } : p)));
    void refreshHouseholdPeople();
    return true;
  }

  if (loading) return <PageSkeleton variant="list" />;

  const owner = people.find((p) => p.owner) ?? null;
  const other = people.find((p) => !p.owner) ?? null;
  const shared = isSharedHousehold(people);
  const readOnly = myAccess === 'view';
  const viewer = people.find((p) => !p.owner && p.access === 'view');
  const fallback = owner?.id ?? me;
  const m = summarizeMonth(txs, fallback);
  const monthName = longMonth(month);
  const canInvite = isOwner && people.length < 2;
  // Con Familiar se invita desde /familia/invitar (link + WhatsApp); si no, la hoja de siempre (solo ver).
  const invite = canInvite && !readOnly
    ? <PillButton onClick={() => (plan === 'family' ? router.push('/familia/invitar') : setInviteKey(Date.now()))}>Invitar</PillButton>
    : undefined;
  const withinUndo = !!merge && new Date(merge.undo_until).getTime() > Date.now();
  const undoDate = merge ? new Date(merge.undo_until).toLocaleDateString('es-GT', { day: 'numeric', month: 'long' }) : '';
  const subtitle = [householdName, `${people.length} ${people.length === 1 ? 'persona' : 'personas'}`].filter(Boolean).join(' · ');

  const catOf = (id: string | null) => cats.find((c) => c.id === id) ?? null;
  const catLabel = (id: string | null) => {
    const c = catOf(id);
    return { emoji: c ? getEmoji(c) : '❔', name: c?.name ?? 'Sin categoría' };
  };

  const pair = shared && owner && other ? [owner, other] : null;
  const ids = who === 'all' ? people.map((p) => p.id) : [who];
  const sumOf = (o: Record<string, number>) => ids.reduce((s, id) => s + (o[id] ?? 0), 0);
  const heroTotal = who === 'all' ? m.total : sumOf(m.paidShared) + sumOf(m.personalBy);
  const balance = pair ? balanceOf(m, mode, pair[0], pair[1], settled) : null;
  const catRows = m.categories
    .map((c) => ({ ...c, mine: sumOf(c.by) }))
    .filter((c) => c.mine > 0)
    .sort((a, b) => b.mine - a.mine);
  const maxCat = catRows[0]?.mine || 1;
  const personOf = (id: string) => people.find((p) => p.id === id) ?? null;
  const memberBadge = (p: Person) =>
    p.owner ? (plan !== 'free' ? 'Paga el plan' : 'Dueño') : p.access === 'view' ? 'Solo ver' : 'Miembro';

  return (
    <AppShell title="Familia" currentPath="/familia" hideMobileBar headerRight={invite}>
      <div className="mx-auto flex max-w-2xl flex-col pb-8 lg:mx-0">
        <PageHeader back={{ href: '/mas', label: 'Más' }} title="Este mes en casa" subtitle={subtitle} right={invite} />
        <p className={`hidden text-sm lg:block ${TEXT_MUTED}`}>{subtitle}</p>

        <div className="mt-3.5 flex flex-col gap-[18px] zafi-stagger">
          {readOnly && (
            <PremiumInline action="Avisarle ›" onClick={openViewOnlySheet}>
              <b>Estás en modo solo ver.</b> Ves el plan y los movimientos del hogar, pero no puedes registrar.
            </PremiumInline>
          )}
          {isOwner && plan !== 'family' && viewer && (
            <PremiumInline action="Ver Familiar ›" onClick={() => setFamilySheet(viewer.name)}>
              <b>{viewer.name} solo puede ver tu plan.</b> Con Familiar también registra y recibe sus avisos.
            </PremiumInline>
          )}

          {pair && (
            <Segmented
              label="De quién"
              options={[{ value: 'all', label: 'Hogar' }, ...pair.map((p) => ({ value: p.id, label: p.name }))]}
              value={who}
              onChange={setWho}
            />
          )}

          <section className={`flex flex-col gap-1.5 ${HERO}`} style={{ ...HERO_STYLE, padding: '22px 22px 20px' }}>
            <span className={`text-[15px] ${HERO_MUTED}`}>
              {who !== 'all' ? `${personOf(who)?.name ?? ''} pagó en ${monthName}` : pair ? `Gastaron en ${monthName}` : `Gastaste en ${monthName}`}
            </span>
            <p className="font-outfit text-[46px] font-extrabold leading-none tracking-[-0.02em]">{fmt(heroTotal)}</p>
            {pair && (
              <p className="text-sm text-[#9FB3CB]">{fmt(sumOf(m.paidShared))} compartido · {fmt(sumOf(m.personalBy))} personal</p>
            )}
            {pair && who === 'all' && m.total > 0 && (
              <>
                <div className="mt-2.5">
                  <SplitBar onHero track="#2A4A6E" parts={pair.map((p) => ({ person: p, value: (m.paidShared[p.id] ?? 0) + (m.personalBy[p.id] ?? 0) }))} />
                </div>
                <div className={`flex justify-between gap-2 text-[13.5px] ${HERO_MUTED}`}>
                  {pair.map((p) => (
                    <span key={p.id} className="flex items-center gap-1.5">
                      <span aria-hidden className={`h-2 w-2 rounded-full ${personClass(p, true)}`} />
                      {p.name}{' '}
                      <b className="font-outfit text-white">
                        {Math.round((((m.paidShared[p.id] ?? 0) + (m.personalBy[p.id] ?? 0)) / m.total) * 100)}%
                      </b>
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          {pair && who === 'all' && (
            balance && !justSettled ? (
              <ListCard>
                <div className="flex items-center gap-3 py-3">
                  <RowBody
                    tile={<Tile>⚖️</Tile>}
                    name={<span className="whitespace-normal [text-wrap:pretty]">{balance.from.name} le pone {fmt(balance.amount)} a {balance.to.name}</span>}
                    help={balanceHelp(mode, balance, fmt(m.shared))}
                  />
                  {!readOnly && <PillButton onClick={() => void settle(balance.from.id, balance.to.id, balance.amount)}>Saldar</PillButton>}
                </div>
              </ListCard>
            ) : justSettled ? (
              <Note tone="ok" className="">
                <b>Cuentas claras.</b> Registramos que {personOf(justSettled.from)?.name} le pasó {fmt(justSettled.amount)} a {personOf(justSettled.to)?.name}.
              </Note>
            ) : mode === 'pool' ? (
              <Note tone="info" className="">
                <b>Bolsa común:</b> todo sale de lo mismo, así que no llevamos cuentas entre ustedes.
              </Note>
            ) : mode === 'income' && pair.some((p) => !(Number(p.monthlyIncome) > 0)) ? (
              <Note tone="info" className="">
                <b>Falta un ingreso.</b> Para repartir según lo que gana cada uno, agrega los ingresos en “Cómo reparten”.
              </Note>
            ) : (
              <Note tone="ok" className=""><b>Están a mano.</b> Este mes nadie le debe al otro.</Note>
            )
          )}

          <section>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
              <GroupTitle className="">En qué se va</GroupTitle>
              {pair && who === 'all' && !readOnly && (
                <button type="button" onClick={() => setSplitOpen(true)} className={`text-[13px] font-semibold ${LINK_TEXT}`}>Cómo reparten ›</button>
              )}
            </div>
            {catRows.length > 0 ? (
              <ListCard>
                {catRows.map((c) => {
                  const l = catLabel(c.categoryId);
                  const help = !pair
                    ? undefined
                    : who === 'all'
                      ? pair.filter((p) => c.by[p.id]).map((p) => `${p.name} ${Math.round(((c.by[p.id] ?? 0) / c.mine) * 100)}%`).join(' · ')
                      : `${Math.round((c.mine / (m.paidShared[who] || 1)) * 100)}% de lo que pagó ${personOf(who)?.name ?? ''}`;
                  return (
                    <div key={c.categoryId ?? 'none'} className={`flex flex-col gap-2 py-3 ${ROW_DIVIDER}`}>
                      <span className="flex items-center gap-3">
                        <RowBody tile={<Tile>{l.emoji}</Tile>} name={l.name} help={help} />
                        <RowAmount>{fmt(c.mine)}</RowAmount>
                      </span>
                      <div style={{ width: `${(c.mine / maxCat) * 100}%` }}>
                        <SplitBar height={6} parts={(pair ?? people).filter((p) => ids.includes(p.id)).map((p) => ({ person: p, value: c.by[p.id] ?? 0 }))} />
                      </div>
                    </div>
                  );
                })}
              </ListCard>
            ) : (
              <p className={`px-1 text-sm ${TEXT_MUTED}`}>Todavía no hay gastos este mes.</p>
            )}
          </section>

          {pair && (
            <section>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
                <GroupTitle className="">Personal</GroupTitle>
                <span className={`text-[13px] ${TEXT_MUTED}`}>no entra en la cuenta</span>
              </div>
              <ListCard>
                {pair.filter((p) => ids.includes(p.id)).map((p) => {
                  const list = m.personalCats[p.id] ?? [];
                  return (
                    <div key={p.id} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                      <RowBody
                        tile={<PersonAvatar person={p} />}
                        name={p.name}
                        help={list.length ? list.slice(0, 3).map((x) => { const l = catLabel(x.categoryId); return `${l.emoji} ${l.name} ${fmt(x.total)}`; }).join(' · ') : 'Nada personal este mes'}
                      />
                      <RowAmount>{fmt(m.personalBy[p.id] ?? 0)}</RowAmount>
                    </div>
                  );
                })}
              </ListCard>
            </section>
          )}

          <section>
            <GroupTitle className="mb-1.5">Pagos del mes</GroupTitle>
            <ListCard>
              <Link href="/plan/pagos" className="flex items-center gap-3 py-3 no-underline">
                {(() => {
                  const s = pagosSummary(pagos);
                  const next = sortPending(pagos, localToday())[0];
                  const who = next?.responsibleId ? personOf(next.responsibleId)?.name : null;
                  return (
                    <RowBody
                      tile={<Tile>🔔</Tile>}
                      name={s.total ? `${s.paid} de ${s.total} pagados` : 'Agrega sus pagos fijos'}
                      help={next
                        ? [(pagoStatus(next, localToday()).status === 'late' ? 'Atrasado: ' : 'Próximo: ') + next.name, who, dueWeekday(next, localToday())].filter(Boolean).join(' · ')
                        : s.total ? 'Todo pagado este mes' : 'Renta, luz, colegio… con quién se encarga'}
                    />
                  );
                })()}
                <Chevron />
              </Link>
            </ListCard>
          </section>

          <section>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
              <GroupTitle className="">Miembros</GroupTitle>
            </div>
            <ListCard>
              {people.map((p) => (
                <div key={p.id} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                  <RowBody
                    tile={<PersonAvatar person={p} />}
                    name={p.fullName}
                    badge={<span className={p.owner ? BADGE_INFO : BADGE_NEUTRAL}>{memberBadge(p)}</span>}
                    help={Number(p.monthlyIncome) > 0 ? `Ingreso ${fmt(Number(p.monthlyIncome))} al mes` : p.email ?? undefined}
                  />
                  {isOwner && !p.owner && (
                    <PillButton className={PILL_OUTLINE} onClick={() => void removeMember(p)}>Quitar</PillButton>
                  )}
                </div>
              ))}
            </ListCard>
            {merge && !readOnly && (withinUndo || merge.guest_user_id === me) && (
              <button type="button" onClick={() => setUndoOpen(true)} className={`mx-1 mt-2 flex h-11 items-center text-[15px] font-semibold ${LINK_TEXT}`}>
                {withinUndo ? `Deshacer la unión · hasta el ${undoDate}` : 'Salir del hogar'}
              </button>
            )}
            {people.length < 2 && (
              <p className={`mx-1 mt-2 text-sm ${TEXT_MUTED}`}>
                {isOwner ? 'Invita a tu pareja para llevar las cuentas de la casa entre los dos.' : 'No hay otros miembros en este hogar.'}
              </p>
            )}
          </section>
        </div>
      </div>

      {pair && (
        <SplitSheet
          open={splitOpen}
          onClose={() => setSplitOpen(false)}
          value={mode}
          people={pair}
          onSave={saveSplit}
        />
      )}

      <BottomSheet themed open={inviteKey !== null} onClose={() => setInviteKey(null)} label="Invitar a tu hogar">
        {inviteKey !== null && (
          <InviteSheet
            key={inviteKey}
            householdId={householdId}
            onAdd={async (email) => {
              const error = await addByEmail(email);
              if (!error) {
                setInviteKey(null);
                setMessage({ text: 'Agregamos a tu hogar a ' + email, tone: 'ok' });
              }
              return error;
            }}
          />
        )}
      </BottomSheet>

      <UndoToast
        key={removed?.id}
        visible={!!removed}
        title={`Quitamos a ${removed?.name ?? ''}`}
        subtitle="Ya no ve el plan del hogar"
        onUndo={() => void undoRemove()}
        onDismiss={dismissRemoved}
      />
      <StatusToast message={message} onDone={() => setMessage(null)} />
      <BottomSheet themed open={undoOpen} onClose={() => setUndoOpen(false)} label="Deshacer la unión">
        {undoOpen && (
          <div className="flex flex-col gap-3.5 px-5 pb-[calc(26px+env(safe-area-inset-bottom))] pt-2">
            <SheetHeader
              emoji="↩️"
              title={withinUndo ? '¿Deshacer la unión?' : '¿Salir del hogar?'}
              subtitle={withinUndo ? 'Cada quien se lleva lo suyo.' : 'Te llevas lo que pagaste tú, tus metas y tus deudas.'}
            />
            <p className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>
              {withinUndo
                ? 'Lo que trajo cada uno vuelve a su cuenta, y lo nuevo se reparte según quién lo pagó. No se borra nada.'
                : 'Lo que registraste desde que se unieron se va contigo según quién lo pagó. No se borra nada.'}
            </p>
            <button type="button" onClick={() => void undoMerge()} disabled={undoing} className={PRIMARY_BUTTON}>
              {undoing ? 'Deshaciendo…' : withinUndo ? 'Sí, deshacer' : 'Sí, salir'}
            </button>
            <button type="button" onClick={() => setUndoOpen(false)} className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}>Cancelar</button>
          </div>
        )}
      </BottomSheet>
      <PremiumSheet reason="familia" open={familySheet !== null} onClose={() => setFamilySheet(null)} memberName={familySheet} family />
    </AppShell>
  );
}

function SplitSheet({ open, onClose, value, people, onSave }: {
  open: boolean;
  onClose: () => void;
  value: SplitMode;
  people: Person[];
  onSave: (mode: SplitMode, incomes: Record<string, number>) => Promise<boolean>;
}) {
  const [v, setV] = useState<SplitMode>(value);
  const [incomes, setIncomes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setV(value);
    setError('');
    setIncomes(Object.fromEntries(people.map((p) => [p.id, Number(p.monthlyIncome) > 0 ? String(p.monthlyIncome) : ''])));
  }, [open, value, people]);

  const [a, b] = people;
  const preview = people.map((p) => ({ ...p, monthlyIncome: Number(incomes[p.id]) || null }));

  async function save() {
    const parsed: Record<string, number> = {};
    if (v === 'income') {
      for (const p of people) {
        const n = Number(incomes[p.id]);
        if (!(n > 0)) { setError(`Falta el ingreso de ${firstName(p.name)}.`); return; }
        parsed[p.id] = n;
      }
    }
    setBusy(true);
    const ok = await onSave(v, parsed);
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} label="Cómo reparten" themed>
      <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pb-[calc(26px+env(safe-area-inset-bottom))] pt-2 [&>*]:shrink-0">
        <SheetHeader emoji="⚖️" title="¿Cómo reparten lo compartido?" subtitle="Lo personal nunca entra en la cuenta." />
        {SPLIT_MODES.map((k) => {
          const l = splitLabel(k);
          const on = v === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setV(k)}
              aria-pressed={on}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition duration-150 active:scale-[0.98] ${
                on ? 'border-2 border-electric bg-electric-ghost dark:bg-[#1B2B4D]' : 'border border-[var(--zafi-border)] bg-[var(--zafi-card)]'
              }`}
            >
              <RowBody tile={<Tile>{l.emoji}</Tile>} name={l.title} help={l.help(preview[0], preview[1])} />
            </button>
          );
        })}
        {v === 'income' && a && b && (
          <div className={`flex flex-col gap-3 border-t pt-3.5 ${DIVIDER}`}>
            {people.map((p) => (
              <div key={p.id} className="flex flex-col gap-1.5">
                <FieldLabel htmlFor={`ingreso-${p.id}`}>Ingreso de {p.name} al mes</FieldLabel>
                <input
                  id={`ingreso-${p.id}`}
                  inputMode="decimal"
                  value={incomes[p.id] ?? ''}
                  onChange={(e) => setIncomes((s) => ({ ...s, [p.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                  placeholder="0"
                  className={`${INPUT_48} font-outfit`}
                />
              </div>
            ))}
            <p className={`text-[13px] ${TEXT_MUTED}`}>Solo lo ven ustedes dos.</p>
          </div>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
        <button type="button" onClick={() => void save()} disabled={busy} className={PRIMARY_BUTTON}>
          {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </BottomSheet>
  );
}

function InviteSheet({ householdId, onAdd }: { householdId: string; onAdd: (email: string) => Promise<string | null> }) {
  const [link, setLink] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function createLink() {
    setGenerating(true);
    setError('');
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId }),
    });
    if (res.ok) {
      const data = await res.json();
      setLink(`${window.location.origin}/invite/${data.invite.invite_code}`);
    } else {
      setError('No se pudo crear el link. Intenta de nuevo.');
    }
    setGenerating(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar. Mantén presionado el link para copiarlo.');
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Únete a mi hogar en Zafi',
          text: 'Te invito a compartir el presupuesto familiar en Zafi',
          url: link,
        });
      } catch {
        // La persona cerró el menú de compartir.
      }
    } else {
      void copyLink();
    }
  }

  async function add() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Revisa el correo.'); return; }
    setAdding(true);
    setError('');
    const err = await onAdd(email.trim());
    if (err) setError(err);
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2 [&>*]:shrink-0">
      <SheetHeader emoji="👪" title="Invitar a tu hogar" subtitle="Comparte el presupuesto con tu pareja o familia" />

      {!link ? (
        <button type="button" onClick={() => void createLink()} disabled={generating} className={PRIMARY_BUTTON}>
          {generating ? 'Creando link…' : 'Crear link de invitación'}
        </button>
      ) : (
        <>
          <input
            readOnly
            value={link}
            aria-label="Link de invitación"
            onFocus={(e) => e.currentTarget.select()}
            className={`${INPUT_48} !text-[var(--zafi-text-secondary)]`}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => void copyLink()} className="btn-outline flex-1">{copied ? 'Copiado' : 'Copiar'}</button>
            <button type="button" onClick={() => void shareLink()} className="btn-primary flex-1">Compartir</button>
          </div>
          <p className={`text-center text-[13px] ${TEXT_MUTED}`}>El link sirve 7 días.</p>
        </>
      )}

      <div className={`h-px border-t ${DIVIDER}`} />

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="invitar-correo">O agrégala por correo</FieldLabel>
        <input
          id="invitar-correo"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
          placeholder="correo@ejemplo.com"
          className={INPUT_48}
        />
        <span className={`text-[13px] ${TEXT_MUTED}`}>Solo si ya tiene cuenta en Zafi.</span>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void add()} disabled={adding} className="btn-secondary w-full">
        {adding ? 'Agregando…' : 'Agregar'}
      </button>
    </div>
  );
}
