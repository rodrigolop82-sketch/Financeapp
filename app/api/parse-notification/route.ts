import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEffectivePlan } from '@/lib/plans'
import { localToday } from '@/lib/dates'
import { cleanTransactionName, formatMoney } from '@/lib/format'
import { toGTQ, detectCurrency } from '@/lib/currency'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseApplePayBody } from '@/lib/apple-pay'
import { findShortcutToken, registerApplePayCharge, touchShortcutToken } from '@/lib/apple-pay-server'

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

const ZAFI_CATEGORIES = [
  'Vivienda/alquiler', 'Alimentación', 'Transporte', 'Salud/medicinas', 'Servicios',
  'Educación', 'Restaurantes y salidas', 'Ropa', 'Entretenimiento', 'Suscripciones',
  'Varios personales', 'Fondo de emergencia', 'Ahorro para metas', 'Pago extra de deudas',
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

  const extractionResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `Extractor de transacciones de notificaciones bancarias en Guatemala y Apple Pay.
Respondé SOLO con JSON válido. Fecha hoy: ${today}. Moneda principal: GTQ (Q).
Categorías disponibles: ${ZAFI_CATEGORIES.join(', ')}.

Extraé de la notificación: monto, comercio/descripción, banco, categoría sugerida, nivel de confianza, currency (código ISO: GTQ, USD, EUR, MXN), y type ("expense" o "income").

Formato de respuesta:
{"amount":150.00,"merchant":"Walmart","bank":"BAM","category":"Alimentación","confidence":0.9,"currency":"GTQ","type":"expense"}

Si no podés extraer datos, respondé: {"amount":0,"merchant":"","bank":"","category":"","confidence":0,"currency":"GTQ","type":"expense"}
Reglas:
- Si el texto menciona Apple Pay, Wallet o tarjeta Apple, el banco es "Apple Pay"
- Si menciona compra/pago/cargo/débito, es type:"expense"
- Si menciona depósito, abono, transferencia recibida o acreditado (dinero que ENTRA a la cuenta), es type:"income". Ante la duda, usá "expense".
- Detectá el nombre del comercio cuando aparezca
- Asigná la categoría más probable
- Si el monto está en $ o USD, currency es "USD". Si está en Q o GTQ, currency es "GTQ".`,
      messages: [{ role: 'user', content: `Notificación recibida:\n"${rawText}"` }],
    }),
  })

  if (!extractionResponse.ok) {
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

  const extraction = await extractionResponse.json()

  try {
    const responseText = extraction.content[0].type === 'text' ? extraction.content[0].text : ''
    const result = JSON.parse(responseText.replace(/```json|```/g, '').trim())

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
    if (household && result.category) {
      const { data: categories } = await supabase
        .from('budget_categories').select('id, name').eq('household_id', household.id)

      if (categories) {
        const match = categories.find(c =>
          c.name.toLowerCase().includes(result.category.toLowerCase()) ||
          result.category.toLowerCase().includes(c.name.toLowerCase())
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

/** Atajo de Apple Pay: clave personal → gasto con source 'apple_pay'. */
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
    return NextResponse.json({ error: 'Clave inválida o revocada. Genera una nueva en Zafi › Mis bancos › Apple Pay.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Manda un JSON con amount, merchant, card y date.' }, { status: 400 })
  }
  const parsed = parseApplePayBody(body, localToday())
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if (!(await touchShortcutToken(admin, row))) {
    return NextResponse.json({ error: 'Demasiados pagos seguidos con esta clave. Intenta en una hora.' }, { status: 429 })
  }

  // Solo ver: el atajo tampoco registra (no pasa por RLS: usa service role).
  if ((await getEffectivePlan(row.user_id)).access === 'view') {
    return NextResponse.json({ error: 'Estás en modo solo ver: pídele al dueño del hogar que active Familiar.' }, { status: 403 })
  }

  const result = await registerApplePayCharge(admin, row.user_id, parsed.value)
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
    message: r.remembered && r.categoryName
      ? `Registramos ${spent}: ${r.categoryName}.`
      : `Registramos ${spent}. Abre Zafi para elegir la categoría.`,
  }, { status: 201 })
}
