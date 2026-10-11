'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RecurringData } from '@/lib/recurring/data'

export interface RecurringResponse extends RecurringData {
  features: { reminders: boolean }
  canWrite: boolean
}

export type RecurringState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; data: RecurringResponse }

/** Cobros recurrentes del hogar (GET /api/recurring). */
export function useRecurring() {
  const [state, setState] = useState<RecurringState>({ status: 'loading' })
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/recurring', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setState({ status: 'ok', data: (await res.json()) as RecurringResponse })
    } catch {
      setState({ status: 'error' })
    }
  }, [])
  useEffect(() => { void load() }, [load])
  return { state, reload: load, setState }
}

export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'No se pudo guardar. Intenta de nuevo.' }
  } catch {
    return { ok: false, error: 'Sin conexión. Intenta de nuevo.' }
  }
}
