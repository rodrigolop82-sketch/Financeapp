'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { MonthSeal } from '@/components/cierre/MonthSeal'
import {
  getMonthCloseChecklist, formatYearMonth, getPreviousYearMonth,
  type MonthCloseChecklist,
} from '@/lib/month-close'
import {
  Loader2, CheckCircle2, Circle, CreditCard, Landmark, Banknote,
  Wallet, ChevronLeft, ChevronRight, Upload,
} from 'lucide-react'

const SOURCE_ICONS: Record<string, typeof CreditCard> = {
  tarjeta_credito: CreditCard,
  cuenta_bancaria: Landmark,
  efectivo: Banknote,
}

export default function CierreMesPage() {
  const [checklist, setChecklist] = useState<MonthCloseChecklist | null>(null)
  const [loading, setLoading] = useState(true)
  const [yearMonth, setYearMonth] = useState(getPreviousYearMonth)
  const [marking, setMarking] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: members } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .limit(1)

    const householdId = members?.[0]?.household_id
    if (!householdId) { setLoading(false); return }

    const result = await getMonthCloseChecklist(user.id, householdId, yearMonth)
    setChecklist(result)
    setLoading(false)
  }, [supabase, router, yearMonth])

  useEffect(() => { load() }, [load])

  async function markSourceLoaded(sourceId: string) {
    setMarking(sourceId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('source_monthly_status').upsert(
      {
        user_source_id: sourceId,
        year_month: yearMonth,
        loaded: true,
        loaded_at: new Date().toISOString(),
      },
      { onConflict: 'user_source_id,year_month' },
    )

    setMarking(null)
    load()
  }

  function navigateMonth(delta: number) {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthLabel = formatYearMonth(yearMonth)

  if (loading) {
    return (
      <AppShell title="Cierre de mes" currentPath="/cierre-mes">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#2563EB' }} />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Cierre de mes" currentPath="/cierre-mes">
      {/* Month navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 16, marginBottom: 24,
      }}>
        <button
          onClick={() => navigateMonth(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <ChevronLeft size={20} color="#64748B" />
        </button>
        <span className="font-serif" style={{
          fontSize: 18, fontWeight: 400, color: '#1E3A5F',
          textTransform: 'capitalize', minWidth: 160, textAlign: 'center',
        }}>
          {monthLabel}
        </span>
        <button
          onClick={() => navigateMonth(1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <ChevronRight size={20} color="#64748B" />
        </button>
      </div>

      {!checklist || checklist.totalCount === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 20px', color: '#94A3B8',
          fontSize: 14, lineHeight: 1.6,
        }}>
          <Wallet size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ margin: '0 0 12px' }}>
            No tienes fuentes declaradas todavía.
          </p>
          <button
            onClick={() => router.push('/mis-fuentes')}
            style={{
              padding: '10px 20px', borderRadius: 10,
              background: '#2563EB', color: '#fff', border: 'none',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            Configurar mis fuentes
          </button>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', marginBottom: 8,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F' }}>
                Progreso
              </span>
              <span style={{
                fontSize: 24, fontWeight: 800, color: '#1E3A5F',
                fontFamily: "'Outfit', sans-serif",
              }}>
                {checklist.percentComplete}%
              </span>
            </div>
            <div style={{
              height: 8, borderRadius: 4, background: '#E2E8F0',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: checklist.isFullyClosed
                  ? 'linear-gradient(90deg, #059669, #10B981)'
                  : 'linear-gradient(90deg, #2563EB, #60A5FA)',
                width: `${checklist.percentComplete}%`,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, display: 'block' }}>
              {checklist.completedCount} de {checklist.totalCount} completados
            </span>
          </div>

          {/* Seal when fully closed */}
          {checklist.isFullyClosed && (
            <div style={{ marginBottom: 24 }}>
              <MonthSeal yearMonth={yearMonth} />
            </div>
          )}

          {/* Checklist items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {checklist.items.map(item => {
              const isSource = item.type === 'source'
              const Icon = isSource
                ? SOURCE_ICONS[item.sourceType ?? ''] ?? CreditCard
                : Wallet
              const isMarking = marking === item.sourceId

              return (
                <div key={item.id} style={{
                  background: '#fff', borderRadius: 14, padding: '12px 16px',
                  border: `1px solid ${item.done ? '#D1FAE5' : '#E2E8F0'}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                  opacity: item.done ? 0.7 : 1,
                }}>
                  {item.done ? (
                    <CheckCircle2 size={22} color="#10B981" style={{ flexShrink: 0 }} />
                  ) : (
                    <Circle size={22} color="#CBD5E1" style={{ flexShrink: 0 }} />
                  )}

                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: item.done ? '#F0FDF4' : '#EFF6FF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={18} color={item.done ? '#10B981' : '#2563EB'} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 14, fontWeight: 600,
                      color: item.done ? '#6B7280' : '#1E3A5F',
                      textDecoration: item.done ? 'line-through' : 'none',
                    }}>
                      {item.label}
                    </span>
                  </div>

                  {!item.done && isSource && (
                    <button
                      onClick={() => item.sourceId && markSourceLoaded(item.sourceId)}
                      disabled={isMarking}
                      style={{
                        padding: '6px 12px', borderRadius: 8,
                        background: '#EFF6FF', border: '1px solid #BFDBFE',
                        color: '#2563EB', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      {isMarking ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      Cargar
                    </button>
                  )}

                  {!item.done && !isSource && (
                    <button
                      onClick={() => router.push('/presupuesto')}
                      style={{
                        padding: '6px 12px', borderRadius: 8,
                        background: '#F0FDF4', border: '1px solid #BBF7D0',
                        color: '#059669', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      Revisar
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="h-24" />
    </AppShell>
  )
}
