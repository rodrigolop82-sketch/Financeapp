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
}

export function GoalForm({ emoji, templateName, goalType, avgMonthlyExpenses, onSubmit }: GoalFormProps) {
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
    width: '100%', padding: '14px 16px',
    background: 'white',
    border: '1px solid #CBD5E1',
    borderRadius: 12, color: '#0F172A',
    fontSize: 16, outline: 'none',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: '#2563EB',
    marginBottom: 8, display: 'block',
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
          <label style={labelStyle}>Monto objetivo</label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              color: '#94A3B8', fontSize: 16, fontWeight: 700,
              fontFamily: 'var(--font-outfit)',
            }}>
              Q
            </span>
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0"
              min="1"
              step="0.01"
              style={{
                ...inputStyle,
                paddingLeft: 36,
                fontFamily: 'var(--font-outfit)',
                fontWeight: 700,
                fontSize: 18,
              }}
            />
          </div>
        </div>

        {/* Emergency fund suggestion */}
        {goalType === 'emergency_fund' && avgMonthlyExpenses > 0 && (
          <div style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: 12,
            padding: '14px 16px',
          }}>
            <p style={{ fontSize: 13, color: '#1E40AF', lineHeight: 1.6 }}>
              💡 Calculamos esto con 3 meses de tu gasto promedio ({formatMoney(avgMonthlyExpenses)}/mes). Es el colchón mínimo recomendado para emergencias.
            </p>
          </div>
        )}

        <div>
          <label style={labelStyle}>
            Fecha deseada <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span>
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>
            Aporte mensual planeado <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span>
          </label>
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
        <p style={{ color: '#EF4444', fontSize: 13, marginTop: 12 }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          width: '100%', padding: '16px',
          background: '#2563EB', border: 'none',
          borderRadius: 14, color: 'white',
          fontSize: 16, fontWeight: 700,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
          marginTop: 28,
        }}
      >
        {saving ? 'Guardando...' : 'Crear meta 🎯✨'}
      </button>
    </form>
  )
}
