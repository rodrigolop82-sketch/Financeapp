import { createServerSupabaseClient } from '@/lib/supabase-server'
import { localToday, localDaysAgo } from '@/lib/dates'
import { cleanTransactionName } from '@/lib/format'
import { getUserHousehold } from '@/lib/household'
import { toGTQ } from '@/lib/currency'
import { NextRequest, NextResponse } from 'next/server'

const ZAFI_CATEGORIES = [
  'Vivienda/alquiler', 'Alimentación', 'Transporte', 'Salud/medicinas', 'Servicios',
  'Educación', 'Restaurantes y salidas', 'Ropa', 'Entretenimiento', 'Suscripciones',
  'Varios personales', 'Fondo de emergencia', 'Ahorro para metas', 'Pago extra de deudas',
]

const SMS_SYSTEM_PROMPT = (today: string, yesterday: string, expenseCategories: string, incomeCategories: string) => `
Eres un extractor de transacciones financieras para Guatemala. Analizas dos tipos de texto:
1. Mensajes SMS de bancos, notificaciones de Apple Pay, Google Pay y alertas de tarjetas de crédito/débito.
2. Frases informales que la persona escribe a mano, como se lo diría a alguien ("uber 38", "me pagaron 8500").

Fecha hoy: ${today}. Ayer fue ${yesterday}. Moneda principal: GTQ (Q).

Patrones comunes que debes reconocer como GASTO (type: "expense"):
- Bancos Guatemala: "Compra aprobada por Q250.00 en WALMART", "VISA: Compra por Q125.00 en AMAZON", "Alerta: Q350.00 en PRICEMART el 19/04/2026"
- Apple Pay: "Apple Pay: Q89.50 at Starbucks", "Apple Pay charged $25.00 at Amazon"
- Google Pay: "Pagaste Q200.00 a Uber con Google Pay", "Google Pay: paid Q150.00"
- Débito/Crédito: "Su tarjeta fue utilizada por Q450.00 en TIKAL FUTURA"
- También acepta montos en USD ($), EUR (€) o MXN. Devuelve el monto original y la moneda detectada.

Patrones comunes que debes reconocer como INGRESO (type: "income") — dinero que ENTRA a la cuenta, no que sale:
- "Depósito recibido por Q3,500.00", "Se ha abonado Q500.00 a su cuenta", "Abono a su cuenta por Q2,000.00"
- "Transferencia recibida de Q1,200.00", "Ha recibido una transferencia por Q800.00"
- "Su salario ha sido depositado", "Depósito de nómina por Q8,000.00"
- Cualquier mensaje de "depósito", "abono", "transferencia recibida", "acreditado" donde el dinero entra a la cuenta del usuario (no una compra/pago/cargo)

Frases informales (sin "Q", sin formato de banco). Ejemplos:
- "uber 38" → gasto de 38, descripción "Uber", categoría de transporte, payment_method "efectivo"
- "super la torre 342.50 con tarjeta" → gasto de 342.50, descripción "Super La Torre", categoría de alimentación/supermercado, payment_method "tarjeta"
- "me pagaron 8500" o "salario 8500" → ingreso de 8500, descripción "Salario"
- "ayer farmacia 125" → gasto de 125 con fecha ${yesterday}, descripción "Farmacia", categoría de salud
- "netflix 99 transferencia" → gasto de 99, payment_method "transferencia"
- Un número suelto sin contexto ("45") es un gasto con descripción vacía.

Categorías de gasto disponibles: ${expenseCategories}
Categorías de ingreso disponibles: ${incomeCategories}

Reglas:
- Extrae siempre: monto (número), comercio/descripción (corta, con mayúscula inicial), fecha (si no hay, usa hoy; "ayer" es ${yesterday}), categoría (usa exactamente uno de los nombres de la lista que corresponda al tipo; si ninguno aplica, déjala vacía), currency (código ISO: GTQ, USD, EUR, MXN — default GTQ), type ("expense" o "income") y payment_method ("efectivo", "tarjeta", "transferencia" o "cheque"; default "efectivo"; SMS de tarjeta, Apple Pay o Google Pay son "tarjeta")
- Un cargo, compra, pago o débito es SIEMPRE type:"expense". Un depósito, abono, transferencia recibida, salario o "me pagaron" es SIEMPRE type:"income". Ante la duda, usa "expense".
- Si hay múltiples transacciones en un solo texto, extrae todas
- Ignora saldos disponibles, números de tarjeta y datos que no sean el movimiento en sí
- Si el texto NO describe un movimiento de dinero (ej: SMS de código de verificación), devuelve transactions:[]
- Si entiendes el movimiento pero no hay monto, devuélvelo con amount 0.

Responde SOLO con JSON válido, sin texto adicional:
{"transactions":[{"amount":250,"description":"Walmart","category":"Alimentación","date":"${today}","confidence":0.95,"currency":"GTQ","type":"expense","payment_method":"tarjeta"}],"raw_text":"...","ambiguous":false,"clarification":null}
`.trim()

