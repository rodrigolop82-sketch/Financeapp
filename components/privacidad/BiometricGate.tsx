'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { authenticate, biometricAvailable, readLockEnabled } from '@/lib/biometria'

/**
 * Al abrir la app con el bloqueo activo, cubre la pantalla y pide Face ID o
 * huella antes de mostrar datos. En la web (sin Capacitor) no hace nada.
 */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function BiometricGate() {
  const [locked, setLocked] = useState(false)

  const unlock = useCallback(async () => {
    if (await authenticate()) setLocked(false)
  }, [])

  // Antes de pintar: si el bloqueo está activo en este teléfono, se cubre ya.
  useBeforePaint(() => {
    if (!readLockEnabled()) return
    setLocked(true)
    let cancelled = false
    void biometricAvailable().then((ok) => {
      if (cancelled) return
      if (!ok) { setLocked(false); return }
      void unlock()
    })
    return () => { cancelled = true }
  }, [unlock])

  if (!locked) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Zafi está bloqueada"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 px-6 text-center text-white"
      style={{ background: 'var(--zafi-hero)' }}
    >
      <span className="font-serif text-[34px] leading-none">zafi</span>
      <span className="text-[15px] text-[#CBD8E8]">Zafi está bloqueada</span>
      <button
        type="button"
        onClick={() => void unlock()}
        className="flex h-[46px] items-center rounded-full bg-white px-6 font-semibold text-navy"
      >
        Desbloquear
      </button>
    </div>
  )
}
