'use client'

export type AlertType = 'warning' | 'positive' | 'info' | null

export interface AlertData {
  type: AlertType
  title: string
  subtitle: string
}

/**
 * Genera la alerta más relevante según el contexto financiero actual.
 * Prioridad: déficit proyectado > categoría sobregirada > días sin registrar > logro reciente
 */
export function buildSmartAlert(params: {
  spent: number
  budget: number
  daysLeft: number
  daysInMonth: number
  topOverBudgetCategory?: { name: string; spent: number; limit: number; pctOver: number }
  daysSinceLastTransaction: number
  scoreImproved?: boolean
  scorePoints?: number
}): AlertData | null {
  const { spent, budget, daysLeft, daysInMonth,
          topOverBudgetCategory, daysSinceLastTransaction,
          scoreImproved, scorePoints } = params

  const daysElapsed = daysInMonth - daysLeft
  const dailyRate = daysElapsed > 0 ? spent / daysElapsed : 0
  const projectedTotal = dailyRate * daysInMonth

  // 1. Proyección de déficit (lo más importante)
  if (projectedTotal > budget * 1.05) {
    const overage = Math.round(projectedTotal - budget)
    return {
      type: 'warning',
      title: `A este ritmo cerrarás el mes Q ${overage.toLocaleString()} sobre el presupuesto`,
      subtitle: 'Aún podés corregirlo — reducí gastos estos días.',
    }
  }

  // 2. Categoría sobregirada
  if (topOverBudgetCategory && topOverBudgetCategory.pctOver > 25) {
    const extra = Math.round(topOverBudgetCategory.spent - topOverBudgetCategory.limit)
    return {
      type: 'warning',
      title: `Gastaste ${topOverBudgetCategory.pctOver}% más en ${topOverBudgetCategory.name}`,
      subtitle: `Superaste el límite por Q ${extra.toLocaleString()} este mes.`,
    }
  }

  // 3. Días sin registrar
  if (daysSinceLastTransaction >= 3) {
    return {
      type: 'info',
      title: `Hace ${daysSinceLastTransaction} días sin registrar gastos`,
      subtitle: 'Registrá un gasto para mantener tu racha y el presupuesto al día.',
    }
  }

  // 4. Logro positivo
  if (scoreImproved && scorePoints && scorePoints >= 3) {
    return {
      type: 'positive',
      title: `Tu puntaje Zafi subió ${scorePoints} puntos este mes`,
      subtitle: '¡Seguís mejorando! Revisá tu plan para continuar.',
    }
  }

  // 5. Alerta final del mes
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
  if (!alert) return null

  const styles = {
    warning: {
      bg: '#FFF7ED', border: '#FED7AA',
      iconBg: '#FED7AA', iconColor: '#92400E',
      titleColor: '#92400E', subColor: '#B45309',
    },
    positive: {
      bg: '#F0FDF4', border: '#BBF7D0',
      iconBg: '#BBF7D0', iconColor: '#065F46',
      titleColor: '#065F46', subColor: '#047857',
    },
    info: {
      bg: '#EFF6FF', border: '#BFDBFE',
      iconBg: '#BFDBFE', iconColor: '#1E40AF',
      titleColor: '#1E40AF', subColor: '#2563EB',
    },
  }

  const s = styles[alert.type!]

  return (
    <div style={{ padding: '10px 16px 0' }}>
      <div style={{
        background: s.bg, border: `0.5px solid ${s.border}`,
        borderRadius: 12, padding: '10px 12px',
        display: 'flex', gap: 10, alignItems: 'flex-start'
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
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
          <div style={{ fontSize: 14, fontWeight: 500, color: s.titleColor, marginBottom: 2 }}>
            {alert.title}
          </div>
          <div style={{ fontSize: 12, color: s.subColor, lineHeight: 1.4 }}>
            {alert.subtitle}
          </div>
        </div>
      </div>
    </div>
  )
}