const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia', 'cheque'] as const

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const text = (body.text as string)?.trim()
  if (!text) return NextResponse.json({ error: 'Texto requerido' }, { status: 400 })

  const today = localToday()
  const yesterday = localDaysAgo(1)

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
  }

  // Las categorías reales del hogar guían al modelo y luego se usan para
  // resolver category_id.
  const household = await getUserHousehold(supabase, user.id)
  let categories: { id: string; name: string; bucket: string }[] = []
  if (household) {
    const { data } = await supabase
      .from('budget_categories')
      .select('id, name, bucket')
      .eq('household_id', household.id)
      .is('archived_at', null)
    categories = data ?? []
  }
  const expenseNames = categories.filter((c) => c.bucket !== 'income').map((c) => c.name)
  const incomeNames = categories.filter((c) => c.bucket === 'income').map((c) => c.name)

  // Call Claude to extract transactions from the text
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
      system: SMS_SYSTEM_PROMPT(
        today,
        yesterday,
        (expenseNames.length > 0 ? expenseNames : ZAFI_CATEGORIES).join(', '),
        (incomeNames.length > 0 ? incomeNames : ['Salario', 'Otros ingresos']).join(', '),
      ),
      messages: [{ role: 'user', content: `Texto recibido:\n"${text}"` }],
    }),
  })

  if (!extractionResponse.ok) {
    const errText = await extractionResponse.text()
    console.error('Claude SMS parse error:', extractionResponse.status, errText)
    return NextResponse.json({ error: 'Error al interpretar el mensaje. Intenta de nuevo.' }, { status: 500 })
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
    return NextResponse.json({ error: 'No se pudo interpretar el mensaje. Intenta escribirlo de otra forma.' }, { status: 500 })
  }

  if (Array.isArray(result.transactions)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.transactions = result.transactions.map((tx: any) => {
      const type = tx.type === 'income' ? 'income' : 'expense'
      const wanted = norm(String(tx.category ?? ''))
      const pool = categories.filter((c) => (type === 'income') === (c.bucket === 'income'))
      const match = wanted
        ? pool.find((c) => norm(c.name) === wanted) ??
          pool.find((c) => norm(c.name).includes(wanted) || wanted.includes(norm(c.name)))
        : undefined
      const currency = (tx.currency || 'GTQ').toUpperCase()
      const isForex = currency !== 'GTQ'
      const amount = Number(tx.amount) || 0
      const pm = String(tx.payment_method ?? '').toLowerCase()
      return {
        ...tx,
        category: match?.name ?? tx.category ?? '',
        category_id: match?.id,
        description: cleanTransactionName(tx.description || ''),
        original_amount: isForex ? amount : null,
        original_currency: isForex ? currency : null,
        amount: isForex ? toGTQ(amount, currency) : amount,
        type,
        payment_method: (PAYMENT_METHODS as readonly string[]).includes(pm) ? pm : 'efectivo',
        date: tx.date || today,
      }
    })
  }

  if (!result.transactions || result.transactions.length === 0) {
    return NextResponse.json({
      transactions: [],
      raw_text: text,
      ambiguous: false,
      clarification: 'No entendí un movimiento en ese texto. Prueba con algo como “uber 38”.',
    })
  }

  return NextResponse.json(result)
}
