'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { localToday } from '@/lib/dates'

interface ParsedNotification {
  amount: number
  merchant: string
  bank: string
  category: string
  categoryId: string
  confidence: number
  rawText: string
}

function NotificacionContent() {
  const [step, setStep] = useState<'input' | 'parsing' | 'confirm' | 'saving' | 'saved' | 'error'>('input')
  const [inputText, setInputText] = useState('')
  const [parsed, setParsed] = useState<ParsedNotification | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Editable fields
  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<{ id: string; name: string; bucket: string }[]>([])
  const [householdId, setHouseholdId] = useState('')

  const router = useRouter()
  const params = useSearchParams()
  const fmt = useFormatMoney()

  // Check if text was shared via PWA share target or URL param
  useEffect(() => {
    const shared = params.get('text') || params.get('title') || ''
    if (shared) {
      setInputText(shared)
      // Auto-parse if text was shared
      handleParse(shared)
    }
    loadCategories()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCategories() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: hh } = await supabase
      .from('households').select('id').eq('owner_id', user.id).limit(1).single()
    if (!hh) { router.push('/dashboard'); return }
    setHouseholdId(hh.id)

    const { data: cats } = await supabase
      .from('budget_categories').select('id, name, bucket').eq('household_id', hh.id).order('bucket')
    setCategories((cats || []) as { id: string; name: string; bucket: string }[])
  }

  async function handleParse(text?: string) {
    const textToParse = text || inputText
    if (!textToParse.trim()) return

    setStep('parsing')
    setErrorMsg('')

    try {
      const res = await fetch('/api/parse-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToParse }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'No se pudo procesar la notificación')
        setStep('error')
        return
      }

      if (!data.amount || data.amount <= 0) {
        setErrorMsg('No se detectó un monto en la notificación. Verificá que el texto contenga información de un pago o compra.')
        setStep('error')
        return
      }

      setParsed(data)
      setAmount(data.amount)
      setDescription(data.merchant || '')
      setCategoryId(data.categoryId || '')
      setStep('confirm')
    } catch {
      setErrorMsg('Error de conexión. Intentá de nuevo.')
      setStep('error')
    }
  }

  async function handleSave() {
    if (!householdId || amount <= 0) return
    setStep('saving')

    const supabase = createClient()
    await supabase.from('transactions').insert({
      household_id: householdId,
      category_id: categoryId || null,
      amount,
      description,
      date: localToday(),
      source: 'ocr' as const,
    })

    setStep('saved')
    setTimeout(() => router.replace('/dashboard'), 1500)
  }

  // ─── SAVED ───
  if (step === 'saved') {
    return (
      <div style={{
        minHeight: '100vh', background: '#F8F9FF',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12,
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%', background: '#D1FAE5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <path d="M5 13l6 6L21 7" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#1E3A5F' }}>Gasto registrado</p>
        <p style={{ fontSize: 12, color: '#94A3B8' }}>Volviendo al dashboard...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FF', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: '#1E3A5F', padding: '16px 20px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: '50%',
              width: 34, height: 34, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.45)', letterSpacing: '.08em' }}>
            CAPTURA DE NOTIFICACIÓN
          </span>
          <div style={{ width: 34 }} />
        </div>

        <p style={{ fontSize: 18, fontWeight: 600, color: 'white', lineHeight: 1.3 }}>
          Pegá tu notificación bancaria o de Apple Pay
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginTop: 4 }}>
          SMS, notificación push o mensaje de tu banco
        </p>
      </div>

      <div style={{ flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ─── INPUT STEP ─── */}
        {(step === 'input' || step === 'error') && (
          <>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={'Ejemplo:\n"BAM le informa: Compra por Q 150.00 en WALMART aprobada. TC *1234"'}
              rows={5}
              style={{
                width: '100%', padding: '14px', fontSize: 14,
                border: '1px solid #E2E8F0', borderRadius: 12,
                background: 'white', color: '#1E3A5F',
                fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                lineHeight: 1.5,
              }}
              autoFocus
            />

            {step === 'error' && (
              <div style={{
                padding: '10px 14px', background: '#FEF2F2',
                border: '1px solid #FECACA', borderRadius: 10,
                fontSize: 13, color: '#991B1B',
              }}>
                {errorMsg}
              </div>
            )}

            {/* Quick tips */}
            <div style={{
              padding: '12px 14px', background: '#EFF6FF',
              border: '1px solid #BFDBFE', borderRadius: 10,
            }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#1E40AF', marginBottom: 6 }}>
                Tipos de notificaciones compatibles:
              </p>
              <div style={{ fontSize: 11, color: '#2563EB', lineHeight: 1.7 }}>
                <div>- SMS de bancos (BAM, Banrural, BI, G&T)</div>
                <div>- Notificaciones de Apple Pay / Wallet</div>
                <div>- Alertas de tarjeta de crédito/débito</div>
                <div>- Cualquier texto con monto y comercio</div>
              </div>
            </div>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => handleParse()}
              disabled={!inputText.trim()}
              style={{
                width: '100%', padding: 15, fontSize: 15, fontWeight: 700,
                background: !inputText.trim() ? '#CBD5E1' : '#1E3A5F', color: 'white',
                border: 'none', borderRadius: 13, cursor: !inputText.trim() ? 'default' : 'pointer',
                fontFamily: 'inherit', marginBottom: 24,
              }}
            >
              Detectar gasto
            </button>
          </>
        )}

        {/* ─── PARSING ─── */}
        {step === 'parsing' && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid #DBEAFE', borderTopColor: '#2563EB',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 14, color: '#64748B' }}>Analizando notificación...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* ─── CONFIRM ─── */}
        {(step === 'confirm' || step === 'saving') && parsed && (
          <>
            {/* Detected summary */}
            <div style={{
              background: 'white', borderRadius: 14, padding: '14px 16px',
              border: '1px solid #E2E8F0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '.06em' }}>
                  DETECTADO
                </span>
                {(() => {
                  const c = parsed.confidence
                  const bg = c >= 0.8 ? '#D1FAE5' : c >= 0.6 ? '#FEF3C7' : '#FEE2E2'
                  const color = c >= 0.8 ? '#065F46' : c >= 0.6 ? '#D97706' : '#991B1B'
                  const label = c >= 0.8 ? 'Alta confianza' : c >= 0.6 ? 'Media' : 'Baja'
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 20, background: bg,
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color }}>{label}</span>
                    </div>
                  )
                })()}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#1E3A5F', marginBottom: 2 }}>
                {fmt(parsed.amount)}
              </div>
              <div style={{ fontSize: 14, color: '#64748B' }}>
                {parsed.merchant} {parsed.bank ? `· ${parsed.bank}` : ''}
              </div>
            </div>

            {/* Editable fields */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                CATEGORÍA
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{
                  width: '100%', padding: '11px 13px', fontSize: 14,
                  border: '1px solid #E2E8F0', borderRadius: 11,
                  background: 'white', color: '#1E3A5F', fontFamily: 'inherit', outline: 'none',
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

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                DESCRIPCIÓN
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: '100%', padding: '11px 13px', fontSize: 14,
                  border: '1px solid #E2E8F0', borderRadius: 11,
                  background: 'white', color: '#1E3A5F', fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
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
                    background: 'white', color: '#1E3A5F', fontFamily: 'inherit',
                    outline: 'none', textAlign: 'right',
                  }}
                />
              </div>
            </div>

            {/* Raw text */}
            <details>
              <summary style={{ fontSize: 11, color: '#94A3B8', cursor: 'pointer', listStyle: 'none' }}>
                Ver notificación original ↓
              </summary>
              <p style={{
                fontSize: 10, color: '#94A3B8', marginTop: 6,
                padding: '8px 10px', background: '#F1F5F9',
                borderRadius: 8, fontFamily: 'monospace', lineHeight: 1.5,
              }}>
                {parsed.rawText}
              </p>
            </details>

            <div style={{ flex: 1 }} />

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
              <button
                onClick={handleSave}
                disabled={step === 'saving'}
                style={{
                  width: '100%', padding: 15, fontSize: 15, fontWeight: 700,
                  background: step === 'saving' ? '#93C5FD' : '#1E3A5F', color: 'white',
                  border: 'none', borderRadius: 13, cursor: step === 'saving' ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {step === 'saving' ? 'Guardando...' : `Confirmar ${fmt(amount)}`}
              </button>
              <button
                onClick={() => { setStep('input'); setParsed(null) }}
                disabled={step === 'saving'}
                style={{
                  width: '100%', padding: 13, fontSize: 13, fontWeight: 600,
                  background: 'transparent', color: '#64748B',
                  border: '1px solid #E2E8F0', borderRadius: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Volver a intentar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function NotificacionPage() {
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
      <NotificacionContent />
    </Suspense>
  )
}
