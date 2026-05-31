import { createServerSupabaseClient } from '@/lib/supabase-server'
import { localToday } from '@/lib/dates'
import { cleanTransactionName } from '@/lib/format'
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
  for (const pattern of BANK_PATTERNS) {
    const match = rawText.match(pattern.regex)
    if (match) {
      quickBank = pattern.bank
      const amountStr = match[match.length - 1].replace(/,/g, '')
      quickAmount = parseFloat(amountStr)
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
Respondé SOLO con JSON válido. Fecha hoy: ${today}. Moneda: GTQ (Q).
Categorías disponibles: ${ZAFI_CATEGORIES.join(', ')}.

Extraé de la notificación: monto, comercio/descripción, banco, categoría sugerida y nivel de confianza.

Formato de respuesta:
{"amount":150.00,"merchant":"Walmart","bank":"BAM","category":"Alimentación","confidence":0.9}

Si no podés extraer datos, respondé: {"amount":0,"merchant":"","bank":"","category":"","confidence":0}
Reglas:
- Si el texto menciona Apple Pay, Wallet o tarjeta Apple, el banco es "Apple Pay"
- Si menciona compra/pago/cargo, es un gasto
- Detectá el nombre del comercio cuando aparezca
- Asigná la categoría más probable`,
      messages: [{ role: 'user', content: `Notificación recibida:\n"${rawText}"` }],
    }),
  })

  if (!extractionResponse.ok) {
    // Fallback to regex result
    if (quickAmount && quickAmount > 0) {
      return NextResponse.json({
        amount: quickAmount,
        merchant: 'Gasto detectado',
        bank: quickBank,
        category: '',
        confidence: 0.5,
        rawText,
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

    return NextResponse.json({
      amount: result.amount,
      merchant: cleanTransactionName(result.merchant || ''),
      bank: result.bank || quickBank,
      category: result.category || '',
      categoryId,
      confidence: result.confidence || 0.7,
      rawText,
    })
  } catch {
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
    return NextResponse.json({ error: 'No se pudo interpretar la notificación' }, { status: 500 })
  }
}
