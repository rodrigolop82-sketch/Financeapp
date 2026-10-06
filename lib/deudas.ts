// Simulador de pago de deudas (bola de nieve / avalancha). Sin React para
// poder probarlo con vitest.

import type { Debt } from '@/types';

export type DebtStrategy = 'snowball' | 'avalanche';

export interface SimResult {
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  order: { name: string; months: number; totalPaid: number; interestPaid: number }[];
  warnings: string[];
}

export function simulatePayoff(
  debts: Debt[],
  extraPayment: number,
  strategy: DebtStrategy
): SimResult {
  if (debts.length === 0) return { totalMonths: 0, totalInterest: 0, totalPaid: 0, order: [], warnings: [] };

  const warnings: string[] = [];
  const active = debts.map(d => {
    const balance = Number(d.balance);
    const annualRate = Number(d.interest_rate);
    const monthlyRate = annualRate / 100 / 12;
    const minPayment = Number(d.min_payment);
    const monthlyInterest = balance * monthlyRate;

    if (minPayment > 0 && minPayment <= monthlyInterest && annualRate > 0) {
      warnings.push(`"${d.name}": el pago mínimo (Q ${minPayment.toLocaleString()}) no cubre los intereses mensuales (Q ${Math.round(monthlyInterest).toLocaleString()}). Necesitas pagar más para reducir esta deuda.`);
    }

    return {
      name: d.name,
      balance,
      rate: monthlyRate,
      minPayment,
      totalPaid: 0,
      interestPaid: 0,
      months: 0,
      paidOff: false,
    };
  });

  // Sort by strategy
  if (strategy === 'snowball') {
    active.sort((a, b) => a.balance - b.balance);
  } else {
    active.sort((a, b) => b.rate - a.rate);
  }

  const order: SimResult['order'] = [];
  let totalMonths = 0;
  let totalInterest = 0;
  let freedPayments = 0;
  const maxMonths = 360; // 30 years max

  while (active.some(d => d.balance > 0 && !d.paidOff) && totalMonths < maxMonths) {
    totalMonths++;
    const availableExtra = extraPayment + freedPayments;
    let extraRemaining = availableExtra;

    // First pass: apply interest and minimum payments
    for (const d of active) {
      if (d.balance <= 0 || d.paidOff) continue;

      // Apply monthly interest
      const interest = d.balance * d.rate;
      totalInterest += interest;
      d.interestPaid += interest;
      d.balance += interest;

      // Apply minimum payment
      const minPay = Math.min(d.minPayment, d.balance);
      d.balance -= minPay;
      d.totalPaid += minPay;
      d.months = totalMonths;

      if (d.balance <= 0.01) {
        d.balance = 0;
        d.paidOff = true;
        freedPayments += d.minPayment;
        order.push({ name: d.name, months: totalMonths, totalPaid: Math.round(d.totalPaid), interestPaid: Math.round(d.interestPaid) });
      }
    }

    // Second pass: apply extra payment to target debt (first unpaid in sorted order)
    for (const d of active) {
      if (d.balance <= 0 || d.paidOff || extraRemaining <= 0) continue;

      const extraPay = Math.min(extraRemaining, d.balance);
      d.balance -= extraPay;
      d.totalPaid += extraPay;
      extraRemaining -= extraPay;

      if (d.balance <= 0.01) {
        d.balance = 0;
        d.paidOff = true;
        freedPayments += d.minPayment;
        // Check if already added to order
        if (!order.some(o => o.name === d.name)) {
          order.push({ name: d.name, months: totalMonths, totalPaid: Math.round(d.totalPaid), interestPaid: Math.round(d.interestPaid) });
        }
      }

      break; // Extra payment goes to first target only
    }
  }

  // Add remaining unpaid debts
  for (const d of active) {
    if (d.balance > 0 && !d.paidOff) {
      order.push({ name: d.name, months: totalMonths, totalPaid: Math.round(d.totalPaid), interestPaid: Math.round(d.interestPaid) });
      warnings.push(`"${d.name}" no se paga en 30 años con los pagos actuales. Considera aumentar el pago mensual.`);
    }
  }

  const totalPaid = active.reduce((s, d) => s + d.totalPaid, 0);
  return { totalMonths, totalInterest: Math.round(totalInterest), totalPaid: Math.round(totalPaid), order, warnings };
}

/** "8 meses", "1 año 4 m", "2 años", "+30 años". */
export function formatMonths(months: number): string {
  if (months >= 360) return '+30 años';
  if (months > 12) {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return `${years} ${years === 1 ? 'año' : 'años'}${rest ? ` ${rest} m` : ''}`;
  }
  return `${months} ${months === 1 ? 'mes' : 'meses'}`;
}

/** Interés de un mes sobre el saldo actual. */
export function monthlyInterest(debt: Pick<Debt, 'balance' | 'interest_rate'>): number {
  return Number(debt.balance) * (Number(debt.interest_rate) / 100 / 12);
}
