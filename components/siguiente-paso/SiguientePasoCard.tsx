'use client'

import Link from 'next/link'
import { TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { CARD, GREEN_TEXT } from '@/components/resumen/ctf-ui'
import { pasoEfecto, pasoTitulo, VAS_MUY_BIEN } from '@/lib/siguiente-paso/texto'
import { useSiguientePaso } from './useSiguientePaso'

/** F1: tarjeta de Inicio con el primer paso. Sin puntaje (sin ingresos) no aparece. */
export function SiguientePasoCard({ householdId, fmt, reloadKey }: { householdId: string; fmt: (n: number) => string; reloadKey?: number }) {
  const { loading, score, pasos } = useSiguientePaso(householdId, reloadKey)
  if (loading || !score || score.components.length === 0) return null
  const paso = pasos[0]

  return (
    <section aria-label="Tu siguiente mejor paso" className={`mt-3 flex flex-col gap-2 p-4 ${CARD}`}>
      <span className={`text-[13px] font-semibold ${TEXT_MUTED}`}>Tu siguiente mejor paso</span>
      {paso ? (
        <>
          <span className={`text-[16px] font-semibold leading-[1.35] [text-wrap:pretty] ${TEXT_STRONG}`}>{pasoTitulo(paso, fmt)}</span>
          <span className={`text-sm font-semibold ${GREEN_TEXT}`}>{pasoEfecto(paso)}</span>
          <Link href="/plan/siguiente-paso" className="mt-1 flex h-11 items-center self-start rounded-full bg-electric px-5 text-sm font-semibold text-white">
            Ver mi plan
          </Link>
        </>
      ) : (
        <span className={`text-[15px] leading-[1.4] ${TEXT_STRONG}`}>{VAS_MUY_BIEN}</span>
      )}
    </section>
  )
}
