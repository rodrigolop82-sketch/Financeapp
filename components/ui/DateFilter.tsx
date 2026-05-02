'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

interface DateFilterProps {
  dateFrom: string // YYYY-MM-DD
  dateTo: string   // YYYY-MM-DD
  onChange: (from: string, to: string) => void
  /** Render as dark strip (inside navy hero card) or light (standalone) */
  variant?: 'dark' | 'light'
  /** Show top border separator (default true for dark, false for light) */
  showBorder?: boolean
}

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function monthStart(ym: string) { return `${ym}-01` }
function monthEnd(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}
function toYM(date: string) { return date.slice(0, 7) }
function currentYM() { return todayStr().slice(0, 7) }

function formatPeriod(from: string, to: string): string {
  const fromYM = toYM(from)
  const toYM2 = toYM(to)
  if (fromYM === toYM2) {
    const [y, m] = fromYM.split('-').map(Number)
    const isFullMonth = from === monthStart(fromYM) && to === monthEnd(fromYM)
    if (isFullMonth) return `${MONTHS[m - 1]} ${y}`
    // partial month
    const fd = from.slice(8)
    const td = to.slice(8)
    return `${Number(fd)} – ${Number(td)} ${MONTHS[m - 1]} ${y}`
  }
  // cross-month range
  const [fy, fm] = fromYM.split('-').map(Number)
  const [ty, tm] = toYM2.split('-').map(Number)
  const fromLabel = `${Number(from.slice(8))} ${MONTHS[fm - 1].slice(0, 3)}`
  const toLabel = `${Number(to.slice(8))} ${MONTHS[tm - 1].slice(0, 3)}${ty !== fy ? ` ${ty}` : ''}`
  return `${fromLabel} – ${toLabel}`
}

export function DateFilter({ dateFrom, dateTo, onChange, variant = 'dark', showBorder }: DateFilterProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState(dateFrom)
  const [customTo, setCustomTo] = useState(dateTo)

  const currentMonth = currentYM()
  const displayedYM = toYM(dateFrom)
  const isCurrentMonth = displayedYM === currentMonth && dateFrom === monthStart(displayedYM) && dateTo === monthEnd(displayedYM)

  function shiftMonth(delta: number) {
    const [y, m] = displayedYM.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    onChange(monthStart(ym), monthEnd(ym))
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      onChange(customFrom, customTo)
      setShowCustom(false)
    }
  }

  const isDark = variant === 'dark'
  const textMuted = isDark ? 'text-white/50' : 'text-gray-400'
  const textMain = isDark ? 'text-white' : 'text-navy'
  const borderColor = isDark ? 'border-white/10' : 'border-gray-200'
  const hoverBg = isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'
  const panelBg = isDark ? 'bg-[#162d4a] border-white/10' : 'bg-gray-50 border-gray-200'
  const hasBorder = showBorder ?? isDark

  return (
    <div className={hasBorder ? `border-t ${borderColor}` : ''} style={{ padding: '8px 14px 10px' }}>
      {/* Main filter row */}
      <div className="flex items-center justify-between">
        {/* Month navigation */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => shiftMonth(-1)}
            disabled={displayedYM <= '2020-01'}
            className={`p-1.5 rounded-lg ${hoverBg} disabled:opacity-30 transition-colors`}
          >
            <ChevronLeft className={`w-3.5 h-3.5 ${textMuted}`} />
          </button>

          <span className={`text-sm font-semibold ${textMain} min-w-[130px] text-center`}>
            {formatPeriod(dateFrom, dateTo)}
          </span>

          <button
            onClick={() => shiftMonth(1)}
            disabled={displayedYM >= currentMonth}
            className={`p-1.5 rounded-lg ${hoverBg} disabled:opacity-30 transition-colors`}
          >
            <ChevronRight className={`w-3.5 h-3.5 ${textMuted}`} />
          </button>
        </div>

        {/* Right side: "Hoy" shortcut + custom range toggle */}
        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <button
              onClick={() => { onChange(monthStart(currentMonth), monthEnd(currentMonth)); setShowCustom(false) }}
              className={`text-xs px-2 py-1 rounded-lg ${hoverBg} ${textMuted} transition-colors`}
            >
              Hoy
            </button>
          )}
          <button
            onClick={() => { setCustomFrom(dateFrom); setCustomTo(dateTo); setShowCustom(v => !v) }}
            className={`p-1.5 rounded-lg ${hoverBg} transition-colors ${showCustom ? (isDark ? 'bg-white/15' : 'bg-gray-100') : ''}`}
            title="Rango personalizado"
          >
            <Calendar className={`w-3.5 h-3.5 ${showCustom ? (isDark ? 'text-electric' : 'text-electric') : textMuted}`} />
          </button>
        </div>
      </div>

      {/* Custom range panel */}
      {showCustom && (
        <div className={`mt-2 rounded-xl border ${panelBg} p-3`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${textMain}`}>Rango personalizado</span>
            <button onClick={() => setShowCustom(false)} className={`${textMuted} ${hoverBg} rounded p-0.5`}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
              <label className={`text-[10px] ${textMuted} uppercase tracking-wide`}>Desde</label>
              <input
                type="date"
                value={customFrom}
                max={customTo || todayStr()}
                onChange={(e) => setCustomFrom(e.target.value)}
                className={`text-xs rounded-lg border px-2 py-1.5 bg-transparent ${textMain} ${borderColor} focus:outline-none`}
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
              />
            </div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
              <label className={`text-[10px] ${textMuted} uppercase tracking-wide`}>Hasta</label>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayStr()}
                onChange={(e) => setCustomTo(e.target.value)}
                className={`text-xs rounded-lg border px-2 py-1.5 bg-transparent ${textMain} ${borderColor} focus:outline-none`}
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
              />
            </div>
            <button
              onClick={applyCustom}
              disabled={!customFrom || !customTo || customFrom > customTo}
              className="mt-4 px-3 py-1.5 rounded-lg bg-electric text-white text-xs font-semibold disabled:opacity-40 hover:bg-electric-dark transition-colors flex-shrink-0"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
