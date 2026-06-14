'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { GoalTemplateGrid, type GoalTemplate } from '@/components/goals/GoalTemplateGrid'
import { GoalForm } from '@/components/goals/GoalForm'
import { useGoals, type GoalType } from '@/hooks/useGoals'
import { ArrowLeft } from 'lucide-react'

export default function NuevaMetaPage() {
  const router = useRouter()
  const { createGoal, avgMonthlyExpenses } = useGoals()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedTemplate, setSelectedTemplate] = useState<GoalTemplate>({
    emoji: '🛡️', name: 'Fondo de emergencia', desc: '3 meses de gastos', type: 'emergency_fund',
  })

  const title = step === 1 ? 'Nueva meta' : 'Detalles de tu meta'

  function handleBack() {
    if (step === 2) {
      setStep(1)
    } else {
      router.push('/metas')
    }
  }

  return (
    <AppShell title={title} currentPath="/metas">
      {/* Back button + step indicator */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
      }}>
        <button
          onClick={handleBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#2563EB', fontSize: 14, fontWeight: 500,
            padding: 0,
          }}
        >
          <ArrowLeft size={18} />
          {step === 2 ? 'Cambiar template' : 'Mis metas'}
        </button>
        <p style={{ fontSize: 13, color: '#94A3B8' }}>
          Paso {step} de 2
        </p>
      </div>

      {step === 1 ? (
        <div>
          <p style={{
            fontSize: 14, color: '#64748B',
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
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 24,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: '#DBEAFE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
            }}>
              {selectedTemplate.emoji}
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{selectedTemplate.name}</p>
              <p style={{ fontSize: 12, color: '#64748B' }}>
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
