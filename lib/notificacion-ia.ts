// Interpreta con IA el texto de un aviso del banco (SMS o notificación).
// Lo usan /api/parse-notification con sesión (pantalla Pegar notificación)
// y el modo automático de Android (C15). Solo servidor.

const ZAFI_CATEGORIES = [
  'Vivienda/alquiler', 'Alimentación', 'Transporte', 'Salud/medicinas', 'Servicios',
  'Educación', 'Restaurantes y salidas', 'Ropa', 'Entretenimiento', 'Suscripciones',
  'Varios personales', 'Fondo de emergencia', 'Ahorro para metas', 'Pago extra de deudas',
]

export interface ExtraccionIA {
  amount: number
  merchant?: string
  bank?: string
  category?: string
  confidence?: number
  currency?: string
  type?: string
}

export type ResultadoIA =
  | { status: 'ok'; result: ExtraccionIA }
  | { status: 'http_error' }
  | { status: 'parse_error' }

export async function extraerNotificacion(rawText: string, today: string): Promise<ResultadoIA> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { status: 'http_error' }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
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
  }).catch(() => null)

  if (!res?.ok) return { status: 'http_error' }
  try {
    const extraction = await res.json()
    const responseText = extraction.content[0].type === 'text' ? extraction.content[0].text : ''
    return { status: 'ok', result: JSON.parse(responseText.replace(/```json|```/g, '').trim()) as ExtraccionIA }
  } catch {
    return { status: 'parse_error' }
  }
}
