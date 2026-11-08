'use client';

import { useState } from 'react';
import Link from 'next/link';
import { longMonth } from '@/lib/como-te-fue';
import type { CategoriaFila, EnQueSeFue as Resultado, TipoDetalle, TipoKey, Tono, Variacion } from '@/lib/en-que-se-fue';
import { DIVIDER, TEXT_FAINT, TEXT_MUTED, TEXT_STRONG, TILE_BG } from '@/components/movimientos/ui';
import { AMBER_TEXT, CARD_LG, GREEN_TEXT, NAVY_BG, SECTION_TITLE } from './ctf-ui';

/** Debajo de este % el tramo es muy angosto para que quepa la etiqueta. */
const MIN_LABEL_PCT = 9;
/** Cada lado de la llave necesita al menos este % del ancho para que quepa su etiqueta. */
const LLAVE_MIN_PCT = 22;

const BLUE_TEXT = 'text-electric-dark dark:text-electric-soft';
const DOT: Record<TipoKey, string> = { needs: NAVY_BG, wants: 'bg-electric-pale', savings: 'bg-success-dark' };
const SEGMENT: Record<TipoKey, string> = {
  needs: `${NAVY_BG} text-white`,
  wants: 'bg-electric-pale text-ink-900',
  savings: 'bg-success-dark text-white',
};

const TONO_CLASS: Record<Tono, string> = { ok: GREEN_TEXT, compensado: BLUE_TEXT, 'ok-bajo': AMBER_TEXT, alerta: AMBER_TEXT };

type Fmt = (n: number) => string;

function signo(diff: number): string {
  return diff > 0 ? '+' : diff < 0 ? '−' : '';
}

function textoVariacion(v: Variacion, fmt: Fmt): string {
  const s = signo(v.diff);
  return `${s}${fmt(Math.abs(v.diff))} · ${s}${Math.abs(v.pct)}%`;
}

function Dato({ valor, etiqueta, clase, aria }: { valor: string; etiqueta: string; clase: string; aria: string }) {
  return (
    <span className="flex flex-col items-end leading-[15px]" aria-label={aria}>
      <span aria-hidden className={`text-[13px] font-bold ${clase}`}>{valor}</span>
      <span aria-hidden className={`text-[11.5px] ${TEXT_MUTED}`}>{etiqueta}</span>
    </span>
  );
}

function notaTipo(t: TipoDetalle, fmt: Fmt): { texto: string; clase: string } {
  if (t.key === 'savings') {
    if (t.estado === 'meta') return { texto: 'Superaste tu meta', clase: GREEN_TEXT };
    if (t.estado === 'bajo') return { texto: 'Debajo de tu meta', clase: AMBER_TEXT };
    return { texto: 'Falta registrar ingresos', clase: TEXT_MUTED };
  }
  if (t.estado === 'over') return { texto: `Te pasaste por ${fmt(t.diff ?? 0)}`, clase: AMBER_TEXT };
  if (t.estado === 'ok') return { texto: 'Dentro del presupuesto', clase: GREEN_TEXT };
  return { texto: 'Sin presupuesto', clase: TEXT_MUTED };
}

function resumenTipo(t: TipoDetalle, fmt: Fmt): { texto: string; clase: string; sub: string } | null {
  if (t.presupuesto === null || t.diff === null) return null;
  if (t.key === 'savings') {
    const sobra = t.diff >= 0;
    return {
      texto: `Apartaste ${fmt(t.monto)} de una meta de ${fmt(t.presupuesto)}`,
      clase: sobra ? GREEN_TEXT : AMBER_TEXT,
      sub: sobra ? `Superaste tu meta por ${fmt(t.diff)}` : `Te faltaron ${fmt(-t.diff)} para tu meta`,
    };
  }
  const pasaste = t.estado === 'over';
  return {
    texto: pasaste ? `Te pasaste por ${fmt(t.diff)}` : `Te quedan ${fmt(-t.diff)}`,
    clase: pasaste ? AMBER_TEXT : GREEN_TEXT,
    sub: `Gastaste ${fmt(t.monto)} de ${fmt(t.presupuesto)} presupuestados`,
  };
}

