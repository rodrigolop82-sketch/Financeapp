import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEffectivePlan } from '@/lib/plans'
import { localToday } from '@/lib/dates'
import { cleanTransactionName, formatMoney } from '@/lib/format'
import { toGTQ, detectCurrency } from '@/lib/currency'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseApplePayBody, type ApplePayCharge } from '@/lib/apple-pay'
import { IGNORADO_TEXTO, cobroDesdeExtraccion, esCuerpoAndroid, pareceCobro, parseAndroidBody, type AndroidNotice } from '@/lib/android'
import { findShortcutToken, registerApplePayCharge, touchShortcutToken } from '@/lib/apple-pay-server'
import { extraerNotificacion } from '@/lib/notificacion-ia'

const BANK_PATTERNS = [
  // BAM Guatemala
  { bank: 'BAM', regex: /BAM.*?(Q|GTQ)\s?([\d,]+\.?\d*)/i },
  // Banrural
  { bank: 'Banrural', regex: /Banrural.*?(Q|GTQ)\s?([\d,]+\.?\d*)/i },
  // BI (Banco Industrial)
  { bank: 'Banco Industrial', regex: /(?:Banco Industrial|BI).*?(Q|GTQ)\s?([\d,]+\.?\d*)/i },
  // G&T Continental
  { bank: 'G&T', regex: /G&T.*?(Q|GTQ)\s?([\d,]+\.?\d*)/i },
  // Apple Pay / Wallet
  { bank: 'Apple Pay', regex: /Apple Pay.*?\$?([\d,]+\.?\d*)/i },
  // Generic: amount patterns
  { bank: 'Banco', regex: /(?:compra|pago|cargo|débito|retiro|transacción).*?(Q|GTQ|\$)\s?([\d,]+\.?\d*)/i },
  // Generic fallback: any Q amount
  { bank: 'Notificación', regex: /(Q|GTQ)\s?([\d,]+\.?\d*)/i },
]

/**
 * POST /api/parse-notification
 * - Con sesión (cookie) y { text }: interpreta el texto de una notificación
 *   del banco y devuelve lo detectado (pantalla /notificacion). Sin cambios.
 * - Con `Authorization: Bearer zafi_…` y { amount, merchant, card, date }:
 *   el atajo de Apple Pay (fase 13.3). Crea el gasto y manda el push.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth && /^bearer\s+/i.test(auth)) {
    return handleShortcut(req, auth.replace(/^bearer\s+/i, '').trim())
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { text } = await req.json()
  if (!text || typeof text !== 'string' || text.trim().length < 5) {
    return NextResponse.json({ error: 'Texto de notificación requerido' }, { status: 400 })
  }

  const rawText = text.trim()

  // Try quick regex extraction first
  let quickAmount: number | null = null
  let quickBank = 'Notificación'
  let quickCurrency = 'GTQ'
  for (const pattern of BANK_PATTERNS) {
    const match = rawText.match(pattern.regex)
    if (match) {
      quickBank = pattern.bank
      const amountStr = match[match.length - 1].replace(/,/g, '')
      quickAmount = parseFloat(amountStr)
      if (match.length >= 3) {
        quickCurrency = detectCurrency(match[1])
      } else if (pattern.bank === 'Apple Pay') {
        quickCurrency = 'USD'
      }
      if (quickAmount > 0) break
    }
  }

  // Use Claude AI for full extraction (more accurate)
  const today = localToday()

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 })
  }

  const ia = await extraerNotificacion(rawText, today)

  if (ia.status === 'http_error') {
    // Fallback to regex result
    if (quickAmount && quickAmount > 0) {
      const isForexFb = quickCurrency !== 'GTQ'
      return NextResponse.json({
        amount: isForexFb ? toGTQ(quickAmount, quickCurrency) : quickAmount,
        merchant: 'Gasto detectado',
        bank: quickBank,
        category: '',
        confidence: 0.5,
        rawText,
        original_amount: isForexFb ? quickAmount : null,
        original_currency: isForexFb ? quickCurrency : null,
      })
    }
    return NextResponse.json({ error: 'Error al procesar la notificación' }, { status: 500 })
  }

  try {
    if (ia.status !== 'ok') throw new Error('parse')
    const result = ia.result

    if (!result.amount || result.amount <= 0) {
      // Fallback to regex
      if (quickAmount && quickAmount > 0) {
        return NextResponse.json({
          amount: quickAmount,
          merchant: 'Gasto detectado',
          bank: quickBank,
          category: '',
          confidence: 0.4,
          rawText,
        })
      }
      return NextResponse.json({
        amount: 0,
        merchant: '',
        bank: '',
        category: '',
        confidence: 0,
        rawText,
        error: 'No se pudo detectar un gasto en esta notificación',
      })
    }

    // Enrich with category_id
    const { data: household } = await supabase
      .from('households').select('id').eq('owner_id', user.id).limit(1).single()

    let categoryId = ''
    const suggested = (result.category ?? '').toLowerCase()
    if (household && suggested) {
      const { data: categories } = await supabase
        .from('budget_categories').select('id, name').eq('household_id', household.id)

      if (categories) {
        const match = categories.find(c =>
          c.name.toLowerCase().includes(suggested) ||
          suggested.includes(c.name.toLowerCase())
        )
        if (match) categoryId = match.id
      }
    }

    const currency = (result.currency || 'GTQ').toUpperCase()
    const isForex = currency !== 'GTQ'

    return NextResponse.json({
      amount: isForex ? toGTQ(result.amount, currency) : result.amount,
      merchant: cleanTransactionName(result.merchant || ''),
      bank: result.bank || quickBank,
      category: result.category || '',
      categoryId,
      confidence: result.confidence || 0.7,
      rawText,
      original_amount: isForex ? result.amount : null,
      original_currency: isForex ? currency : null,
      type: result.type === 'income' ? 'income' : 'expense',
    })
  } catch {
    // Fallback to regex
    if (quickAmount && quickAmount > 0) {
      return NextResponse.json({
        amount: quickCurrency !== 'GTQ' ? toGTQ(quickAmount, quickCurrency) : quickAmount,
        merchant: 'Gasto detectado',
        bank: quickBank,
        category: '',
        confidence: 0.4,
        rawText,
        original_amount: quickCurrency !== 'GTQ' ? quickAmount : null,
        original_currency: quickCurrency !== 'GTQ' ? quickCurrency : null,
      })
    }
    return NextResponse.json({ error: 'No se pudo interpretar la notificación' }, { status: 500 })
  }
}

/**
 * Clave personal (Bearer zafi_…):
 * - Atajo de Apple Pay: JSON { amount, merchant, card, date } → source 'apple_pay'.
 * - Android (C15): MacroDroid/Tasker manda el texto del aviso (texto plano o
 *   JSON { text, app }) → se interpreta con IA → source 'android'.
 */
