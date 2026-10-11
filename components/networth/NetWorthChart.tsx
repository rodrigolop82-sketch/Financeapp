'use client'

// Evolución del patrimonio: línea de 12 meses en SVG (colores en hex).
// Una sola serie: sin leyenda; el título la nombra. Tocar o pasar el dedo
// por un mes muestra su valor; el resumen en texto queda para lectores.

import { useState } from 'react'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import type { HistoryPoint } from '@/lib/networth/compute'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const W = 340
const H = 150
const PAD = { top: 14, right: 12, bottom: 22, left: 12 }

export function monthLabel(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1] ?? month
}

/** Datos de ejemplo para la vista previa de Gratis (nunca los reales). */
export const SAMPLE_SERIES: HistoryPoint[] = [
  ['2025-10', 120000], ['2025-11', 123500], ['2025-12', 119800], ['2026-01', 126000], ['2026-02', 131200], ['2026-03', 129900],
  ['2026-04', 136400], ['2026-05', 141000], ['2026-06', 139500], ['2026-07', 147800], ['2026-08', 152300], ['2026-09', 158000],
].map(([month, netWorth]) => ({ month: month as string, netWorth: netWorth as number }))

export function NetWorthChart({ series, fmt, interactive = true }: {
  series: HistoryPoint[]
  fmt: (n: number) => string
  interactive?: boolean
}) {
  const [active, setActive] = useState<number | null>(null)
  if (series.length === 0) return null

  const values = series.map((p) => p.netWorth)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - ((v - min) / span) * innerH
  const path = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.netWorth).toFixed(1)}`).join(' ')
  const sel = active ?? series.length - 1
  const first = series[0]
  const last = series[series.length - 1]
  const summary = `Patrimonio de ${monthLabel(first.month)} a ${monthLabel(last.month)}: de ${fmt(first.netWorth)} a ${fmt(last.netWorth)}.`

  function pick(clientX: number, rect: DOMRect) {
    const rel = ((clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 1; i < series.length; i++) if (Math.abs(x(i) - rel) < Math.abs(x(best) - rel)) best = i
    setActive(best)
  }

  return (
    <figure className="flex flex-col gap-2">
      {interactive && (
        <div className="flex items-baseline justify-between gap-2" aria-live="polite">
          <span className={`text-[13px] capitalize ${TEXT_MUTED}`}>{monthLabel(series[sel].month)} {series[sel].month.slice(0, 4)}</span>
          <span className={`font-outfit text-[17px] font-extrabold ${TEXT_STRONG}`}>{series[sel].netWorth < 0 ? '−' : ''}{fmt(Math.abs(series[sel].netWorth))}</span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={summary}
        onPointerMove={interactive ? (e) => pick(e.clientX, e.currentTarget.getBoundingClientRect()) : undefined}
        onPointerDown={interactive ? (e) => pick(e.clientX, e.currentTarget.getBoundingClientRect()) : undefined}
        onPointerLeave={interactive ? () => setActive(null) : undefined}
      >
        {min < 0 && max > 0 && (
          <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#94A3B8" strokeWidth={1} strokeDasharray="3 3" />
        )}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#CBD5E1" strokeWidth={1} />
        {interactive && (
          <line x1={x(sel)} x2={x(sel)} y1={PAD.top} y2={PAD.top + innerH} stroke="#94A3B8" strokeWidth={1} />
        )}
        <path d={path} fill="none" stroke="#2563EB" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(sel)} cy={y(series[sel].netWorth)} r={5} fill="#2563EB" stroke="#FFFFFF" strokeWidth={2} />
        <text x={x(0)} y={H - 6} fontSize={11} fill="#64748B" textAnchor="start">{monthLabel(first.month)}</text>
        <text x={x(series.length - 1)} y={H - 6} fontSize={11} fill="#64748B" textAnchor="end">{monthLabel(last.month)}</text>
      </svg>
      <figcaption className="sr-only">
        {summary}
        <ul>{series.map((p) => <li key={p.month}>{monthLabel(p.month)} {p.month.slice(0, 4)}: {fmt(p.netWorth)}</li>)}</ul>
      </figcaption>
    </figure>
  )
}
