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
  const [step, setStep] = useState<'template' | 'form'>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<GoalTemplate>({
    emoji: '🛡️', name: 'Fondo de emergencia', desc: '3 meses de gastos', type: 'emergency_fund',
  })

  function handleTemplateSelect(template: GoalTemplate) {
    setSelectedTemplate(template)
    setStep('form')
  }

  return (
    <AppShell title="Nueva meta" currentPath="/metas">
      {step === 'template' ? (
        <div>
          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.6)',
            marginBottom: 16, lineHeight: 1.5,
          }}>
            Elige un tipo de meta para empezar
          </p>
          <GoalTemplateGrid
            selected={selectedTemplate.type as GoalType}
            onSelect={handleTemplateSelect}
          />
        </div>
      ) : (
        <GoalForm
          emoji={selectedTemplate.emoji}
          templateName={selectedTemplate.name}
          goalType={selectedTemplate.type as GoalType}
          avgMonthlyExpenses={avgMonthlyExpenses}
          onSubmit={async (input) => {
            await createGoal(input)
            router.push('/metas')
          }}
          onCancel={() => setStep('template')}
        />
      )}
    </AppShell>
  )
}
