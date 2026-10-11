'use client'

// "Tip de Zafi" en el detalle de una categoría en Sobregiro (mes en curso).
// Solo hechos; ofrece un reto de 14 días. "Ahora no" lo oculta este mes.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CARD } from '@/components/resumen/ctf-ui'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { ListCard, PillButton, ROW_DIVIDER } from '@/components/layout/Pantalla'
import { PremiumAction } from '@/components/premium/PremiumTag'
import { postJson } from '@/components/recurring/useRecurring'
import type { TipData } from '@/lib/challenges/tip-data'

type Resp = TipData & { needsPremium: boolean; canWrite: boolean }

export function CategoryTip({ categoryId, fmt }: { categoryId: string; fmt: (n: number) => string }) {
  const [data, setData] = useState<Resp | null>(null)
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/challenges/tip?categoryId=${encodeURIComponent(categoryId)}`, { cache: 'no-store' })
      if (res.ok) setData((await res.json()) as Resp)
    } catch { /* sin tip */ }
  }, [categoryId])
  useEffect(() => { void load() }, [load])

  if (!data?.tip || hidden) return null
  const tip = data.tip
  const templateId = data.templates.noSpendId ?? data.templates.reductionId

  async function accept() {
    if (!templateId) return
    setBusy(true)
    const r = await postJson('/api/challenges', { templateId, categoryId })
    setBusy(false)
    if (r.ok) { setHidden(true); setNote(null) }
    else setNote(r.error ?? 'No se pudo empezar el reto')
  }

  async function dismiss() {
    setHidden(true)
    await postJson('/api/challenges/tip', { tipKey: tip.tipKey })
  }

  return (
    <section aria-label="Tip de Zafi" className="mt-[18px] flex flex-col gap-2">
      <div className={`flex flex-col gap-3 p-4 ${CARD}`}>
        <span className="text-[13px] font-bold uppercase tracking-[0.04em] text-electric-dark dark:text-electric-soft">💡 Tip de Zafi</span>
        <p className={`text-[15px] leading-[1.5] ${TEXT_STRONG}`}>
          Tuviste {tip.purchases} {tip.purchases === 1 ? 'compra' : 'compras'} en {tip.categoryName} este mes ({fmt(tip.spent)}) y vas {fmt(tip.overBudget)} sobre tu presupuesto.
          Un reto de 14 días podría ayudarte a retomar el control.
        </p>
        {note && <p className="text-[13.5px] text-danger-text dark:text-[var(--zafi-error-text)]">{note}</p>}
        {data.canWrite && templateId && (
          <div className="flex flex-wrap items-center gap-2">
            {data.needsPremium ? (
              <PremiumAction from="challenges">
                <span className="text-[14px] font-bold text-electric-dark dark:text-electric-soft">Aceptar reto</span>
              </PremiumAction>
            ) : (
              <button type="button" disabled={busy} onClick={() => void accept()} className="flex h-11 items-center rounded-full bg-electric px-4 text-sm font-semibold text-white disabled:opacity-60">
                Aceptar reto
              </button>
            )}
            <PillButton onClick={() => void dismiss()}>Ahora no</PillButton>
          </div>
        )}
      </div>

      {data.rows.length > 0 && (
        <>
          <h2 className={`mt-2 px-1 text-[15px] font-bold ${TEXT_STRONG}`}>Dónde puedes bajar tus gastos</h2>
          <ListCard>
            {data.rows.map((r) => (
              <Link key={r.href} href={r.href} className={`flex min-h-[52px] items-center gap-2 py-3 ${ROW_DIVIDER}`}>
                <span className={`flex-1 text-[15px] font-semibold ${TEXT_STRONG}`}>{r.label}</span>
                <span className={`text-[13.5px] ${TEXT_MUTED}`}>
                  {r.kind === 'subscriptions' ? `${fmt(r.amount)}/mes` : `${fmt(r.amount)} sobre presupuesto`}
                </span>
                <span aria-hidden className="font-bold text-electric">›</span>
              </Link>
            ))}
          </ListCard>
        </>
      )}
    </section>
  )
}
