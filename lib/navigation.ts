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

// "Más" (móvil): lo mismo que el menú lateral fuera de la barra inferior.
// Tu salud financiera y Cerrar el mes viven dentro de Cómo te fue; Familia y
// Enviar idea, dentro de Cuenta.
export const MORE_GROUPS: MoreGroup[] = [
  {
    title: 'Tu dinero',
    items: [
      { emoji: '📊', name: 'Cómo te fue', description: 'Tu mes, tu salud financiera y el cierre', href: '/resumen' },
    ],
  },
  {
    title: 'Ayuda',
    items: [
      { emoji: '💬', name: 'Pregúntale a Zafi', description: 'Resuelve dudas de tu dinero', href: '/chat' },
      { emoji: '📚', name: 'Aprende', description: 'Lecciones cortas', href: '/aprende' },
    ],
  },
  {
    title: 'Tu cuenta',
    items: [
      { emoji: '🏦', name: 'Mis cuentas', description: 'Cuentas de banco y tarjetas', href: '/mis-fuentes' },
      { emoji: '⚙️', name: 'Cuenta', description: 'Perfil, avisos, familia y privacidad', href: '/cuenta' },
    ],
  },
];

export type SidebarIcon = 'inicio' | 'movimientos' | 'plan' | 'resumen' | 'chat' | 'aprende' | 'cuentas' | 'cuenta';

export interface SidebarItem {
  href: string;
  label: string;
  icon: SidebarIcon;
}

/** Menú lateral (escritorio): 8 entradas. */
export const SIDEBAR_GROUPS: { label: string; items: SidebarItem[] }[] = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard', icon: 'inicio', label: 'Inicio' },
      { href: '/transacciones', icon: 'movimientos', label: 'Movimientos' },
      { href: '/plan', icon: 'plan', label: 'Plan' },
      { href: '/resumen', icon: 'resumen', label: 'Cómo te fue' },
    ],
  },
  {
    label: 'Ayuda',
    items: [
      { href: '/chat', icon: 'chat', label: 'Pregúntale a Zafi' },
      { href: '/aprende', icon: 'aprende', label: 'Aprende' },
    ],
  },
  {
    label: 'Tu cuenta',
    items: [
      { href: '/mis-fuentes', icon: 'cuentas', label: 'Mis cuentas' },
      { href: '/cuenta', icon: 'cuenta', label: 'Cuenta' },
    ],
  },
];

/**
 * Entrada del menú lateral que se marca para `pathname`: la propia o la de
 * la sección donde vive ahora (p. ej. /cierre-mes → Cómo te fue).
 */
const SIDEBAR_ALIASES: [string, string][] = [
  ['/score', '/resumen'],
  ['/health-score', '/resumen'],
  ['/cierre-mes', '/resumen'],
  ['/presupuesto', '/plan'],
  ['/metas', '/plan'],
  ['/deudas', '/plan'],
  ['/importar', '/transacciones'],
  ['/notificacion', '/transacciones'],
  ['/familia', '/cuenta'],
  ['/patrimonio', '/mis-fuentes'],
];

export function sidebarActiveHref(pathname: string): string | null {
  for (const [prefix, href] of SIDEBAR_ALIASES) if (matches(pathname, prefix)) return href;
  for (const g of SIDEBAR_GROUPS) for (const i of g.items) if (matches(pathname, i.href)) return i.href;
  return null;
}

/** Rutas raíz de cada pestaña: en móvil no llevan barra superior. */
export const ROOT_PATHS = ['/dashboard', '/transacciones', '/plan', '/mas'];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

/** Pestaña de la barra inferior que se marca como activa para `pathname`. */
export function activeTabFor(pathname: string): TabKey | null {
  if (matches(pathname, '/dashboard')) return 'inicio';
  if (['/transacciones', '/importar', '/notificacion'].some((p) => matches(pathname, p))) return 'movimientos';
  // Plan agrupa el plan del mes, las metas y las deudas.
  if (['/plan', '/presupuesto', '/metas', '/deudas'].some((p) => matches(pathname, p))) return 'plan';
  const moreRoutes = [
    '/mas', '/admin', '/planes', '/score', '/health-score', '/cierre-mes', '/familia', '/patrimonio',
    ...MORE_GROUPS.flatMap((g) => g.items.flatMap((i) => (i.href ? [i.href.split('?')[0]] : []))),
  ];
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
  ['/resumen/suscripciones', { label: 'Suscripciones', href: '/resumen/suscripciones' }],
  ['/resumen', { label: 'Cómo te fue', href: '/resumen' }],
  ['/patrimonio', { label: 'Mi patrimonio', href: '/patrimonio' }],
  ['/health-score', { label: 'Cómo te fue', href: '/resumen' }],
  ['/score', { label: 'Cómo te fue', href: '/resumen' }],
  ['/cierre-mes', { label: 'Cómo te fue', href: '/resumen' }],
  ['/familia', { label: 'Cuenta', href: '/cuenta' }],
  ['/plan', { label: 'Plan', href: '/plan' }],
  ['/importar', { label: 'Movimientos', href: '/transacciones' }],
  ['/notificacion', { label: 'Movimientos', href: '/transacciones' }],
  ['/metas', { label: 'Metas', href: '/plan?s=metas' }],
  ['/cuenta', { label: 'Cuenta', href: '/cuenta' }],
  ['/mis-fuentes', { label: 'Mis cuentas', href: '/mis-fuentes' }],
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