async function handleShortcut(req: NextRequest, token: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.error('[apple-pay] Falta SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Falta configurar el servidor.' }, { status: 503 })
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const row = await findShortcutToken(admin, token)
  if (!row) {
    return NextResponse.json({ error: 'Clave inválida o revocada. Genera una nueva en Zafi › Mis cuentas.' }, { status: 401 })
  }

  // JSON (atajo, o Android con { text }) o texto plano (Android).
  const raw = await req.text().catch(() => '')
  const isJson = (req.headers.get('content-type') ?? '').includes('json') || raw.trim().startsWith('{')
  let body: unknown = raw
  if (isJson) {
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Manda un JSON con amount, merchant, card y date, o el texto del aviso.' }, { status: 400 })
    }
  }

  const today = localToday()
  const android = esCuerpoAndroid(body)
  let charge: ApplePayCharge
  let notice: AndroidNotice | null = null
  if (android) {
    const parsed = parseAndroidBody(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    notice = parsed.value
    // Sin monto no se interpreta ni cuenta para el límite.
    if (!pareceCobro(notice.text)) return ignored('no_es_cobro')
  } else {
    const parsed = parseApplePayBody(body, today)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    charge = parsed.value
  }

  if (!(await touchShortcutToken(admin, row))) {
    return NextResponse.json({ error: 'Demasiados pagos seguidos con esta clave. Intenta en una hora.' }, { status: 429 })
  }

  // Solo ver: el atajo tampoco registra (no pasa por RLS: usa service role).
  if ((await getEffectivePlan(row.user_id)).access === 'view') {
    return NextResponse.json({ error: 'Estás en modo solo ver: pídele al dueño del hogar que active Familiar.' }, { status: 403 })
  }

  if (notice) {
    const ia = await extraerNotificacion(notice.text, today)
    const extraccion = ia.status === 'ok' ? {
      amount: Number(ia.result.amount) || 0,
      merchant: ia.result.merchant ?? '',
      bank: ia.result.bank ?? '',
      currency: (ia.result.currency ?? 'GTQ').toUpperCase(),
      type: ia.result.type === 'income' ? 'income' as const : 'expense' as const,
    } : null
    if (ia.status !== 'ok') console.warn('[android] No se pudo interpretar el aviso:', ia.status)
    const cobro = cobroDesdeExtraccion(extraccion, notice, today)
    if (!cobro.ok) return ignored(cobro.reason)
    charge = cobro.value
  }

  const via = notice ? (charge!.card ? `por el aviso de ${charge!.card}` : 'por un aviso del banco') : 'con Apple Pay'
  const result = await registerApplePayCharge(admin, row.user_id, charge!, { source: notice ? 'android' : 'apple_pay', via })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  const r = result.value
  const spent = `${formatMoney(r.amount, { showDecimals: true })} en ${r.merchant}`
  return NextResponse.json({
    ok: true,
    id: r.id,
    amount: r.amount,
    merchant: r.merchant,
    date: r.date,
    category: r.categoryName,
    categorized: r.remembered,
    notified: r.pushed,
    duplicate: !!r.duplicate,
    message: r.duplicate
      ? `Ya estaba registrado: ${spent}.`
      : r.remembered && r.categoryName
        ? `Registramos ${spent}: ${r.categoryName}.`
        : `Registramos ${spent}. Abre Zafi para elegir la categoría.`,
  }, { status: r.duplicate ? 200 : 201 })
}

/** Aviso que no es un gasto: 200 para que MacroDroid no lo marque como error. */
function ignored(reason: keyof typeof IGNORADO_TEXTO) {
  return NextResponse.json({ ok: true, ignored: true, reason, message: IGNORADO_TEXTO[reason] })
}
