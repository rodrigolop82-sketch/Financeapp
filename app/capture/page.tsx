'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { localToday } from '@/lib/dates'
import { getUserHousehold } from '@/lib/household'

interface CaptureData {
  amount: number
  merchant: string
  bank: string
  confidence: number
  rawText: string
  category: string
}

function CaptureContent() {
  const [data, setData] = useState<CaptureData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [categories, setCategories] = useState<{ id: string; name: string; bucket: string }[]>([])
  const [householdId, setHouseholdId] = useState('')

  const router = useRouter()
  const params = useSearchParams()
  const fmt = useFormatMoney()

  useEffect(() => {
    async function load() {
      // Parse data from URL params
      const rawAmount = parseFloat(params.get('amount') || '0')
      const merchant = params.get('merchant') || ''
      const bank = params.get('bank') || ''
      const confidence = parseFloat(params.get('confidence') || '1')
      const rawText = params.get('raw') || ''
      const category = params.get('category') || ''

      if (!rawAmount || !merchant) {
        setError(true)
        setLoading(false)
        return
      }

      setData({ amount: rawAmount, merchant, bank, confidence, rawText, category })
      setAmount(rawAmount)
      setDescription(merchant)

      // Load user categories
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const hh = await getUserHousehold(supabase, user.id)
      if (!hh) { router.push('/dashboard'); return }
      setHouseholdId(hh.id)

      const { data: cats } = await supabase
        .from('budget_categories').select('id, name, bucket').eq('household_id', hh.id).order('bucket')

      const catList = (cats || []) as { id: string; name: string; bucket: string }[]
      setCategories(catList)

      // Try to auto-match category
      if (category) {
        const match = catList.find(c =>
          c.name.toLowerCase().includes(category.toLowerCase()) ||
          category.toLowerCase().includes(c.name.toLowerCase())
        )
        if (match) setCategoryId(match.id)
      }
      if (!categoryId && catList.length > 0) {
        // Try merchant-based matching
        const lower = merchant.toLowerCase()
        const match = catList.find(c => lower.includes(c.name.toLowerCase()))
        if (match) setCategoryId(match.id)
        else if (catList.length > 0) setCategoryId(catList[0].id)
      }

      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirm() {
    if (!householdId || amount <= 0) return
    setSaving(true)

    const supabase = createClient()
    await supabase.from('transactions').insert({
      household_id: householdId,
      category_id: categoryId || null,
      amount,
      description,
      date: localToday(),
      source: 'ocr',
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => router.replace('/dashboard'), 1500)
  }

  function discard() {
    router.replace('/dashboard')
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F8F9FF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid #DBEAFE', borderTopColor: '#2563EB',
          animation: 'spin 0.8s linear infinite',
        }}/>
        <p style={{ fontSize: 13, color: '#94A3B8' }}>Cargando...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // --- Error state ---
  if (error || !data) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F8F9FF',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 24, gap: 16, textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: '#FEE2E2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 3v8M10 14v1.5" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F' }}>
          No pudimos leer la notificación
        </p>
        <p style={{ fontSize: 13, color: '#64748B' }}>
          Ingresá el gasto manualmente desde el dashboard.
        </p>
        <button
          onClick={() => router.replace('/dashboard')}
          style={{
            padding: '11px 24px', background: '#1E3A5F', color: 'white',
            borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Ir al dashboard
        </button>
      </div>
    )
  }

  // --- Saved state ---
  if (saved) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F8F9FF',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12,
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: '#D1FAE5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <path d="M5 13l6 6L21 7" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#1E3A5F' }}>
          Gasto guardado
        </p>
        <p style={{ fontSize: 12, color: '#94A3B8' }}>
          Volviendo al dashboard...
        </p>
      </div>
    )
  }

  // --- Main capture UI ---
  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FF', display: 'flex', flexDirection: 'column' }}>

      {/* Header marino */}
      <div style={{
        background: '#1E3A5F', padding: '16px 20px 22px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <p style={{
          fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.45)',
          letterSpacing: '.07em',
        }}>
          CAPTURADO DE {data.bank.toUpperCase()}
        </p>
        <p style={{
          fontSize: 36, fontWeight: 700, color: 'white',
          letterSpacing: '-.03em', lineHeight: 1,
        }}>
          {fmt(data.amount)}
        </p>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,.8)' }}>
          {data.merchant}
        </p>

        {data.confidence < 0.7 && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: '#FEF3C7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M4 1.5v3M4 6v.5" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{ fontSize: 11, color: '#FEF3C7', fontWeight: 500 }}>
              Revisá que los datos sean correctos
            </p>
          </div>
        )}
      </div>

      {/* Form */}
      <div style={{
        flex: 1, padding: '18px 20px', display: 'flex',
        flexDirection: 'column', gap: 14, background: '#F8F9FF',
      }}>
        {/* Categoría */}
        <div>
          <label style={{
            fontSize: 10, fontWeight: 700, color: '#64748B',
            letterSpacing: '.06em', display: 'block', marginBottom: 6,
          }}>
            CATEGORÍA
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            style={{
              width: '100%', padding: '11px 13px', fontSize: 14,
              border: '1px solid #E2E8F0', borderRadius: 11,
              background: 'white', color: '#1E3A5F',
              fontFamily: 'inherit', outline: 'none',
            }}
          >
            <option value="">Sin categoría</option>
            {['needs', 'wants', 'savings'].map(bucket => {
              const bucketCats = categories.filter(c => c.bucket === bucket)
              if (bucketCats.length === 0) return null
              const label = bucket === 'needs' ? 'Necesidades' : bucket === 'wants' ? 'Gustos' : 'Ahorro/Deudas'
              return (
                <optgroup key={bucket} label={label}>
                  {bucketCats.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>

        {/* Descripción */}
        <div>
          <label style={{
            fontSize: 10, fontWeight: 700, color: '#64748B',
            letterSpacing: '.06em', display: 'block', marginBottom: 6,
          }}>
            DESCRIPCIÓN
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              width: '100%', padding: '11px 13px', fontSize: 14,
              border: '1px solid #E2E8F0', borderRadius: 11,
              background: 'white', color: '#1E3A5F',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        {/* Monto */}
        <div>
          <label style={{
            fontSize: 10, fontWeight: 700, color: '#64748B',
            letterSpacing: '.06em', display: 'block', marginBottom: 6,
          }}>
            MONTO
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, color: '#64748B', fontWeight: 600 }}>Q</span>
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              style={{
                flex: 1, padding: '11px 13px', fontSize: 14,
                border: '1px solid #E2E8F0', borderRadius: 11,
                background: 'white', color: '#1E3A5F',
                fontFamily: 'inherit', outline: 'none',
                textAlign: 'right',
              }}
            />
          </div>
        </div>

        {/* Notificación original */}
        {data.rawText && (
          <details>
            <summary style={{
              fontSize: 11, color: '#94A3B8', cursor: 'pointer',
              listStyle: 'none',
            }}>
              Ver notificación original ↓
            </summary>
            <p style={{
              fontSize: 10, color: '#94A3B8', marginTop: 6,
              padding: '8px 10px', background: '#F1F5F9',
              borderRadius: 8, fontFamily: 'monospace', lineHeight: 1.5,
            }}>
              {data.rawText}
            </p>
          </details>
        )}

        {/* Confidence badge */}
        {(() => {
          const conf = data.confidence
          const bg = conf >= 0.8 ? '#D1FAE5' : conf >= 0.6 ? '#FEF3C7' : '#FEE2E2'
          const color = conf >= 0.8 ? '#065F46' : conf >= 0.6 ? '#D97706' : '#991B1B'
          const label = conf >= 0.8 ? 'Alta confianza' : conf >= 0.6 ? 'Confianza media' : 'Baja confianza'
          return (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 20, background: bg,
              alignSelf: 'flex-start',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 10, fontWeight: 600, color }}>{label}</span>
            </div>
          )
        })()}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Botones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
          <button
            onClick={confirm}
            disabled={saving}
            style={{
              width: '100%', padding: 15, fontSize: 15, fontWeight: 700,
              background: saving ? '#93C5FD' : '#1E3A5F', color: 'white',
              border: 'none', borderRadius: 13, cursor: saving ? 'wait' : 'pointer',
              fontFamily: 'inherit', transition: 'background .2s',
            }}
          >
            {saving ? 'Guardando...' : `Confirmar ${fmt(amount)}`}
          </button>
          <button
            onClick={discard}
            disabled={saving}
            style={{
              width: '100%', padding: 13, fontSize: 13, fontWeight: 600,
              background: 'transparent', color: '#64748B',
              border: '1px solid #E2E8F0', borderRadius: 13,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Descartar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CapturePage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', background: '#F8F9FF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid #DBEAFE', borderTopColor: '#2563EB',
          animation: 'spin 0.8s linear infinite',
        }}/>
        <p style={{ fontSize: 13, color: '#94A3B8' }}>Cargando...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <CaptureContent />
    </Suspense>
  )
}
