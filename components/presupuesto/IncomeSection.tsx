'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { IncomeEntry } from '@/types'

const INCOME_SUGGESTIONS = ['Salario', 'Bonos', 'Freelance', 'Alquiler', 'Negocio', 'Pensión', 'Remesas', 'Otros']

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  mensual: 1,
  quincenal: 2,
  semanal: 4.33,
  anual: 1 / 12,
}

interface Props {
  income: number
  incomeEntries: IncomeEntry[]
  onAddIncomeEntry: (source?: string) => void
  onUpdateIncomeEntry: (id: string, field: string, value: string | number) => void
  onDeleteIncomeEntry: (id: string) => void
  fmt: (amount: number) => string
}

export function IncomeSection({
  income, incomeEntries,
  onAddIncomeEntry, onUpdateIncomeEntry, onDeleteIncomeEntry,
  fmt,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18,
      padding: '20px 28px', marginBottom: 20,
    }}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: '#F0FDF4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v14M1 8h14" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif", fontSize: 18, fontWeight: 700,
              color: '#1E3A5F', margin: 0,
            }}>
              Ingresos
            </h2>
            <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
              {incomeEntries.length} fuente{incomeEntries.length !== 1 ? 's' : ''} &middot; {fmt(income)}/mes
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#16A34A' }}>{fmt(income)}</span>
          {expanded
            ? <ChevronUp style={{ width: 18, height: 18, color: '#94A3B8' }} />
            : <ChevronDown style={{ width: 18, height: 18, color: '#94A3B8' }} />
          }
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: 16, borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
          {/* Quick-add chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {INCOME_SUGGESTIONS.filter(s => !incomeEntries.some(e => e.source === s)).map((s) => (
              <button
                key={s}
                onClick={() => onAddIncomeEntry(s)}
                style={{
                  padding: '4px 12px', fontSize: 11, borderRadius: 20,
                  border: '1px solid #BBD4F1', background: '#fff',
                  color: '#2563EB', cursor: 'pointer', fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                <Plus style={{ width: 10, height: 10 }} />
                {s}
              </button>
            ))}
          </div>

          {/* Income entries */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {incomeEntries.map((entry) => (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#FAFBFC', border: '1px solid #F1F5F9', borderRadius: 10,
                padding: '8px 12px',
              }}>
                <div style={{ width: 4, height: 28, borderRadius: 4, background: '#10B981', flexShrink: 0 }} />
                <Input
                  className="flex-1 h-8 text-sm min-w-0"
                  placeholder="Fuente de ingreso"
                  value={entry.source}
                  onChange={(e) => onUpdateIncomeEntry(entry.id, 'source', e.target.value)}
                />
                <select
                  className="text-xs border rounded-lg px-2 py-1.5 bg-white text-gray-600 flex-shrink-0"
                  value={entry.member}
                  onChange={(e) => onUpdateIncomeEntry(entry.id, 'member', e.target.value)}
                >
                  <option value="Persona 1">Persona 1</option>
                  <option value="Persona 2">Persona 2</option>
                  <option value="Persona 3">Persona 3</option>
                  <option value="Hogar">Hogar</option>
                </select>
                <select
                  className="text-xs border rounded-lg px-2 py-1.5 bg-white text-gray-600 flex-shrink-0"
                  value={entry.frequency}
                  onChange={(e) => onUpdateIncomeEntry(entry.id, 'frequency', e.target.value)}
                >
                  <option value="mensual">Mensual</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="semanal">Semanal</option>
                  <option value="anual">Anual</option>
                </select>
                <div style={{ position: 'relative', width: 110, flexShrink: 0 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94A3B8' }}>Q</span>
                  <Input
                    type="number"
                    className="pl-7 h-8 text-sm text-right"
                    placeholder="0"
                    value={entry.amount || ''}
                    onChange={(e) => onUpdateIncomeEntry(entry.id, 'amount', parseFloat(e.target.value) || 0)}
                  />
                </div>
                {entry.frequency !== 'mensual' && entry.amount > 0 && (
                  <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0, width: 60, textAlign: 'right' }}>
                    {fmt(Math.round(entry.amount * (FREQUENCY_MULTIPLIER[entry.frequency] || 1) * 100) / 100)}/mes
                  </span>
                )}
                <button
                  onClick={() => onDeleteIncomeEntry(entry.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#CBD5E1' }}
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => onAddIncomeEntry()}
            style={{
              marginTop: 12, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: '#2563EB',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Plus style={{ width: 14, height: 14 }} /> Agregar ingreso
          </button>

          {incomeEntries.length > 0 && (
            <div style={{
              marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#334155' }}>Ingreso mensual total</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1E3A5F' }}>{fmt(income)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
