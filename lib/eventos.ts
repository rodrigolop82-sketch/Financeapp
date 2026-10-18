// Eventos: presupuesto para una ocasión (cumpleaños, graduación, vacación,
// boda o algo desde cero). Puro, para vitest: plantillas, totales, acceso
// Premium y la meta de "Ahorrar para esto". Tablas: migración 20261105.

export type EventoTipo = 'cumpleanos' | 'graduacion' | 'vacacion' | 'boda' | 'otro'

export interface Plantilla {
  tipo: EventoTipo
  emoji: string
  label: string
  /** Nombre que se sugiere al crear (vacío en "En blanco"). */
  nombre: string
  /** Conceptos sugeridos para anotar valores (se pueden quitar o agregar más). */
  conceptos: string[]
}

export const PLANTILLAS: Plantilla[] = [
  {
    tipo: 'cumpleanos', emoji: '🎂', label: 'Cumpleaños', nombre: 'Cumpleaños',
    conceptos: ['Lugar', 'Comida', 'Pastel', 'Bebidas', 'Decoración', 'Invitaciones', 'Música o entretenimiento', 'Recuerdos', 'Regalo'],
  },
  {
    tipo: 'graduacion', emoji: '🎓', label: 'Graduación', nombre: 'Graduación',
    conceptos: ['Derechos de graduación', 'Toga y birrete', 'Fotos', 'Vestuario', 'Lugar de la celebración', 'Comida y bebidas', 'Invitaciones', 'Transporte', 'Regalo'],
  },
  {
    tipo: 'vacacion', emoji: '🏖️', label: 'Vacación', nombre: 'Vacación',
    conceptos: ['Transporte (vuelos, bus o gasolina)', 'Hospedaje', 'Comida', 'Tours y actividades', 'Transporte local', 'Seguro de viaje', 'Compras y recuerdos', 'Imprevistos'],
  },
  {
    tipo: 'boda', emoji: '💍', label: 'Boda', nombre: 'Boda',
    conceptos: ['Salón', 'Banquete', 'Bebidas', 'Pastel', 'Vestido y traje', 'Fotografía y video', 'Música', 'Flores y decoración', 'Invitaciones', 'Anillos', 'Ceremonia', 'Luna de miel', 'Imprevistos'],
  },
  { tipo: 'otro', emoji: '✏️', label: 'En blanco', nombre: '', conceptos: [] },
]

export function plantillaDe(tipo: EventoTipo | string | null | undefined): Plantilla {
  return PLANTILLAS.find((p) => p.tipo === tipo) ?? PLANTILLAS[PLANTILLAS.length - 1]
}

export function esTipoEvento(v: unknown): v is EventoTipo {
  return typeof v === 'string' && PLANTILLAS.some((p) => p.tipo === v)
}

/**
 * Eventos es de Premium (y de la prueba): solo Premium crea o reactiva
 * eventos. En Gratis los que ya existan se pueden ver, no crear nuevos.
 */
export function puedeCrearEvento(premium: boolean): boolean {
  return premium
}

export const MAX_NOMBRE = 80
export const MAX_CONCEPTOS = 40
export const MAX_MONTO = 100_000_000

export interface ConceptoInput {
  nombre: string
  presupuesto: number
}

export interface NuevoEvento {
  tipo: EventoTipo
  nombre: string
  fechaInicio: string | null
  fechaFin: string | null
  conceptos: ConceptoInput[]
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

function limpiar(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max).trim() : ''
}

function fecha(v: unknown): string | null | undefined {
  if (v === undefined || v === null || v === '') return null
  return typeof v === 'string' && FECHA_RE.test(v) && Number.isFinite(Date.parse(v)) ? v : undefined
}

/** Monto escrito ("Q 1,250.50", "800") o número; null si no es válido. */
export function montoConcepto(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return 0
  if (typeof v === 'string' && v.includes('-')) return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n < 0 || n > MAX_MONTO) return null
  return Math.round(n * 100) / 100
}

/** Valida lo que manda la hoja de "Nuevo evento". */
export function parseNuevoEvento(body: unknown): { ok: true; value: NuevoEvento } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Datos inválidos' }
  const b = body as Record<string, unknown>
  if (!esTipoEvento(b.tipo)) return { ok: false, error: 'Elige un tipo de evento' }
  const nombre = limpiar(b.nombre, MAX_NOMBRE)
  if (!nombre) return { ok: false, error: 'Ponle nombre al evento' }
  const fechaInicio = fecha(b.fechaInicio)
  const fechaFin = fecha(b.fechaFin)
  if (fechaInicio === undefined || fechaFin === undefined) return { ok: false, error: 'Revisa las fechas' }
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) return { ok: false, error: 'La fecha final es antes de la inicial' }
  const raw = Array.isArray(b.conceptos) ? b.conceptos : []
  if (raw.length > MAX_CONCEPTOS) return { ok: false, error: `Hasta ${MAX_CONCEPTOS} conceptos por evento` }
  const conceptos: ConceptoInput[] = []
  for (const c of raw) {
    const r = (c ?? {}) as Record<string, unknown>
    const n = limpiar(r.nombre, MAX_NOMBRE)
    const monto = montoConcepto(r.presupuesto)
    if (monto === null) return { ok: false, error: `Revisa el monto de ${n || 'un concepto'}` }
    if (!n) continue
    conceptos.push({ nombre: n, presupuesto: monto })
  }
  return { ok: true, value: { tipo: b.tipo, nombre, fechaInicio, fechaFin, conceptos } }
}

export interface ConceptoResumen {
  id: string
  nombre: string
  presupuesto: number
  gastado: number
}

