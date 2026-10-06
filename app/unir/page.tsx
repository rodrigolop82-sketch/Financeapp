'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useFormatMoney } from '@/lib/hooks/useFormatMoney';
import { refreshEffectivePlan } from '@/lib/hooks/useEffectivePlan';
import { refreshHouseholdPeople } from '@/lib/hooks/useHouseholdPeople';
import { priceLabel } from '@/lib/plans';
import { rowValue, type BudgetPick, type PlanRow } from '@/lib/unir';
import { PageSkeleton } from '@/components/motion/PageSkeleton';
import {
  BADGE_INFO, ErrorBox, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, ListCard, ROW_DIVIDER, RowBody, Segmented, Tile,
} from '@/components/layout/Pantalla';
import { PRIMARY_BUTTON, SHEET_TITLE, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { Note, RowAmount } from '@/components/plan/ui';

interface Preview {
  host: { id: string; name: string; ownerName: string; family: boolean; seat: boolean; isOwner: boolean; isMember: boolean };
  guestName: string;
  hasData: boolean;
  counts: { transactions: number; months: string; goals: string[]; debts: string[] };
  plan: PlanRow[];
  duplicates: { guestId: string; hostId: string; name: string; amount: number; date: string }[];
  goals: { id: string; name: string; emoji: string | null; amount: number; similar: { id: string; name: string; amount: number } | null }[];
  debts: { id: string; name: string; dueDay: number | null }[];
  refundCents: number;
  month: string;
}

const STEPS = ['Tu cuenta', 'Plan del mes', 'Repetidos y metas', 'Listo'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function today() {
  const d = new Date();
  return { long: `${WEEKDAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`, short: `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`, month: MONTHS[d.getMonth()] };
}

function shortDate(iso: string) {
  return `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)}`;
}

export default function UnirPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <Unir />
    </Suspense>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={`h-1 flex-1 rounded transition-colors duration-300 ${i <= step ? 'bg-electric' : 'bg-[var(--zafi-border)]'}`} />
        ))}
      </div>
      <span className={`text-[13px] ${TEXT_MUTED}`}>Paso {step + 1} de 4 · <b className={TEXT_STRONG}>{STEPS[step]}</b></span>
    </div>
  );
}

