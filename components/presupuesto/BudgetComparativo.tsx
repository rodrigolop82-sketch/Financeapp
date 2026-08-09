'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { MonthPicker } from '@/components/ui/MonthPicker'
import type { BudgetCategory } from '@/types'

const BUCKETS: { key: 'needs' | 'wants' | 'savings'; label: string; color: string }[] = [
  { key: 'needs',   label: 'Necesidades (50%)',   color: '#1E3A5F' },
  { key: 'wants',   label: 'Gustos (30%)',         color: '#2563EB' },
  { key: 'savings', label: 'Ahorro/Deudas (20%)',  color: '#8fc1fb' },
]

interface Props {
  level: 0 | 1 | 2
  onSetLevel: (level: 0 | 1 | 2) => void
  month: string
  onMonthChange: (month: string) => void
  categories: BudgetCategory[]
  spentByCategory: Record<string, number>
  totalBudgeted: number
  loading: boolean
  getCategoryTotal: (catId: string) => number
  fmt: (amount: number) => string
}

function fmtNum(n: number) {
  return n.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function varColor(diff: number, isSavings: boolean) {
  if (diff === 0) return '#94A3B8'
  if (isSavings) return diff > 0 ? '#16A34A' : '#D97706'
  return diff > 0 ? '#EF4444' : '#16A34A'
}

function varSign(diff: number) {
  if (diff > 0) return '+'
  if (diff < 0) return '-'
  return ''
}

export function BudgetComparativo({
  level, onSetLevel, month, onMonthChange,
  categories, spentByCategory, totalBudgeted, loading,
  getCategoryTotal, fmt,
}: Props) {
  const totalSpent = Object.values(spentByCategory).reduce((s, v) => s + v, 0)
  const totalDiff = totalSpent - totalBudgeted
  const totalPct = totalBudgeted > 0 ? Math.round((totalDiff / totalBudgeted) * 100) : 0

  const nextLevel = level === 0 ? 1 : level === 1 ? 2 : 0
  const levelLabels = ['Ver por grupo ▾', 'Ver por categoría ▾', 'Mostrar menos ▴']

  if (categories.length === 0) return null

  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18,
      padding: '24px 28px', marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{
          fontFamily: "'DM Serif Display', serif", fontSize: 20, fontWeight: 700,
          color: '#1E3A5F', margin: 0,
        }}>
          Comparativo
        </h2>
        <button
          onClick={() => onSetLevel(nextLevel)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, color: '#2563EB', whiteSpace: 'nowrap',
          }}
        >
          {levelLabels[level]}
        </button>
      </div>

      {/* Month picker */}
      <div style={{ marginBottom: 12 }}>
        <MonthPicker value={month} onChange={onMonthChange} />
      </div>

      {/* Summary line */}
      <div style={{ fontSize: 12, color: '#64748B', marginBottom: level > 0 ? 16 : 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
            Cargando...
          </div>
        ) : (
          <>
            Presupuesto: {fmt(totalBudgeted)} &middot; Real: {fmt(totalSpent)} &middot;{' '}
            <span style={{ fontWeight: 600, color: varColor(totalDiff, false) }}>
              Variación: {varSign(totalDiff)}{fmtNum(Math.abs(totalDiff))}
            </span>
          </>
        )}
        <p style={{ fontSize: 11, color: '#CBD5E1', margin: '4px 0 0' }}>
          Todas las cifras están en Quetzales (GTQ)
        </p>
      </div>

      {/* Level 1: By group */}
      {level >= 1 && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: level === 2 ? 16 : 0 }}>
          {BUCKETS.map(({ key, label, color }) => {
            const bucketCats = categories.filter(c => c.bucket === key)
            if (bucketCats.length === 0) return null
            const bucketBudgeted = bucketCats.reduce((s, c) => s + getCategoryTotal(c.id), 0)
            const bucketActual = bucketCats.reduce((s, c) => s + (spentByCategory[c.id] || 0), 0)
            const bucketDiff = bucketActual - bucketBudgeted
            const isSavings = key === 'savings'

            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10,
                background: '#F8FAFC', border: '1px solid #F1F5F9',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F' }}>{label}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <span style={{ color: '#64748B' }}>Presup: {fmtNum(bucketBudgeted)}</span>
                  <span style={{ color: '#64748B' }}>Real: {fmtNum(bucketActual)}</span>
                  <span style={{ fontWeight: 600, color: varColor(bucketDiff, isSavings) }}>
                    {varSign(bucketDiff)}{fmtNum(Math.abs(bucketDiff))}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Level 2: By category */}
      {level === 2 && !loading && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748B', padding: '8px 4px' }}>Categoría</th>
                <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748B', padding: '8px 4px' }}>Tipo</th>
                <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748B', padding: '8px 4px' }}>Recurrencia</th>
                <th style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748B', padding: '8px 4px' }}>Presupuesto</th>
                <th style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748B', padding: '8px 4px' }}>Real</th>
                <th style={{ textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#64748B', padding: '8px 4px' }}>Variación</th>
              </tr>
            </thead>
            <tbody>
              {BUCKETS.map(({ key, label, color }) => {
                const bucketCats = categories.filter(c => c.bucket === key)
                if (bucketCats.length === 0) return null
                const bucketBudgeted = bucketCats.reduce((s, c) => s + getCategoryTotal(c.id), 0)
                const bucketActual = bucketCats.reduce((s, c) => s + (spentByCategory[c.id] || 0), 0)
                const bucketDiff = bucketActual - bucketBudgeted
                const isSavings = key === 'savings'

                return (
                  <React.Fragment key={key}>
                    <tr style={{ background: '#F8FAFC' }}>
                      <td colSpan={6} style={{ padding: '6px 4px', fontSize: 12, fontWeight: 700, color: '#1E3A5F' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                          {label}
                        </div>
                      </td>
                    </tr>
                    {bucketCats.map((cat) => {
                      const budgeted = getCategoryTotal(cat.id)
                      const actual = spentByCategory[cat.id] || 0
                      const diff = actual - budgeted

                      return (
                        <tr key={cat.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '6px 4px', fontWeight: 500, color: '#334155' }}>{cat.name}</td>
                          <td style={{ padding: '6px 4px', fontSize: 11, color: '#94A3B8' }}>—</td>
                          <td style={{ padding: '6px 4px', fontSize: 11, color: '#94A3B8' }}>Mensual</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(budgeted)}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(actual)}</td>
                          <td style={{
                            padding: '6px 4px', textAlign: 'right', fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            color: varColor(diff, isSavings),
                          }}>
                            {varSign(diff)}{fmtNum(Math.abs(diff))}
                          </td>
                        </tr>
                      )
                    })}
                    {/* Subtotal */}
                    <tr style={{ borderBottom: '2px solid #E5E7EB', background: '#F8FAFC' }}>
                      <td colSpan={3} style={{ padding: '6px 4px', fontSize: 11, fontWeight: 700, color: '#64748B' }}>Subtotal</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(bucketBudgeted)}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(bucketActual)}</td>
                      <td style={{
                        padding: '6px 4px', textAlign: 'right', fontSize: 11, fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: varColor(bucketDiff, isSavings),
                      }}>
                        {varSign(bucketDiff)}{fmtNum(Math.abs(bucketDiff))}
                      </td>
                    </tr>
                  </React.Fragment>
                )
              })}
              {/* Total */}
              <tr style={{ borderTop: '3px solid #1E3A5F' }}>
                <td colSpan={3} style={{ padding: '8px 4px', fontWeight: 800, color: '#1E3A5F', fontSize: 13 }}>TOTAL</td>
                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 800, color: '#1E3A5F', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(totalBudgeted)}</td>
                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 800, color: '#1E3A5F', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(totalSpent)}</td>
                <td style={{
                  padding: '8px 4px', textAlign: 'right', fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: varColor(totalDiff, false),
                }}>
                  {varSign(totalDiff)}{fmtNum(Math.abs(totalDiff))} ({varSign(totalDiff)}{Math.abs(totalPct)}%)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
