'use client'

// Barra de avance de un evento o un concepto: lo gastado contra lo planeado,
// cuánto queda o cuánto se pasó. Si se pasó, el tramo extra va en rojo.

import { avance, type EstadoAvance } from '@/lib/eventos'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'

const COLOR: Record<EstadoAvance, string> = {
  dentro: '#2563EB',
  casi: '#F59E0B',
  pasado: '#2563EB',
  sin_presupuesto: '#94A3B8',
}
const EXCESO = '#EF4444'

export function AvanceBar({ presupuesto, gastado, fmt, inverse = false }: {
  presupuesto: number
  gastado: number
  fmt: (n: number) => string
  /** Sobre el fondo oscuro del encabezado. */
  inverse?: boolean
}) {
  const a = avance(presupuesto, gastado)
  const muted = inverse ? 'text-[#CBD8E8]' : TEXT_MUTED
  const strong = inverse ? 'text-white' : TEXT_STRONG
  const estadoTexto =
    a.estado === 'pasado' ? `Te pasaste ${fmt(a.exceso)}`
    : a.estado === 'sin_presupuesto' ? (gastado > 0 ? 'Sin presupuesto' : 'Sin presupuesto ni gastos')
    : `Quedan ${fmt(a.restante)}`
  const estadoClase =
    a.estado === 'pasado' ? 'text-danger-text dark:text-[var(--zafi-error-text)]'
    : a.estado === 'casi' ? 'text-warning-text dark:text-warning'
    : muted
  const label = a.pct === null
    ? `${fmt(gastado)} gastado sin presupuesto`
    : `${fmt(gastado)} de ${fmt(presupuesto)}, ${a.pct}%. ${estadoTexto}`

  return (
    <div className="flex flex-col gap-1.5" role="img" aria-label={label}>
      <span className={`flex h-2 w-full overflow-hidden rounded-full ${inverse ? 'bg-white/15' : 'bg-[var(--zafi-border-light)]'}`}>
        <span className="block h-full transition-[width] duration-[600ms]" style={{ width: `${a.barra.dentro * 100}%`, background: inverse && a.estado !== 'casi' ? '#60A5FA' : COLOR[a.estado] }} />
        {a.barra.exceso > 0 && (
          <span className="block h-full border-l-2 border-[var(--zafi-card)] transition-[width] duration-[600ms]" style={{ width: `${a.barra.exceso * 100}%`, background: a.estado === 'sin_presupuesto' ? COLOR.sin_presupuesto : EXCESO }} />
        )}
      </span>
      <span className="flex items-baseline justify-between gap-3 text-[13px] [font-variant-numeric:tabular-nums]">
        <span className={muted}>
          {/* En el encabezado el monto gastado ya está arriba, en grande. */}
          {!inverse && <b className={`font-semibold ${strong}`}>{fmt(gastado)} </b>}
          {a.pct !== null && <>de {fmt(presupuesto)} · {a.pct}%</>}
        </span>
        <span className={`font-semibold ${estadoClase}`}>{estadoTexto}</span>
      </span>
    </div>
  )
}
