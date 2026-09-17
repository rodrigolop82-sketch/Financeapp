export interface ProjectionInput {
  targetAmount: number
  currentAmount: number
  avgMonthlySavings: number
  plannedContribution?: number
  targetDate?: Date | null
}

export interface ProjectionResult {
  status: 'completed' | 'no_data' | 'on_track' | 'behind' | 'no_target_date'
  monthsRemaining: number | null
  estimatedDate: Date | null
  requiredMonthly: number | null
  message: string
}

export function projectGoal(input: ProjectionInput): ProjectionResult {
  const remaining = input.targetAmount - input.currentAmount

  if (remaining <= 0) {
    return {
      status: 'completed',
      monthsRemaining: 0,
      estimatedDate: null,
      requiredMonthly: null,
      message: '¡Meta completada! 🎉',
    }
  }

  const monthlyRate = input.plannedContribution ?? input.avgMonthlySavings

  if (monthlyRate <= 0) {
    return {
      status: 'no_data',
      monthsRemaining: null,
      estimatedDate: null,
      requiredMonthly: null,
      message: 'Registra ahorros para ver tu proyección',
    }
  }

  const months = Math.ceil(remaining / monthlyRate)
  const estimatedDate = new Date()
  estimatedDate.setMonth(estimatedDate.getMonth() + months)

  const monthName = estimatedDate.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })

  if (!input.targetDate) {
    return {
      status: 'on_track',
      monthsRemaining: months,
      estimatedDate,
      requiredMonthly: null,
      message: `A este ritmo: ${monthName}`,
    }
  }

  const monthsUntilTarget = Math.max(1, Math.round(
    (input.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
  ))

  if (months <= monthsUntilTarget) {
    return {
      status: 'on_track',
      monthsRemaining: months,
      estimatedDate,
      requiredMonthly: null,
      message: `Vas bien — llegas en ${monthName}`,
    }
  }

  const requiredMonthly = Math.ceil(remaining / monthsUntilTarget)
  const targetMonthName = input.targetDate.toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })

  return {
    status: 'behind',
    monthsRemaining: months,
    estimatedDate,
    requiredMonthly,
    message: `Necesitas ahorrar Q${requiredMonthly.toLocaleString('es-GT')}/mes para llegar en ${targetMonthName}`,
  }
}

export function suggestEmergencyFundTarget(avgMonthlyExpenses: number): number {
  return Math.round(avgMonthlyExpenses * 3)
}
