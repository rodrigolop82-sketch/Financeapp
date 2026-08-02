'use client'
import { useMoneyFormat } from '@/lib/format'

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
        subtitle: `${savingsAlert.name} — llevás Q ${savingsAlert.saved.toLocaleString()} de Q ${savingsAlert.goal.toLocaleString()}.`,
      }
    } else {
      return {
        type: 'info',
        title: `Aún no registrás ahorro este mes`,
        subtitle: `Tu meta de ${savingsAlert.name} es Q ${savingsAlert.goal.toLocaleString()} — un buen momento para empezar.`,
      }
    }
  }

  if (projectedTotal > budget * 1.05) {
    const overage = Math.round(projectedTotal - budget)
    return {
      type: 'warning',
      title: `A este ritmo cerrarás el mes Q ${overage.toLocaleString()} sobre el presupuesto`,
      subtitle: 'Aún podés corregirlo — reducí gastos estos días.',
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

  if (daysSinceLastTransaction >= 3) {
    return {
      type: 'info',
      title: `Hace ${daysSinceLastTransaction} días sin registrar gastos.`,
      subtitle: 'Registrá uno para mantener tu racha al día →',
    }
  }

  if (scoreImproved && scorePoints && scorePoints >= 3) {
    return {
      type: 'positive',
      title: `Tu puntaje Zafi subió ${scorePoints} puntos este mes`,
      subtitle: '¡Seguís mejorando! Revisá tu plan para continuar.',
    }
  }

  if (daysLeft <= 5 && spent < budget * 0.95) {
    const saving = Math.round(budget - spent)
    return {
      type: 'positive',
      title: `Vas a cerrar el mes con Q ${saving.toLocaleString()} de sobra`,
      subtitle: 'Movelós al fondo de emergencia o al pago extra de deudas.',
    }
  }

  return null
}

export function SmartAlert({ alert }: { alert: AlertData | null }) {
  const { money } = useMoneyFormat()
  if (!alert) return null

  if (alert.type === 'info') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: '#E9F0FF', borderRadius: 14,
        padding: '16px 20px', marginTop: 20,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: '#2563EB', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>!</div>
        <div style={{ fontSize: '14.5px', color: '#1E3A5F' }}>
          <span style={{ fontWeight: 600 }}>{alert.title}</span>
          {' '}
          <span style={{ color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>
            {alert.subtitle}
          </span>
        </div>
      </div>
    )
  }

  const styles = {
    warning: {
      bg: '#FEF3C7', border: '#F59E0B40',
      iconBg: '#F59E0B20', iconColor: '#92400E',
      titleColor: '#92400E', subColor: '#B45309',
    },
    positive: {
      bg: '#D1FAE5', border: '#10B98140',
      iconBg: '#10B98120', iconColor: '#065F46',
      titleColor: '#065F46', subColor: '#047857',
    },
  }

  const s = styles[alert.type as 'warning' | 'positive']

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{
        background: s.bg, border: `0.5px solid ${s.border}`,
        borderRadius: 14, padding: '16px 20px',
        display: 'flex', gap: 12, alignItems: 'flex-start'
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: s.iconBg, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: 1
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            {alert.type === 'positive'
              ? <path d="M2 6l2.5 2.5L10 3" stroke={s.iconColor} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              : <path d="M6 2v5M6 8.5v1" stroke={s.iconColor} strokeWidth="1.4" strokeLinecap="round"/>
            }
          </svg>
        </div>
        <div>
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: s.titleColor, marginBottom: 2 }}>
            {alert.title}
          </div>
          <div style={{ fontSize: 13, color: s.subColor, lineHeight: 1.4 }}>
            {alert.subtitle}
          </div>
          {alert.budgetAmount != null && alert.spentAmount != null && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 9, fontWeight: 600, color: '#B45309', marginBottom: 3 }}>
                <span>Presupuesto</span>
                <span>Gasto real</span>
              </div>
              <div style={{ height: 5, background: '#FED7AA', borderRadius: 3,
                overflow: 'visible', position: 'relative' }}>
                <div style={{
                  height: 5,
                  width: `${Math.min((alert.budgetAmount / alert.spentAmount) * 100, 100)}%`,
                  background: '#D97706', borderRadius: 3
                }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 9, marginTop: 3, fontWeight: 600 }}>
                <span style={{ color: '#B45309' }}>
                  {money(alert.budgetAmount)} planeado
                </span>
                <span style={{ color: '#EF4444' }}>
                  {money(alert.spentAmount)} gastado
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
