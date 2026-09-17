import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { localToday } from '@/lib/dates'
import { cleanTransactionName } from '@/lib/format'
import { getUserHousehold } from '@/lib/household'
import { toGTQ } from '@/lib/currency'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FALLBACK_CATEGORIES = [
  'Vivienda/alquiler', 'Alimentación', 'Transporte', 'Salud/medicinas', 'Servicios',
  'Educación', 'Restaurantes y salidas', 'Ropa', 'Entretenimiento', 'Suscripciones',
  'Varios personales', 'Fondo de emergencia', 'Ahorro para metas', 'Pago extra de deudas',
]

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const formData = await req.formData()
  const audioBlob = formData.get('audio') as File
  const mode = (formData.get('mode') as string) ?? 'expense'
  if (!audioBlob) return NextResponse.json({ error: 'Audio requerido' }, { status: 400 })

  // Paso 1: Whisper transcription via fetch
  let transcription: string
  try {
    const whisperForm = new FormData()
    whisperForm.append('file', audioBlob, 'recording.webm')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'es')
    whisperForm.append('prompt', 'Quetzales, gasté, pagué, compré, almuerzo, gasolina, supermercado, farmacia, luz, agua, internet')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: whisperForm,
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.text()
      console.error('Whisper error:', whisperRes.status, err)
      return NextResponse.json({ error: `Error al transcribir audio: ${err}` }, { status: 500 })
    }

    const whisperData = await whisperRes.json()
    transcription = (whisperData.text || '').trim()
  } catch {
    return NextResponse.json({ error: 'Error al transcribir audio' }, { status: 500 })
  }

  if (!transcription) {
    return NextResponse.json({ error: 'No se detectó voz. Intentá de nuevo.' }, { status: 400 })
  }

  // If chat mode, just return the transcription
  if (mode === 'chat') {
    return NextResponse.json({ transcription })
  }

  // Paso 2: Claude extrae transacciones
  const today = localToday()

  // Query the user's actual categories (including custom ones) for the extraction prompt
  let categoryNames = FALLBACK_CATEGORIES
  const household = await getUserHousehold(supabase, user.id)

  if (household) {
    const { data: userCategories } = await supabase
      .from('budget_categories')
      .select('id, name, bucket')
      .eq('household_id', household.id)

    if (userCategories && userCategories.length > 0) {
      categoryNames = userCategories.map((c: { name: string }) => c.name)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any
  try {
    const extraction = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `Extractor de transacciones financieras para Guatemala. Respondé SOLO con JSON válido. Fecha hoy: ${today}. Moneda principal: GTQ (Q). Si el usuario menciona dólares, USD, euros o pesos mexicanos, devolvé "currency" con el código ISO (USD, EUR, MXN). Si no especifica moneda, usá "GTQ". Categorías: ${categoryNames.join(', ')}. Reglas: fechas relativas a hoy, montos siempre en números, múltiples gastos = múltiples transacciones. Formato: {"transactions":[{"amount":85,"description":"almuerzo","category":"Restaurantes y salidas","date":"${today}","confidence":0.95,"currency":"GTQ"}],"raw_text":"...","ambiguous":false,"clarification":null}`,
      messages: [{ role: 'user', content: `Texto dictado: "${transcription}"` }],
    })

    const text = extraction.content[0].type === 'text' ? extraction.content[0].text : ''
    result = JSON.parse(text.replace(/```json|```/g, '').trim())
    result.raw_text = transcription
  } catch (err) {
    console.error('Claude extraction error:', err)
    return NextResponse.json({ error: 'Error al extraer datos. Intentá de nuevo.' }, { status: 500 })
  }

  // Paso 3: Enriquecer con category_id del household del usuario
  if (household) {
    const { data: categories } = await supabase
      .from('budget_categories')
      .select('id, name')
      .eq('household_id', household.id)

    if (categories && result.transactions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.transactions = result.transactions.map((tx: any) => {
        const match = categories.find(c =>
          c.name.toLowerCase().includes(tx.category.toLowerCase()) ||
          tx.category.toLowerCase().includes(c.name.toLowerCase())
        )
        const currency = (tx.currency || 'GTQ').toUpperCase()
        const isForex = currency !== 'GTQ'
        return {
          ...tx,
          category_id: match?.id,
          description: cleanTransactionName(tx.description || ''),
          original_amount: isForex ? tx.amount : null,
          original_currency: isForex ? currency : null,
          amount: isForex ? toGTQ(tx.amount, currency) : tx.amount,
        }
      })
    }
  }

  // If no transactions were extracted, include transcription for debugging
  if (!result.transactions || result.transactions.length === 0) {
    return NextResponse.json({
      transactions: [],
      raw_text: transcription,
      ambiguous: false,
      clarification: `Whisper escuchó: "${transcription}" pero no se detectaron gastos. Intentá ser más específico, por ejemplo: "gasté 100 quetzales en gasolina".`,
    })
  }

  return NextResponse.json(result)
}
