'use client'
import { useState, useEffect } from 'react'

interface ProcessingScreenProps {
  bankDetected: string | null
  isLoading: boolean
  /** Qué se está leyendo: el PDF (por defecto) o una foto. */
  source?: 'pdf' | 'photo'
}

/** Cuándo pasa a cada paso mientras se espera la respuesta (ms). */
const STEP_AT = [0, 2500, 6000]

/**
 * Leyendo el estado de cuenta: barra de progreso y tres pasos que pasan
 * de spinner a check (con `pop`). El último paso espera la respuesta.
 */
export function ProcessingScreen({ bankDetected, isLoading, source = 'pdf' }: ProcessingScreenProps) {
  // Paso en curso (0–2); 3 = todo listo.
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setStep(3)
      return
    }
    setStep(0)
    const timers = STEP_AT.slice(1).map((ms, i) => setTimeout(() => setStep(i + 1), ms))
    return () => timers.forEach(clearTimeout)
  }, [isLoading])

  const steps = [
    source === 'photo' ? 'Leyendo la foto' : 'Leyendo el PDF',
    step > 1 && bankDetected && bankDetected !== 'Desconocido' ? `Encontrando movimientos de ${bankDetected}` : 'Encontrando movimientos',
    'Buscando duplicados',
  ]
  // Mientras espera el último paso, la barra no llega al final.
  const pct = step >= 3 ? 100 : Math.min(90, ((step + 0.5) / 3) * 100)

  return (
    <div className="px-4 pt-3.5 pb-8" role="status" aria-live="polite">
      <div className="flex flex-col gap-4 rounded-[20px] border border-navy/[0.08] bg-white px-[18px] py-[22px]">
        <div className="flex flex-col gap-2">
          <span className="text-[17px] font-bold text-ink-900">
            {step >= 3 ? '¡Listo!' : 'Leyendo tu estado de cuenta…'}
          </span>
          <div
            className="h-2 overflow-hidden rounded-[5px] bg-[#EEF1F6]"
            role="progressbar"
            aria-label="Progreso"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
          >
            <div
              className="h-full rounded-[5px] bg-electric"
              style={{ width: `${pct}%`, transition: 'width .7s cubic-bezier(.4,0,.2,1)' }}
            />
          </div>
        </div>
        {steps.map((label, i) => {
          const done = step > i
          const active = step === i
          return (
            <div
              key={i}
              className="flex items-center gap-3 transition-opacity duration-300"
              style={{ opacity: step >= i ? 1 : 0.4 }}
            >
              {done ? (
                <span
                  aria-hidden
                  className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-success-dark text-sm font-extrabold text-white animate-pop"
                  style={{ animationDuration: '.35s' }}
                >
                  ✓
                </span>
              ) : active ? (
                <span aria-hidden className="m-0.5 h-[22px] w-[22px] flex-none rounded-full border-[2.5px] border-electric-ghost border-t-electric animate-spin" />
              ) : (
                <span aria-hidden className="m-0.5 h-[22px] w-[22px] flex-none rounded-full border-2 border-ink-100" />
              )}
              <span className="text-[15px] font-semibold text-ink-900">{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
