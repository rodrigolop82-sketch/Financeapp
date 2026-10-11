// Comentario de IA del resumen semanal (Premium). Constructor de prompt
// propio: no usa ni toca buildZafiSystemPrompt. La IA recibe SOLO el JSON
// agregado del snapshot (sin transacciones, comercios ni datos personales).

import { DAY_NAMES, VERDICT_COPY, type WeeklySnapshot } from './weekly'

/** Lo único que viaja a la API: cifras agregadas. */
export function snapshotForAi(s: WeeklySnapshot) {
  return {
    semana: { inicio: s.weekStart, fin: s.weekEnd },
    gastoVariable: Math.round(s.totalVariable),
    pagosFijos: Math.round(s.fixedPaid),
    esperado: s.expectedVariable === null ? null : Math.round(s.expectedVariable),
    veredicto: s.verdict ? VERDICT_COPY[s.verdict] : null,
    diferenciaPct: s.deltaVsExpectedPct,
    sobrante: s.surplusVsExpected === null ? null : Math.round(s.surplusVsExpected),
    porDia: s.byDay.map((d, i) => ({ dia: DAY_NAMES[i], monto: Math.round(d.amount) })),
    categorias: s.topCategories.map((c) => ({
      nombre: c.name,
      monto: Math.round(c.amount),
      cambioVsSemanaAnterior: c.deltaVsPrevWeek === null ? null : Math.round(c.deltaVsPrevWeek),
    })),
  }
}

export function buildSnapshotPrompt(s: WeeklySnapshot): { system: string; user: string } {
  return {
    system: [
      'Eres Zafi, una app de finanzas personales de Guatemala. Escribes en español, tuteando, con tono cercano y breve.',
      'Te dan el resumen agregado de la semana de gastos de una persona, en quetzales (Q).',
      'Escribe como máximo 2 frases sobre lo más relevante de su semana.',
      'Usa solo las cifras del resumen, sin calcular cifras nuevas ni inventar datos. Escribe los montos como "Q 1,234".',
      'No des consejos de inversión ni recomiendes productos financieros, bancos o marcas.',
      'Responde solo con el texto, sin títulos, comillas ni listas.',
    ].join(' '),
    user: JSON.stringify(snapshotForAi(s)),
  }
}

/** Números permitidos: los del JSON enviado (y sus valores absolutos). */
function allowedNumbers(s: WeeklySnapshot): Set<number> {
  const out = new Set<number>()
  const walk = (v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) { out.add(Math.round(v)); out.add(Math.abs(Math.round(v))) }
    else if (typeof v === 'string') { for (const m of Array.from(v.matchAll(/\d+/g))) out.add(Number(m[0])) }
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(snapshotForAi(s))
  return out
}

/** Cifras que aparecen en un texto: "Q 1,234.50" → 1235; "34%" → 34. */
export function numbersIn(text: string): number[] {
  return Array.from(text.matchAll(/\d[\d,]*(?:\.\d+)?/g)).map((m) => Math.round(Number(m[0].replace(/,/g, ''))))
}

/**
 * Valida el comentario: no vacío, como mucho 2 frases y ~400 caracteres, y
 * sin cifras que no estén en la entrada. null ⇒ se usa la observación
 * determinista.
 */
export function validateCommentary(text: string | null | undefined, s: WeeklySnapshot): string | null {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!clean || clean.length > 400) return null
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean)
  if (sentences.length > 2) return null
  const allowed = allowedNumbers(s)
  if (numbersIn(clean).some((n) => !allowed.has(n))) return null
  return clean
}

/** Huella de los datos: si cambia (edición tardía), se regenera el comentario. */
export function snapshotDataKey(s: WeeklySnapshot): string {
  return JSON.stringify(snapshotForAi(s))
}
