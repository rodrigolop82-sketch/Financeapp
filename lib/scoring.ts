export interface FinancialProfile {
  total_income: number;
  total_fixed_expenses: number;
  total_debt: number;
  total_savings: number;
  has_emergency_fund: boolean;
  income_type: 'fixed' | 'variable' | 'mixed';
}

export interface ScoreBreakdown {
  total: number;
  label: 'crítico' | 'en riesgo' | 'estable' | 'saludable' | 'excelente';
  color: 'red' | 'orange' | 'yellow' | 'green' | 'emerald';
  components: {
    savingsRate: number;      // máx 30 pts
    debtBurden: number;       // máx 25 pts
    emergencyFund: number;    // máx 20 pts
    expenseRatio: number;     // máx 15 pts
    incomeStability: number;  // máx 10 pts
  };
  insights: string[];
}

export function calculateHealthScore(profile: FinancialProfile): ScoreBreakdown {
  const {
    total_income: income,
    total_fixed_expenses: fixedExp,
    total_debt: debt,
    total_savings: savings,
    has_emergency_fund: hasEF,
    income_type,
  } = profile;

  if (income <= 0) return zeroScore();

  const components = {
    // 1. Tasa de ahorro (0–30 pts)
    savingsRate: scoreSavingsRate(savings / income),
    // 2. Carga de deuda — debt-to-income (0–25 pts)
    debtBurden: scoreDebtBurden(debt / income),
    // 3. Fondo de emergencia (0–20 pts)
    emergencyFund: scoreEmergencyFund(hasEF, savings, fixedExp),
    // 4. Ratio gastos fijos vs ingreso (0–15 pts)
    expenseRatio: scoreExpenseRatio(fixedExp / income),
    // 5. Estabilidad del ingreso (0–10 pts)
    incomeStability: income_type === 'fixed' ? 10 : income_type === 'mixed' ? 6 : 3,
  };

  const total = Math.round(
    Object.values(components).reduce((a, b) => a + b, 0)
  );

  return {
    total,
    label: getLabel(total),
    color: getColor(total),
    components,
    insights: generateInsights(profile, components),
  };
}

function scoreSavingsRate(rate: number): number {
  if (rate >= 0.20) return 30;
  if (rate >= 0.15) return 24;
  if (rate >= 0.10) return 18;
  if (rate >= 0.05) return 10;
  return 0;
}

function scoreDebtBurden(dti: number): number {
  if (dti === 0)    return 25;
  if (dti <= 0.10)  return 20;
  if (dti <= 0.20)  return 14;
  if (dti <= 0.35)  return 7;
  return 0;
}

function scoreEmergencyFund(hasEF: boolean, savings: number, fixedExp: number): number {
  if (!hasEF && savings < fixedExp) return 0;
  const months = fixedExp > 0 ? savings / fixedExp : 0;
  if (months >= 6) return 20;
  if (months >= 3) return 14;
  if (months >= 1) return 7;
  return 0;
}

function scoreExpenseRatio(ratio: number): number {
  if (ratio <= 0.50) return 15;
  if (ratio <= 0.60) return 10;
  if (ratio <= 0.70) return 5;
  return 0;
}

function getLabel(score: number): ScoreBreakdown['label'] {
  if (score >= 85) return 'excelente';
  if (score >= 65) return 'saludable';
  if (score >= 45) return 'estable';
  if (score >= 25) return 'en riesgo';
  return 'crítico';
}

function getColor(score: number): ScoreBreakdown['color'] {
  if (score >= 85) return 'emerald';
  if (score >= 65) return 'green';
  if (score >= 45) return 'yellow';
  if (score >= 25) return 'orange';
  return 'red';
}

function generateInsights(profile: FinancialProfile, components: ScoreBreakdown['components']): string[] {
  const insights: string[] = [];
  const { total_income: inc, total_debt: debt, total_fixed_expenses: exp } = profile;

  if (components.debtBurden < 14)
    insights.push(`Tus deudas son el ${Math.round((debt/inc)*100)}% de tu ingreso. Prioriza pagarlas.`);
  if (components.emergencyFund < 7)
    insights.push('No tenés fondo de emergencia. Empezá con un mes de gastos fijos.');
  if (components.savingsRate < 10)
    insights.push('Estás ahorrando menos del 5% de tu ingreso. El objetivo es llegar al 10%.');
  if (components.expenseRatio < 10)
    insights.push(`Tus gastos fijos consumen el ${Math.round((exp/inc)*100)}% de tu ingreso. El límite saludable es 60%.`);

  if (insights.length === 0)
    insights.push('¡Vas muy bien! Mantené el hábito de revisión mensual para seguir mejorando.');

  return insights;
}

function zeroScore(): ScoreBreakdown {
  return {
    total: 0, label: 'crítico', color: 'red',
    components: { savingsRate: 0, debtBurden: 0, emergencyFund: 0, expenseRatio: 0, incomeStability: 0 },
    insights: ['Ingresá tus datos financieros para calcular tu puntaje.'],
  };
}