/** Barra con marca en el presupuesto. Escala: lo mayor entre gastado y presupuesto. */
function BarraPresupuesto({ gastado, presupuesto, pasaste, claseRelleno }: { gastado: number; presupuesto: number; pasaste: boolean; claseRelleno?: string }) {
  const escala = Math.max(gastado, presupuesto) || 1;
  return (
    <div aria-hidden className={`relative h-2 rounded-full ${TILE_BG}`}>
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${claseRelleno ?? (pasaste ? 'bg-warning' : 'bg-electric')}`}
        style={{ width: `${(gastado / escala) * 100}%` }}
      />
      <div
        className="absolute -top-[3px] -bottom-[3px] w-0.5 bg-ink-900 dark:bg-white"
        style={{ left: `calc(${(presupuesto / escala) * 100}% - 1px)` }}
      />
    </div>
  );
}

function FilaCategoria({ fila, month, enlace, fmt }: { fila: CategoriaFila; month: string; enlace: boolean; fmt: Fmt }) {
  const pasaste = fila.estado === 'over';
  const contenido = (
    <div className="flex min-w-0 flex-1 flex-col gap-[7px] py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className={`min-w-0 truncate text-[15px] font-semibold ${TEXT_STRONG}`}>{fila.nombre}</span>
        <span className={`flex-none font-outfit text-base font-bold ${TEXT_STRONG}`}>{fmt(fila.gastado)}</span>
      </div>
      {fila.presupuesto !== null && fila.diff !== null && (
        <>
          <BarraPresupuesto gastado={fila.gastado} presupuesto={fila.presupuesto} pasaste={pasaste} />
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-[12.5px] font-semibold ${pasaste ? AMBER_TEXT : GREEN_TEXT}`}>
              {pasaste ? `Te pasaste por ${fmt(fila.diff)}` : `Te quedan ${fmt(-fila.diff)}`}
            </span>
            <span className={`text-[12.5px] ${TEXT_MUTED}`}>Presupuesto {fmt(fila.presupuesto)}</span>
          </div>
        </>
      )}
      {fila.presupuesto === null && <span className={`text-[12.5px] ${TEXT_MUTED}`}>Sin presupuesto</span>}
    </div>
  );
  if (!enlace || !fila.id) return <div className={`flex items-center border-t ${DIVIDER}`}>{contenido}</div>;
  return (
    <Link href={`/resumen/categoria/${fila.id}?mes=${month}`} className={`flex min-h-[44px] items-center gap-2 border-t ${DIVIDER}`}>
      {contenido}
      <span aria-hidden className={`flex-none text-sm font-bold ${TEXT_FAINT}`}>›</span>
    </Link>
  );
}

