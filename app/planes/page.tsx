'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  BADGE_INFO, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, LINK_TEXT, ListCard, PageHeader, RowBody, ROW_DIVIDER, Segmented, SheetHeader, Tile,
  DANGER_TEXT_BUTTON, ErrorBox, INPUT_48, BADGE_OK,
} from '@/components/layout/Pantalla';
import { PRIMARY_BUTTON, SOFT_BG, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { Note } from '@/components/plan/ui';
import { BottomSheet } from '@/components/transactions/BottomSheet';
import { PageSkeleton } from '@/components/motion/PageSkeleton';
import { PRICES_CENTS, priceLabel, type Cycle, type Plan, type Tier } from '@/lib/plans';
import {
  codePlanText, defaultTier, longDate, planAction, planBenefits, planFrom, planHero, planPrice, tierName, type Subscription,
} from '@/lib/planes';
import {
  codeMismatch, codePriceHelp, discountedCents, discountLabel, freeCodeHelp, isFree, normalizeCode, type PublicCode,
} from '@/lib/descuentos';

interface Status {
  plan: Plan;
  isOwner: boolean;
  trialActive: boolean;
  trialEndsAt: string | null;
  ownerName: string | null;
  household: { name: string; type: string; members: { name: string; owner: boolean; access: string }[] } | null;
  subscription: Subscription | null;
}

export default function PlanesPage() {
  return (
    <Suspense>
      <PlanesContent />
    </Suspense>
  );
}

function PlanCard({ on, onClick, name, tier, cycle, badge, code }: {
  on: boolean; onClick: () => void; name: string; tier: Tier; cycle: Cycle; badge?: string; code?: PublicCode | null;
}) {
  const p = planPrice(tier, cycle);
  // Con un código que aplica a esta tarjeta: el precio tachado y el nuevo.
  const fits = !!code && !codeMismatch(code, tier, cycle);
  const deal = fits ? (isFree(code!) ? 'Gratis' : priceLabel(discountedCents(PRICES_CENTS[tier][cycle], code!.percentOff))) : null;
  const help = !fits ? p.help
    : isFree(code!) ? (code!.durationMonths ? `Por ${code!.durationMonths} ${code!.durationMonths === 1 ? 'mes' : 'meses'}` : 'Sin vencimiento')
    : `${p.period} · ${discountLabel(code!)}`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex min-w-0 flex-col items-start gap-1 rounded-2xl px-3.5 pb-3 pt-3.5 text-left transition duration-150 active:scale-[0.98] ${
        on ? 'border-2 border-electric bg-electric-ghost dark:bg-[#1B2B4D]' : 'border border-[var(--zafi-border)] bg-[var(--zafi-card)]'
      }`}
    >
      <span className="flex flex-wrap items-center gap-1.5">
        <span className={`text-[15px] font-bold ${TEXT_STRONG}`}>{name}</span>
        {badge && <span className={BADGE_INFO}>{badge}</span>}
      </span>
      {deal ? (
        <span className="flex flex-wrap items-baseline gap-1">
          <span className={`whitespace-nowrap font-outfit text-2xl font-extrabold ${TEXT_STRONG}`}>{deal}</span>
          <s className={`text-[13px] ${TEXT_MUTED}`}>{p.amount}</s>
        </span>
      ) : (
        <span className="flex flex-wrap items-baseline gap-1">
          <span className={`whitespace-nowrap font-outfit text-2xl font-extrabold ${TEXT_STRONG}`}>{p.amount}</span>
          <span className={`text-[13px] ${TEXT_MUTED}`}>{p.period}</span>
        </span>
      )}
      <span className={`text-[12.5px] leading-[1.3] ${TEXT_MUTED}`}>{help}</span>
    </button>
  );
}

function PlanesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const from = planFrom(params.get('from'));
  const justPaid = params.get('ok') === '1';

  const [status, setStatus] = useState<Status | null>(null);
  const [cycle, setCycle] = useState<Cycle>('annual');
  const [tier, setTier] = useState<Tier>('premium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  // Código de descuento: lo escrito, el ya revisado y su error.
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState<PublicCode | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [redeemed, setRedeemed] = useState(false);

  const applyCode = useCallback(async (raw: string) => {
    const value = normalizeCode(raw);
    if (!value) return;
    setCodeBusy(true);
    setCodeError(null);
    try {
      const res = await fetch('/api/billing/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.code) {
        const c = data.code as PublicCode;
        setCode(c);
        // Que se vea aplicado: si no sirve para el plan elegido, el primero que sí.
        setTier((t) => (c.tiers.includes(t) ? t : c.tiers[0]));
        if (!isFree(c)) setCycle((x) => (c.cycles.includes(x) ? x : c.cycles[0]));
      } else {
        setCode(null);
        setCodeError(data.error || 'No pudimos revisar el código.');
      }
    } catch {
      setCodeError('No pudimos revisar el código. Revisa tu conexión.');
    }
    setCodeBusy(false);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch('/api/billing/status', { cache: 'no-store' });
    if (res.status === 401) { router.push('/login'); return null; }
    if (!res.ok) return null;
    const s = (await res.json()) as Status;
    setStatus(s);
    return s;
  }, [router]);

  useEffect(() => {
    load().then((s) => {
      if (!s) return;
      const sub = s.subscription;
      setTier(defaultTier({
        householdType: s.household?.type,
        memberCount: s.household?.members.length ?? 1,
        current: sub?.tier ?? null,
        param: params.get('tier'),
      }));
      if (sub?.cycle) setCycle(sub.cycle);
      // /planes?code=AMIGOS50: el código ya puesto y revisado.
      const shared = params.get('code');
      if (shared && s.isOwner) {
        setCodeOpen(true);
        setCodeInput(normalizeCode(shared));
        applyCode(shared);
      }
    });
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al volver del pago, el webhook puede tardar unos segundos.
  useEffect(() => {
    if (!justPaid) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const s = await load();
      if ((s && s.subscription?.status === 'active') || tries >= 10) clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [justPaid, load]);

  if (!status) return <PageSkeleton variant="list" />;

  const sub = status.subscription;
  const hero = planHero(tier);
  const rows = planBenefits(tier, from);
  const action = planAction({
    tier, cycle, isOwner: status.isOwner, ownerName: status.ownerName,
    trialActive: status.trialActive, trialEndsAt: status.trialEndsAt, subscription: sub,
  });
  // Los códigos son solo para la primera compra (no para cambiar de plan).
  const canUseCode = action.kind === 'checkout';
  const activeCode = canUseCode ? code : null;
  const codeIssue = activeCode ? codeMismatch(activeCode, tier, cycle) : null;
  const codeFits = !!activeCode && !codeIssue;
  const freeByCode = codeFits && isFree(activeCode!);
  const actionHelp = !codeFits || action.kind !== 'checkout'
    ? (action.kind === 'checkout' || action.kind === 'change' ? action.help : '')
    : freeByCode
      ? freeCodeHelp(activeCode!)
      : codePriceHelp(activeCode!, PRICES_CENTS[tier][cycle], planPrice(tier, cycle).period);
  const diff = PRICES_CENTS.family[cycle] - PRICES_CENTS.premium[cycle];
  const pastDue = sub?.status === 'past_due';
  const active = sub?.status === 'active' || pastDue;
  const paidConfirmed = justPaid && sub?.status === 'active';

  async function pay() {
    if (action.kind !== 'checkout' && action.kind !== 'change') return;
    setBusy(true);
    setError(null);
    if (freeByCode) {
      try {
        const res = await fetch('/api/billing/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: activeCode!.code, tier }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setRedeemed(true);
          setCode(null);
          setCodeOpen(false);
          await load();
        } else setError(data.error || 'No pudimos activar tu código. Intenta de nuevo.');
      } catch {
        setError('No pudimos activar tu código. Revisa tu conexión.');
      }
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(action.kind === 'change' ? '/api/billing/change-plan' : '/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, cycle, ...(codeFits ? { code: activeCode!.code } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) { window.location.href = data.url; return; }
      const message = data.error || 'No pudimos abrir el pago. Intenta de nuevo.';
      setError(data.detail ? `${message} (${data.detail})` : message);
    } catch {
      setError('No pudimos abrir el pago. Revisa tu conexión.');
    }
    setBusy(false);
  }

  async function updateCard() {
    setBusy(true);
    const res = await fetch('/api/billing/update-card');
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (data.url) { window.location.href = data.url; return; }
    window.location.href = `mailto:hola@zafiapp.com?subject=${encodeURIComponent('Cambiar mi tarjeta')}`;
  }

  async function cancel(undo = false) {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/billing/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ undo }),
    });
    setBusy(false);
    setCancelOpen(false);
    if (!res.ok) { setError('No pudimos cambiar tu plan. Intenta de nuevo.'); return; }
    await load();
  }

  return (
    <AppShell title="Planes" currentPath="/planes" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col pb-8 lg:mx-0">
        <PageHeader back={{ href: '/mas', label: 'Más' }} title="Planes" />

        <div className="mt-3.5 flex flex-col gap-[18px] zafi-stagger">
          {justPaid && (
            <Note tone={paidConfirmed ? 'ok' : 'info'} className="">
              {paidConfirmed
                ? <><b>Listo, tu plan {tierName(sub!.tier ?? 'premium')} está activo.</b> Gracias por apoyar a Zafi.</>
                : <>Estamos confirmando tu pago con Recurrente. Esto tarda unos segundos.</>}
            </Note>
          )}

          {redeemed && sub?.viaCode && (
            <Note tone="ok" className="">
              <b>Listo, tu plan {tierName(sub.tier ?? 'premium')} está activo.</b> {codePlanText(sub.currentPeriodEnd)}.
            </Note>
          )}

          {pastDue && status.isOwner && (
            <div role="alert" className="flex items-center gap-3 rounded-2xl bg-danger-light px-4 py-3.5 dark:bg-[var(--zafi-error-bg)]">
              <span aria-hidden className="text-[22px] leading-none">💳</span>
              <span className="flex-1 text-sm text-danger-text dark:text-[var(--zafi-error-text)]">
                <b>No pudimos cobrar tu plan.</b> Lo intentaremos de nuevo; mientras, sigues con todo.
              </span>
              <button type="button" onClick={updateCard} disabled={busy} className="flex-none text-sm font-semibold text-danger-text dark:text-[var(--zafi-error-text)]">
                Cambiar tarjeta ›
              </button>
            </div>
          )}

          <section className={`flex flex-col gap-2 ${HERO}`} style={{ ...HERO_STYLE, padding: '22px 22px 20px' }}>
            <span className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.12em] text-electric-soft">
              👑 {hero.eyebrow}
            </span>
            <h2 className="font-serif text-[28px] leading-[1.15]">{hero.title}</h2>
            <p className={`text-[14.5px] leading-[1.45] [text-wrap:pretty] ${HERO_MUTED}`}>{hero.text}</p>
          </section>

          {status.isOwner && !freeByCode && (
            <Segmented
              label="Cobro"
              options={[{ value: 'annual', label: 'Anual · ahorra 33%' }, { value: 'monthly', label: 'Mensual' }]}
              value={cycle}
              onChange={setCycle}
            />
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <PlanCard on={tier === 'premium'} onClick={() => setTier('premium')} name="Premium" tier="premium" cycle={cycle} code={activeCode} />
            <PlanCard on={tier === 'family'} onClick={() => setTier('family')} name="Familiar" badge="Para 2" tier="family" cycle={cycle} code={activeCode} />
          </div>

          <section>
            <GroupTitle className="mb-1.5">{tier === 'family' ? 'Familiar incluye' : 'Premium incluye'}</GroupTitle>
            <ListCard>
              {rows.map(([emoji, name, help]) => (
                <div key={name} className={`flex items-center gap-3 py-[11px] ${ROW_DIVIDER}`}>
                  <RowBody tile={<Tile>{emoji}</Tile>} name={name} help={help} />
                </div>
              ))}
            </ListCard>
          </section>

          {tier === 'premium' && !freeByCode && (
            <button type="button" onClick={() => setTier('family')} className={`self-center px-2 py-1.5 text-sm font-semibold ${LINK_TEXT}`}>
              ¿Lo usan dos? Familiar es $ {Math.round(diff / 100)} más {cycle === 'annual' ? 'al año' : 'al mes'} ›
            </button>
          )}

          <div className={`rounded-2xl border border-[var(--zafi-border)] px-4 py-3.5 text-sm leading-[1.45] ${SOFT_BG} ${TEXT_MUTED}`}>
            <b className={TEXT_STRONG}>Siempre gratis:</b> registrar, Plan del mes, Metas, Deudas, Salud financiera y Cerrar el mes.
          </div>

          {canUseCode && status.isOwner && (
            activeCode ? (
              <div className={`flex flex-col gap-1 rounded-2xl border border-[var(--zafi-border)] px-4 py-3 ${SOFT_BG}`}>
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className="text-[20px] leading-none">🎟️</span>
                  <span className={`flex-1 text-sm ${TEXT_STRONG}`}>
                    <b>{activeCode.code}</b> · {discountLabel(activeCode)}
                  </span>
                  {codeFits && <span className={BADGE_OK}>Aplicado</span>}
                  <button
                    type="button"
                    onClick={() => { setCode(null); setCodeInput(''); }}
                    className={`text-sm font-semibold ${LINK_TEXT}`}
                  >
                    Quitar
                  </button>
                </div>
                {codeIssue && <p className="text-[13px] text-warning-text dark:text-warning">{codeIssue}.</p>}
              </div>
            ) : codeOpen ? (
              <form
                className="flex flex-col gap-1.5"
                onSubmit={(e) => { e.preventDefault(); applyCode(codeInput); }}
              >
                <div className="flex gap-2">
                  <input
                    aria-label="Código de descuento"
                    placeholder="Escribe tu código"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={32}
                    className={`${INPUT_48} uppercase`}
                  />
                  <button
                    type="submit"
                    disabled={codeBusy || !normalizeCode(codeInput)}
                    className={`h-12 flex-none rounded-[14px] px-4 text-[15px] font-semibold disabled:opacity-50 ${SOFT_BG} ${TEXT_STRONG}`}
                  >
                    {codeBusy ? 'Revisando…' : 'Aplicar'}
                  </button>
                </div>
                {codeError && <p className="text-[13px] text-danger-text dark:text-[var(--zafi-error-text)]">{codeError}</p>}
              </form>
            ) : (
              <button type="button" onClick={() => setCodeOpen(true)} className={`self-center px-2 py-1.5 text-sm font-semibold ${LINK_TEXT}`}>
                ¿Tienes un código de descuento?
              </button>
            )
          )}

          {error && <ErrorBox>{error}</ErrorBox>}

          <div className="flex flex-col gap-2">
            {action.kind === 'member' && (
              <Note tone="info" className="">
                <b>{action.text}.</b> Tienes todo lo de {tierName(status.plan === 'family' ? 'family' : 'premium')} mientras su plan esté activo.
              </Note>
            )}
            {action.kind === 'current' && (
              <>
                <p className={`rounded-[14px] py-4 text-center text-[15px] font-semibold ${SOFT_BG} ${TEXT_STRONG}`}>✓ {action.text}</p>
                {sub?.viaCode ? null : sub?.cancelAtPeriodEnd ? (
                  <button type="button" onClick={() => cancel(true)} disabled={busy} className={`h-11 text-[15px] font-semibold ${LINK_TEXT}`}>
                    Seguir con mi plan
                  </button>
                ) : (
                  <button type="button" onClick={() => setCancelOpen(true)} className={DANGER_TEXT_BUTTON}>
                    Cancelar plan
                  </button>
                )}
              </>
            )}
            {(action.kind === 'checkout' || action.kind === 'change') && (
              <>
                <button type="button" onClick={pay} disabled={busy} className={PRIMARY_BUTTON}>
                  {busy
                    ? (freeByCode ? 'Activando…' : 'Abriendo el pago…')
                    : freeByCode ? `Activar ${tierName(tier)} gratis` : action.label}
                </button>
                <p className={`text-center text-[13px] ${TEXT_MUTED}`}>{actionHelp}</p>
              </>
            )}
          </div>
        </div>
      </div>

      <BottomSheet open={cancelOpen} onClose={() => setCancelOpen(false)} label="Cancelar plan" themed>
        <div className="flex flex-col gap-4 px-5 pb-[calc(26px+env(safe-area-inset-bottom))] pt-2">
          <SheetHeader
            emoji="👑"
            title="¿Cancelar tu plan?"
            subtitle={active && sub?.currentPeriodEnd ? `Sigue hasta el ${longDate(sub.currentPeriodEnd)} y ya no se renueva.` : undefined}
          />
          <p className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>
            Después pasas a Gratis. No se borra nada: tus movimientos, metas y plan del mes siguen guardados.
            {sub?.tier === 'family' && ' Tu pareja pasa a solo ver.'}
          </p>
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => setCancelOpen(false)} className={PRIMARY_BUTTON}>Seguir con mi plan</button>
            <button type="button" onClick={() => cancel(false)} disabled={busy} className={DANGER_TEXT_BUTTON}>Sí, cancelar</button>
          </div>
        </div>
      </BottomSheet>
    </AppShell>
  );
}
