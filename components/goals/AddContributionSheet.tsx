'use client'
import { useState } from 'react'

interface AddContributionSheetProps {
  open: boolean
  onClose: () => void
  onConfirm: (amount: number, note: string) => Promise<void>
  monthlyContribution: number | null
}

export function AddContributionSheet({ open, onClose, onConfirm, monthlyContribution }: AddContributionSheetProps) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const quickAmounts = [200, 500]
  if (monthlyContribution && !quickAmounts.includes(monthlyContribution)) {
    quickAmounts.unshift(monthlyContribution)
  }

  async function handleConfirm() {
    const val = parseFloat(amount)
    if (!val || val <= 0) return
    setSaving(true)
    try {
      await onConfirm(val, note)
      setAmount('')
      setNote('')
      onClose()
    } catch {
      // error handled by parent
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.5)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
        background: '#0D1F36',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px 20px 0 0',
        padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.15)',
          margin: '0 auto 16px',
        }} />

        <p style={{ fontSize: 16, fontWeight: 600, color: 'white', marginBottom: 16 }}>
          Registrar abono
        </p>

        {/* Amount display */}
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Q 0"
          autoFocus
          style={{
            width: '100%', padding: '14px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, color: 'white',
            fontSize: 24, fontWeight: 900,
            fontFamily: 'var(--font-outfit)',
            textAlign: 'center', outline: 'none',
            marginBottom: 12,
          }}
        />

        {/* Quick amounts */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {quickAmounts.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(q.toString())}
              style={{
                flex: 1, padding: '10px 0',
                background: amount === q.toString() ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.04)',
                border: amount === q.toString() ? '1px solid #2563EB' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, color: 'white',
                fontSize: 14, fontWeight: 600,
                fontFamily: 'var(--font-outfit)',
                cursor: 'pointer',
              }}
            >
              Q{q}
            </button>
          ))}
        </div>

        {/* Note */}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          style={{
            width: '100%', padding: '12px 14px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, color: 'white',
            fontSize: 14, outline: 'none',
            marginBottom: 16,
            fontFamily: 'inherit',
          }}
        />

        <button
          onClick={handleConfirm}
          disabled={saving || !amount || parseFloat(amount) <= 0}
          style={{
            width: '100%', padding: '14px',
            background: '#2563EB', border: 'none',
            borderRadius: 12, color: 'white',
            fontSize: 15, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: (saving || !amount || parseFloat(amount) <= 0) ? 0.5 : 1,
          }}
        >
          {saving ? 'Guardando...' : 'Confirmar abono'}
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
