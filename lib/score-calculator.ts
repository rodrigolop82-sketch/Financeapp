// Salud financiera (puntaje Zafi): una sola fórmula de 5 partes de 20.
// El puntaje es continuo (interpolación lineal entre umbrales) para que cada
// aporte, cuota pagada o gasto mueva el número, no solo al cruzar un tramo.
// Las entradas vienen de lo que la persona ya registra (lib/health-data.ts);
// el onboarding es solo la semilla del día 1 (scoreFromProfile).

export type IncomeType = 'fixed' | 'variable' | 'mixed'

export interface ScoreInput {
  /** Ingreso mensual (Plan del mes; si no hay, el del onboarding). */
  income: number
  /** Lo que se guardó en el mes: aportes a metas + gastos en categorías de ahorro. */
  saved: number
  /** Σ pagos mínimos al mes de las deudas activas (la cuota, no el saldo). */
  debtPayments: number
  /** Saldo del fondo de emergencia. */
  emergencyFund: number
  /** Gastos fijos al mes. */
  fixedExpenses: number
  /** Gasto del mes en básico + gustos. */
  spent: number
  /** Lo planeado en básico + gustos (0: se usa el 80% del ingreso). */
  planned: number
  incomeType: IncomeType
  /** Coeficiente de variación de los ingresos de los últimos 3 meses (null: sin datos). */
  incomeVariation?: number | null
  /** Meta de fondo de emergencia, para "Aportar al fondo". */
  emergencyGoalId?: string | null
  hasDebts?: boolean
}

export type ScoreKey = 'savings' | 'debt' | 'emergency' | 'spending' | 'stability'

export interface ScoreComponent {
  key: ScoreKey
  emoji: string
  label: string
  score: number
  max: number
  /** "Este mes guardaste Q 900 · 8% de tu ingreso". */
  detail: string
  tip: string
  action: { label: string; href: string } | null
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

/** y0 en x0, y1 en x1, recta en medio y plano fuera del tramo. */
export function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  const t = clamp((x - x0) / (x1 - x0), 0, 1)
  return y0 + t * (y1 - y0)
}

function q(n: number): string {
  return `Q ${Math.round(n).toLocaleString('en-US')}`
}

const STABILITY_BASE: Record<IncomeType, number> = { fixed: 20, mixed: 14, variable: 8 }

