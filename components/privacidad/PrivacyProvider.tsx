'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { maskFormatter, readLocalHidden, writeLocalHidden } from '@/lib/privacidad'

// Ocultar saldos (F9): un solo estado para el ojo de Inicio y el interruptor
// de Cuenta. La preferencia vive en users.ocultar_saldos (entre dispositivos)
// con una copia local para resolverla antes de pintar montos.

interface PrivacyState {
  hidden: boolean
  /** La preferencia ya se conoce (copia local o respuesta de la cuenta). */
  resolved: boolean
  setHidden: (hidden: boolean) => Promise<boolean>
}

const PrivacyContext = createContext<PrivacyState>({
  hidden: false,
  resolved: true,
  setHidden: async () => false,
})

// useLayoutEffect en el navegador (antes de pintar); useEffect en el servidor.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(false)
  const [resolved, setResolved] = useState(false)

  useBeforePaint(() => {
    const local = readLocalHidden()
    if (local !== null) {
      setHiddenState(local)
      setResolved(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data, error } = await supabase.from('users').select('ocultar_saldos').eq('id', user.id).single()
        // Sin la migración la columna no existe: se queda en false.
        if (cancelled || error || !data) return
        const value = !!(data as { ocultar_saldos?: boolean | null }).ocultar_saldos
        setHiddenState(value)
        writeLocalHidden(value)
      } catch {
        // Sin red: se queda con la copia local.
      } finally {
        if (!cancelled) setResolved(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const setHidden = useCallback(async (next: boolean) => {
    setHiddenState(next)
    writeLocalHidden(next)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return true
    const { error } = await supabase.from('users').update({ ocultar_saldos: next }).eq('id', user.id)
    if (error) {
      setHiddenState(!next)
      writeLocalHidden(!next)
      return false
    }
    return true
  }, [])

  const value = useMemo(() => ({ hidden, resolved, setHidden }), [hidden, resolved, setHidden])
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}

export function usePrivacy(): PrivacyState {
  return useContext(PrivacyContext)
}

/** El formateador de montos, cubierto con "Q ••••" si Ocultar saldos está activo. */
export function useMaskedFmt<F extends (amount: number, ...rest: never[]) => string>(fmt: F): F {
  const { hidden } = usePrivacy()
  return useMemo(() => maskFormatter(fmt, hidden), [fmt, hidden])
}

/** Monto que respeta Ocultar saldos. */
export function Monto({ value, fmt, className }: { value: number; fmt: (n: number) => string; className?: string }) {
  const masked = useMaskedFmt(fmt)
  return <span className={className}>{masked(value)}</span>
}
