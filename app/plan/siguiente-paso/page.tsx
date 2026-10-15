'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { useEffectivePlan } from '@/lib/hooks/useEffectivePlan'
import { planHasFeature } from '@/lib/entitlements/features'
import { calculateScore, type ScoreInput } from '@/lib/score-calculator'
import { aplicarPaso, type Paso } from '@/lib/siguiente-paso'
import { pasoAccion, pasoAyuda, pasoEfecto, pasoTitulo, VAS_MUY_BIEN } from '@/lib/siguiente-paso/texto'
import { AppShell } from '@/components/layout/AppShell'
import { LINK_TEXT, PageHeader, PillButton } from '@/components/layout/Pantalla'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { DIVIDER, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { CARD, GREEN_TEXT } from '@/components/resumen/ctf-ui'
import { Note } from '@/components/plan/ui'
import { PremiumBadge, upgradeHref } from '@/components/premium/PremiumTag'
import { useSiguientePaso } from '@/components/siguiente-paso/useSiguientePaso'

const BACK = { href: '/dashboard', label: 'Inicio' }

// F1: detalle de "Tu siguiente mejor paso". Los tres pasos son gratis; el
// detalle del cálculo y la simulación son Premium. No es la pestaña Plan.
export default function SiguientePasoPage() {
  const router = useRouter()
  const fmt = useFormatMoney()
  const plan = useEffectivePlan()
  const [householdId, setHouseholdId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const hh = await getUserHousehold(supabase, user.id)
      if (!hh) { router.push('/onboarding'); return }
      if (!cancelled) setHouseholdId(hh.id as string)
    })()
    return () => { cancelled = true }
  }, [router])

  const { loading, input, score, ctx, pasos } = useSiguientePaso(householdId)
  if (!householdId || loading) return <PageSkeleton variant="detail" />

  const premium = !!plan && planHasFeature(plan.plan, 'next_step.details')

  return (
    <AppShell title="Tu siguiente mejor paso" currentPath="/dashboard" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={BACK} title="Tu siguiente mejor paso" subtitle="Lo que más sube tu salud financiera con el menor esfuerzo." />

        {!score || score.components.length === 0 ? (
          <Note tone="info" className="mt-3.5">Registra tus ingresos en tu plan del mes para ver tus pasos.</Note>
        ) : pasos.length === 0 ? (
          <Note tone="ok" className="mt-3.5"><b>{VAS_MUY_BIEN}</b> Tu puntaje es {score.total}.</Note>
        ) : (
          <>
            <div className={`mt-3.5 flex items-baseline justify-between px-1`}>
              <span className={`text-sm ${TEXT_MUTED}`}>Tu puntaje hoy</span>
              <span className={`font-outfit text-[22px] font-extrabold ${TEXT_STRONG}`}>{score.total}</span>
            </div>
            {pasos.map((p, i) => (
              <section key={p.key} aria-label={`Paso ${i + 1}`} className={`mt-3 flex flex-col gap-2 p-4 ${CARD}`}>
                <div className="flex items-start gap-3">
                  <span aria-hidden className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-electric-ghost font-outfit text-sm font-bold text-electric dark:bg-[#1B2B4D] dark:text-electric-soft">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className={`text-[16px] font-semibold leading-[1.35] [text-wrap:pretty] ${TEXT_STRONG}`}>{pasoTitulo(p, fmt)}</span>
                    <span className={`text-[13.5px] leading-[1.4] ${TEXT_MUTED}`}>{pasoAyuda(p, fmt)}</span>
                    <span className={`text-sm font-semibold ${GREEN_TEXT}`}>{pasoEfecto(p)} (estimado)</span>
                  </div>
                </div>
                <Link href={p.href} className="flex h-11 items-center self-start rounded-full bg-electric px-5 text-sm font-semibold text-white">
                  {pasoAccion(p)}
                </Link>
                {premium && input && ctx && <DetallePaso paso={p} input={input} minPayment={debtMin(ctx.debts, p)} fmt={fmt} />}
              </section>
            ))}
            {!premium && (
              <Link href={upgradeHref('next_step')} className={`mt-3 flex items-center gap-3 p-4 ${CARD}`}>
                <PremiumBadge />
                <span className={`flex-1 text-sm leading-[1.4] ${TEXT_STRONG}`}>Mira cómo calculamos cada paso y simula cuánto sube tu puntaje.</span>
                <span aria-hidden className={`font-bold ${LINK_TEXT}`}>›</span>
              </Link>
            )}
            <p className={`mt-3 px-1 text-[12.5px] leading-[1.4] ${TEXT_MUTED}`}>
              Los puntos son estimaciones: calculamos tu puntaje como si ya hubieras dado el paso este mes.
            </p>
          </>
        )}
      </div>
    </AppShell>
  )
}

function debtMin(debts: { id: string; min_payment: number | string | null }[], p: Paso): number | undefined {
  if (p.key !== 'debt') return undefined
  return Number(debts.find((d) => d.id === p.targetId)?.min_payment) || 0
}

/** Premium: qué partes del puntaje cambian y, en aportes, un simulador. */
function DetallePaso({ paso, input, minPayment, fmt }: { paso: Paso; input: ScoreInput; minPayment?: number; fmt: (n: number) => string }) {
  const simulable = paso.key === 'emergency' || paso.key === 'savings'
  const max = Math.max(paso.amount * 3, 500)
  const [amount, setAmount] = useState(paso.amount)
  const simulated = useMemo(
    () => calculateScore(aplicarPaso(input, paso.key, amount, { minPayment })).total,
    [input, paso.key, amount, minPayment],
  )

  return (
    <div className={`mt-1 flex flex-col gap-2 border-t pt-3 ${DIVIDER}`}>
      <span className={`flex items-center gap-2 text-[13px] font-semibold ${TEXT_MUTED}`}>Cómo lo calculamos <PremiumBadge /></span>
      <ul className="flex flex-col gap-1">
        {paso.cambios.map((c) => (
          <li key={c.key} className={`flex justify-between text-[13.5px] ${TEXT_STRONG}`}>
            <span>{c.label}</span>
            <span className="font-outfit">{c.from} → <b className={GREEN_TEXT}>{c.to}</b> de 20</span>
          </li>
        ))}
      </ul>
      {simulable && (
        <div className="mt-1 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2" aria-live="polite">
            <span className={`text-[13.5px] ${TEXT_MUTED}`}>Si aportas {fmt(amount)}</span>
            <span className={`font-outfit text-[17px] font-extrabold ${TEXT_STRONG}`}>{simulated} puntos</span>
          </div>
          <input
            type="range"
            min={0}
            max={max}
            step={50}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-label="Monto a aportar"
            aria-valuetext={fmt(amount)}
            className="h-11 w-full accent-electric"
          />
          <PillButton onClick={() => setAmount(paso.amount)}>Volver al sugerido</PillButton>
        </div>
      )}
    </div>
  )
}
