'use client'
import { useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export interface SelectedMonth {
  month: string       // YYYY-MM
  year: number
  monthIndex: number   // 0-based
  isCurrent: boolean
  isClosed: boolean
  label: string        // e.g. "septiembre 2026"
  shortLabel: string   // e.g. "sep"
  goPrev: () => void
  goNext: () => void
  setMonth: (m: string) => void
}

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const SHORT_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function isValidMonth(m: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(m)
}

function addMonths(m: string, delta: number): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function useSelectedMonth(availableMonths?: string[]): SelectedMonth {
  const router = useRouter()
  const searchParams = useSearchParams()
  const raw = searchParams.get('mes')
  const current = getCurrentMonth()

  const month = useMemo(() => {
    if (raw && isValidMonth(raw)) {
      if (raw > current) return current
      if (availableMonths && availableMonths.length > 0) {
        const earliest = availableMonths[0]
        if (raw < earliest) return earliest
      }
      return raw
    }
    return current
  }, [raw, current, availableMonths])

  const [year, monthIndex] = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    return [y, m - 1]
  }, [month])

  const isCurrent = month === current
  const isClosed = !isCurrent

  const label = `${MONTH_NAMES[monthIndex]} ${year}`
  const shortLabel = SHORT_NAMES[monthIndex]

  const navigate = useCallback((m: string) => {
    if (m === current) {
      router.push('/resumen', { scroll: false })
    } else {
      router.push(`/resumen?mes=${m}`, { scroll: false })
    }
  }, [router, current])

  const goPrev = useCallback(() => {
    const prev = addMonths(month, -1)
    if (availableMonths && availableMonths.length > 0 && prev < availableMonths[0]) return
    navigate(prev)
  }, [month, availableMonths, navigate])

  const goNext = useCallback(() => {
    const next = addMonths(month, 1)
    if (next > current) return
    navigate(next)
  }, [month, current, navigate])

  const setMonth = useCallback((m: string) => {
    if (!isValidMonth(m)) return
    if (m > current) return
    navigate(m)
  }, [current, navigate])

  return { month, year, monthIndex, isCurrent, isClosed, label, shortLabel, goPrev, goNext, setMonth }
}

export { MONTH_NAMES, SHORT_NAMES }
