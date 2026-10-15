'use client'

import { Eye, EyeOff } from 'lucide-react'
import { usePrivacy } from './PrivacyProvider'

/** Ojo del encabezado de Inicio: alterna Ocultar saldos. */
export function OcultarSaldosButton() {
  const { hidden, setHidden } = usePrivacy()
  const label = hidden ? 'Mostrar saldos' : 'Ocultar saldos'
  return (
    <button
      type="button"
      onClick={() => void setHidden(!hidden)}
      aria-label={label}
      aria-pressed={hidden}
      title={label}
      className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full text-ink-500 transition-transform active:scale-95 dark:text-ink-400"
    >
      {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  )
}
