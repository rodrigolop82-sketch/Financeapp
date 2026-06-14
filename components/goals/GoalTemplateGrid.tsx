'use client'
import type { GoalType } from '@/hooks/useGoals'

interface GoalTemplate {
  emoji: string
  name: string
  desc: string
  type: GoalType
}

const TEMPLATES: GoalTemplate[] = [
  { emoji: '🛡️', name: 'Fondo de emergencia', desc: '3 meses de gastos', type: 'emergency_fund' },
  { emoji: '✈️', name: 'Viaje', desc: 'Vacaciones o escape', type: 'travel' },
  { emoji: '🚗', name: 'Vehículo', desc: 'Enganche o compra', type: 'vehicle' },
  { emoji: '🎓', name: 'Educación', desc: 'Curso o colegiatura', type: 'education' },
  { emoji: '📈', name: 'Inversión', desc: 'Capital para invertir', type: 'investment' },
  { emoji: '🎯', name: 'Personalizada', desc: 'Define tu propia meta', type: 'custom' },
]

interface GoalTemplateGridProps {
  selected: GoalType
  onSelect: (template: GoalTemplate) => void
}

export function GoalTemplateGrid({ selected, onSelect }: GoalTemplateGridProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      marginBottom: 20,
    }}>
      {TEMPLATES.map((t) => {
        const isSelected = t.type === selected
        return (
          <button
            key={t.type}
            onClick={() => onSelect(t)}
            style={{
              background: isSelected ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.04)',
              border: isSelected ? '1.5px solid #2563EB' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: '14px 12px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <span style={{ fontSize: 24, display: 'block', marginBottom: 6 }}>{t.emoji}</span>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 2 }}>{t.name}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{t.desc}</p>
          </button>
        )
      })}
    </div>
  )
}

export { TEMPLATES }
export type { GoalTemplate }
