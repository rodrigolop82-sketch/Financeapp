'use client'
import { useEffect, useState } from 'react'

interface AddExpenseSheetProps {
  open: boolean
  onClose: () => void
  onScan: () => void
  onVoice: () => void
  onManual: () => void
}

const OPTIONS = [
  {
    key: 'scan',
    label: 'Escanear',
    badge: 'Con IA',
    badgeColor: '#2563EB',
    badgeBg: '#E9F0FF',
    description: 'Foto de un recibo o tu estado de cuenta — Zafi detecta los movimientos',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 7V5a2 2 0 012-2h2" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M17 3h2a2 2 0 012 2v2" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M21 17v2a2 2 0 01-2 2h-2" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M7 21H5a2 2 0 01-2-2v-2" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round"/>
        <rect x="7" y="7" width="10" height="10" rx="1" stroke="#2563EB" strokeWidth="1.5" strokeDasharray="2 2"/>
      </svg>
    ),
  },
  {
    key: 'voice',
    label: 'Dictar por voz',
    badge: 'Rápido',
    badgeColor: '#16A34A',
    badgeBg: '#DCFCE7',
    description: 'Dile a Zafi qué gastaste, él lo registra por ti',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill="#2563EB"/>
        <path d="M19 10v2a7 7 0 01-14 0v-2" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="12" y1="19" x2="12" y2="23" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'manual',
    label: 'Registrar manualmente',
    badge: null,
    badgeColor: null,
    badgeBg: null,
    description: 'Ingresa monto, categoría y nota a tu propio ritmo',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
] as const

export function AddExpenseSheet({ open, onClose, onScan, onVoice, onManual }: AddExpenseSheetProps) {
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true))
      })
    } else {
      setAnimating(false)
      const timer = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  if (!visible) return null

  function handleAction(action: () => void) {
    onClose()
    setTimeout(action, 200)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: animating ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
        transition: 'background 300ms ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          transform: animating ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#D1D5DB' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 24px 16px' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1E3A5F', margin: 0 }}>Agregar gasto</h2>
            <p style={{ fontSize: 14, color: '#8B9AAE', margin: '4px 0 0' }}>¿Cómo querés registrarlo?</p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#F1F5F9', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Options */}
        <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleAction(opt.key === 'scan' ? onScan : opt.key === 'voice' ? onVoice : onManual)}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: '#F8F9FC', borderRadius: 16,
                padding: '18px 20px', border: '1.5px solid #E9F0FF',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'border-color 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563EB')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E9F0FF')}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: '#E9F0FF', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {opt.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#1E3A5F' }}>
                    {opt.label}
                  </span>
                  {opt.badge && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: opt.badgeColor!,
                      background: opt.badgeBg!, padding: '2px 8px', borderRadius: 8,
                    }}>
                      {opt.badge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#8B9AAE', marginTop: 3, lineHeight: 1.4 }}>
                  {opt.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
