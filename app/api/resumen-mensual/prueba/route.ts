import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/billing/server'
import { localToday } from '@/lib/dates'
import { addMonths } from '@/lib/como-te-fue'
import { sendResumenToUser, type ResumenUser } from '@/lib/resumen-mensual/envio'

export const dynamic = 'force-dynamic'

/**
 * F7: disparo manual del resumen mensual, solo para pruebas. Protegido con
 * RESUMEN_MENSUAL_TEST_SECRET y limitado a la cuenta de RESUMEN_MENSUAL_TEST_EMAIL
 * (la cuenta QA): nunca envía a otra persona. No depende de
 * RESUMEN_MENSUAL_ENABLED, pero sí de la preferencia y del registro de envíos.
 * POST con Authorization: Bearer <secreto>; ?mes=YYYY-MM (por defecto, el anterior).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESUMEN_MENSUAL_TEST_SECRET
  const email = process.env.RESUMEN_MENSUAL_TEST_EMAIL?.trim().toLowerCase()
  if (!secret || !email) return NextResponse.json({ error: 'Prueba sin configurar' }, { status: 503 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const mes = req.nextUrl.searchParams.get('mes')
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : addMonths(localToday().slice(0, 7), -1)

  const admin = adminClient()
  const { data } = await admin.from('users').select('id, email, full_name, currency, show_decimals').eq('email', email).maybeSingle()
  if (!data) return NextResponse.json({ error: 'No existe la cuenta de prueba' }, { status: 404 })
  const result = await sendResumenToUser(admin, data as ResumenUser, month)
  return NextResponse.json({ month, result })
}
