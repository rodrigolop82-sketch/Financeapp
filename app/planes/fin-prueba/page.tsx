'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBox, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, ListCard, PageHeader, RowBody, ROW_DIVIDER, Segmented, Tile } from '@/components/layout/Pantalla';
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { PageSkeleton } from '@/components/motion/PageSkeleton';
import { PremiumCheck } from '@/components/premium/PremiumSheet';
import type { Cycle, Tier } from '@/lib/plans';
import { planPrice } from '@/lib/planes';
import { TRIAL_DAYS, daysText, freeChangesRows, trialEndText, trialProgress, trialUsageRows, type TrialSummary } from '@/lib/trial';

const SECONDARY_BUTTON = `h-[54px] w-full rounded-[14px] border border-[var(--zafi-border)] bg-[var(--zafi-card)] text-base font-semibold transition duration-150 active:scale-[0.96] disabled:opacity-60 ${TEXT_STRONG}`;

export default function FinPruebaPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<TrialSummary | null>(null);
  const [cycle, setCycle] = useState<Cycle>('annual');
  const [busy, setBusy] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/plan/trial-summary', { cache: 'no-store' })
      .then((r) => {
        if (r.status === 401) { router.push('/login'); return null; }
        if (!r.ok) { router.replace('/planes'); return null; }
        return r.json();
      })
      .then((s) => s && setSummary(s))
      .catch(() => router.replace('/planes'));
  }, [router]);

  if (!summary) return <PageSkeleton variant="detail" />;

  const { daysLeft } = trialProgress(summary.trialEndsAt);
  const used = trialUsageRows(summary);
  const changes = freeChangesRows(summary.member?.name ?? null);
  const family = planPrice('family', cycle);
  const premium = planPrice('premium', cycle);
  const pair = !!summary.member;

  async function activate(tier: Tier) {
    setBusy(tier);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, cycle }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) { window.location.href = data.url; return; }
      if (data.changePlan) { router.push('/planes'); return; }
      setError(data.error || 'No pudimos abrir el pago. Intenta de nuevo.');
    } catch {
      setError('No pudimos abrir el pago. Revisa tu conexión.');
    }
    setBusy(null);
  }

  const familyButton = (primary: boolean) => (
    <button key="family" type="button" onClick={() => activate('family')} disabled={!!busy} className={primary ? PRIMARY_BUTTON : SECONDARY_BUTTON}>
      {busy === 'family' ? 'Abriendo el pago…' : `Seguir con Familiar · ${family.amount} ${family.period}`}
    </button>
  );
  const premiumButton = (primary: boolean) => (
    <button key="premium" type="button" onClick={() => activate('premium')} disabled={!!busy} className={primary ? PRIMARY_BUTTON : SECONDARY_BUTTON}>
      {busy === 'premium' ? 'Abriendo el pago…' : primary ? `Seguir con Premium · ${premium.amount} ${premium.period}` : `Solo yo · Premium ${premium.amount}`}
    </button>
  );

  return (
    <AppShell title="Tu prueba" currentPath="/planes" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col pb-8 lg:mx-0">
        <PageHeader back={{ href: '/dashboard', label: 'Inicio' }} title="Tu prueba" />

        <div className="mt-3.5 flex flex-col gap-[18px] zafi-stagger">
          <section className={`flex flex-col gap-1.5 ${HERO}`} style={{ ...HERO_STYLE, padding: '22px 22px 20px' }}>
            <span className={`text-[15px] ${HERO_MUTED}`}>Tu prueba Premium termina en</span>
            <p className="font-outfit text-[46px] font-extrabold leading-none tracking-[-0.02em]">{daysText(daysLeft)}</p>
            <p className="text-sm text-[#9FB3CB]">{trialEndText(summary.trialEndsAt)}</p>
            <div
              className="mt-2.5 h-2 overflow-hidden rounded-[5px] bg-[#2A4A6E]"
              role="progressbar"
              aria-label="Días usados de la prueba"
              aria-valuemin={0}
              aria-valuemax={TRIAL_DAYS}
              aria-valuenow={summary.daysUsed}
            >
              <div className="h-full rounded-[5px] bg-warning" style={{ width: `${(summary.daysUsed / TRIAL_DAYS) * 100}%` }} />
            </div>
          </section>

          {used.length > 0 && (
            <section>
              <GroupTitle className="mb-1.5">En estos {summary.daysUsed} días</GroupTitle>
              <ListCard>
                {used.map(([emoji, name, help]) => (
                  <div key={name} className={`flex items-center gap-3 py-[11px] ${ROW_DIVIDER}`}>
                    <RowBody tile={<Tile>{emoji}</Tile>} name={name} help={help} />
                  </div>
                ))}
              </ListCard>
            </section>
          )}

          <section>
            <GroupTitle className="mb-1.5">Si sigues con Gratis</GroupTitle>
            <ListCard>
              {changes.map(([, name, help]) => (
                <div key={name} className={`flex items-center gap-3 py-[11px] ${ROW_DIVIDER}`}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-[15px] font-semibold ${TEXT_MUTED}`}>{name}</span>
                    {help && <span className={`text-[13px] leading-[1.35] ${TEXT_MUTED}`}>{help}</span>}
                  </span>
                  <PremiumCheck on={false} />
                </div>
              ))}
            </ListCard>
            <p className={`mx-1 mt-1 text-[13px] ${TEXT_MUTED}`}>No se borra nada de lo que {pair ? 'registraron' : 'registraste'}.</p>
          </section>

          <Segmented
            label="Cobro"
            options={[{ value: 'annual', label: 'Anual · ahorra 33%' }, { value: 'monthly', label: 'Mensual' }]}
            value={cycle}
            onChange={setCycle}
          />

          {error && <ErrorBox>{error}</ErrorBox>}

          <div className="flex flex-col gap-1.5">
            {pair ? [familyButton(true), premiumButton(false)] : [premiumButton(true), familyButton(false)]}
            <button type="button" onClick={() => router.push('/dashboard')} className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}>
              Seguir con Gratis
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
