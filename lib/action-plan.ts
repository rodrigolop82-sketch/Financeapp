import { FinancialProfile, ScoreBreakdown } from './scoring';
import { ActionStep } from '@/types';

export function generateInitialPlan(
  profile: FinancialProfile,
  score: ScoreBreakdown
): ActionStep[] {
  const steps: ActionStep[] = [];
  let id = 1;

  const { total_income: inc, total_debt: debt, total_fixed_expenses: exp } = profile;

  // Always start with tracking
  steps.push({
    id: String(id++),
    title: 'Registra todos tus gastos esta semana',
    description: 'Anota cada gasto, por pequeño que sea. Este hábito es la base de todo.',
    priority: 'high',
  });

  // Emergency fund priority
  if (score.components.emergencyFund < 7) {
    const target = Math.round(exp * 1);
    steps.push({
      id: String(id++),
      title: 'Empieza tu fondo de emergencia',
      description: `Tu meta inicial: Q ${target.toLocaleString()}  (1 mes de gastos fijos). Separa aunque sea Q 100 esta semana.`,
      priority: 'high',
    });
  }

  // Debt reduction
  if (score.components.debtBurden < 14 && debt > 0) {
    steps.push({
      id: String(id++),
      title: 'Haz una lista completa de tus deudas',
      description: 'Incluye monto, tasa de interés y pago mínimo. Usa la sección de Deudas para organizarlas.',
      priority: 'high',
    });
    steps.push({
      id: String(id++),
      title: 'Paga al menos el mínimo de todas tus deudas',
      description: 'Nunca dejes de pagar el mínimo. Si puedes, agrega un extra a la deuda más pequeña (bola de nieve).',
      priority: 'high',
    });
  }

  // Expense reduction
  if (score.components.expenseRatio < 10) {
    steps.push({
      id: String(id++),
      title: 'Identifica 2 gastos que puedas reducir',
      description: `Tus gastos fijos son el ${Math.round((exp/inc)*100)}% de tu ingreso. Revisa suscripciones, transporte o servicios.`,
      priority: 'medium',
    });
  }

  // Savings improvement
  if (score.components.savingsRate < 18) {
    const targetSaving = Math.round(inc * 0.10);
    steps.push({
      id: String(id++),
      title: 'Establece un monto fijo de ahorro mensual',
      description: `Meta: Q ${targetSaving.toLocaleString()} al mes (10% de tu ingreso). Sepáralo el día que recibas tu pago.`,
      priority: 'medium',
    });
  }

  // Budget setup
  steps.push({
    id: String(id++),
    title: 'Completa tu presupuesto 50/30/20',
    description: 'Ve a la sección de Presupuesto y asigna montos a cada categoría según la regla 50/30/20.',
    priority: 'medium',
  });

  // Monthly review habit
  steps.push({
    id: String(id++),
    title: 'Agenda tu revisión mensual',
    description: 'Pon una alarma para el último domingo del mes. Revisa tu progreso y ajusta tu plan.',
    priority: 'low',
  });

  return steps;
}