export function calculateScore(input: ScoreInput): HealthScoreResult {
  const { income, saved, debtPayments, emergencyFund, fixedExpenses, spent, incomeType } = input

  if (income <= 0) {
    return { total: 0, label: 'Sin datos', color: '#6B7280', emoji: '📊', components: [] }
  }

  const rate = Math.max(0, saved) / income
  const burden = Math.max(0, debtPayments) / income
  const months = fixedExpenses > 0 ? Math.max(0, emergencyFund) / fixedExpenses : 0
  const planned = input.planned > 0 ? input.planned : income * 0.8
  const pace = Math.max(0, spent) / planned

  const base = STABILITY_BASE[incomeType] ?? 14
  const cv = input.incomeVariation
  // Ingresos que varían más de 10% entre meses restan hasta la mitad.
  const stability = cv == null ? base : base - lerp(cv, 0.1, 0.5, 0, base / 2)

  const components: ScoreComponent[] = [
    {
      key: 'savings', emoji: '💰', label: 'Ahorro', max: 20,
      score: lerp(rate, 0, 0.2, 2, 20),
      detail: `Este mes guardaste ${q(saved)} · ${Math.round(rate * 100)}% de tu ingreso`,
      tip: rate < 0.1 ? `La meta es guardar al menos 10% (${q(income * 0.1)}).` : '¡Buen nivel de ahorro! Sigue así.',
      action: rate < 0.2 ? { label: 'Aportar a una meta', href: '/plan?s=metas' } : null,
    },
    {
      key: 'debt', emoji: '💳', label: 'Deuda', max: 20,
      score: lerp(burden, 0.4, 0, 2, 20),
      detail: debtPayments > 0
        ? `Tus cuotas son ${q(debtPayments)} al mes · ${Math.round(burden * 100)}% de tu ingreso`
        : 'No tienes cuotas de deudas',
      tip: burden > 0.15 ? 'Si bajas tus cuotas a menos de 15% del ingreso, este punto sube.' : 'Tu nivel de deuda está controlado.',
      action: input.hasDebts ?? debtPayments > 0 ? { label: 'Ver cómo salir más rápido', href: '/plan?s=deudas' } : null,
    },
    {
      key: 'emergency', emoji: '🛡️', label: 'Fondo de emergencia', max: 20,
      score: lerp(months, 0, 6, 2, 20),
      detail: `Cubre ${months.toFixed(1).replace('.', ',')} ${months === 1 ? 'mes' : 'meses'} de gastos fijos`,
      tip: months < 3 ? `Lo recomendado es tener al menos 3 meses (${q(fixedExpenses * 3)}).` : 'Tienes un buen colchón.',
      action: months < 6
        ? { label: 'Aportar al fondo', href: input.emergencyGoalId ? `/metas/${input.emergencyGoalId}?from=score` : '/plan?s=metas' }
        : null,
    },
    {
      key: 'spending', emoji: '📊', label: 'Gasto del mes', max: 20,
      score: lerp(pace, 0.6, 1.1, 20, 2),
      detail: `Llevas ${q(spent)} de ${q(planned)} planeados`,
      tip: pace > 0.9 ? 'Vas cerca del límite de tu plan.' : 'Vas dentro de tu plan.',
      action: { label: 'Ver plan del mes', href: '/plan' },
    },
    {
      key: 'stability', emoji: '📈', label: 'Estabilidad de ingreso', max: 20,
      score: stability,
      detail: cv == null
        ? incomeType === 'fixed' ? 'Tu ingreso es fijo' : incomeType === 'mixed' ? 'Tu ingreso es mixto' : 'Tu ingreso es variable'
        : cv <= 0.1 ? 'Ingresos parecidos los últimos 3 meses' : 'Tus ingresos cambiaron en los últimos 3 meses',
      tip: stability < 16 ? 'Con ingreso que varía, un fondo de emergencia más grande te protege.' : 'Ingreso estable es una gran ventaja.',
      action: null,
    },
  ].map((c) => ({ ...c, score: Math.round(c.score) })) as ScoreComponent[]

  const total = clamp(components.reduce((s, c) => s + c.score, 0), 0, 100)
  return { total, ...getScoreMeta(total), components }
}

export function getScoreMeta(score: number): { label: string; color: string; emoji: string } {
  if (score >= 80) return { label: 'Excelente', color: '#10B981', emoji: '🏆' }
  if (score >= 60) return { label: 'Saludable', color: '#2563EB', emoji: '💪' }
  if (score >= 40) return { label: 'Estable', color: '#F59E0B', emoji: '⚠️' }
  if (score >= 20) return { label: 'En riesgo', color: '#F97316', emoji: '🔶' }
  return { label: 'Crítico', color: '#EF4444', emoji: '🚨' }
}

/** Color de una parte según qué tan llena está. */
export function partColor(score: number, max: number): string {
  const r = max > 0 ? score / max : 0
  if (r >= 0.75) return '#10B981'
  if (r >= 0.5) return '#2563EB'
  if (r >= 0.3) return '#F59E0B'
  return '#EF4444'
}

export interface FinancialProfile {
  total_income: number
  total_fixed_expenses: number
  total_debt: number
  total_savings: number
  has_emergency_fund: boolean
  income_type: IncomeType
}

/** Cuota mensual estimada cuando solo se conoce el saldo (3%, típico de tarjeta). */
export function estimatedDebtPayment(balance: number): number {
  return Math.max(0, balance) * 0.03
}

/**
 * Semilla del día 1 (onboarding, análisis gratuito): todavía no hay
 * movimientos ni metas, así que se usa lo que la persona contó.
 */
export function scoreFromProfile(profile: FinancialProfile, debtPayments?: number): HealthScoreResult {
  const income = Number(profile.total_income) || 0
  const fixed = Number(profile.total_fixed_expenses) || 0
  const savings = Number(profile.total_savings) || 0
  const payments = debtPayments ?? estimatedDebtPayment(Number(profile.total_debt) || 0)
  return calculateScore({
    income,
    // Sin historial: lo que queda después de fijos y cuotas, hasta lo ahorrado.
    saved: Math.min(savings, Math.max(0, income - fixed - payments)),
    debtPayments: payments,
    emergencyFund: savings,
    fixedExpenses: fixed,
    spent: fixed,
    planned: income * 0.8,
    incomeType: profile.income_type,
    hasDebts: (Number(profile.total_debt) || 0) > 0,
  })
}
