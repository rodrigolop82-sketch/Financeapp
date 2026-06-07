import { createServerSupabaseClient } from '@/lib/supabase-server'
import { localToday } from '@/lib/dates'
import { cleanTransactionName } from '@/lib/format'
import { getUserHousehold } from '@/lib/household'
import { NextRequest, NextResponse } from 'next/server'

const ZAFI_CATEGORIES = [
  'Vivienda/alquiler', 'Alimentación', 'Transporte', 'Salud/medicinas', 'Servicios',
  'Educación', 'Restaurantes y salidas', 'Ropa', 'Entretenimiento', 'Suscripciones',
  'Varios personales', 'Fondo de emergencia', 'Ahorro para metas', 'Pago extra de deudas',
]

const SMS_SYSTEM_PROMPT = (today: string, categories: string) => `
Eres un extractor de transacciones financieras para Guatemala. Analizás mensajes de texto SMS de bancos, notificaciones de Apple Pay, Google Pay y alertas de tarjetas de crédito/débito.

Fecha hoy: ${today}. Moneda principal: GTQ (Q).

Patrones comunes que debes reconocer:
- Bancos Guatemala: "Compra aprobada por Q250.00 en WALMART", "VISA: Compra por Q125.00 en AMAZON", "Alerta: Q350.00 en PRICEMART el 19/04/2026"
- Apple Pay: "Apple Pay: Q89.50 at Starbucks", "Apple Pay charged $25.00 at Amazon"
- Google Pay: "Pagaste Q200.00 a Uber con Google Pay", "Google Pay: paid Q150.00"
- Débito/Crédito: "Su tarjeta fue utilizada por Q450.00 en TIKAL FUTURA"
- También acepta montos en USD ($) — convertílos a GTQ multiplicando por 7.8

Categorías disponibles: ${categories}

Reglas:
- Extraé siempre: monto (número), comercio/descripción, fecha (si no hay, usá hoy), categoría
- Si hay múltiples transacciones en un solo texto, extraé todas
- Ignorá saldos disponibles, números de tarjeta y datos que no sean el gasto en sí
- Si el texto NO es una notificación de gasto (ej: SMS de código de verificación), retorná transactions:[]

Respondé SOLO con JSON válido, sin texto adicional:
{"transactions":[{"amount":250,"description":"Walmart","category":"Alimentación","date":"${today}","confidence":0.95}],"raw_text":"...","ambiguous":false,"clarification":null}
`.trim()

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const text = (body.text as string)?.trim()
  if (!text) return NextResponse.json({ error: 'Texto requerido' }, { status: 400 })

  const today = localToday()

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
  }

  // Call Claude to extract transactions from the SMS text
  const extractionResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SMS_SYSTEM_PROMPT(today, ZAFI_CATEGORIES.join(', ')),
      messages: [{ role: 'user', content: `Mensaje recibido:\n"${text}"` }],
    }),
  })

  if (!extractionResponse.ok) {
    const errText = await extractionResponse.text()
    console.error('Claude SMS parse error:', extractionResponse.status, errText)
    return NextResponse.json({ error: 'Error al interpretar el mensaje. Intentá de nuevo.' }, { status: 500 })
  }

  const extraction = await extractionResponse.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any
  try {
    const raw = extraction.content[0].type === 'text' ? extraction.content[0].text : ''
    result = JSON.parse(raw.replace(/```json|```/g, '').trim())
    result.raw_text = text
  } catch {
    console.error('JSON parse error from Claude:', extraction.content?.[0]?.text)
    return NextResponse.json({ error: 'No se pudo interpretar el mensaje. Verificá que sea una notificación de gasto.' }, { status: 500 })
  }

  // Enrich with household category_id
  const household = await getUserHousehold(supabase, user.id)
  if (household) {
    const { data: categories } = await supabase
      .from('budget_categories')
      .select('id, name')
      .eq('household_id', household.id)

    if (categories && result.transactions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.transactions = result.transactions.map((tx: any) => {
        const match = categories.find((c) =>
          c.name.toLowerCase().includes(tx.category.toLowerCase()) ||
          tx.category.toLowerCase().includes(c.name.toLowerCase())
        )
        return { ...tx, category_id: match?.id, description: cleanTransactionName(tx.description || '') }
      })
    }
  }

  if (!result.transactions || result.transactions.length === 0) {
    return NextResponse.json({
      transactions: [],
      raw_text: text,
      ambiguous: false,
      clarification: 'No se detectó ningún gasto en el mensaje. Aseguráte de pegar una notificación de compra de tu banco o billetera digital.',
    })
  }

  return NextResponse.json(result)
}
