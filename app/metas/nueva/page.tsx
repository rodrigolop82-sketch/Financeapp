'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { GoalTemplateGrid, type GoalTemplate } from '@/components/goals/GoalTemplateGrid'
import { GoalForm } from '@/components/goals/GoalForm'
import { useGoals, type GoalType } from '@/hooks/useGoals'

export default function NuevaMetaPage() {
  const router = useRouter()
  const { createGoal, avgMonthlyExpenses } = useGoals()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<GoalTemplate>({
    emoji: '🛡️', name: 'Fondo de emergencia', desc: '3 meses de gastos', type: 'emergency_fund',
  })

  const title = step === 1 ? 'Nueva meta' : 'Detalles de tu meta'

  return (
    <AppShell title={title} currentPath="/metas">
      {/* Step indicator */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
      }}>
        <div />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          Paso {step} de 2
        </p>
      </div>

      {step === 1 ? (
        <div>
          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.5)',
            marginBottom: 20, lineHeight: 1.6,
          }}>
            Elige un punto de partida — vas a poder ajustar todo en el siguiente paso.
          </p>

          <GoalTemplateGrid
            selected={selectedTemplate.type as GoalType}
            onSelect={setSelectedTemplate}
          />

          <button
            onClick={() => setStep(2)}
            style={{
              width: '100%', padding: '16px',
              background: '#2563EB', border: 'none',
              borderRadius: 14, color: 'white',
              fontSize: 16, fontWeight: 700,
              cursor: 'pointer', marginTop: 24,
            }}
          >
            Continuar →
          </button>
        </div>
      ) : (
        <div>
          {/* Hero card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'rgba(37,99,235,0.1)',
            border: '1px solid rgba(37,99,235,0.2)',
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 24,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(37,99,235,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
            }}>
              {selectedTemplate.emoji}
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{selectedTemplate.name}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                Te sugerimos un monto basado en tus gastos reales
              </p>
            </div>
          </div>

          <GoalForm
            emoji={selectedTemplate.emoji}
            templateName={selectedTemplate.name}
            goalType={selectedTemplate.type as GoalType}
            avgMonthlyExpenses={avgMonthlyExpenses}
            onSubmit={async (input) => {
              await createGoal(input)
              router.push('/metas')
            }}
          />
        </div>
      )}
    </AppShell>
  )
}
