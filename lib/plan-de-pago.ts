// Plan de pago de deudas (F6). Puro, para vitest.
// Orden recomendado: avalancha (primero la de mayor interés). El plazo de
// cada deuda sale del motor de amortización; el efecto del pago extra, del
// simulador de Deudas (que pasa lo que se libera a la siguiente deuda).

import type { Debt } from '@/types';
import { amortizar, type Amortizacion } from './amortizacion';
import { simulatePayoff } from './deudas';

export type DebtTermsInput = Pick<Debt, 'id' | 'name' | 'balance' | 'interest_rate' | 'min_payment'>;

export interface PasoDeuda {
  id: string;
  name: string;
  saldo: number;
  tasaAnual: number;
  cuota: number;
  /** Al ritmo actual (solo su cuota). */
  ritmoActual: Amortizacion;
}

/** Deudas en orden avalancha: mayor interés primero; a igual interés, la de mayor saldo. */
export function ordenAvalancha(debts: DebtTermsInput[]): PasoDeuda[] {
  return debts
    .map((d) => {
      const saldo = Number(d.balance) || 0;
      const tasaAnual = Number(d.interest_rate) || 0;
      const cuota = Number(d.min_payment) || 0;
      return { id: d.id, name: d.name, saldo, tasaAnual, cuota, ritmoActual: amortizar({ saldo, tasaAnual, cuota }) };
    })
    .sort((a, b) => b.tasaAnual - a.tasaAnual || b.saldo - a.saldo);
}

/** Motivo en una línea para la primera deuda del orden. */
export function motivoOrden(primera: PasoDeuda | undefined): string {
  if (!primera) return '';
  if (primera.tasaAnual <= 0) return 'Ninguna deuda cobra interés: empieza por la de mayor saldo.';
  return `Empieza por ${primera.name}: cobra ${primera.tasaAnual}% al año, el interés más alto. Así pagas menos en total.`;
}

export interface EfectoExtra {
  sinExtra: { meses: number; intereses: number };
  conExtra: { meses: number; intereses: number };
  mesesAhorrados: number;
  interesesAhorrados: number;
  /** Alguna deuda no se termina en 30 años (el ahorro no es confiable). */
  sinFin: boolean;
}

/** Cuántos meses e intereses te ahorras con un pago extra al mes (avalancha). */
export function efectoPagoExtra(debts: DebtTermsInput[], extra: number): EfectoExtra {
  const asDebts = debts as Debt[];
  const base = simulatePayoff(asDebts, 0, 'avalanche');
  const con = simulatePayoff(asDebts, Math.max(0, extra), 'avalanche');
  const MAX = 360;
  return {
    sinExtra: { meses: base.totalMonths, intereses: base.totalInterest },
    conExtra: { meses: con.totalMonths, intereses: con.totalInterest },
    mesesAhorrados: Math.max(0, base.totalMonths - con.totalMonths),
    interesesAhorrados: Math.max(0, base.totalInterest - con.totalInterest),
    sinFin: base.totalMonths >= MAX || con.totalMonths >= MAX,
  };
}
