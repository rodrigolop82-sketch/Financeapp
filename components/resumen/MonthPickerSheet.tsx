'use client'
import { useState, useMemo } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SHORT_NAMES } from '@/hooks/useSelectedMonth'

interface MonthInfo {
  key: string         // YYYY-MM
  hasData: boolean
  result: 'ok' | 'warn' | 'bad' | 'live' | null
}

interface MonthPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selected: string    // YYYY-MM
  currentMonth: string // YYYY-MM
  availableMonths: MonthInfo[]
  onSelect: (month: string) => void
}

const RESULT_COLORS: Record<string, string> = {
  ok: '#22C55E',
  warn: '#F59E0B',
  bad: '#EF4444',
  live: '#7E93AE',
}

export function MonthPickerSheet({
  open, onOpenChange, selected, currentMonth, availableMonths, onSelect,
}: MonthPickerSheetProps) {
  const currentYear = parseInt(currentMonth.split('-')[0])
  const [viewYear, setViewYear] = useState(currentYear)

  const availableSet = useMemo(() => {
    const map = new Map<string, MonthInfo>()
    for (const m of availableMonths) map.set(m.key, m)
    return map
  }, [availableMonths])

  const years = useMemo(() => {
    const ySet = new Set<number>()
    for (const m of availableMonths) ySet.add(parseInt(m.key.split('-')[0]))
    ySet.add(currentYear)
    return Array.from(ySet).sort()
  }, [availableMonths, currentYear])

  const canPrevYear = years.length > 0 && viewYear > years[0]
  const canNextYear = viewYear < currentYear

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent style={{ maxHeight: '70vh', padding: '24px 28px 32px' }}>
        {/* Year navigator */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 20, marginBottom: 24,
        }}>
          <button
            onClick={() => canPrevYear && setViewYear(viewYear - 1)}
            disabled={!canPrevYear}
            style={{
              background: 'none', border: 'none', cursor: canPrevYear ? 'pointer' : 'default',
              padding: 6, opacity: canPrevYear ? 1 : 0.3,
            }}
          >
            <ChevronLeft style={{ width: 20, height: 20, color: '#1E3A5F' }} />
          </button>
          <span style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 800,
            fontSize: 20, color: '#1E3A5F',
          }}>
            {viewYear}
          </span>
          <button
            onClick={() => canNextYear && setViewYear(viewYear + 1)}
            disabled={!canNextYear}
            style={{
              background: 'none', border: 'none', cursor: canNextYear ? 'pointer' : 'default',
              padding: 6, opacity: canNextYear ? 1 : 0.3,
            }}
          >
            <ChevronRight style={{ width: 20, height: 20, color: '#1E3A5F' }} />
          </button>
        </div>

        {/* 4x3 grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
        }}>
          {SHORT_NAMES.map((name, i) => {
            const key = `${viewYear}-${String(i + 1).padStart(2, '0')}`
            const info = availableSet.get(key)
            const hasData = info?.hasData ?? false
            const isFuture = key > currentMonth
            const disabled = !hasData || isFuture
            const isSelected = key === selected
            const result = info?.result ?? null

            return (
              <button
                key={key}
                onClick={() => {
                  if (!disabled) {
                    onSelect(key)
                    onOpenChange(false)
                  }
                }}
                disabled={disabled}
                style={{
                  padding: '14px 8px', borderRadius: 12,
                  border: isSelected ? '2px solid #2563EB' : '2px solid transparent',
                  background: isSelected ? '#EFF6FF' : disabled ? '#F8F9FB' : '#fff',
                  cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{
                  fontSize: 14, fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? '#2563EB' : '#1E3A5F',
                }}>
                  {name}
                </span>
                {result && (
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: RESULT_COLORS[result] ?? '#7E93AE',
                  }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 16, justifyContent: 'center',
          marginTop: 20, fontSize: 12, color: '#8B9AAE',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
            Sobrante
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
            Ajustado
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
            Sobregiro
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7E93AE' }} />
            En curso
          </span>
        </div>

        <div style={{
          textAlign: 'center', marginTop: 16,
          fontSize: 12, color: '#8B9AAE', fontStyle: 'italic',
        }}>
          Solo se muestran meses con movimientos registrados
        </div>
      </SheetContent>
    </Sheet>
  )
}
