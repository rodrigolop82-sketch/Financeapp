'use client'

// Slot único de Inicio para la tarjeta destacada (resumen semanal, reto
// activo o patrimonio). Si no hay nada que mostrar, no ocupa espacio.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { CARD } from '@/components/resumen/ctf-ui'
import { HERO, HERO_MUTED, HERO_STYLE } from '@/components/layout/Pantalla'
import type { FeaturedCard as Card } from '@/lib/home/featured-card'

export function FeaturedCard({ fmt, reloadKey }: { fmt: (n: number) => string; reloadKey?: number }) {
  const [card, setCard] = useState<Card | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/home/featured', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { card: null }))
      .then((d: { card: Card | null }) => { if (alive) setCard(d.card) })
      .catch(() => {})
    return () => { alive = false }
  }, [reloadKey])

  if (!card) return null

  if (card.kind === 'snapshot') {
    return (
      <Link href="/resumen/semana" className={`mt-[18px] flex items-center gap-3 p-4 transition-transform duration-150 active:scale-[0.98] ${HERO}`} style={HERO_STYLE}>
        <span aria-hidden className="text-2xl">🗓️</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-bold">Tu semana está lista</span>
          <span className={`text-[13.5px] ${HERO_MUTED}`}>Gastaste {fmt(card.total)} · tócala para verla</span>
        </span>
        <span aria-hidden className="font-bold text-electric-pale">›</span>
      </Link>
    )
  }

  if (card.kind === 'challenge') {
    return (
      <Link href="/plan?s=metas&v=retos" className={`mt-[18px] flex items-center gap-3 p-4 transition-transform duration-150 active:scale-[0.98] ${HERO}`} style={HERO_STYLE}>
        <span aria-hidden className="text-2xl">🏁</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold">{card.title}</span>
          <span className={`text-[13.5px] ${HERO_MUTED}`}>
            Día {card.dayIndex} de {card.durationDays}{card.streak > 0 ? ` · racha de ${card.streak} ${card.streak === 1 ? 'día' : 'días'}` : ''}
          </span>
        </span>
        <span aria-hidden className="font-bold text-electric-pale">›</span>
      </Link>
    )
  }

  if (card.kind === 'networth') {
    const d = card.delta
    return (
      <Link href="/patrimonio" className={`mt-[18px] flex items-center gap-3 p-4 transition-transform duration-150 active:scale-[0.98] ${CARD}`}>
        <span aria-hidden className="text-2xl">📈</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`text-[13px] font-semibold ${TEXT_MUTED}`}>Patrimonio neto</span>
          <span className={`font-outfit text-[20px] font-extrabold ${TEXT_STRONG}`}>{card.netWorth < 0 ? '−' : ''}{fmt(Math.abs(card.netWorth))}</span>
          {d !== null && d !== 0 && (
            <span className={`text-[13px] font-semibold ${d > 0 ? 'text-success-dark dark:text-[var(--zafi-success-text)]' : 'text-warning-text dark:text-warning'}`}>
              {d > 0 ? '+' : '−'}{fmt(Math.abs(d))} este mes
            </span>
          )}
        </span>
        <span aria-hidden className="font-bold text-electric">›</span>
      </Link>
    )
  }

  return (
    <Link href="/patrimonio" className={`mt-[18px] flex items-center gap-3 p-4 transition-transform duration-150 active:scale-[0.98] ${CARD}`}>
      <span aria-hidden className="text-2xl">📈</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>Agrega tus cuentas para ver tu patrimonio</span>
        <span className={`text-[13px] ${TEXT_MUTED}`}>Solo tú ves estos datos.</span>
      </span>
      <span aria-hidden className="font-bold text-electric">›</span>
    </Link>
  )
}
