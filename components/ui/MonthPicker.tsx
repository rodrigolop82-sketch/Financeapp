'use client'

import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

interface MonthPickerProps {
  value: string // YYYY-MM
  onChange: (month: string) => void
  label?: string
  maxMonth?: string // YYYY-MM, defaults to current month
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function MonthPicker({ value, onChange, label, maxMonth }: MonthPickerProps) {
  const [year, month] = value.split('-').map(Number)
  const max = maxMonth ?? new Date().toISOString().slice(0, 7)
  const [maxYear, maxMonth2] = max.split('-').map(Number)

  const isAtMax = year === maxYear && month === maxMonth2
  const isAtMin = year <= 2020 && month <= 1

  function shift(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    onChange(`${y}-${m}`)
  }

  return (
    <div className="flex items-center gap-1.5">
      {label && (
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <Calendar className="w-3.5 h-3.5" />
          {label}
        </span>
      )}
      <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg px-1 py-0.5">
        <button
          onClick={() => shift(-1)}
          disabled={isAtMin}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
        </button>
        <span className="text-xs font-medium text-navy px-1.5 min-w-[110px] text-center">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button
          onClick={() => shift(1)}
          disabled={isAtMax}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
        </button>
      </div>
    </div>
  )
}
