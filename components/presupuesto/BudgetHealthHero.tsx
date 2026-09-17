'use client'

import type { BudgetCategory } from '@/types'

const BUCKET_META: Record<string, { label: string; color: string; target: number }> = {
  needs:   { label: 'Necesidades',    color: '#1E3A5F', target: 0.50 },
  wants:   { label: 'Gustos',         color: '#2563EB', target: 0.30 },
  savings: { label: 'Ahorro/Deudas',  color: '#8fc1fb', target: 0.20 },
}

interface Props {
  income: number
  bucketTotals: { needs: number; wants: number; savings: number }
  categories: BudgetCategory[]
  spentByCategory: Record<string, number>
  expandedGroups: Set<string>
  onToggleGroup: (bucket: string) => void
  onDistribute: () => void
  getCategoryTotal: (catId: string) => number
  fmt: (amount: number) => string
}

type BucketStatus = 'en_meta' | 'por_debajo' | 'por_encima'

function getStatus(bucket: string, assignedPct: number, targetPct: number): BucketStatus {
  const diff = Math.abs(assignedPct - targetPct)
  if (diff <= 3) return 'en_meta'
  return assignedPct > targetPct ? 'por_encima' : 'por_debajo'
}

function statusStyle(status: BucketStatus, bucket: string) {
  if (status === 'en_meta') return { bg: '#DCFCE7', text: '#166534', label: 'En meta' }
  if (status === 'por_encima') {
    if (bucket === 'savings') return { bg: '#DCFCE7', text: '#166534', label: 'Por encima de la meta' }
    return { bg: '#FEF3C7', text: '#92400E', label: 'Por encima de la meta' }
  }
  if (bucket === 'savings') return { bg: '#FEF3C7', text: '#92400E', label: 'Por debajo de la meta' }
  return { bg: '#FEF3C7', text: '#92400E', label: 'Por debajo de la meta' }
}

