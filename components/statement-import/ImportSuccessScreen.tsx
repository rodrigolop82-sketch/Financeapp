'use client'
import { useEffect, useState } from 'react'
import { formatMoney } from '@/lib/format'
import type { ImportStats } from '@/hooks/useStatementImport'
import { SuccessCheck } from '@/components/motion/SuccessCheck'
import { CountUp } from '@/components/motion/CountUp'
import { Confetti } from '@/components/motion/Confetti'

interface ImportSuccessScreenProps {
  stats: ImportStats
  /** "Ver movimientos": abre Movimientos con el banner de lo importado. */
  onSeeMovements: () => void
  /** Revierte la importación. */
  onUndo: () => Promise<void> | void
}

const money = (n: number) => formatMoney(n)

/**
 * ¡Listo!: check grande sobre navy, confeti breve, cuatro cifras que cuentan
 * hacia arriba y "Ver movimientos". Vibra una vez al llegar.
 */
export function ImportSuccessScreen({ stats, onSeeMovements, onUndo }: ImportSuccessScreenProps) {
  const [undoing, setUndoing] = useState(false)

  useEffect(() => {
    navigator.vibrate?.([12, 40, 12])
  }, [])

  const cards = [
    { label: 'Movimientos nuevos', value: stats.imported, format: undefined, duration: 1000, size: 'text-[28px]', color: 'text-ink-900 dark:text-ink-100' },
    { label: 'Duplicados evitados', value: stats.duplicatesSkipped, format: undefined, duration: 700, size: 'text-[28px]', color: 'text-warning-text dark:text-warning' },
    { label: 'Gastos', value: stats.totalAmount, format: money, duration: 1200, size: 'text-[22px]', color: 'text-ink-900 dark:text-ink-100' },
    { label: 'Ingresos recibidos', value: stats.incomeAmount, format: money, duration: 1200, size: 'text-[22px]', color: 'text-success-dark dark:text-[var(--zafi-success-text)]' },
  ]

  return (
    <div className="relative overflow-hidden px-4 pt-3.5 pb-8">
      <Confetti top={60} />
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col items-center gap-2.5 rounded-[20px] bg-navy px-[18px] py-6 text-center text-white">
          <SuccessCheck
            size={84}
            delay={0.05}
            title="¡Listo! Importamos tu estado"
            subtitle="Revisa en Movimientos si algo quedó en otra categoría."
            titleClassName="text-xl font-bold text-white"
            subtitleClassName="text-sm text-[#CBD8E8]"
            className="!gap-2.5"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {cards.map((c, i) => (
            <div
              key={c.label}
              className="flex flex-col gap-0.5 rounded-2xl border border-navy/[0.08] bg-[var(--zafi-card)] p-3.5 animate-fade-up"
              style={{ animationDelay: `${0.5 + i * 0.1}s` }}
            >
              <span className="text-[13px] text-ink-700 dark:text-ink-200">{c.label}</span>
              <span className={`font-outfit font-extrabold ${c.size} ${c.color}`}>
                <CountUp value={c.value} from={0} delay={500} duration={c.duration} format={c.format} />
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onSeeMovements}
          className="h-[52px] rounded-full bg-electric text-base font-bold text-white transition duration-150 hover:bg-electric-dark active:scale-[0.96] animate-fade-up"
          style={{ animationDelay: '.9s' }}
        >
          Ver movimientos
        </button>
        <button
          type="button"
          disabled={undoing}
          onClick={async () => { setUndoing(true); await onUndo() }}
          className="h-11 text-[14.5px] font-semibold text-ink-500 disabled:opacity-60"
        >
          {undoing ? 'Deshaciendo…' : 'Deshacer la importación'}
        </button>
      </div>
    </div>
  )
}
