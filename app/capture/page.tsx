'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useFormatMoney } from '@/lib/hooks/useFormatMoney'
import { localToday } from '@/lib/dates'
import { getUserHousehold } from '@/lib/household'

function CaptureContent() {
  const [mode, setMode] = useState<'choose' | 'form'>('choose')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(localToday())
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'cheque' | 'transferencia'>('efectivo')
  const [categories, setCategories] = useState<{ id: string; name: string; bucket: string }[]>([])
  const [householdId, setHouseholdId] = useState('')
  const [confidence, setConfidence] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const params = useSearchParams()
  const fmt = useFormatMoney()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const hh = await getUserHousehold(supabase, user.id)
      if (!hh) { router.push('/onboarding'); return }
      setHouseholdId(hh.id)

      const { data: cats } = await supabase
        .from('budget_categories').select('id, name, bucket')
        .eq('household_id', hh.id).order('bucket')
      setCategories((cats || []) as { id: string; name: string; bucket: string }[])
      if (cats && cats.length > 0) setCategoryId(cats[0].id)

      // Check for URL params (legacy OCR flow)
      const rawAmount = parseFloat(params.get('amount') || '0')
      const merchant = params.get('merchant') || ''
      if (rawAmount > 0 && merchant) {
        setAmount(rawAmount)
        setDescription(merchant)
        setConfidence(parseFloat(params.get('confidence') || '1'))
        setMode('form')
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleImageSelected(file: File) {
    const preview = URL.createObjectURL(file)
    setImagePreview(preview)
    setProcessing(true)
    setError(null)
    setMode('form')

    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/api/ocr', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'No se pudo procesar la imagen')
        setProcessing(false)
        return
      }

      if (data.amount) setAmount(data.amount)
      if (data.merchant) setDescription(data.merchant)
      if (data.items && !data.merchant) setDescription(data.items)
      if (data.date) setDate(data.date)
      if (data.confidence != null) setConfidence(data.confidence)

      // Auto-match category
      if (data.merchant || data.items) {
        const searchText = (data.merchant || data.items || '').toLowerCase()
        const match = categories.find(c =>
          searchText.includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(searchText)
        )
        if (match) setCategoryId(match.id)
      }
    } catch {
      setError('Error de conexion al procesar la imagen')
    }
    setProcessing(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleImageSelected(file)
  }

  async function confirm() {
    if (!householdId || amount <= 0) {
      setError('Ingresa un monto valido')
      return
    }
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('transactions').insert({
      household_id: householdId,
      category_id: categoryId || null,
      amount,
      description: description || null,
      date,
      source: 'ocr',
      payment_method: paymentMethod,
    })

    if (insertError) {
      setError(`Error al guardar: ${insertError.message}`)
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => router.replace('/dashboard'), 1500)
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

  // --- Choose mode ---
  if (mode === 'choose') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FF', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          background: '#1E3A5F', padding: '16px 20px 22px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button onClick={() => router.replace('/dashboard')} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4l-6 6 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
            Capturar gasto
          </p>
        </div>

        <div style={{
          flex: 1, padding: '24px 20px', display: 'flex',
          flexDirection: 'column', gap: 16,
        }}>
          <p style={{ fontSize: 14, color: '#64748B', textAlign: 'center' }}>
            Toma una foto de tu recibo o factura y te ayudamos a extraer los datos.
          </p>

          {/* Camera button */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            style={{
              width: '100%', padding: '20px 16px',
              background: 'white', border: '1.5px solid #E2E8F0',
              borderRadius: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14,
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: '#EFF6FF', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="13" r="4" stroke="#2563EB" strokeWidth="2"/>
              </svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1E3A5F' }}>Tomar foto</p>
              <p style={{ fontSize: 12, color: '#94A3B8' }}>Usa la camara para capturar el recibo</p>
            </div>
          </button>

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%', padding: '20px 16px',
              background: 'white', border: '1.5px solid #E2E8F0',
              borderRadius: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14,
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: '#F0FDF4', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="17,8 12,3 7,8" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="#059669" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1E3A5F' }}>Subir imagen</p>
              <p style={{ fontSize: 12, color: '#94A3B8' }}>Selecciona una foto de tu galeria</p>
            </div>
          </button>

          {/* Manual entry button */}
          <button
            onClick={() => setMode('form')}
            style={{
              width: '100%', padding: '20px 16px',
              background: 'white', border: '1.5px solid #E2E8F0',
              borderRadius: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 14,
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: '#FEF3C7', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#1E3A5F' }}>Ingreso manual</p>
              <p style={{ fontSize: 12, color: '#94A3B8' }}>Escribe los datos del gasto directamente</p>
            </div>
          </button>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>
    )
  }

  // --- Form mode ---
  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FF', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: '#1E3A5F', padding: '16px 20px 22px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setMode('choose'); setImagePreview(null); setError(null) }} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4l-6 6 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
            {imagePreview ? 'Verificar datos' : 'Registrar gasto'}
          </p>
        </div>
        {amount > 0 && (
          <p style={{
            fontSize: 32, fontWeight: 700, color: 'white',
            letterSpacing: '-.03em', lineHeight: 1, paddingLeft: 36,
          }}>
            {fmt(amount)}
          </p>
        )}
      </div>

      {/* Processing indicator */}
      {processing && (
        <div style={{
          padding: '16px 20px', background: '#EFF6FF',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid #BFDBFE',
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid #BFDBFE', borderTopColor: '#2563EB',
            animation: 'spin 0.8s linear infinite',
          }}/>
          <p style={{ fontSize: 13, color: '#1E40AF', fontWeight: 500 }}>
            Analizando imagen...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{
          margin: '10px 20px 0', padding: '10px 14px',
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 10, fontSize: 13, color: '#991B1B',
        }}>
          {error}
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div style={{ padding: '12px 20px 0' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Recibo capturado"
            style={{
              width: '100%', maxHeight: 200, objectFit: 'contain',
              borderRadius: 10, border: '1px solid #E2E8F0',
              background: 'white',
            }}
          />
          {confidence != null && (
            <div style={{
              marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 20,
              background: confidence >= 0.8 ? '#D1FAE5' : confidence >= 0.6 ? '#FEF3C7' : '#FEE2E2',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: confidence >= 0.8 ? '#065F46' : confidence >= 0.6 ? '#D97706' : '#991B1B',
              }} />
              <span style={{
                fontSize: 10, fontWeight: 600,
                color: confidence >= 0.8 ? '#065F46' : confidence >= 0.6 ? '#D97706' : '#991B1B',
              }}>
                {confidence >= 0.8 ? 'Alta confianza' : confidence >= 0.6 ? 'Confianza media' : 'Baja confianza — revisa los datos'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <div style={{
        flex: 1, padding: '14px 20px', display: 'flex',
        flexDirection: 'column', gap: 14,
      }}>
        {/* Monto */}
        <div>
          <label style={{
            fontSize: 10, fontWeight: 700, color: '#64748B',
            letterSpacing: '.06em', display: 'block', marginBottom: 6,
          }}>MONTO</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, color: '#64748B', fontWeight: 600 }}>Q</span>
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              style={{
                flex: 1, padding: '11px 13px', fontSize: 14,
                border: '1px solid #E2E8F0', borderRadius: 11,
                background: 'white', color: '#1E3A5F',
                fontFamily: 'inherit', outline: 'none', textAlign: 'right',
              }}
            />
          </div>
        </div>

        {/* Descripcion */}
        <div>
          <label style={{
            fontSize: 10, fontWeight: 700, color: '#64748B',
            letterSpacing: '.06em', display: 'block', marginBottom: 6,
          }}>DESCRIPCION</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Supermercado, Gasolina"
            style={{
              width: '100%', padding: '11px 13px', fontSize: 14,
              border: '1px solid #E2E8F0', borderRadius: 11,
              background: 'white', color: '#1E3A5F',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        {/* Categoria */}
        <div>
          <label style={{
            fontSize: 10, fontWeight: 700, color: '#64748B',
            letterSpacing: '.06em', display: 'block', marginBottom: 6,
          }}>CATEGORIA</label>
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
            <option value="">Sin categoria</option>
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

        {/* Fecha y metodo de pago */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{
              fontSize: 10, fontWeight: 700, color: '#64748B',
              letterSpacing: '.06em', display: 'block', marginBottom: 6,
            }}>FECHA</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: '100%', padding: '11px 13px', fontSize: 14,
                border: '1px solid #E2E8F0', borderRadius: 11,
                background: 'white', color: '#1E3A5F',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{
              fontSize: 10, fontWeight: 700, color: '#64748B',
              letterSpacing: '.06em', display: 'block', marginBottom: 6,
            }}>FORMA DE PAGO</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
              style={{
                width: '100%', padding: '11px 13px', fontSize: 14,
                border: '1px solid #E2E8F0', borderRadius: 11,
                background: 'white', color: '#1E3A5F',
                fontFamily: 'inherit', outline: 'none',
              }}
            >
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="cheque">Cheque</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Botones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
          <button
            onClick={confirm}
            disabled={saving || processing}
            style={{
              width: '100%', padding: 15, fontSize: 15, fontWeight: 700,
              background: saving || processing ? '#93C5FD' : '#1E3A5F', color: 'white',
              border: 'none', borderRadius: 13, cursor: saving ? 'wait' : 'pointer',
              fontFamily: 'inherit', transition: 'background .2s',
            }}
          >
            {saving ? 'Guardando...' : `Guardar gasto${amount > 0 ? ` ${fmt(amount)}` : ''}`}
          </button>
          <button
            onClick={() => router.replace('/dashboard')}
            disabled={saving}
            style={{
              width: '100%', padding: 13, fontSize: 13, fontWeight: 600,
              background: 'transparent', color: '#64748B',
              border: '1px solid #E2E8F0', borderRadius: 13,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancelar
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