export function BudgetHealthHero({
  income, bucketTotals, categories, spentByCategory,
  expandedGroups, onToggleGroup, onDistribute, getCategoryTotal, fmt,
}: Props) {
  const totalBudgeted = bucketTotals.needs + bucketTotals.wants + bucketTotals.savings
  const remaining = income - totalBudgeted
  const unassignedPct = income > 0 ? (remaining / income) * 100 : 0

  const bucketPcts = {
    needs:   income > 0 ? (bucketTotals.needs / income) * 100 : 0,
    wants:   income > 0 ? (bucketTotals.wants / income) * 100 : 0,
    savings: income > 0 ? (bucketTotals.savings / income) * 100 : 0,
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18,
      padding: '24px 28px', marginBottom: 20,
    }}>
      <h2 style={{
        fontFamily: "'DM Serif Display', serif", fontSize: 20, fontWeight: 700,
        color: '#1E3A5F', margin: '0 0 4px',
      }}>
        Salud de tu presupuesto
      </h2>
      <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>
        ¿Qué tan alineado está tu presupuesto con la regla 50/30/20?
      </p>

      {/* Stacked comparison bars */}
      <div style={{ position: 'relative', marginBottom: 24 }}>
        {/* Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Recomendado</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>50 / 30 / 20</span>
        </div>
        {/* Recommended bar */}
        <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ width: '50%', background: '#1E3A5F' }} />
          <div style={{ width: '30%', background: '#2563EB' }} />
          <div style={{ width: '20%', background: '#8fc1fb' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, marginTop: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Tu asignación</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>
            {Math.round(bucketPcts.needs)} / {Math.round(bucketPcts.wants)} / {Math.round(bucketPcts.savings)}
            {unassignedPct > 0.5 ? ` + ${Math.round(unassignedPct)} sin asignar` : ''}
          </span>
        </div>
        {/* Actual bar */}
        <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
          {bucketPcts.needs > 0 && (
            <div style={{ width: `${bucketPcts.needs}%`, background: '#1E3A5F', minWidth: 2 }} />
          )}
          {bucketPcts.wants > 0 && (
            <div style={{ width: `${bucketPcts.wants}%`, background: '#2563EB', minWidth: 2 }} />
          )}
          {bucketPcts.savings > 0 && (
            <div style={{ width: `${bucketPcts.savings}%`, background: '#8fc1fb', minWidth: 2 }} />
          )}
          {unassignedPct > 0.5 && (
            <div style={{
              width: `${unassignedPct}%`,
              background: 'repeating-linear-gradient(45deg, #FEF3C7, #FEF3C7 4px, #FDE68A 4px, #FDE68A 8px)',
              minWidth: 2,
            }} />
          )}
        </div>

        {/* Guide lines at 50% and 80% */}
        <div style={{
          position: 'absolute', left: '50%', top: 0, bottom: 0,
          borderLeft: '2px dashed rgba(30,58,95,0.15)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', left: '80%', top: 0, bottom: 0,
          borderLeft: '2px dashed rgba(30,58,95,0.15)', pointerEvents: 'none',
        }} />
      </div>

      {/* Group cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(['needs', 'wants', 'savings'] as const).map((bucket) => {
          const meta = BUCKET_META[bucket]
          const targetAmt = income * meta.target
          const targetPct = meta.target * 100
          const assigned = bucketTotals[bucket]
          const assignedPct = income > 0 ? (assigned / income) * 100 : 0
          const status = getStatus(bucket, assignedPct, targetPct)
          const style = statusStyle(status, bucket)
          const isExpanded = expandedGroups.has(bucket)
          const bucketCats = categories.filter(c => c.bucket === bucket)
          const progressPct = targetAmt > 0 ? Math.min((assigned / targetAmt) * 100, 100) : 0
          const gap = targetAmt - assigned

          return (
            <div key={bucket} style={{
              border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 18px',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', background: meta.color, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F' }}>{meta.label}</span>
                  <span style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 600,
                    padding: '2px 10px', borderRadius: 20,
                    background: style.bg, color: style.text,
                  }}>
                    {style.label}
                  </span>
                </div>
              </div>

              {/* Meta vs Asignado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginBottom: 8 }}>
                <span>Meta: {Math.round(targetPct)}% ({fmt(targetAmt)})</span>
                <span>Asignado: {Math.round(assignedPct)}% ({fmt(assigned)})</span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%', borderRadius: 3, width: `${progressPct}%`,
                  background: status === 'en_meta' || (bucket === 'savings' && status === 'por_encima') ? '#22C55E' : meta.color,
                  transition: 'width 0.3s ease',
                }} />
              </div>

              {/* Alert */}
              {status !== 'en_meta' && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, marginBottom: 8,
                  color: bucket === 'savings' && status === 'por_encima' ? '#166534' : '#92400E',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: bucket === 'savings' && status === 'por_encima' ? '#22C55E' : '#F59E0B',
                  }} />
                  {status === 'por_debajo' && (
                    <span>Te faltan {fmt(Math.abs(gap))} para llegar a la meta recomendada.</span>
                  )}
                  {status === 'por_encima' && bucket === 'savings' && (
                    <span>¡Vas {fmt(assigned - targetAmt)} por encima de tu meta de ahorro!</span>
                  )}
                  {status === 'por_encima' && bucket !== 'savings' && (
                    <span>Estás {fmt(assigned - targetAmt)} por encima de la meta recomendada.</span>
                  )}
                </div>
              )}

              {/* Toggle categories */}
              <button
                onClick={() => onToggleGroup(bucket)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 12, fontWeight: 600, color: '#2563EB',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {isExpanded ? 'Ocultar categorías ▴' : 'Ver categorías ▾'}
              </button>

              {/* Expanded category list */}
              {isExpanded && bucketCats.length > 0 && (
                <div style={{ marginTop: 10, borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
                  {bucketCats.map((cat) => {
                    const catAmt = getCategoryTotal(cat.id)
                    const catSpent = spentByCategory[cat.id] || 0
                    return (
                      <div key={cat.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '5px 0', fontSize: 13,
                      }}>
                        <span style={{ color: '#334155' }}>{cat.name}</span>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748B' }}>
                          <span>Asignado: {fmt(catAmt)}</span>
                          <span>Real: {fmt(catSpent)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Sin asignar callout */}
      {remaining > 0 ? (
        <div style={{
          marginTop: 16, padding: '14px 18px', borderRadius: 12,
          background: '#FFFBEB', border: '1px solid #F59E0B',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#92400E' }}>
              Sin asignar: {fmt(remaining)}
            </span>
            <span style={{ fontSize: 12, color: '#92400E', marginLeft: 8 }}>
              ({Math.round(unassignedPct)}% de tu ingreso)
            </span>
          </div>
          <button
            onClick={onDistribute}
            style={{
              background: '#2563EB', color: '#fff', border: 'none',
              padding: '8px 16px', borderRadius: 10, fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Distribuir según 50/30/20
          </button>
        </div>
      ) : remaining === 0 && totalBudgeted > 0 ? (
        <div style={{
          marginTop: 16, padding: '14px 18px', borderRadius: 12,
          background: '#F0FDF4', border: '1px solid #22C55E',
          fontSize: 14, fontWeight: 600, color: '#166534',
        }}>
          Presupuesto totalmente asignado y alineado con la regla 50/30/20.
        </div>
      ) : null}
    </div>
  )
}
