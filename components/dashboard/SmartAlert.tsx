'use client'

export type AlertType = 'warning' | 'positive' | 'info' | null

export interface AlertData {
  type: AlertType
  title: string
  subtitle: string
  budgetAmount?: number
  spentAmount?: number
}

export function buildSmartAlert(params: {
  spent: number
  budget: number
  daysLeft: number
  daysInMonth: number
  topOverBudgetCategory?: { name: string; spent: number; limit: number; pctOver: number }
  daysSinceLastTransaction: number
  scoreImproved?: boolean
  scorePoints?: number
  savingsAlert?: { name: string; saved: number; goal: number }
}): AlertData | null {
  const { spent, budget, daysLeft, daysInMonth,
          topOverBudgetCategory, daysSinceLastTransaction,
          scoreImproved, scorePoints, savingsAlert } = params

  const daysElapsed = daysInMonth - daysLeft
  const dailyRate = daysElapsed > 0 ? spent / daysElapsed : 0
  const projectedTotal = dailyRate * daysInMonth

  // Savings alert: exceeding savings goal is positive
  if (savingsAlert && savingsAlert.goal > 0) {
    if (savingsAlert.saved >= savingsAlert.goal) {
      const extra = Math.round(savingsAlert.saved - savingsAlert.goal)
      return {
        type: 'positive',
        title: `Superaste tu meta de ahorro${extra > 0 ? ` por Q ${extra.toLocaleString()}` : ''} este mes`,
        subtitle: `${savingsAlert.name} — meta: Q ${savingsAlert.goal.toLocaleString()}, ahorrado: Q ${savingsAlert.saved.toLocaleString()}.`,
      }
    } else if (savingsAlert.saved > 0) {
      const pct = Math.round((savingsAlert.saved / savingsAlert.goal) * 100)
      return {
        type: 'info',
        title: `Vas al ${pct}% de tu meta de ahorro este mes`,
        subtitle: `${savingsAlert.name} — llevas Q ${savingsAlert.saved.toLocaleString()} de Q ${savingsAlert.goal.toLocaleString()}.`,
      }
    } else {
      return {
        type: 'info',
        title: `Aún no registras ahorro este mes`,
        subtitle: `Tu meta de ${savingsAlert.name} es Q ${savingsAlert.goal.toLocaleString()} — un buen momento para empezar.`,
      }
    }
  }

  if (projectedTotal > budget * 1.05) {
    const overage = Math.round(projectedTotal - budget)
    return {
      type: 'warning',
      title: `A este ritmo cerrarás el mes Q ${overage.toLocaleString()} sobre el presupuesto`,
      subtitle: 'Aún puedes corregirlo — reduce gastos estos días.',
    }
  }

  if (topOverBudgetCategory && topOverBudgetCategory.pctOver > 25) {
    const extra = Math.round(topOverBudgetCategory.spent - topOverBudgetCategory.limit)
    return {
      type: 'warning',
      title: `${topOverBudgetCategory.name} sobre el límite este mes`,
      subtitle: `Gastaste Q ${extra.toLocaleString()} más de lo planeado.`,
      budgetAmount: topOverBudgetCategory.limit,
      spentAmount: topOverBudgetCategory.spent,
    }
  }

  if (daysSinceLastTransaction >= 3 && daysSinceLastTransaction <= 90) {
    return {
      type: 'info',
      title: `Hace ${daysSinceLastTransaction} días sin registrar gastos.`,
      subtitle: 'Registra uno para mantener tu racha al día →',
    }
  }

  if (scoreImproved && scorePoints && scorePoints >= 3) {
    return {
      type: 'positive',
      title: `Tu puntaje Zafi subió ${scorePoints} puntos este mes`,
      subtitle: '¡Sigues mejorando! Revisa tu plan para continuar.',
    }
  }

  if (daysLeft <= 5 && spent < budget * 0.95) {
    const saving = Math.round(budget - spent)
    return {
      type: 'positive',
      title: `Vas a cerrar el mes con Q ${saving.toLocaleString()} de sobra`,
      subtitle: 'Muévelos al fondo de emergencia o al pago extra de deudas.',
    }
  }

  return null
}
