'use client'
import { useState } from 'react'
import { formatMoney } from '@/lib/format'
import { suggestEmergencyFundTarget } from '@/lib/goal-projector'
import type { GoalType, CreateGoalInput } from '@/hooks/useGoals'
import { ErrorBox, FieldLabel, INPUT_48, SheetHeader } from '@/components/layout/Pantalla'
import { PRIMARY_BUTTON, TEXT_MUTED, TILE_BG } from '@/components/movimientos/ui'
import { Note } from '@/components/plan/ui'

export interface GoalTemplate {
  emoji: string
  name: string
  type: GoalType
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  { emoji: '🛡️', name: 'Fondo de emergencia', type: 'emergency_fund' },
  { emoji: '✈️', name: 'Viaje', type: 'travel' },
  { emoji: '🚗', name: 'Vehículo', type: 'vehicle' },
  { emoji: '🎓', name: 'Educación', type: 'education' },
  { emoji: '📈', name: 'Inversión', type: 'investment' },
  { emoji: '🎯', name: 'Otra meta', type: 'custom' },
]

interface GoalFormProps {
  avgMonthlyExpenses: number
  onSubmit: (input: CreateGoalInput) => Promise<void>
}

function num(v: string): number {
  return parseFloat(v.replace(/[^0-9.]/g, '')) || 0
}

/** Contenido de la hoja "Nueva meta": tipo (emoji), nombre, monto y fecha. */
export function GoalForm({ avgMonthlyExpenses, onSubmit }: GoalFormProps) {
  const suggested = avgMonthlyExpenses > 0 ? suggestEmergencyFundTarget(avgMonthlyExpenses) : 0
  const [template, setTemplate] = useState<GoalTemplate>(GOAL_TEMPLATES[0])
  const [name, setName] = useState(GOAL_TEMPLATES[0].name)
  const [targetAmount, setTargetAmount] = useState(suggested > 0 ? String(suggested) : '')
  const [monthlyContribution, setMonthlyContribution] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function pick(t: GoalTemplate) {
    // El nombre sugerido solo se cambia si no lo escribió la persona.
    const isSuggested = !name.trim() || GOAL_TEMPLATES.some((x) => x.name === name)
    if (isSuggested) setName(t.type === 'custom' ? '' : t.name)
    if (t.type === 'emergency_fund' && suggested > 0 && !targetAmount) setTargetAmount(String(suggested))
    setTemplate(t)
  }

  async function submit() {
    const amount = num(targetAmount)
    if (!name.trim() || amount <= 0) { setError('Ponle nombre y cuánto quieres juntar.'); return }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        emoji: template.emoji,
        targetAmount: amount,
        monthlyContribution: monthlyContribution ? num(monthlyContribution) : null,
        targetDate: targetDate || null,
        goalType: template.type,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar. Intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2 [&>*]:shrink-0">
      <SheetHeader emoji={template.emoji} title="Nueva meta" subtitle="¿Para qué quieres ahorrar?" />

      <div role="radiogroup" aria-label="Tipo de meta" className="flex flex-wrap gap-2">
        {GOAL_TEMPLATES.map((t) => {
          const active = t.type === template.type
          return (
            <button
              key={t.type}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t.name}
              onClick={() => pick(t)}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 text-[22px] transition duration-150 active:scale-[0.96] ${
                active ? 'border-electric bg-electric-ghost dark:bg-[#1B2B4D]' : `border-transparent ${TILE_BG}`
              }`}
            >
              {t.emoji}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="meta-nombre">Nombre</FieldLabel>
        <input id="meta-nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Viaje a Semuc" className={INPUT_48} />
      </div>

      <div className="flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FieldLabel htmlFor="meta-monto">Meta</FieldLabel>
          <input id="meta-monto" inputMode="decimal" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="Q 0.00" className={INPUT_48} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FieldLabel htmlFor="meta-fecha">Para cuándo</FieldLabel>
          <input id="meta-fecha" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={INPUT_48} />
        </div>
      </div>

      {template.type === 'emergency_fund' && avgMonthlyExpenses > 0 && (
        <Note tone="info" className="">
          Te sugerimos 3 meses de tu gasto promedio ({formatMoney(avgMonthlyExpenses)} al mes): es el colchón mínimo para emergencias.
        </Note>
      )}

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="meta-aporte">Aporte al mes (opcional)</FieldLabel>
        <input id="meta-aporte" inputMode="decimal" value={monthlyContribution} onChange={(e) => setMonthlyContribution(e.target.value)} placeholder="Q 0.00" className={INPUT_48} />
        <span className={`text-[13px] ${TEXT_MUTED}`}>Con esto calculamos cuándo llegas.</span>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      <button type="button" onClick={() => void submit()} disabled={saving} className={PRIMARY_BUTTON}>
        {saving ? 'Guardando…' : 'Crear meta'}
      </button>
    </div>
  )
}