function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} aria-pressed={on} onClick={onClick} className="flex h-11 w-11 flex-none items-center justify-center">
      <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-[13px] font-extrabold text-white ${on ? 'bg-electric' : 'border-[1.5px] border-[var(--zafi-border)] bg-[var(--zafi-card)]'}`}>
        {on ? '✓' : ''}
      </span>
    </button>
  );
}

function Unir() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get('code') ?? '';
  const fmt = useFormatMoney();
  const t = useMemo(today, []);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<Record<string, BudgetPick>>({});
  const [dups, setDups] = useState<Record<string, boolean>>({});
  const [goals, setGoals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ duplicates: number; mergedGoal: boolean; refundCents: number } | null>(null);

  useEffect(() => {
    if (!code) { setError('Falta el código de la invitación.'); return; }
    fetch(`/api/household/merge-preview?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) { router.push(`/login?invite=${encodeURIComponent(code)}`); return; }
        const data = await r.json();
        if (!r.ok) { setError(data.error || 'Esta invitación ya no sirve.'); return; }
        const p = data as Preview;
        setPreview(p);
        setPicks(Object.fromEntries(p.plan.filter((r) => r.guestId && r.hostId).map((r) => [r.guestId!, r.pick])));
        setDups(Object.fromEntries(p.duplicates.map((d) => [d.guestId, true])));
        setGoals(Object.fromEntries(p.goals.map((g) => [g.id, g.similar ? `merge:${g.similar.id}` : 'shared'])));
      })
      .catch(() => setError('No pudimos cargar la invitación. Revisa tu conexión.'));
  }, [code, router]);

  if (error) {
    return (
      <AppShell title="Unir cuentas" currentPath="/familia" hideMobileBar>
        <div className="mx-auto flex max-w-2xl flex-col gap-3 pt-6 lg:mx-0">
          <ErrorBox>{error}</ErrorBox>
          <Link href="/dashboard" className={`flex items-center justify-center ${PRIMARY_BUTTON}`}>Ir a Inicio</Link>
        </div>
      </AppShell>
    );
  }
  if (!preview) return <PageSkeleton variant="detail" />;

  const host = preview.host;
  const owner = host.ownerName;
  const me = preview.guestName;
  const blocked = host.isOwner ? 'own' : host.isMember ? 'member' : !host.family && preview.hasData ? 'host_not_family' : !host.seat ? 'no_seat' : null;
  const planTotal = preview.plan.reduce((s, r) => s + rowValue(r, r.guestId ? picks[r.guestId] ?? r.pick : r.pick), 0);
  const separate = preview.plan.reduce((s, r) => s + r.host + r.guest, 0);
  const nDup = Object.values(dups).filter(Boolean).length;

  async function merge() {
    setBusy(true);
    setError(null);
    const choices = {
      budget: picks,
      duplicates: Object.entries(dups).filter(([, on]) => on).map(([id]) => id),
      goals,
    };
    const res = await fetch('/api/household/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, choices }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || 'No pudimos unir las cuentas. Intenta de nuevo.'); return; }
    setResult({
      duplicates: Number(data.duplicates) || 0,
      mergedGoal: Object.values(goals).some((g) => g.startsWith('merge:')),
      refundCents: Number(data.refundCents) || 0,
    });
    void refreshEffectivePlan();
    void refreshHouseholdPeople();
    setStep(3);
  }

  function next() {
    // Sin datos que juntar, directo a unir.
    if (step === 0 && !preview!.hasData) { void merge(); return; }
    if (step === 1 && preview!.duplicates.length === 0 && preview!.goals.length === 0 && preview!.debts.length === 0) { void merge(); return; }
    setStep((s) => Math.min(2, s + 1));
  }

  const hero = (title: string, sub: string) => (
    <section className={`flex flex-col gap-1.5 ${HERO}`} style={{ ...HERO_STYLE, padding: '22px 22px 20px' }}>
      <span className={`flex items-center gap-2.5 text-[15px] ${HERO_MUTED}`}>
        <span aria-hidden className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/[0.12] text-lg">👪</span>
        {host.name}
      </span>
      <h2 className="mt-1 font-serif text-[28px] leading-[1.15]">{title}</h2>
      <p className={`text-[14.5px] leading-[1.45] ${HERO_MUTED}`}>{sub}</p>
    </section>
  );

  return (
    <AppShell title="Unir cuentas" currentPath="/familia" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col gap-[18px] pb-8 pt-[calc(12px+env(safe-area-inset-top))] lg:mx-0 lg:pt-0 zafi-stagger">
        <Stepper step={step} />

        {step === 0 && (
          <>
            {hero(`${owner} te invitó a su hogar`, host.family ? `Premium Familiar · lo paga ${owner}` : `${owner} todavía no tiene Familiar`)}
            {blocked ? (
              <ErrorBox>
                {blocked === 'host_not_family'
                  ? `Para juntar sus cuentas, ${owner} necesita el plan Familiar. Te avisamos cuando lo active.`
                  : blocked === 'no_seat' ? 'Este hogar ya tiene a sus 2 personas.'
                    : blocked === 'member' ? 'Ya eres parte de este hogar.' : 'Este es tu propio hogar.'}
              </ErrorBox>
            ) : (
              <>
                {preview.hasData && (
                  <section>
                    <GroupTitle className="mb-1.5">Lo que traes</GroupTitle>
                    <ListCard>
                      {preview.counts.transactions > 0 && (
                        <div className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                          <RowBody tile={<Tile>🧾</Tile>} name={`${preview.counts.transactions} movimientos`} help={`${preview.counts.months} · quedan a tu nombre`} />
                        </div>
                      )}
                      {preview.counts.goals.length > 0 && (
                        <div className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                          <RowBody tile={<Tile>🎯</Tile>} name={`${preview.counts.goals.length} ${preview.counts.goals.length === 1 ? 'meta' : 'metas'}`} help={preview.counts.goals.join(' · ')} />
                        </div>
                      )}
                      {preview.counts.debts.length > 0 && (
                        <div className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                          <RowBody tile={<Tile>💳</Tile>} name={`${preview.counts.debts.length} ${preview.counts.debts.length === 1 ? 'deuda' : 'deudas'}`} help={preview.counts.debts.join(' · ')} />
                        </div>
                      )}
                    </ListCard>
                  </section>
                )}
                <section>
                  <GroupTitle className="mb-1.5">Cómo funciona</GroupTitle>
                  <ListCard>
                    {[
                      ['🔒', 'No se borra nada', 'Todo lo que registraste pasa al hogar.'],
                      ['🗂️', 'Lo de antes es tuyo', 'Queda como tu historial; no entra en cuentas claras.'],
                      ['⚖️', 'Desde hoy se reparte', `Lo de la casa cuenta para los dos a partir del ${t.long.split(' ').slice(1).join(' ')}.`],
                      ['↩️', 'Puedes deshacerlo', 'Durante 30 días, y cada quien se lleva lo suyo.'],
                    ].map(([e, n, h]) => (
                      <div key={n} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                        <RowBody tile={<Tile>{e}</Tile>} name={n} help={h} />
                      </div>
                    ))}
                  </ListCard>
                </section>
                {preview.refundCents > 0 && (
                  <Note tone="info" className="">
                    Tu plan individual se cancela hoy y te devolvemos <b>{priceLabel(preview.refundCents)}</b> por los días que no usaste.
                  </Note>
                )}
              </>
            )}
            {error && <ErrorBox>{error}</ErrorBox>}
            <div className="flex flex-col gap-1.5">
              {!blocked && (
                <button type="button" onClick={next} disabled={busy} className={PRIMARY_BUTTON}>
                  {busy ? 'Uniendo…' : 'Unir mi cuenta'}
                </button>
              )}
              <Link href="/dashboard" className={`flex h-11 items-center justify-center text-[15px] font-semibold ${TEXT_MUTED}`}>Ahora no</Link>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="flex flex-col gap-1">
              <h2 className={`${SHEET_TITLE} !text-[26px]`}>El plan de {t.month}, juntos</h2>
              <p className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>{owner} lo propuso así. Cambia lo que no cuadre.</p>
            </div>
            {preview.plan.length > 0 ? (
              <ListCard>
                {preview.plan.map((r) => {
                  const both = !!(r.guestId && r.hostId);
                  const pick = r.guestId ? picks[r.guestId] ?? r.pick : r.pick;
                  const only = !r.hostId ? me : !r.guestId ? owner : null;
                  return (
                    <div key={r.guestId ?? r.hostId} className={`flex flex-col gap-2.5 py-3 ${ROW_DIVIDER}`}>
                      <span className="flex items-center gap-3">
                        <RowBody tile={<Tile>{r.icon || '🧾'}</Tile>} name={r.name} help={only ? `Solo lo tiene ${only}` : `${owner} ${fmt(r.host)} · ${me} ${fmt(r.guest)}`} />
                        <RowAmount>{fmt(rowValue(r, pick))}</RowAmount>
                      </span>
                      {both && (
                        <Segmented
                          label={r.name}
                          options={[{ value: 'sum', label: 'Sumar' }, { value: 'host', label: `De ${owner}` }, { value: 'guest', label: `De ${me}` }]}
                          value={pick}
                          onChange={(v) => setPicks((p) => ({ ...p, [r.guestId!]: v }))}
                        />
                      )}
                      {r.looksSame && pick === 'sum' && (
                        <span className="text-[13px] text-warning-text dark:text-warning">⚠️ Montos parecidos. ¿Lo registraron los dos?</span>
                      )}
                    </div>
                  );
                })}
              </ListCard>
            ) : (
              <p className={`px-1 text-sm ${TEXT_MUTED}`}>Ninguno de los dos tiene plan este mes. Lo pueden armar juntos después.</p>
            )}
            <ListCard>
              <div className="flex items-center gap-3 py-3.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>Plan del hogar</span>
                  <span className={`text-[13px] ${TEXT_MUTED}`}>Por separado sumaban {fmt(separate)}</span>
                </span>
                <span className={`font-outfit text-2xl font-extrabold ${TEXT_STRONG}`}>{fmt(planTotal)}</span>
              </div>
            </ListCard>
            {error && <ErrorBox>{error}</ErrorBox>}
            <button type="button" onClick={next} disabled={busy} className={PRIMARY_BUTTON}>{busy ? 'Uniendo…' : 'Siguiente'}</button>
          </>
        )}

        {step === 2 && (
          <>
            {preview.duplicates.length > 0 && (
              <section>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <GroupTitle className="">Se repiten</GroupTitle>
                  <span className={`text-[13px] ${TEXT_MUTED}`}>juntar {nDup} de {preview.duplicates.length}</span>
                </div>
                <ListCard>
                  {preview.duplicates.map((d) => (
                    <div key={d.guestId} className={`flex items-center gap-3 py-2 ${ROW_DIVIDER}`}>
                      <RowBody tile={<Tile>🧾</Tile>} name={`${d.name} · ${fmt(d.amount)}`} help={`${shortDate(d.date)} · lo registraron ${owner} y ${me}`} />
                      <Check on={!!dups[d.guestId]} label={`Juntar ${d.name}`} onClick={() => setDups((s) => ({ ...s, [d.guestId]: !s[d.guestId] }))} />
                    </div>
                  ))}
                </ListCard>
                <p className={`mx-1 mt-1 text-[13px] ${TEXT_MUTED}`}>Misma fecha, monto y comercio. Al juntar queda uno solo.</p>
              </section>
            )}

            {preview.goals.length > 0 && (
              <section>
                <GroupTitle className="mb-1.5">Metas</GroupTitle>
                <ListCard>
                  {preview.goals.map((g) => {
                    const v = goals[g.id] ?? 'shared';
                    const options = g.similar
                      ? [{ value: `merge:${g.similar.id}`, label: `Unir · ${fmt(g.amount + g.similar.amount)}` }, { value: 'shared', label: 'Dejar separadas' }]
                      : [{ value: 'shared', label: 'Compartida' }, { value: 'personal', label: `Solo de ${me}` }];
                    return (
                      <div key={g.id} className={`flex flex-col gap-2.5 py-3 ${ROW_DIVIDER}`}>
                        <span className="flex items-center gap-3">
                          <RowBody
                            tile={<Tile>{g.emoji || '🎯'}</Tile>}
                            name={g.name}
                            badge={g.similar ? <span className={BADGE_INFO}>Los dos</span> : undefined}
                            help={g.similar ? `${owner} ${fmt(g.similar.amount)} · ${me} ${fmt(g.amount)}` : `De ${me} · ${fmt(g.amount)}`}
                          />
                        </span>
                        <Segmented label={g.name} options={options} value={v} onChange={(x) => setGoals((s) => ({ ...s, [g.id]: x }))} />
                      </div>
                    );
                  })}
                </ListCard>
              </section>
            )}

            {preview.debts.length > 0 && (
              <section>
                <GroupTitle className="mb-1.5">Deudas</GroupTitle>
                <ListCard>
                  {preview.debts.map((d) => (
                    <div key={d.id} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                      <RowBody tile={<Tile>💳</Tile>} name={d.name} help={`Responsable: ${me}${d.dueDay ? ` · vence el ${d.dueDay}` : ''}`} />
                    </div>
                  ))}
                </ListCard>
              </section>
            )}
            {error && <ErrorBox>{error}</ErrorBox>}
            <button type="button" onClick={() => void merge()} disabled={busy} className={PRIMARY_BUTTON}>{busy ? 'Uniendo…' : 'Unir cuentas'}</button>
          </>
        )}

        {step === 3 && result && (
          <>
            {hero('Ya son un hogar', `Desde hoy, ${t.long}`)}
            <ListCard>
              {[
                ['🗂️', `Antes del ${t.short}`, 'Cada quien conserva su historial. No entra en cuentas claras.'],
                ['⚖️', `Desde el ${t.short}`, 'Al registrar eligen quién pagó y si es de la casa. Lo compartido se reparte.'],
                ['🧮', `Plan de ${t.month} · ${fmt(planTotal)}`, `Combinado. Cuenta los gastos de los dos desde el 1 de ${t.month}.`],
              ].map(([e, n, h]) => (
                <div key={n} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                  <RowBody tile={<Tile>{e}</Tile>} name={n} help={h} />
                </div>
              ))}
            </ListCard>
            {(result.duplicates > 0 || result.mergedGoal) && (
              <Note tone="ok" className="">
                {result.duplicates > 0 ? `Juntamos ${result.duplicates} ${result.duplicates === 1 ? 'movimiento repetido' : 'movimientos repetidos'}` : 'Listo'}
                {result.mergedGoal ? ' y unimos sus metas parecidas' : ''}. Nada se borró.
              </Note>
            )}
            {result.refundCents > 0 && (
              <Note tone="info" className="">Cancelamos tu plan individual y te devolvemos {priceLabel(result.refundCents)}.</Note>
            )}
            <p className={`mx-1 text-[13px] ${TEXT_MUTED}`}>¿Cambiaron de idea? En Familia pueden deshacer la unión durante 30 días.</p>
            <Link href="/familia" className={`flex items-center justify-center ${PRIMARY_BUTTON}`}>Ver Este mes en casa</Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