function Detalle({ tipo, month, fmt, onClose }: { tipo: TipoDetalle; month: string; fmt: Fmt; onClose: () => void }) {
  const resumen = resumenTipo(tipo, fmt);
  const esAhorro = tipo.key === 'savings';
  return (
    <section aria-label={`Detalle de ${tipo.label}`} className={`mt-3 flex flex-col gap-3.5 px-4 py-[18px] ${CARD_LG}`}>
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className={SECTION_TITLE}>{esAhorro ? 'Ahorro: a dónde fue' : tipo.label}</h3>
          {resumen && (
            <>
              <span className={`text-[13.5px] font-semibold leading-[1.35] ${resumen.clase}`}>{resumen.texto}</span>
              <span className={`text-[12.5px] ${TEXT_MUTED}`}>{resumen.sub}</span>
            </>
          )}
          {!resumen && esAhorro && <span className={`text-[12.5px] ${TEXT_MUTED}`}>Apartaste {fmt(tipo.monto)}. Registra tus ingresos para ver tu meta.</span>}
          {!resumen && !esAhorro && <span className={`text-[12.5px] ${TEXT_MUTED}`}>Gastaste {fmt(tipo.monto)}. Aún no tienes presupuesto para estas categorías.</span>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="-mr-2 -mt-2 flex h-11 w-11 flex-none items-center justify-center rounded-full text-ink-400 hover:bg-[var(--zafi-hover)]"
        >
          <span aria-hidden className="text-lg font-bold leading-none">×</span>
        </button>
      </div>

      {esAhorro && tipo.presupuesto !== null && (
        <div className="flex flex-col gap-[7px]">
          <BarraPresupuesto gastado={tipo.monto} presupuesto={tipo.presupuesto} pasaste={false} claseRelleno="bg-success-dark" />
          <span className={`text-[12.5px] ${TEXT_MUTED}`}>La marca es tu meta del mes: 20% de tus ingresos.</span>
        </div>
      )}

      <div className="flex flex-col">
        {tipo.categorias.length === 0 && <span className={`text-sm ${TEXT_MUTED}`}>Sin movimientos en este tipo.</span>}
        {tipo.categorias.map((f) => (
          <FilaCategoria key={f.id ?? f.nombre} fila={esAhorro ? { ...f, presupuesto: null, diff: null } : f} month={month} enlace={!esAhorro} fmt={fmt} />
        ))}
      </div>
      {!esAhorro && tipo.presupuesto !== null && (
        <span className={`text-[12px] ${TEXT_MUTED}`}>La marca es tu presupuesto del mes. Toca una categoría para ver su detalle.</span>
      )}
    </section>
  );
}

/**
 * "¿En qué se fue [mes]?": salidas del mes (gastaste + apartaste) contra
 * ingresos y presupuesto, barra apilada Lo básico / Gustos / Ahorro y, al
 * tocar un tipo, sus categorías contra el presupuesto.
 */
export function EnQueSeFue({ month, data, fmt }: { month: string; data: Resultado; fmt: Fmt }) {
  const [sel, setSel] = useState<TipoKey | null>('needs');
  const mes = longMonth(month);
  const tonoClase = data.tono ? TONO_CLASS[data.tono] : TEXT_MUTED;
  const elegido = data.tipos.find((t) => t.key === sel) ?? null;
  const descripcion = `Salidas del mes: ${data.tipos.map((t) => `${t.label} ${t.pct}%`).join(', ')}`;

  // Llave "Gasto / Ahorro" sobre la barra; solo si las dos etiquetas caben.
  const gastoPct = data.tipos[0].pct + data.tipos[1].pct;
  const ahorroPct = data.tipos[2].pct;
  const llave = gastoPct >= LLAVE_MIN_PCT && ahorroPct >= LLAVE_MIN_PCT ? { gastoPct, ahorroPct } : null;

  const vsIng = data.vsIngresos;
  const vsPres = data.vsPresupuestoGasto;

  return (
    <section aria-label={`¿En qué se fue ${mes}?`} className="mt-3.5">
      <div className={`flex flex-col gap-3.5 px-4 py-[18px] ${CARD_LG}`}>
        <div className="flex flex-col gap-0.5">
          <h2 className={`text-[15px] font-bold ${TEXT_STRONG}`}>¿En qué se fue {mes}?</h2>
          <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className={`text-[13px] ${TEXT_MUTED}`}>Salidas del mes</span>
              <span className={`font-outfit text-[32px] font-extrabold leading-[1.15] tracking-[-0.02em] ${TEXT_STRONG}`}>{fmt(data.salidas)}</span>
            </div>
            <div className="flex flex-none flex-col items-end gap-[5px] pb-[5px]">
              {vsIng ? (
                <Dato
                  valor={textoVariacion(vsIng, fmt)}
                  etiqueta="vs ingresos"
                  clase={vsIng.diff > 0 ? AMBER_TEXT : GREEN_TEXT}
                  aria={`Salidas ${fmt(Math.abs(vsIng.diff))}, ${Math.abs(vsIng.pct)} por ciento ${vsIng.diff > 0 ? 'por encima de' : 'por debajo de'} tus ingresos`}
                />
              ) : (
                <Dato valor="Falta registrar" etiqueta="ingresos" clase={AMBER_TEXT} aria="Falta registrar tus ingresos para compararlos con tus salidas" />
              )}
              {vsPres && (
                <Dato
                  valor={textoVariacion(vsPres, fmt)}
                  etiqueta="básico y gustos vs plan"
                  clase={tonoClase}
                  aria={`Gastaste ${fmt(Math.abs(vsPres.diff))}, ${Math.abs(vsPres.pct)} por ciento ${vsPres.diff > 0 ? 'más que' : 'menos que'} tu plan de básico y gustos`}
                />
              )}
            </div>
          </div>
          <span className={`text-[13px] leading-[1.4] ${TEXT_MUTED}`}>
            Gastaste {fmt(data.gastaste)} en lo básico y gustos, y apartaste {fmt(data.apartaste)} (no cuenta como gasto).
          </span>
          {data.mensaje && <span className={`text-[13px] font-semibold leading-[1.4] ${tonoClase}`}>{data.mensaje}</span>}
        </div>

        {llave && (
          <div aria-hidden className="-mb-2 flex gap-[3px]">
            <div className="flex min-w-0 flex-col gap-[3px]" style={{ flex: `${llave.gastoPct} 1 0` }}>
              <span className={`whitespace-nowrap text-[11.5px] font-semibold ${TEXT_MUTED}`}>Gasto {fmt(data.gastaste)}</span>
              <div className="h-1.5 rounded-t-[5px] border-2 border-b-0 border-ink-400" />
            </div>
            <div className="flex min-w-0 flex-col gap-[3px]" style={{ flex: `${llave.ahorroPct} 1 0` }}>
              <span className={`whitespace-nowrap text-[11.5px] font-semibold ${GREEN_TEXT}`}>Ahorro {fmt(data.apartaste)}</span>
              <div className="h-1.5 rounded-t-[5px] border-2 border-b-0 border-success-dark dark:border-[var(--zafi-success-text)]" />
            </div>
          </div>
        )}

        <div role="img" aria-label={descripcion} className="flex h-11 gap-[3px] overflow-hidden rounded-xl">
          {data.tipos.map((t) => (
            <div
              key={t.key}
              className={`flex items-center justify-center text-[13px] font-bold transition-opacity duration-200 motion-reduce:transition-none ${SEGMENT[t.key]} ${sel && sel !== t.key ? 'opacity-[0.35]' : ''}`}
              style={{ flexGrow: Math.max(t.pct, 0.5), flexBasis: 0 }}
            >
              {t.pct >= MIN_LABEL_PCT ? `${t.pct}%` : ''}
            </div>
          ))}
        </div>

        <div role="group" aria-label="Elige un tipo para ver su detalle" className="flex flex-col gap-2">
          {data.tipos.map((t) => {
            const on = sel === t.key;
            const nota = notaTipo(t, fmt);
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                onClick={() => setSel(on ? null : t.key)}
                className={`flex min-h-[56px] items-center gap-3 rounded-[14px] border px-3.5 py-2 text-left ${on ? 'border-electric bg-electric-ghost dark:bg-[#1B2B4D]' : `border-navy/[0.08] dark:border-white/[0.06] ${TILE_BG}`}`}
              >
                <span aria-hidden className={`h-3 w-3 flex-none rounded-[4px] ${DOT[t.key]}`} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-[15px] font-semibold ${TEXT_STRONG}`}>{t.label}</span>
                  <span className={`text-[12.5px] ${nota.clase}`}>{nota.texto}</span>
                </span>
                <span className="flex flex-none flex-col items-end">
                  <span className={`font-outfit text-[17px] font-bold ${TEXT_STRONG}`}>{fmt(t.monto)}</span>
                  <span className={`text-[12.5px] ${TEXT_MUTED}`}>{t.pct}%</span>
                </span>
                <span aria-hidden className={`flex-none text-sm font-bold transition-transform duration-200 motion-reduce:transition-none ${TEXT_FAINT} ${on ? 'rotate-90' : ''}`}>›</span>
              </button>
            );
          })}
        </div>
        <span className={`text-[12.5px] ${TEXT_MUTED}`}>
          {sel ? '% de tus salidas del mes.' : '% de tus salidas del mes. Toca un tipo para ver de qué está hecho y cómo vas contra tu presupuesto.'}
        </span>
      </div>

      {elegido && <Detalle tipo={elegido} month={month} fmt={fmt} onClose={() => setSel(null)} />}
    </section>
  );
}
