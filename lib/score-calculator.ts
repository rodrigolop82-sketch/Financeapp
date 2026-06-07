export interface ScoreInput {
  totalIncome: number
  totalFixedExpenses: number
  totalDebt: number
  totalSavings: number
  hasEmergencyFund: boolean
  incomeType: 'fixed' | 'variable' | 'mixed'
  spentThisMonth: number
}

export interface ScoreComponent {
  key: string
  label: string
  score: number
  max: number
  tip: string
}

export interface HealthScoreResult {
  total: number
  label: string
  color: string
  emoji: string
  components: ScoreComponent[]
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export function calculateDynamicScore(input: ScoreInput): HealthScoreResult {
  const { totalIncome, totalFixedExpenses, totalDebt, totalSavings, hasEmergencyFund, incomeType, spentThisMonth } = input

  if (totalIncome <= 0) {
    return {
      total: 0,
      label: 'Sin datos',
      color: '#6B7280',
      emoji: '📊',
      components: [],
    }
  }

  const components: ScoreComponent[] = []

  // 1. Ahorro (20 pts) — savings rate
  const savingsRate = totalSavings / totalIncome
  let savingsScore: number
  if (savingsRate >= 0.20) savingsScore = 20
  else if (savingsRate >= 0.15) savingsScore = 16
  else if (savingsRate >= 0.10) savingsScore = 12
  else if (savingsRate >= 0.05) savingsScore = 7
  else savingsScore = 2

  components.push({
    key: 'savings',
    label: 'Ahorro',
    score: savingsScore,
    max: 20,
    tip: savingsScore < 12
      ? 'Intenta ahorrar al menos 10% de tu ingreso cada mes.'
      : '¡Buen nivel de ahorro! Sigue así.',
  })

  // 2. Deuda (20 pts) — debt-to-income
  const dti = totalDebt / totalIncome
  let debtScore: number
  if (dti === 0) debtScore = 20
  else if (dti <= 0.10) debtScore = 16
  else if (dti <= 0.20) debtScore = 11
  else if (dti <= 0.35) debtScore = 6
  else debtScore = 2

  components.push({
    key: 'debt',
    label: 'Deuda',
    score: debtScore,
    max: 20,
    tip: debtScore < 11
      ? `Tus deudas son ${Math.round(dti * 100)}% de tu ingreso. Prioriza reducirlas.`
      : 'Tu nivel de deuda está controlado.',
  })

  // 3. Fondo de emergencia (20 pts)
  const monthsCovered = totalFixedExpenses > 0 ? totalSavings / totalFixedExpenses : 0
  let efScore: number
  if (hasEmergencyFund && monthsCovered >= 6) efScore = 20
  else if (monthsCovered >= 3) efScore = 14
  else if (monthsCovered >= 1) efScore = 8
  else efScore = 2

  components.push({
    key: 'emergency',
    label: 'Emergencia',
    score: efScore,
    max: 20,
    tip: efScore < 14
      ? 'Tu fondo de emergencia debería cubrir al menos 3 meses de gastos.'
      : 'Tienes un buen colchón de emergencia.',
  })

  // 4. Gasto vs presupuesto (20 pts) — spending ratio this month
  const budgetLimit = totalIncome * 0.8
  const spendingRatio = budgetLimit > 0 ? spentThisMonth / budgetLimit : 0
  let spendScore: number
  if (spendingRatio <= 0.60) spendScore = 20
  else if (spendingRatio <= 0.75) spendScore = 16
  else if (spendingRatio <= 0.90) spendScore = 12
  else if (spendingRatio <= 1.0) spendScore = 7
  else spendScore = 2

  components.push({
    key: 'spending',
    label: 'Gasto',
    score: spendScore,
    max: 20,
    tip: spendScore < 12
      ? 'Estás gastando más de lo recomendado este mes.'
      : 'Tu ritmo de gasto va bien este mes.',
  })

  // 5. Estabilidad de ingreso (20 pts)
  const stabilityScore = incomeType === 'fixed' ? 20 : incomeType === 'mixed' ? 12 : 6

  components.push({
    key: 'stability',
    label: 'Estabilidad',
    score: stabilityScore,
    max: 20,
    tip: stabilityScore < 12
      ? 'Con ingreso variable, un fondo de emergencia más grande te protege.'
      : 'Ingreso estable es una gran ventaja financiera.',
  })

  const total = clamp(
    Math.round(components.reduce((s, c) => s + c.score, 0)),
    0,
    100
  )

  return {
    total,
    ...getScoreMeta(total),
    components,
  }
}

function getScoreMeta(score: number): { label: string; color: string; emoji: string } {
  if (score >= 80) return { label: 'Excelente', color: '#10B981', emoji: '🏆' }
  if (score >= 60) return { label: 'Saludable', color: '#2563EB', emoji: '💪' }
  if (score >= 40) return { label: 'Estable', color: '#F59E0B', emoji: '⚠️' }
  if (score >= 20) return { label: 'En riesgo', color: '#F97316', emoji: '🔶' }
  return { label: 'Crítico', color: '#EF4444', emoji: '🚨' }
}
