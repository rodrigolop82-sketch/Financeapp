'use client'

import { useEffect, useState } from 'react'
import { isSharedHousehold, type Person } from '@/lib/hogar'

interface People {
  householdId: string | null
  me: string | null
  people: Person[]
  /** 2+ personas con acceso completo: se pregunta quién pagó. */
  shared: boolean
  byId: (id: string | null | undefined) => Person | null
}

let cached: Promise<{ householdId: string | null; me: string | null; people: Person[] }> | null = null

function load() {
  return fetch('/api/household/people', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { householdId: null, me: null, people: [] }))
    .catch(() => ({ householdId: null, me: null, people: [] }))
}

/** Vuelve a pedir las personas (p. ej. al agregar o quitar a alguien). */
export function refreshHouseholdPeople() {
  cached = load()
  return cached
}

export function useHouseholdPeople(): People {
  const [data, setData] = useState<{ householdId: string | null; me: string | null; people: Person[] }>({ householdId: null, me: null, people: [] })
  useEffect(() => {
    let alive = true
    ;(cached ??= load()).then((d) => { if (alive) setData(d) })
    return () => { alive = false }
  }, [])
  const map = new Map(data.people.map((p) => [p.id, p]))
  return {
    ...data,
    shared: isSharedHousehold(data.people),
    byId: (id) => (id ? map.get(id) ?? null : null),
  }
}
