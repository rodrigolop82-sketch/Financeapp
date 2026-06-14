'use client'
import { useState } from 'react'
import { formatMoney } from '@/lib/format'
import { suggestEmergencyFundTarget } from '@/lib/goal-projector'
import type { GoalType, CreateGoalInput } from '@/hooks/useGoals'

interface GoalFormProps {
  emoji: string
  templateName: string
  goalType: GoalType
  avgMonthlyExpenses: number
  onSubmit: (input: CreateGoalInput) => Promise<void>
  onCancel: () => void
}

export function GoalForm({ emoji, templateName, goalType, avgMonthlyExpenses, onSubmit, onCancel }: GoalFormProps) {
  const suggestedAmount = goalType === 'emergency_fund' && avgMonthlyExpenses > 0
    ? suggestEmergencyFundTarget(avgMonthlyExpenses)
    : 0

  const [name, setName] = useState(goalType !== 'custom' ? templateName : '')
  const [targetAmount, setTargetAmount] = useState(suggestedAmount > 0 ? suggestedAmount.toString() : '')
  const [monthlyContribution, setMonthlyContribution] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(targetAmount)
    if (!name.trim()) { setError('Ingresa un nombre para tu meta'); return }
    if (!amount || amount <= 0) { setError('El monto debe ser mayor a 0'); return }

    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        emoji,
        targetAmount: amount,
        monthlyContribution: monthlyContribution ? parseFloat(monthlyContribution) : null,
        targetDate: targetDate || null,
        goalType,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, color: 'white',
    fontSize: 15, outline: 'none',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)',
    marginBottom: 6, display: 'block',
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Hero */}
      <div style={{
        textAlign: 'center', padding: '20px 0 24px',
      }}>
        <span style={{ fontSize: 48 }}>{emoji}</span>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'white', marginTop: 8 }}>{templateName}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>Nombre de la meta</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Fondo para viaje a Semuc"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Monto objetivo (Q)</label>
          <input
            type="number"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="0"
            min="1"
            step="0.01"
            style={{ ...inputStyle, fontFamily: 'var(--font-outfit)', fontWeight: 700, fontSize: 18 }}
          />
        </div>

        {/* Emergency fund suggestion */}
        {goalType === 'emergency_fund' && avgMonthlyExpenses > 0 && (
          <div style={{
            background: 'rgba(37,99,235,0.1)',
            border: '1px solid rgba(37,99,235,0.25)',
            borderRadius: 12,
            padding: '12px 14px',
          }}>
            <p style={{ fontSize: 13, color: '#93C5FD', lineHeight: 1.5 }}>
              💡 Calculamos esto con 3 meses de tu gasto promedio ({formatMoney(avgMonthlyExpenses)}/mes).
              Tener este fondo te protege ante imprevistos.
            </p>
          </div>
        )}

        <div>
          <label style={labelStyle}>Fecha deseada (opcional)</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }}
          />
        </div>

        <div>
          <label style={labelStyle}>Aporte mensual planeado (opcional)</label>
          <input
            type="number"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(e.target.value)}
            placeholder="Q 0"
            min="0"
            step="0.01"
            style={{ ...inputStyle, fontFamily: 'var(--font-outfit)' }}
          />
        </div>
      </div>

      {error && (
        <p style={{ color: '#F87171', fontSize: 13, marginTop: 12 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1, padding: '14px', borderRadius: 12,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{
            flex: 2, padding: '14px', borderRadius: 12,
            background: '#2563EB', border: 'none',
            color: 'white', fontSize: 15, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Guardando...' : 'Crear meta'}
        </button>
      </div>
    </form>
  )
}
