'use client'

// Medidor de un límite de Gratis, antes de llegar a él: texto 13px, "1 de 2"
// en Outfit y barra sm (azul < 50%, ámbar ≥ 50%).

import { ProgressBar } from '@/components/plan/ui'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { meterColor } from '@/lib/premium'

export function LimitMeter({ used, limit, text, className = '' }: { used: number; limit: number; text: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 px-1 ${className}`}>
      <span className={`flex justify-between gap-2 text-[13px] ${TEXT_MUTED}`}>
        <span>{text}</span>
        <b className={`flex-none font-outfit ${TEXT_STRONG}`}>{used} de {limit}</b>
      </span>
      <ProgressBar ratio={limit > 0 ? used / limit : 1} color={meterColor(used, limit)} className="!h-1" />
    </div>
  )
}
