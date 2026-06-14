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
      gap: 12,
    }}>
      {TEMPLATES.map((t) => {
        const isSelected = t.type === selected
        return (
          <button
            key={t.type}
            onClick={() => onSelect(t)}
            style={{
              background: isSelected ? '#DBEAFE' : 'white',
              border: isSelected ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
              borderRadius: 16,
              padding: '20px 12px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              boxShadow: isSelected ? '0 0 0 3px rgba(37,99,235,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <span style={{ fontSize: 36, display: 'block', marginBottom: 10 }}>{t.emoji}</span>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{t.name}</p>
            <p style={{ fontSize: 12, color: '#64748B' }}>{t.desc}</p>
          </button>
        )
      })}
    </div>
  )
}

export { TEMPLATES }
export type { GoalTemplate }
