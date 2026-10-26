import type { MetadataRoute } from 'next';
import { PROTECTED_ROUTES } from '@/lib/rutas-protegidas';
import { SITE_URL } from '@/lib/site';

// Las pantallas con sesión solo le muestran a Google la de /login (con un
// ?next= distinto cada una), así que no hay nada que indexar ahí.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...PROTECTED_ROUTES, '/api/', '/auth/', '/invite/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