export interface ResumenEvento {
  presupuesto: number
  gastado: number
  /** Presupuesto − gastado (negativo si se pasó). */
  restante: number
  /** 0–100+ (para la barra). */
  pct: number
  /** Conceptos que ya se pasaron de su presupuesto. */
  pasados: number
  /** Gastos asignados al evento sin concepto con presupuesto (presupuesto 0). */
  sinPresupuesto: number
}

export function resumenEvento(conceptos: ConceptoResumen[]): ResumenEvento {
  const presupuesto = conceptos.reduce((s, c) => s + c.presupuesto, 0)
  const gastado = conceptos.reduce((s, c) => s + c.gastado, 0)
  return {
    presupuesto,
    gastado,
    restante: Math.round((presupuesto - gastado) * 100) / 100,
    pct: presupuesto > 0 ? Math.round((gastado / presupuesto) * 100) : gastado > 0 ? 100 : 0,
    pasados: conceptos.filter((c) => c.presupuesto > 0 && c.gastado > c.presupuesto).length,
    sinPresupuesto: conceptos.filter((c) => c.presupuesto === 0 && c.gastado > 0).reduce((s, c) => s + c.gastado, 0),
  }
}

/** Gastado por concepto a partir de los movimientos asignados (solo gastos). */
export function gastadoPorConcepto(txs: { evento_concepto_id: string | null; amount: number | string; type?: string | null }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of txs) {
    if (!t.evento_concepto_id || t.type === 'income') continue
    m.set(t.evento_concepto_id, Math.round(((m.get(t.evento_concepto_id) ?? 0) + Number(t.amount)) * 100) / 100)
  }
  return m
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function corto(d: string, conAnio: boolean): string {
  const [y, m, day] = d.split('-').map(Number)
  return `${day} ${MESES[m - 1]}${conAnio ? ` ${y}` : ''}`
}

/** "12 dic", "12–15 dic", "28 dic – 3 ene 2027" o "Sin fecha". */
export function textoFechas(inicio: string | null, fin: string | null, today: string): string {
  if (!inicio && !fin) return 'Sin fecha'
  const a = inicio ?? fin!
  const b = inicio && fin && fin !== inicio ? fin : null
  const otroAnio = (d: string) => d.slice(0, 4) !== today.slice(0, 4)
  if (!b) return corto(a, otroAnio(a))
  if (a.slice(0, 7) === b.slice(0, 7)) return `${Number(a.slice(8))}–${corto(b, otroAnio(b))}`
  return `${corto(a, false)} – ${corto(b, otroAnio(b) || otroAnio(a))}`
}

/** "Faltan 12 días", "Es hoy", "En curso" o "Terminó" (null sin fecha). */
export function textoCuenta(inicio: string | null, fin: string | null, today: string): string | null {
  if (!inicio) return null
  const dias = Math.round((Date.parse(inicio) - Date.parse(today)) / 86_400_000)
  if (dias > 1) return `Faltan ${dias} días`
  if (dias === 1) return 'Es mañana'
  if (dias === 0) return 'Es hoy'
  if (fin && fin >= today) return 'En curso'
  return 'Ya pasó'
}

/**
 * "Ahorrar para esto": meta con el presupuesto del evento y su fecha. El
 * aporte mensual reparte el total entre los meses que faltan (mínimo 1).
 */
export function metaParaEvento(e: { tipo: EventoTipo; nombre: string; fechaInicio: string | null }, total: number, today: string) {
  const p = plantillaDe(e.tipo)
  let meses = 1
  if (e.fechaInicio && e.fechaInicio > today) {
    const [y1, m1] = today.split('-').map(Number)
    const [y2, m2] = e.fechaInicio.split('-').map(Number)
    meses = Math.max(1, (y2 - y1) * 12 + (m2 - m1))
  }
  return {
    name: e.nombre,
    emoji: p.emoji === '✏️' ? '🎯' : p.emoji,
    goalType: e.tipo === 'vacacion' ? ('travel' as const) : ('custom' as const),
    targetAmount: Math.round(total * 100) / 100,
    targetDate: e.fechaInicio && e.fechaInicio > today ? e.fechaInicio : null,
    monthlyContribution: Math.ceil(total / meses),
  }
}

export type EstadoAvance = 'sin_presupuesto' | 'dentro' | 'casi' | 'pasado'

export interface Avance {
  estado: EstadoAvance
  /** Gastado / presupuesto en % (puede pasar de 100; null sin presupuesto). */
  pct: number | null
  /** Lo que queda (0 si se pasó). */
  restante: number
  /** Cuánto se pasó (0 si no). */
  exceso: number
  /** Ancho de cada tramo de la barra (0–1): lo gastado dentro del presupuesto y el exceso. */
  barra: { dentro: number; exceso: number }
}

/** A partir del 90 % del presupuesto se avisa que ya casi se acaba. */
export const CASI_PCT = 90

/**
 * Ejecución real contra el presupuesto, para la barra de avance. Si se pasó,
 * la barra se reparte entre lo presupuestado y el exceso (el total es lo gastado).
 */
export function avance(presupuesto: number, gastado: number): Avance {
  const p = Math.max(0, presupuesto)
  const g = Math.max(0, gastado)
  const r2 = (n: number) => Math.round(n * 100) / 100
  if (p === 0) {
    return { estado: 'sin_presupuesto', pct: null, restante: 0, exceso: r2(g), barra: { dentro: 0, exceso: g > 0 ? 1 : 0 } }
  }
  const pct = Math.round((g / p) * 100)
  if (g > p) {
    return { estado: 'pasado', pct, restante: 0, exceso: r2(g - p), barra: { dentro: p / g, exceso: (g - p) / g } }
  }
  return { estado: pct >= CASI_PCT ? 'casi' : 'dentro', pct, restante: r2(p - g), exceso: 0, barra: { dentro: g / p, exceso: 0 } }
}
