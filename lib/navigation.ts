// Mapa de navegación de Zafi: pestañas de la barra inferior, menú "Más"
// y a qué pantalla "padre" vuelve cada ruta. Sin dependencias de React para
// poder probarlo con vitest.

export type TabKey = 'inicio' | 'movimientos' | 'plan' | 'mas';

export interface MoreItem {
  emoji: string;
  name: string;
  description: string;
  /** Ruta a la que lleva. Las filas con `action` no navegan. */
  href?: string;
  /** Acción en la misma página (p. ej. abrir la hoja de feedback). */
  action?: 'feedback';
}

export interface MoreGroup {
  title: string;
  items: MoreItem[];
}

export const MORE_GROUPS: MoreGroup[] = [
  {
    title: 'Tu dinero',
    items: [
      { emoji: '📊', name: 'Cómo te fue', description: 'Cuánto ahorraste y dónde ajustar', href: '/resumen' },
      { emoji: '💚', name: 'Tu salud financiera', description: 'Tu puntaje Zafi y cómo mejorarlo', href: '/score?from=mas' },
      { emoji: '✅', name: 'Cerrar el mes', description: 'Repasa cómo te fue', href: '/cierre-mes' },
    ],
  },
  {
    title: 'Ayuda',
    items: [
      { emoji: '💬', name: 'Pregúntale a Zafi', description: 'Resuelve dudas de tu dinero', href: '/chat' },
      { emoji: '📚', name: 'Aprende', description: 'Lecciones cortas', href: '/aprende' },
      { emoji: '💡', name: 'Envíanos tu idea', description: 'Sugerencias, errores o lo que quieras', action: 'feedback' },
    ],
  },
  {
    title: 'Tu cuenta',
    items: [
      { emoji: '🏦', name: 'Mis bancos', description: 'Importa tu estado de cuenta', href: '/mis-fuentes' },
      { emoji: '👪', name: 'Familia', description: 'Comparte con tu pareja o familia', href: '/familia' },
      { emoji: '⚙️', name: 'Cuenta y privacidad', description: 'Perfil, apariencia, datos', href: '/cuenta' },
    ],
  },
];

/** Rutas raíz de cada pestaña: en móvil no llevan barra superior. */
export const ROOT_PATHS = ['/dashboard', '/transacciones', '/plan', '/mas'];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

/** Pestaña de la barra inferior que se marca como activa para `pathname`. */
export function activeTabFor(pathname: string): TabKey | null {
  if (['/dashboard', '/resumen', '/health-score', '/score'].some((p) => matches(pathname, p))) return 'inicio';
  if (['/transacciones', '/importar', '/notificacion'].some((p) => matches(pathname, p))) return 'movimientos';
  // Plan agrupa el plan del mes, las metas y las deudas.
  if (['/plan', '/presupuesto', '/metas', '/deudas'].some((p) => matches(pathname, p))) return 'plan';
  const moreRoutes = ['/mas', '/admin', '/planes', ...MORE_GROUPS.flatMap((g) => g.items.flatMap((i) => (i.href ? [i.href.split('?')[0]] : [])))];
  if (moreRoutes.some((p) => matches(pathname, p))) return 'mas';
  return null;
}

export function isRootPath(pathname: string): boolean {
  return ROOT_PATHS.includes(pathname);
}

export interface ParentLink {
  label: string;
  href: string;
}

/**
 * Pantalla a la que vuelve el "‹" del encabezado móvil. Se evalúa en orden:
 * la primera coincidencia gana, así que las rutas más específicas van antes.
 */
const PARENTS: [string, ParentLink][] = [
  ['/resumen/categoria', { label: 'Cómo te fue', href: '/resumen' }],
  ['/health-score', { label: 'Cómo te fue', href: '/resumen' }],
  ['/score', { label: 'Cómo te fue', href: '/resumen' }],
  ['/plan', { label: 'Plan', href: '/plan' }],
  ['/importar', { label: 'Movimientos', href: '/transacciones' }],
  ['/notificacion', { label: 'Movimientos', href: '/transacciones' }],
  ['/metas', { label: 'Metas', href: '/plan?s=metas' }],
  ['/cuenta', { label: 'Cuenta', href: '/cuenta' }],
  ['/mis-fuentes', { label: 'Mis bancos', href: '/mis-fuentes' }],
  ['/aprende', { label: 'Aprende', href: '/aprende' }],
];

export function parentFor(pathname: string): ParentLink {
  for (const [prefix, parent] of PARENTS) {
    // Una ruta no es su propio padre: /cuenta vuelve a Más, /cuenta/x vuelve a Cuenta.
    if (pathname.startsWith(prefix + '/') || (pathname === prefix && parent.href !== prefix)) {
      return parent;
    }
  }
  return { label: 'Más', href: '/mas' };
}

/** Secciones de la pestaña Plan (`/plan?s=…`). */
export type PlanSection = 'mes' | 'metas' | 'deudas';

export function planSection(value: string | null | undefined): PlanSection {
  return value === 'metas' || value === 'deudas' ? value : 'mes';
}

/**
 * Destino en /plan de las rutas viejas (/presupuesto, /metas, /deudas):
 * conserva sus parámetros (p. ej. `confirmMonth`) menos `from` y `s`.
 */
export function planHref(section: PlanSection, params: Record<string, string | string[] | undefined> = {}): string {
  const q = new URLSearchParams();
  if (section !== 'mes') q.set('s', section);
  for (const [k, v] of Object.entries(params)) {
    if (k === 's' || k === 'from' || typeof v !== 'string') continue;
    q.set(k, v);
  }
  const qs = q.toString();
  return qs ? `/plan?${qs}` : '/plan';
}
