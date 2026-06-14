'use client'
import { useState } from 'react'
import { formatMoney } from '@/lib/format'

interface AddContributionSheetProps {
  open: boolean
  onClose: () => void
  goalName: string
  goalEmoji: string
  currentAmount: number
  targetAmount: number
  onConfirm: (amount: number, note: string) => Promise<void>
  monthlyContribution: number | null
}

export function AddContributionSheet({
  open, onClose, goalName, goalEmoji,
  currentAmount, targetAmount,
  onConfirm, monthlyContribution,
}: AddContributionSheetProps) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCustom, setShowCustom] = useState(false)

  if (!open) return null

  const quickAmounts: (number | 'other')[] = [200, 500]
  if (monthlyContribution && !quickAmounts.includes(monthlyContribution)) {
    quickAmounts.push(monthlyContribution)
  }
  quickAmounts.push('other')

  async function handleConfirm() {
    const val = parseFloat(amount)
    if (!val || val <= 0) return
    setSaving(true)
    try {
      await onConfirm(val, note)
      setAmount('')
      setNote('')
      setShowCustom(false)
      onClose()
    } catch {
      // error handled by parent
    } finally {
      setSaving(false)
    }
  }

  function handleQuickSelect(q: number | 'other') {
    if (q === 'other') {
      setShowCustom(true)
      setAmount('')
    } else {
      setShowCustom(false)
      setAmount(q.toString())
    }
  }

  const displayAmount = amount
    ? `${parseFloat(amount).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '0.00'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.4)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
        background: 'white',
        borderTop: '1px solid #E2E8F0',
        borderRadius: '20px 20px 0 0',
        padding: '16px 20px calc(20px + env(safe-area-inset-bottom))',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: '#CBD5E1',
          margin: '0 auto 16px',
        }} />

        {/* Title */}
        <p style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
          Abonar a {goalName}
        </p>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
          {goalEmoji} {formatMoney(currentAmount)} de {formatMoney(targetAmount)} actual
        </p>

        {/* Amount display */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <p style={{
            fontSize: 42, fontWeight: 900, color: '#0F172A',
            fontFamily: 'var(--font-outfit)',
          }}>
            <span style={{ fontSize: 20, color: '#94A3B8', fontWeight: 700 }}>Q</span>
            {displayAmount}
          </p>
        </div>

        {/* Quick amounts */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {quickAmounts.map((q) => {
            const isSelected = q === 'other'
              ? showCustom
              : amount === q.toString() && !showCustom
            return (
              <button
                key={q.toString()}
                onClick={() => handleQuickSelect(q)}
                style={{
                  flex: 1, padding: '12px 0',
                  background: isSelected ? '#DBEAFE' : '#F8FAFF',
                  border: isSelected ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                  borderRadius: 10, color: isSelected ? '#1D4ED8' : '#334155',
                  fontSize: 14, fontWeight: 600,
                  fontFamily: 'var(--font-outfit)',
                  cursor: 'pointer',
                }}
              >
                {q === 'other' ? 'Otro' : `Q${q}`}
              </button>
            )
          })}
        </div>

        {/* Custom amount input */}
        {showCustom && (
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ingresa el monto"
            autoFocus
            style={{
              width: '100%', padding: '12px 14px',
              background: '#F8FAFF',
              border: '1px solid #CBD5E1',
              borderRadius: 10, color: '#0F172A',
              fontSize: 16, fontWeight: 600,
              fontFamily: 'var(--font-outfit)',
              textAlign: 'center', outline: 'none',
              marginBottom: 16,
            }}
          />
        )}

        {/* Note */}
        <p style={{ fontSize: 13, fontWeight: 600, color: '#2563EB', marginBottom: 6 }}>
          Nota <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span>
        </p>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Aporte mensual"
          style={{
            width: '100%', padding: '12px 14px',
            background: '#F8FAFF',
            border: '1px solid #E2E8F0',
            borderRadius: 10, color: '#0F172A',
            fontSize: 14, outline: 'none',
            marginBottom: 20,
            fontFamily: 'inherit',
          }}
        />

        <button
          onClick={handleConfirm}
          disabled={saving || !amount || parseFloat(amount) <= 0}
          style={{
            width: '100%', padding: '16px',
            background: '#2563EB', border: 'none',
            borderRadius: 14, color: 'white',
            fontSize: 16, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: (saving || !amount || parseFloat(amount) <= 0) ? 0.5 : 1,
          }}
        >
          {saving ? 'Guardando...' : 'Confirmar abono 💰'}
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
