'use client'

// Plan › Eventos: presupuestos para cumpleaños, graduaciones, vacaciones,
// bodas o lo que sea. Cada evento muestra lo gastado contra lo planeado
// (los gastos se asignan a un concepto al agregarlos o desde su detalle).

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getUserHousehold } from '@/lib/household'
import { localToday } from '@/lib/dates'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { useEffectivePlan } from '@/lib/hooks/useEffectivePlan'
import { isPremium } from '@/lib/plans'
import { FREE_EVENTOS_ACTIVOS, plantillaDe, textoCuenta, textoFechas } from '@/lib/eventos'
import { loadEventos, type Evento } from '@/lib/eventos-data'
import { BADGE_NEUTRAL, BADGE_WARN, ErrorBox, GroupTitle, ListCard, ROW_DIVIDER, RowBody, Tile } from '@/components/layout/Pantalla'
import { CARD } from '@/components/resumen/ctf-ui'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { AddRow, ProgressBar, RowAmount } from '@/components/plan/ui'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { SkeletonRows } from '@/components/motion/PageSkeleton'
import { PremiumSheet } from '@/components/premium/PremiumSheet'
import { NuevoEventoSheet } from './NuevoEventoSheet'

export function EventosView({ addRequest = 0 }: { addRequest?: number } = {}) {
  const router = useRouter()
  const fmt = useFormatMoney()
  const plan = useEffectivePlan()
  const supabase = useMemo(() => createClient(), [])
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  const [error, setError] = useState(false)
  const [sheetKey, setSheetKey] = useState<number | null>(null)
  const [premiumOpen, setPremiumOpen] = useState(false)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const today = localToday()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const hh = await getUserHousehold(supabase, user.id)
      if (!hh) { router.push('/onboarding'); return }
      const rows = await loadEventos(supabase, hh.id)
      if (cancelled) return
      if (!rows) setError(true)
      setEventos(rows ?? [])
    })()
    return () => { cancelled = true }
  }, [supabase, router])

  const activos = (eventos ?? []).filter((e) => !e.archivedAt)
  const terminados = (eventos ?? []).filter((e) => e.archivedAt)
  const premium = plan ? isPremium(plan.plan) : true
  const canWrite = plan?.access !== 'view'

  const openNew = useCallback(() => {
    if (!premium && activos.length >= FREE_EVENTOS_ACTIVOS) { setPremiumOpen(true); return }
    setSheetKey(Date.now())
  }, [premium, activos.length])
  useEffect(() => { if (addRequest > 0) openNew() }, [addRequest]) // eslint-disable-line react-hooks/exhaustive-deps

  const fila = (e: Evento) => {
    const p = plantillaDe(e.tipo)
    const r = e.resumen
    const over = r.presupuesto > 0 && r.gastado > r.presupuesto
    const cuenta = e.archivedAt ? null : textoCuenta(e.fechaInicio, e.fechaFin, today)
    return (
      <Link key={e.id} href={`/eventos/${e.id}`} className={`flex flex-col gap-2.5 py-3 transition duration-150 active:scale-[0.98] ${ROW_DIVIDER}`}>
        <span className="flex items-center gap-3">
          <RowBody
            tile={<Tile>{p.emoji}</Tile>}
            name={e.nombre}
            badge={over ? <span className={BADGE_WARN}>Te pasaste</span> : cuenta ? <span className={BADGE_NEUTRAL}>{cuenta}</span> : null}
            help={<>{textoFechas(e.fechaInicio, e.fechaFin, today)} · <b className={`font-semibold ${TEXT_STRONG}`}>{fmt(r.gastado)}</b> de {fmt(r.presupuesto)}</>}
          />
          <RowAmount className={over ? 'text-warning-text dark:text-warning' : TEXT_STRONG}>{Math.min(999, r.pct)}%</RowAmount>
        </span>
        <ProgressBar ratio={r.presupuesto > 0 ? r.gastado / r.presupuesto : 0} color={over ? '#F59E0B' : '#2563EB'} />
      </Link>
    )
  }

  return (
    <>
      <div className="flex max-w-2xl flex-col zafi-stagger">
        {error && <div className="mt-3.5"><ErrorBox>No pudimos cargar tus eventos. Intenta de nuevo.</ErrorBox></div>}
        {eventos === null ? (
          <div className="mt-3.5"><SkeletonRows count={3} /></div>
        ) : eventos.length === 0 ? (
          <div className={`mt-3.5 flex flex-col items-center gap-3 px-5 py-8 text-center ${CARD}`}>
            <span aria-hidden className="text-[40px] leading-none">🎉</span>
            <p className={`text-[17px] font-bold ${TEXT_STRONG}`}>Planea tu próximo evento</p>
            <p className={`text-sm leading-[1.45] [text-wrap:pretty] ${TEXT_MUTED}`}>
              Un cumpleaños, una graduación, unas vacaciones o una boda: arma el presupuesto con conceptos sugeridos y ve cuánto llevas gastado.
            </p>
            {canWrite && <button type="button" onClick={openNew} className={`mt-1 ${PRIMARY_BUTTON}`}>Crear un evento</button>}
          </div>
        ) : (
          <>
            <section>
              <GroupTitle>Próximos y en curso</GroupTitle>
              <ListCard>
                {activos.map(fila)}
                {activos.length === 0 && <p className={`py-3 text-sm ${TEXT_MUTED}`}>No tienes eventos activos.</p>}
                {canWrite && <AddRow label="Crear un evento" onClick={openNew} />}
              </ListCard>
              {!premium && (
                <p className={`mx-1 mt-2 text-[13px] ${TEXT_MUTED}`}>Gratis: {FREE_EVENTOS_ACTIVOS} evento activo a la vez. Termina uno para crear otro.</p>
              )}
            </section>
            {terminados.length > 0 && (
              <section>
                <GroupTitle>Terminados</GroupTitle>
                <ListCard>{terminados.map(fila)}</ListCard>
              </section>
            )}
          </>
        )}
      </div>

      <BottomSheet themed open={sheetKey !== null} onClose={() => setSheetKey(null)} label="Nuevo evento">
        {sheetKey !== null && (
          <NuevoEventoSheet
            key={sheetKey}
            onCreated={(id) => { setSheetKey(null); router.push(`/eventos/${id}?nuevo=1`) }}
            onLimit={() => { setSheetKey(null); setPremiumOpen(true) }}
            onError={(text) => setMessage({ text, tone: 'error' })}
          />
        )}
      </BottomSheet>
      <PremiumSheet reason="eventos" open={premiumOpen} onClose={() => setPremiumOpen(false)} />
      <StatusToast message={message} onDone={() => setMessage(null)} />
    </>
  )
}
