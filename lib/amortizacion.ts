// Motor de amortización de una deuda (F3 y F6). Puro, sin React ni Supabase.
//
// Cada mes: se suman los intereses del mes (tasa anual ÷ 12) y se resta la
// cuota más el pago extra. Si la cuota (con el extra) no cubre los intereses
// del primer mes, la deuda nunca baja: se devuelve una advertencia en lugar
// de un plazo infinito.

/** Tope de seguridad: 50 años. */
export const MAX_MESES = 600;

export interface AmortizacionInput {
  /** Saldo actual. */
  saldo: number;
  /** Tasa anual en porcentaje (36 = 36%). */
  tasaAnual: number;
  /** Cuota mensual. */
  cuota: number;
  /** Pago extra mensual opcional. */
  extra?: number;
}

export interface MesAmortizacion {
  mes: number;
  pago: number;
  interes: number;
  capital: number;
  saldo: number;
}

export type Amortizacion =
  | {
      ok: true;
      meses: number;
      interesesTotales: number;
      totalPagado: number;
      calendario: MesAmortizacion[];
    }
  | {
      ok: false;
      advertencia: 'cuota_no_cubre_intereses' | 'sin_cuota' | 'demasiado_largo';
      /** Intereses del primer mes, para el mensaje. */
      interesMensual: number;
    };

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function amortizar({ saldo, tasaAnual, cuota, extra = 0 }: AmortizacionInput): Amortizacion {
  const tasa = Math.max(0, tasaAnual) / 100 / 12;
  const pagoMes = Math.max(0, cuota) + Math.max(0, extra);
  let restante = Math.max(0, saldo);
  const interesMensual = r2(restante * tasa);

  if (restante <= 0) return { ok: true, meses: 0, interesesTotales: 0, totalPagado: 0, calendario: [] };
  if (pagoMes <= 0) return { ok: false, advertencia: 'sin_cuota', interesMensual };
  if (pagoMes <= restante * tasa) return { ok: false, advertencia: 'cuota_no_cubre_intereses', interesMensual };

  const calendario: MesAmortizacion[] = [];
  let interesesTotales = 0;
  let totalPagado = 0;
  for (let mes = 1; restante > 0.005; mes++) {
    if (mes > MAX_MESES) return { ok: false, advertencia: 'demasiado_largo', interesMensual };
    const interes = restante * tasa;
    const pago = Math.min(pagoMes, restante + interes);
    const capital = pago - interes;
    restante = restante + interes - pago;
    interesesTotales += interes;
    totalPagado += pago;
    calendario.push({ mes, pago: r2(pago), interes: r2(interes), capital: r2(capital), saldo: r2(Math.max(0, restante)) });
  }
  return { ok: true, meses: calendario.length, interesesTotales: r2(interesesTotales), totalPagado: r2(totalPagado), calendario };
}

/** Cuánto ahorras con un pago extra: meses e intereses (null si alguno no termina). */
export function ahorroConExtra(input: Omit<AmortizacionInput, 'extra'>, extra: number): { meses: number; intereses: number } | null {
  const base = amortizar(input);
  const con = amortizar({ ...input, extra });
  if (!base.ok || !con.ok) return null;
  return { meses: base.meses - con.meses, intereses: r2(base.interesesTotales - con.interesesTotales) };
}
