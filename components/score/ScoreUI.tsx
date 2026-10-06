'use client'
// Piezas de la salud financiera: hero, línea del hero de Inicio, pastilla de
// Plan, lista "Qué lo compone" y barras "Cómo ha cambiado".

import Link from 'next/link'
import { partColor, type HealthScoreResult } from '@/lib/score-calculator'
import type { ScoreHistoryPoint } from '@/lib/health-data'
import { HERO, HERO_MUTED, HERO_STYLE, LINK_TEXT, ListCard, ROW_DIVIDER, Tile } from '@/components/layout/Pantalla'
import { CARD } from '@/components/resumen/ctf-ui'
import { BORDER, TEXT_FAINT, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { ProgressBar } from '@/components/plan/ui'

const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function shortMonthName(month: string): string {
  return SHORT_MONTHS[Number(month.slice(5, 7)) - 1] ?? ''
}

/** "Subiste 7 puntos desde septiembre." */
export function changeText(total: number, prev: { score: number; name: string } | null, suffix = `desde ${prev?.name ?? ''}`): string {
  if (!prev) return 'Se actualiza con lo que registras.'
  const d = total - prev.score
  if (d > 0) return `Subiste ${d} ${d === 1 ? 'punto' : 'puntos'} ${suffix}.`
  if (d < 0) return `Bajaste ${-d} ${d === -1 ? 'punto' : 'puntos'} ${suffix}.`
  return `Igual que en ${prev.name}.`
}

/** Hero navy con el número grande y la barra del color del puntaje. */
export function ScoreHero({ score, label = 'Tu salud financiera', sub }: { score: HealthScoreResult; label?: string; sub: string }) {
  return (
    <section aria-label={label} className={`mt-3.5 flex flex-col gap-1.5 ${HERO}`} style={{ ...HERO_STYLE, padding: '22px 22px 20px' }}>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-[15px] ${HERO_MUTED}`}>{label}</span>
        <span className="flex flex-none items-center gap-1.5 rounded-full bg-white/[0.08] px-[11px] py-[5px] text-[13px] font-semibold">
          <span aria-hidden className="h-[7px] w-[7px] rounded-full" style={{ background: score.color }} />
          {score.label}
        </span>
      </div>
      <p className="flex items-baseline gap-2">
        <span className="font-outfit text-[58px] font-extrabold leading-none tracking-[-0.02em]">{score.total}</span>
        <span className="text-base text-[#9FB3CB]">de 100</span>
      </p>
      <p className="text-sm text-[#9FB3CB] [text-wrap:pretty]">{sub}</p>
      <div
        className="mt-2.5 h-2 overflow-hidden rounded-[5px] bg-[#2A4A6E]"
        role="progressbar"
        aria-label="Salud financiera"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score.total}
      >
        <div className="h-full rounded-[5px] transition-[width,background-color] duration-[600ms]" style={{ width: `${score.total}%`, background: score.color }} />
      </div>
    </section>
  )
}

/** Línea discreta dentro del hero de Inicio (toda la fila lleva a /score). */
export function ScoreHeroLine({ score, href }: { score: HealthScoreResult; href: string }) {
  return (
    <Link
      href={href}
      className="mt-2 flex w-full items-center justify-between border-t border-white/[0.08] pt-2.5 text-[13.5px] text-[#9FB3CB]"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className="h-[7px] w-[7px] rounded-full" style={{ background: score.color }} />
        Salud financiera <b className="font-outfit text-[15px] font-bold text-white">{score.total}</b> · {score.label}
      </span>
      <span aria-hidden className="font-semibold text-white">›</span>
    </Link>
  )
}

/** Pastilla del encabezado de Plan. */
export function ScorePill({ score, href }: { score: HealthScoreResult; href: string }) {
  return (
    <Link
      href={href}
      aria-label={`Salud financiera ${score.total}, ${score.label}`}
      className={`flex h-11 flex-none items-center`}
    >
      <span className={`flex h-8 items-center gap-1.5 rounded-full border bg-[var(--zafi-card)] px-[11px] ${BORDER}`}>
        <span aria-hidden className="h-[7px] w-[7px] rounded-full" style={{ background: score.color }} />
        <span className={`font-outfit text-[13px] font-bold ${TEXT_STRONG}`}>{score.total}</span>
      </span>
    </Link>
  )
}

/** "Qué lo compone": cada parte con su detalle, barra, consejo y acción. */
export function ScoreParts({ score }: { score: HealthScoreResult }) {
  return (
    <ListCard>
      {score.components.map((p) => {
        const color = partColor(p.score, p.max)
        return (
          <div key={p.key} className={`flex flex-col gap-2 py-3 ${ROW_DIVIDER}`}>
            <div className="flex items-center gap-3">
              <Tile>{p.emoji}</Tile>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>{p.label}</span>
                <span className={`text-[13px] leading-[1.35] ${TEXT_MUTED}`}>{p.detail}</span>
              </span>
              <span className="flex-none font-outfit text-base font-bold" style={{ color }}>
                {p.score}<span className={`text-[13px] font-semibold ${TEXT_FAINT}`}>/{p.max}</span>
              </span>
            </div>
            <ProgressBar ratio={p.score / p.max} color={color} />
            <span className="flex items-center justify-between gap-2">
              <span className={`text-[13px] leading-[1.4] ${TEXT_MUTED}`}>{p.tip}</span>
              {p.action && (
                <Link href={p.action.href} className={`flex min-h-8 flex-none items-center text-[13.5px] font-semibold ${LINK_TEXT}`}>
                  {p.action.label} ›
                </Link>
              )}
            </span>
          </div>
        )
      })}
    </ListCard>
  )
}

/** "Cómo ha cambiado": columnas por mes; la actual con el color del puntaje. */
export function ScoreHistoryChart({ points, color }: { points: ScoreHistoryPoint[]; color: string }) {
  return (
    <div className={`px-3.5 pb-3 pt-4 ${CARD}`}>
      <div className="flex h-[120px] items-end gap-2.5">
        {points.map((p, i) => {
          const last = i === points.length - 1
          return (
            <div key={p.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className={`font-outfit text-[13px] font-bold ${last ? TEXT_STRONG : TEXT_FAINT}`}>{p.score}</span>
              <div
                className="w-full max-w-8 rounded-md transition-[height,background-color] duration-[600ms]"
                style={{ height: (p.score / 100) * 80, background: last ? color : 'var(--zafi-border)' }}
              />
              <span className={`text-xs ${TEXT_MUTED}`}>{shortMonthName(p.month)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
