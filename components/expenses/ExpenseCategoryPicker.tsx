'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import type { BudgetCategory } from '@/types'
import type { CategoryWithProgress } from './useExpenseForm'

const CATEGORY_ICONS: Record<string, string> = {
  'Vivienda/alquiler': '🏠',
  'Alimentación': '🛒',
  'Transporte': '🚗',
  'Salud/medicinas': '💊',
  'Servicios': '⚡',
  'Educación': '📚',
  'Restaurantes y salidas': '🍽️',
  'Ropa': '👕',
  'Entretenimiento': '🎬',
  'Suscripciones': '📱',
  'Varios personales': '💼',
  'Fondo de emergencia': '🛡️',
  'Ahorro para metas': '🎯',
  'Pago extra de deudas': '💳',
}

function getIcon(name: string): string {
  return CATEGORY_ICONS[name] ?? '📋'
}

interface ExpenseCategoryPickerProps {
  recentCategories: BudgetCategory[]
  allCategories: CategoryWithProgress[]
  selected: BudgetCategory | null
  onSelect: (cat: BudgetCategory) => void
}

export function ExpenseCategoryPicker({
  recentCategories,
  allCategories,
  selected,
  onSelect,
}: ExpenseCategoryPickerProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      {recentCategories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {recentCategories.map(cat => {
            const active = selected?.id === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => onSelect(cat)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 20,
                  border: active ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                  background: active ? '#EFF6FF' : '#FAFAFA',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  color: active ? '#2563EB' : '#374151',
                  transition: 'border-color 0.15s, background 0.15s, color 0.15s',
                }}
              >
                <span>{getIcon(cat.name)}</span>
                <span>{cat.name}</span>
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 2px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: '#2563EB',
        }}
      >
        <span>＋ Todas las categorías</span>
        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      <div style={{ maxHeight: expanded ? 340 : 0, overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <div style={{ paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {allCategories.map(cat => {
            const active = selected?.id === cat.id
            const overBudget = cat.percentage >= 100
            const nearLimit = cat.percentage >= 80
            return (
              <button
                key={cat.id}
                onClick={() => { onSelect(cat); setExpanded(false) }}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '10px 12px', borderRadius: 10,
                  border: active ? '1.5px solid #2563EB' : '1px solid #F1F5F9',
                  background: active ? '#EFF6FF' : '#FAFAFA',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: cat.budgeted_amount > 0 ? 6 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15 }}>{getIcon(cat.name)}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1E3A5F' }}>{cat.name}</span>
                  </div>
                  {cat.budgeted_amount > 0 && (
                    <span style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap', marginLeft: 8 }}>
                      {formatMoney(cat.spentAmount)} / {formatMoney(cat.budgeted_amount)}
                    </span>
                  )}
                </div>
                {cat.budgeted_amount > 0 && (
                  <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${cat.percentage}%`,
                      background: overBudget ? '#EF4444' : nearLimit ? '#F59E0B' : '#2563EB',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
