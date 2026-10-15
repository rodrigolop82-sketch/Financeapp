'use client';

import { useState } from 'react';
import { amortizar } from '@/lib/amortizacion';
import { formatMonths } from '@/lib/deudas';
import { DIVIDER, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui';
import { LINK_TEXT } from '@/components/layout/Pantalla';

export const CUOTA_NO_ALCANZA = 'Tu pago mínimo no alcanza para cubrir los intereses';

/** Plazo, intereses y calendario mes a mes de una deuda al ritmo actual. */
export function AmortizacionDetalle({ saldo, tasaAnual, cuota, fmt }: {
  saldo: number;
  tasaAnual: number;
  cuota: number;
  fmt: (n: number) => string;
}) {
  const [verMeses, setVerMeses] = useState(false);
  const a = amortizar({ saldo, tasaAnual, cuota });

  if (!a.ok) {
    if (a.advertencia === 'cuota_no_cubre_intereses') {
      return (
        <p className="text-sm leading-[1.45] text-warning-text dark:text-warning">
          {CUOTA_NO_ALCANZA}: este mes son {fmt(a.interesMensual)} de intereses y pagas {fmt(cuota)}.
        </p>
      );
    }
    if (a.advertencia === 'sin_cuota') {
      return <p className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>Agrega tu pago mensual en Deudas para ver cuándo la terminas.</p>;
    }
    return <p className={`text-sm leading-[1.45] ${TEXT_MUTED}`}>Con este pago tardarías más de 50 años en terminarla.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className={`text-sm leading-[1.45] ${TEXT_STRONG}`}>
        Al ritmo actual la terminas en <b>{formatMonths(a.meses)}</b> y pagas <b>{fmt(a.interesesTotales)}</b> de intereses.
      </p>
      <button type="button" onClick={() => setVerMeses((v) => !v)} aria-expanded={verMeses} className={`self-start text-[13px] font-semibold ${LINK_TEXT} h-9`}>
        {verMeses ? 'Ocultar mes a mes' : 'Ver mes a mes'}
      </button>
      {verMeses && (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className={TEXT_MUTED}>
                <th scope="col" className="py-1 text-left font-semibold">Mes</th>
                <th scope="col" className="py-1 text-right font-semibold">Intereses</th>
                <th scope="col" className="py-1 text-right font-semibold">A tu deuda</th>
                <th scope="col" className="py-1 text-right font-semibold">Te queda</th>
              </tr>
            </thead>
            <tbody className={`font-outfit ${TEXT_STRONG}`}>
              {a.calendario.map((m) => (
                <tr key={m.mes} className={`border-t ${DIVIDER}`}>
                  <td className="py-1">{m.mes}</td>
                  <td className="py-1 text-right">{fmt(m.interes)}</td>
                  <td className="py-1 text-right">{fmt(m.capital)}</td>
                  <td className="py-1 text-right">{fmt(m.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
