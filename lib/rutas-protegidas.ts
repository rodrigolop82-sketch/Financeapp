// Rutas que exigen sesión. El middleware manda a /login a quien entre sin
// sesión. Toda pantalla con datos del usuario debe estar aquí: la página
// puede revisar la sesión en el cliente, pero para entonces ya se sirvió.
export const PROTECTED_ROUTES = [
  '/dashboard', '/presupuesto', '/deudas', '/plan', '/eventos', '/transacciones',
  '/familia', '/cuenta', '/onboarding', '/chat', '/admin', '/notificacion',
  '/resumen', '/metas', '/score', '/mas', '/planes', '/unir',
  '/cierre-mes', '/mis-fuentes', '/aprende', '/patrimonio', '/health-score',
  '/importar', '/guardar',
];

export const AUTH_ROUTES = ['/login', '/registro'];

// Coincide con la ruta exacta o con sus subrutas ("/plan" y "/plan/pagos",
// también "/planes"), como el startsWith que usaba el middleware.
export function isProtectedPath(path: string): boolean {
  return PROTECTED_ROUTES.some((route) => path.startsWith(route));
}

export function isAuthPath(path: string): boolean {
  return AUTH_ROUTES.some((route) => path.startsWith(route));
}
