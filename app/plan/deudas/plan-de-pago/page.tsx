'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { formatMonths } from '@/lib/deudas'
import { efectoPagoExtra, motivoOrden, ordenAvalancha, type DebtTermsInput } from '@/lib/plan-de-pago'
import { AppShell } from '@/components/layout/AppShell'
import { GroupTitle, LINK_TEXT, ListCard, PageHeader, ROW_DIVIDER } from '@/components/layout/Pantalla'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { CARD, GREEN_TEXT } from '@/components/resumen/ctf-ui'
import { Note } from '@/components/plan/ui'
import { AmortizacionDetalle, CUOTA_NO_ALCANZA } from '@/components/deudas/AmortizacionDetalle'

const BACK = { href: '/plan?s=deudas', label: 'Deudas' }
const EXTRA_STEP = 50

// F6: plan de pago de deudas. Gratis, incluido el simulador (Deudas nunca
// se limita). No cambia la lista de Deudas ni su simulador.
export default function PlanDePagoPage() {
  const router = useRouter()
  const fmt = useFormatMoney()
  const [debts, setDebts] = useState<DebtTermsInput[] | null>(null)
  const [extra, setExtra] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const hh = await getUserHousehold(supabase, user.id)
      if (!hh) { router.push('/onboarding'); return }
      const { data } = await supabase
        .from('debts')
        .select('id, name, balance, interest_rate, min_payment')
        .eq('household_id', hh.id)
        .eq('is_paid', false)
      if (cancelled) return
      setDebts(((data ?? []) as DebtTermsInput[]).filter((d) => Number(d.balance) > 0))
    })()
    return () => { cancelled = true }
  }, [router])

  const orden = useMemo(() => ordenAvalancha(debts ?? []), [debts])
  const efecto = useMemo(() => efectoPagoExtra(debts ?? [], extra), [debts, extra])

  if (debts === null) return <PageSkeleton variant="detail" />

  const totalCuotas = orden.reduce((s, d) => s + d.cuota, 0)
  const maxExtra = Math.max(1000, Math.ceil((totalCuotas * 2) / EXTRA_STEP) * EXTRA_STEP)

  return (
    <AppShell title="Tu plan de pago" currentPath="/plan" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={BACK} title="Tu plan de pago" subtitle="Qué deuda pagar primero y cuánto te ahorras pagando un poco más." />

        {orden.length === 0 ? (
          <Note tone="ok" className="mt-3.5">
            <b>No tienes deudas activas.</b> Excelente, sigue así.
          </Note>
        ) : (
          <>
            <GroupTitle>Orden recomendado</GroupTitle>
            <p className={`-mt-0.5 mb-2 px-1 text-[13.5px] leading-[1.45] ${TEXT_MUTED}`}>{motivoOrden(orden[0])}</p>
            <ListCard>
              {orden.map((d, i) => {
                const open = openId === d.id
                const r = d.ritmoActual
                return (
                  <div key={d.id} className={`flex flex-col gap-2 py-3 ${ROW_DIVIDER}`}>
                    <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : d.id)} className="flex w-full items-center gap-3 text-left">
                      <span aria-hidden className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-electric-ghost font-outfit text-sm font-bold text-electric dark:bg-[#1B2B4D] dark:text-electric-soft">
                        {i + 1}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={`truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{d.name}</span>
                        <span className={`text-[13px] leading-[1.35] ${r.ok ? TEXT_MUTED : 'text-warning-text dark:text-warning'}`}>
                          {r.ok
                            ? `${formatMonths(r.meses)} · ${fmt(r.interesesTotales)} de intereses`
                            : r.advertencia === 'cuota_no_cubre_intereses' ? CUOTA_NO_ALCANZA : 'Sin pago mensual registrado'}
                        </span>
                      </span>
                      <span className="flex flex-none flex-col items-end">
                        <span className={`font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>{fmt(d.saldo)}</span>
                        <span className={`text-[12px] ${TEXT_MUTED}`}>{d.tasaAnual ? `${d.tasaAnual}% anual` : 'sin interés'}</span>
                      </span>
                    </button>
                    {open && <AmortizacionDetalle saldo={d.saldo} tasaAnual={d.tasaAnual} cuota={d.cuota} fmt={fmt} />}
                  </div>
                )
              })}
            </ListCard>

            <GroupTitle>Si pagas un extra al mes</GroupTitle>
            <section aria-label="Simulador de pago extra" className={`flex flex-col gap-3 px-4 py-4 ${CARD}`}>
              <div className="flex items-baseline justify-between gap-2" aria-live="polite">
                <span className={`font-outfit text-[32px] font-extrabold leading-none ${TEXT_STRONG}`}>{fmt(extra)}</span>
                <span className={`text-[13px] ${TEXT_MUTED}`}>extra al mes</span>
              </div>
              <input
                type="range"
                min={0}
                max={maxExtra}
                step={EXTRA_STEP}
                value={extra}
                onChange={(e) => setExtra(Number(e.target.value))}
                aria-label="Pago extra al mes"
                aria-valuetext={fmt(extra)}
                className="h-11 w-full accent-electric"
              />
              {efecto.sinFin && (
                <p className="text-[13.5px] leading-[1.45] text-warning-text dark:text-warning">
                  {CUOTA_NO_ALCANZA} en alguna deuda. Con estos pagos no terminas en 30 años: sube el extra.
                </p>
              )}
              {extra > 0 && !efecto.sinFin ? (
                <p className={`text-[14.5px] leading-[1.45] ${TEXT_STRONG}`}>
                  Terminas <b className={GREEN_TEXT}>{efecto.mesesAhorrados} {efecto.mesesAhorrados === 1 ? 'mes' : 'meses'} antes</b> y te ahorras{' '}
                  <b className={GREEN_TEXT}>{fmt(efecto.interesesAhorrados)}</b> en intereses.
                </p>
              ) : !efecto.sinFin ? (
                <p className={`text-[14.5px] leading-[1.45] ${TEXT_MUTED}`}>Mueve el control para ver cuánto te ahorras.</p>
              ) : null}
              <div className={`grid grid-cols-2 gap-3 text-[13px] ${TEXT_MUTED}`}>
                <span>
                  Sin extra
                  <b className={`block font-outfit text-[15px] ${TEXT_STRONG}`}>{formatMonths(efecto.sinExtra.meses)}</b>
                  {fmt(efecto.sinExtra.intereses)} de intereses
                </span>
                <span>
                  Con {fmt(extra)} extra
                  <b className={`block font-outfit text-[15px] ${TEXT_STRONG}`}>{formatMonths(efecto.conExtra.meses)}</b>
                  {fmt(efecto.conExtra.intereses)} de intereses
                </span>
              </div>
              <p className={`text-[12.5px] leading-[1.4] ${TEXT_MUTED}`}>
                El extra va a la primera deuda del orden. Cuando la terminas, su pago pasa a la siguiente.
              </p>
            </section>

            <Link href="/plan?s=deudas" className={`mx-auto mt-3 flex h-11 items-center text-[15px] font-semibold ${LINK_TEXT}`}>
              Editar mis deudas
            </Link>
          </>
        )}
      </div>
    </AppShell>
  )
}
