import { createServerSupabaseClient } from '@/lib/supabase-server'
import { localToday } from '@/lib/dates'
import { cleanTransactionName } from '@/lib/format'
import { toGTQ, detectCurrency } from '@/lib/currency'
import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(req: NextRequest) {
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

Extraé de la notificación: monto, comercio/descripción, banco, categoría sugerida, nivel de confianza, y currency (código ISO: GTQ, USD, EUR, MXN).

Formato de respuesta:
{"amount":150.00,"merchant":"Walmart","bank":"BAM","category":"Alimentación","confidence":0.9,"currency":"GTQ"}

Si no podés extraer datos, respondé: {"amount":0,"merchant":"","bank":"","category":"","confidence":0,"currency":"GTQ"}
Reglas:
- Si el texto menciona Apple Pay, Wallet o tarjeta Apple, el banco es "Apple Pay"
- Si menciona compra/pago/cargo, es un gasto
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
