'use client'

import { useCallback, useEffect, useState } from 'react'
import type { NetWorthData } from '@/lib/networth/data'
import type { SourceKind } from '@/lib/networth/sources'

export interface NetWorthResponse extends NetWorthData {
  archived: { id: string; name: string; kind: SourceKind; archivedAt: string }[]
  features: { history: boolean }
  canWrite: boolean
}

export type NetWorthState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: NetWorthResponse }

export function useNetWorth(opts: { archived?: boolean } = {}) {
  const [state, setState] = useState<NetWorthState>({ status: 'loading' })
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/networth${opts.archived ? '?archivadas=1' : ''}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setState({ status: 'ok', data: (await res.json()) as NetWorthResponse })
    } catch {
      setState({ status: 'error' })
    }
  }, [opts.archived])
  useEffect(() => { void load() }, [load])
  return { state, reload: load }
}

export async function sendJson(url: string, method: 'POST' | 'PATCH', body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: data.error ?? 'No se pudo guardar. Intenta de nuevo.' }
  } catch {
    return { ok: false, error: 'Sin conexión. Intenta de nuevo.' }
  }
}
