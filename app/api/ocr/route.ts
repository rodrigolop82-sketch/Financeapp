import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type || 'image/jpeg'

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Analiza esta imagen de un recibo, factura o comprobante de pago. Extrae la siguiente información en formato JSON estricto (sin texto adicional):

{
  "amount": <número total del gasto>,
  "merchant": "<nombre del comercio o establecimiento>",
  "date": "<fecha en formato YYYY-MM-DD si es visible, o null>",
  "items": "<resumen breve de los artículos o concepto>",
  "confidence": <número de 0 a 1 indicando qué tan seguro estás de la extracción>
}

Si no puedes identificar claramente algún campo, usa null. El monto es lo más importante.
Responde SOLO con el JSON, sin markdown ni explicación.`,
          },
        ],
      }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    return NextResponse.json(
      { error: 'Error al procesar imagen', details: errText },
      { status: 500 },
    )
  }

  const result = await response.json()
  const text = result.content?.[0]?.text || ''

  try {
    const parsed = JSON.parse(text)
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json(
      { error: 'No se pudo interpretar la respuesta', raw: text },
      { status: 422 },
    )
  }
}
