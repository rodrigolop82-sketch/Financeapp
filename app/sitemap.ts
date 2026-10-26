import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

const PUBLIC_PAGES = ['', '/registro', '/login', '/privacidad', '/terminos'];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((path) => ({ url: `${SITE_URL}${path}` }));
}
