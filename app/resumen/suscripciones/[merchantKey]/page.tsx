'use client'

import { useCallback, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBox, GroupTitle, ListCard, PageHeader, PillButton, ROW_DIVIDER, Segmented } from '@/components/layout/Pantalla'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { CARD } from '@/components/resumen/ctf-ui'
import { PremiumAction } from '@/components/premium/PremiumTag'
import { MerchantAvatar, PriceUpBadge } from '@/components/recurring/ui'
import { postJson, useRecurring } from '@/components/recurring/useRecurring'
import { shortDate } from '@/lib/cuenta'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'

const BACK = { href: '/resumen/suscripciones', label: 'Suscripciones' }
type Days = '0' | '1' | '2' | '3'
const DAY_OPTIONS: { value: Days; label: string }[] = [
  { value: '0', label: 'No' },
  { value: '1', label: '1 día' },
  { value: '2', label: '2 días' },
  { value: '3', label: '3 días' },
]

export default function SuscripcionDetallePage() {
  const params = useParams<{ merchantKey: string }>()
  const key = decodeURIComponent(params?.merchantKey ?? '')
  const router = useRouter()
  const fmt = useFormatMoney()
  const { state, setState } = useRecurring()
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const [busy, setBusy] = useState(false)
  const clearMessage = useCallback(() => setMessage(null), [])

  if (state.status === 'loading') return <PageSkeleton variant="detail" />

  const data = state.status === 'ok' ? state.data : null
  const charge = data?.charges.find((c) => c.merchantKey === key) ?? null

  async function override(status: 'cancelled_by_user' | 'dismissed') {
    setBusy(true)
    const r = await postJson('/api/recurring/override', { merchantKey: key, status })
    setBusy(false)
    if (!r.ok) { setMessage({ text: r.error ?? 'No se pudo guardar', tone: 'error' }); return }
    router.push('/resumen/suscripciones')
  }

  async function setReminder(v: Days) {
    if (!data || !charge) return
    const daysBefore = v === '0' ? null : (Number(v) as 1 | 2 | 3)
    const prev = charge.remindDaysBefore
    // Optimista: se ve de inmediato y se revierte si el servidor dice que no.
    const patch = (d: 1 | 2 | 3 | null) =>
      setState({ status: 'ok', data: { ...data, charges: data.charges.map((c) => (c.merchantKey === key ? { ...c, remindDaysBefore: d } : c)) } })
    patch(daysBefore)
    const r = await postJson('/api/recurring/reminder', { merchantKey: key, daysBefore })
    if (!r.ok) { patch(prev); setMessage({ text: r.error ?? 'No se pudo guardar', tone: 'error' }); return }
    setMessage({ text: daysBefore ? `Te avisaremos ${daysBefore === 1 ? '1 día' : `${daysBefore} días`} antes` : 'Recordatorio quitado', tone: 'ok' })
  }

  if (!charge) {
    return (
      <AppShell title="Suscripción" currentPath="/resumen/suscripciones" hideMobileBar>
        <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
          <PageHeader back={BACK} title="Suscripción" />
          <div className="mt-3.5"><ErrorBox>{state.status === 'error' ? 'No pudimos cargar este cobro.' : 'Este cobro ya no aparece entre tus cobros recurrentes.'}</ErrorBox></div>
        </div>
      </AppShell>
    )
  }

  const info = charge.cancelInfo
  const steps = info?.steps ?? []
  const canWrite = data?.canWrite ?? false
  const recent = charge.history.slice(0, 3)

  return (
    <AppShell title={charge.displayName} currentPath="/resumen/suscripciones" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={BACK} title={charge.displayName} />
        <div className="mt-2 flex items-center gap-3 px-1">
          <MerchantAvatar name={charge.displayName} size={48} />
          <span className={`text-[15px] leading-[1.4] ${TEXT_MUTED}`}>
            <span className={`font-outfit font-extrabold ${TEXT_STRONG}`}>{fmt(charge.typicalAmount)}</span> / mes
            {charge.status === 'active' && <> · próximo cobro {shortDate(`${charge.nextExpectedDate}T12:00:00`)}</>}
          </span>
        </div>

        <GroupTitle>Cómo cancelar</GroupTitle>
        <div className={`flex flex-col gap-3 p-4 ${CARD}`}>
          {steps.length > 0 ? (
            <ol className="flex flex-col gap-2">
              {steps.map((s, i) => (
                <li key={i} className={`flex gap-2.5 text-[15px] leading-[1.45] ${TEXT_STRONG}`}>
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-electric-ghost text-[13px] font-bold text-electric-dark dark:bg-[#1B2B4D] dark:text-electric-soft">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={`text-[15px] leading-[1.45] ${TEXT_STRONG}`}>
              Aún no tenemos los pasos de {charge.displayName}. Entra a tu cuenta en su sitio o app, o contacta a su servicio al cliente.
            </p>
          )}
          {info?.cancelUrl && (
            <div className={`flex items-center gap-2 border-t pt-3 border-[var(--zafi-border-light)]`}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`text-[13px] ${TEXT_MUTED}`}>Sitio web</span>
                <span className={`truncate text-sm font-semibold ${TEXT_STRONG}`}>{info.cancelUrl}</span>
              </span>
              <PillButton onClick={() => {
                navigator.clipboard?.writeText(info.cancelUrl!).then(
                  () => setMessage({ text: 'Enlace copiado', tone: 'ok' }),
                  () => setMessage({ text: 'No se pudo copiar', tone: 'error' }),
                )
              }}>Copiar</PillButton>
            </div>
          )}
          {info?.cancelEmail && (
            <div className={`flex flex-col border-t pt-3 border-[var(--zafi-border-light)]`}>
              <span className={`text-[13px] ${TEXT_MUTED}`}>Correo</span>
              <a href={`mailto:${info.cancelEmail}`} className="text-sm font-semibold text-electric">{info.cancelEmail}</a>
            </div>
          )}
          {info?.notes && <p className={`text-[13px] leading-[1.45] ${TEXT_MUTED}`}>{info.notes}</p>}
        </div>

        <GroupTitle>Últimos cobros</GroupTitle>
        <ListCard>
          {recent.map((h, i) => {
            const prev = recent[i + 1]
            const up = prev && h.amount - prev.amount >= 2 ? h.amount - prev.amount : 0
            return (
              <div key={h.date + i} className={`flex min-h-[48px] items-center gap-2 py-2.5 ${ROW_DIVIDER}`}>
                <span className={`flex-1 text-[15px] ${TEXT_STRONG}`}>{shortDate(`${h.date}T12:00:00`)}</span>
                {up > 0 && i === 0 && <PriceUpBadge charge={charge} fmt={fmt} />}
                <span className={`font-outfit text-[15px] font-extrabold ${TEXT_STRONG}`}>{fmt(h.amount)}</span>
              </div>
            )
          })}
        </ListCard>

        {charge.status === 'active' && canWrite && (
          <>
            <GroupTitle>Recordarme antes del cobro</GroupTitle>
            {data?.features.reminders ? (
              <Segmented
                label="Recordarme antes del cobro"
                options={DAY_OPTIONS}
                value={String(charge.remindDaysBefore ?? 0) as Days}
                onChange={(v) => void setReminder(v)}
              />
            ) : (
              <PremiumAction from="recurring" className={`px-4 py-2 ${CARD}`}>
                <span className={`flex-1 text-[15px] font-semibold ${TEXT_STRONG}`}>Recordarme 1, 2 o 3 días antes</span>
              </PremiumAction>
            )}
          </>
        )}

        <p className={`mx-1 mt-4 text-[12.5px] leading-[1.45] ${TEXT_MUTED}`}>
          Zafi no cancela por ti: te muestra dónde hacerlo y te recuerda antes del cobro.
        </p>

        {canWrite && (
          <div className="mt-4 flex flex-col gap-1">
            <button type="button" disabled={busy} onClick={() => void override('cancelled_by_user')} className={PRIMARY_BUTTON}>
              Ya la cancelé
            </button>
            <button type="button" disabled={busy} onClick={() => void override('dismissed')} className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}>
              No es una suscripción
            </button>
          </div>
        )}
      </div>
      <StatusToast message={message} onDone={clearMessage} />
    </AppShell>
  )
}
