import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getUserHousehold } from '@/lib/household'
import { toGTQ } from '@/lib/currency'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const SYSTEM_PROMPT = `Eres un extractor de datos de estados de cuenta bancarios. Responde SIEMPRE y ÚNICAMENTE con JSON válido. Sin explicaciones, sin markdown, sin backticks. Solo el objeto JSON.`

const EXTRACTION_PROMPT = `Analiza este estado de cuenta y extrae TODAS las transacciones.

Responde con este JSON exacto (sin backticks, sin texto adicional):

{"bank":"nombre del banco o Desconocido","period":"Mayo 2026","currency":"GTQ","transactions":[{"date":"2026-05-15","description":"descripción","amount":450.00,"type":"expense","suggested_category":"Alimentación"}]}

suggested_category debe ser una de: Vivienda/alquiler, Alimentación, Transporte, Salud/medicinas, Servicios, Educación, Restaurantes y salidas, Ropa, Entretenimiento, Suscripciones, Varios personales, Fondo de emergencia, Ahorro para metas, Pago extra de deudas, Ingreso, Transferencia, Otro

Reglas:
- amount siempre positivo
- type: "expense" o "income"
- date formato YYYY-MM-DD
- Si no puedes leer una transacción, omítela
- Ordena por fecha descendente`

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const household = await getUserHousehold(supabase, user.id)
  if (!household) return NextResponse.json({ error: 'Sin hogar configurado' }, { status: 400 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'El archivo excede 10MB' }, { status: 400 })
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Formato no soportado. Usa JPG, PNG, WebP o PDF.' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const isPdf = file.type === 'application/pdf'

  // Build content blocks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentBlocks: any[] = []

  if (isPdf) {
    contentBlocks.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: base64,
      },
    })
  } else {
    contentBlocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: file.type,
        data: base64,
      },
    })
  }

  contentBlocks.push({ type: 'text', text: EXTRACTION_PROMPT })

  // Try to create the Anthropic client - handle missing API key
  let anthropic: Anthropic
  try {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  } catch (err) {
    console.error('Anthropic client init error:', err)
    return NextResponse.json({ error: 'Error de configuración del servicio de IA' }, { status: 500 })
  }

  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contentBlocks }],
    })
  } catch (err) {
    console.error('Anthropic API error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Error al llamar a Claude: ${message.substring(0, 200)}` },
      { status: 500 }
    )
  }

  const textBlock = response.content.find(b => b.type === 'text')
  const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''

  if (!text) {
    return NextResponse.json(
      { error: `Claude no devolvió texto. Stop reason: ${response.stop_reason}` },
      { status: 500 }
    )
  }

  console.log('Claude response (first 500 chars):', text.substring(0, 500))

  // Extract JSON robustly
  let jsonStr = text
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim()
  } else {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }
  }

  let result: {
    bank?: string
    period?: string
    currency?: string
    transactions?: Array<{
      suggested_category: string
      description: string
      date: string
      amount: number
      type: string
    }>
    truncated?: boolean
  }

  try {
    result = JSON.parse(jsonStr)
  } catch {
    console.error('JSON parse failed. Raw text:', text)
    return NextResponse.json(
      { error: `Claude respondió pero no con JSON válido. Respuesta: "${text.substring(0, 150)}..."` },
      { status: 500 }
    )
  }

  // Enrich with category_id
  const { data: categories } = await supabase
    .from('budget_categories')
    .select('id, name')
    .eq('household_id', household.id)

  const stmtCurrency = (result.currency || 'GTQ').toUpperCase()
  const isForex = stmtCurrency !== 'GTQ'

  if (categories && result.transactions) {
    result.transactions = result.transactions.map((tx) => {
      const match = categories.find(c =>
        c.name.toLowerCase().includes(tx.suggested_category.toLowerCase()) ||
        tx.suggested_category.toLowerCase().includes(c.name.toLowerCase())
      )
      return {
        ...tx,
        category_id: match?.id ?? null,
        original_amount: isForex ? tx.amount : null,
        original_currency: isForex ? stmtCurrency : null,
        amount: isForex ? toGTQ(tx.amount, stmtCurrency) : tx.amount,
      }
    })
  }

  if (result.transactions && result.transactions.length > 200) {
    result.transactions = result.transactions.slice(0, 200)
    result.truncated = true
  }

  return NextResponse.json(result)
}
