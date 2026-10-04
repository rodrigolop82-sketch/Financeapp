// GET /api/admin: el Resumen del panel (fase 12). Las demás vistas viven en
// /api/admin/{resumen,retencion,inactivos,feedback}. Solo admins.
export const dynamic = 'force-dynamic';
export { GET } from './resumen/route';
