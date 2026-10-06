'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { AppShell } from '@/components/layout/AppShell';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { getUserHousehold } from '@/lib/household';
import { fetchEffectivePlan } from '@/lib/plan-client';
import type { Access, Plan } from '@/lib/plans';
import { PremiumInline } from '@/components/premium/PremiumInline';
import { PremiumSheet } from '@/components/premium/PremiumSheet';
import { openViewOnlySheet } from '@/components/premium/ViewOnlySheet';
import { localMonth } from '@/lib/dates';
import { monthRange } from '@/lib/movimientos';
import { initials } from '@/lib/inicio';
import { PageSkeleton } from '@/components/motion/PageSkeleton';
import {
  BADGE_INFO, BADGE_NEUTRAL, ErrorBox, FieldLabel, GroupTitle, INPUT_48, ListCard, PageHeader,
  PILL_OUTLINE, PillButton, ROW_DIVIDER, SheetHeader,
} from '@/components/layout/Pantalla';
import { CARD } from '@/components/resumen/ctf-ui';
import { DIVIDER, PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { Note, ProgressBar } from '@/components/plan/ui';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { UndoToast } from '@/components/transactions/UndoToast';
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast';

interface Member {
  user_id: string;
  role: string;
  access?: string;
  joined_at: string;
  users: { email: string; full_name: string | null } | null;
}

function memberName(m: Member): string {
  return m.users?.full_name || m.users?.email?.split('@')[0] || 'Usuario';
}

function Avatar({ name, owner, size = 40 }: { name: string; owner: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className={`flex flex-none items-center justify-center rounded-full font-bold ${
        owner ? 'bg-navy text-white dark:bg-electric' : 'bg-electric-ghost text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft'
      }`}
      style={{ width: size, height: size, fontSize: size >= 40 ? 14 : 10 }}
    >
      {initials(name)}
    </span>
  );
}

export default function FamiliaPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fmt = useFormatMoney();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [householdId, setHouseholdId] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [plan, setPlan] = useState<Plan>('free');
  const [myAccess, setMyAccess] = useState<Access>('full');
  const [familySheet, setFamilySheet] = useState<string | null>(null);
  const [spendingByMember, setSpendingByMember] = useState<Record<string, number>>({});
  const [txCountByMember, setTxCountByMember] = useState<Record<string, number>>({});
  const [inviteKey, setInviteKey] = useState<number | null>(null);
  const [removed, setRemoved] = useState<Member | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const loadMembers = useCallback(async (hhId: string) => {
    const res = await fetch(`/api/familia?householdId=${hhId}`);
    if (res.ok) setMembers((await res.json()).members);
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const effective = await fetchEffectivePlan();
      setPlan(effective?.plan ?? 'free');
      setMyAccess(effective?.access ?? 'full');

      const hh = await getUserHousehold(supabase, user.id);
      if (!hh) { router.push('/onboarding'); return; }

      const hhId = hh.id;
      setHouseholdId(hhId);
      setHouseholdName(hh.name ?? '');
      setIsOwner(hh.owner_id === user.id);

      // "Quién gastó este mes": solo los gastos del mes en curso.
      const { from, to } = monthRange(localMonth());
      const [, { data: txData }] = await Promise.all([
        loadMembers(hhId),
        supabase
          .from('transactions')
          .select('paid_by, amount')
          .eq('household_id', hhId)
          .eq('type', 'expense')
          .gte('date', from)
          .lte('date', to),
      ]);

      const byMember: Record<string, number> = {};
      const countByMember: Record<string, number> = {};
      (txData || []).forEach((tx: { paid_by: string | null; amount: number }) => {
        if (!tx.paid_by) return;
        byMember[tx.paid_by] = (byMember[tx.paid_by] || 0) + Number(tx.amount);
        countByMember[tx.paid_by] = (countByMember[tx.paid_by] || 0) + 1;
      });
      setSpendingByMember(byMember);
      setTxCountByMember(countByMember);
      setLoading(false);
    }
    load();
  }, [supabase, router, loadMembers]);

  async function addByEmail(email: string): Promise<string | null> {
    const res = await fetch('/api/familia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || 'No se pudo agregar. Intenta de nuevo.';
    await loadMembers(householdId);
    // Entró en solo ver: se le cuenta al dueño qué cambia con Familiar.
    if (data.access === 'view') setFamilySheet(data.name || email.split('@')[0]);
    return null;
  }

  async function removeMember(member: Member) {
    const res = await fetch('/api/familia', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ householdId, userId: member.user_id }),
    });
    if (!res.ok) { setMessage({ text: 'No se pudo quitar. Intenta de nuevo.', tone: 'error' }); return; }
    setMembers((list) => list.filter((m) => m.user_id !== member.user_id));
    setRemoved(member);
  }

  async function undoRemove() {
    const m = removed;
    setRemoved(null);
    if (!m?.users?.email) return;
    const error = await addByEmail(m.users.email);
    if (error) setMessage({ text: error, tone: 'error' });
  }

  const dismissRemoved = useCallback(() => setRemoved(null), []);

  if (loading) {
    return <PageSkeleton variant="list" />;
  }

  const canInvite = isOwner;
  const viewer = members.find((m) => m.role !== 'owner' && m.access === 'view');
  const viewerName = viewer ? memberName(viewer).split(/\s+/)[0] : null;
  const invite = canInvite ? <PillButton onClick={() => setInviteKey(Date.now())}>Invitar</PillButton> : undefined;
  const subtitle = [householdName, `${members.length} ${members.length === 1 ? 'miembro' : 'miembros'}`].filter(Boolean).join(' · ');
  const totalSpending = Object.values(spendingByMember).reduce((s, v) => s + v, 0);

  const spendRow = (key: string, avatar: React.ReactNode, name: string, amount: number) => {
    const ratio = totalSpending > 0 ? amount / totalSpending : 0;
    return (
      <div key={key} className={`flex flex-col gap-[7px] py-3 border-b ${DIVIDER} last:border-b-0`}>
        <span className="flex items-center gap-2">
          {avatar}
          <span className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{name}</span>
          <span className={`flex-none text-[13px] font-semibold ${TEXT_MUTED}`}>{fmt(amount)} · {Math.round(ratio * 100)}%</span>
        </span>
        <ProgressBar ratio={ratio} />
      </div>
    );
  };

  return (
    <AppShell title="Familia" currentPath="/familia" hideMobileBar headerRight={invite}>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={{ href: '/mas', label: 'Más' }} title="Familia" subtitle={subtitle} right={invite} />
        <p className={`hidden text-sm lg:block ${TEXT_MUTED}`}>{subtitle}</p>

        <div className="flex flex-col zafi-stagger">
          {isOwner && plan !== 'family' && viewer && (
            <PremiumInline className="mt-3.5" action="Ver Familiar ›" onClick={() => setFamilySheet(viewerName)}>
              <b>{viewerName} solo puede ver tu plan.</b> Con Familiar también registra y recibe sus avisos.
            </PremiumInline>
          )}
          {!isOwner && myAccess === 'view' && (
            <div className="mt-3.5 flex items-center gap-3 rounded-2xl bg-electric-ghost px-4 py-3.5 dark:bg-[#1B2B4D]">
              <span aria-hidden className="text-[22px] leading-none">👀</span>
              <span className="flex-1 text-sm leading-[1.45] text-electric-dark dark:text-electric-soft">
                <b>Estás en modo solo ver.</b> Ves el plan y los movimientos del hogar, pero no registras.
              </span>
              <button type="button" onClick={openViewOnlySheet} className="flex-none text-sm font-semibold text-electric-dark dark:text-electric-soft">Avisarle ›</button>
            </div>
          )}

          <section>
            <GroupTitle>Miembros del hogar</GroupTitle>
            {members.length > 0 ? (
              <ListCard>
                {members.map((m) => {
                  const owner = m.role === 'owner';
                  const name = memberName(m);
                  return (
                    <div key={m.user_id} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                      <Avatar name={name} owner={owner} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{name}</span>
                          <span className={owner ? BADGE_INFO : BADGE_NEUTRAL}>{owner ? 'Dueño' : m.access === 'view' ? 'Solo ver' : 'Miembro'}</span>
                        </span>
                        {m.users?.email && <span className={`truncate text-[13px] ${TEXT_MUTED}`}>{m.users.email}</span>}
                      </span>
                      {isOwner && !owner && (
                        <PillButton className={PILL_OUTLINE} onClick={() => void removeMember(m)}>Quitar</PillButton>
                      )}
                    </div>
                  );
                })}
              </ListCard>
            ) : (
              <p className={`px-1 text-sm ${TEXT_MUTED}`}>
                {isOwner ? 'Invita a tu familia para compartir el presupuesto.' : 'No hay otros miembros en este hogar.'}
              </p>
            )}
          </section>

          {members.length > 1 && (
            <Note tone="info">
              {viewer
                ? 'Quien está en solo ver ve el plan y los movimientos del hogar, pero no registra.'
                : 'Los miembros pueden ver el plan, registrar movimientos y ver cómo va el hogar.'}
            </Note>
          )}

          {members.length > 0 && totalSpending > 0 && (
            <section>
              <GroupTitle>Quién gastó este mes</GroupTitle>
              <div className={`px-3.5 py-0.5 ${CARD}`}>
                {members.map((m) => {
                  const name = memberName(m);
                  const count = txCountByMember[m.user_id] || 0;
                  return spendRow(
                    m.user_id,
                    <Avatar name={name} owner={m.role === 'owner'} size={24} />,
                    `${name.split(/\s+/)[0]} · ${count} mov.`,
                    spendingByMember[m.user_id] || 0,
                  );
                })}
              </div>
              <p className={`mx-1 mt-2 flex items-center justify-between text-[13px] ${TEXT_MUTED}`}>
                <span>Total del hogar</span>
                <b className={`font-outfit text-[15px] ${TEXT_STRONG}`}>{fmt(totalSpending)}</b>
              </p>
            </section>
          )}
        </div>
      </div>

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
        key={removed?.user_id}
        visible={!!removed}
        title={`Quitamos a ${removed ? memberName(removed) : ''}`}
        subtitle="Ya no ve el plan del hogar"
        onUndo={() => void undoRemove()}
        onDismiss={dismissRemoved}
      />
      <StatusToast message={message} onDone={() => setMessage(null)} />
      <PremiumSheet reason="familia" open={familySheet !== null} onClose={() => setFamilySheet(null)} memberName={familySheet} family />
    </AppShell>
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
