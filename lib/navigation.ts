// Mapa de navegación de Zafi: pestañas de la barra inferior, menú "Más"
// y a qué pantalla "padre" vuelve cada ruta. Sin dependencias de React para
// poder probarlo con vitest.

export type TabKey = 'inicio' | 'movimientos' | 'metas' | 'mas';

export interface MoreItem {
  emoji: string;
  name: string;
  description: string;
  href: string;
}

export interface MoreGroup {
  title: string;
  items: MoreItem[];
}

export const MORE_GROUPS: MoreGroup[] = [
  {
    title: 'Tu dinero',
    items: [
      { emoji: '🧮', name: 'Plan del mes', description: 'Cuánto quieres gastar en cada cosa', href: '/presupuesto' },
      { emoji: '💳', name: 'Deudas', description: 'Tarjetas y préstamos', href: '/deudas' },
      { emoji: '📊', name: 'Cómo te fue', description: 'Cuánto ahorraste y dónde ajustar', href: '/resumen' },
      { emoji: '✅', name: 'Cerrar el mes', description: 'Repasa cómo te fue', href: '/cierre-mes' },
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
      { emoji: '🏦', name: 'Mis bancos', description: 'Importa tu estado de cuenta', href: '/mis-fuentes' },
      { emoji: '👪', name: 'Familia', description: 'Comparte con tu pareja o familia', href: '/familia' },
      { emoji: '⚙️', name: 'Cuenta y privacidad', description: 'Perfil, apariencia, datos', href: '/cuenta' },
    ],
  },
];

/** Rutas raíz de cada pestaña: en móvil no llevan barra superior. */
export const ROOT_PATHS = ['/dashboard', '/transacciones', '/metas', '/mas'];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

/** Pestaña de la barra inferior que se marca como activa para `pathname`. */
export function activeTabFor(pathname: string): TabKey | null {
  if (['/dashboard', '/resumen', '/health-score', '/score'].some((p) => matches(pathname, p))) return 'inicio';
  if (['/transacciones', '/importar', '/capture', '/notificacion'].some((p) => matches(pathname, p))) return 'movimientos';
  if (matches(pathname, '/metas')) return 'metas';
  const moreRoutes = ['/mas', '/plan', '/admin', ...MORE_GROUPS.flatMap((g) => g.items.map((i) => i.href))];
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
  ['/plan', { label: 'Plan del mes', href: '/presupuesto' }],
  ['/importar', { label: 'Movimientos', href: '/transacciones' }],
  ['/capture', { label: 'Movimientos', href: '/transacciones' }],
  ['/notificacion', { label: 'Movimientos', href: '/transacciones' }],
  ['/metas', { label: 'Metas', href: '/metas' }],
  ['/cuenta', { label: 'Cuenta', href: '/cuenta' }],
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
