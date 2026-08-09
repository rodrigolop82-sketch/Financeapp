import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getUserHousehold } from '@/lib/household'
import { toGTQ } from '@/lib/currency'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300

function tryRepairJson(text: string): unknown | null {
  const cleaned = text.replace(/```json|```/g, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    // noop
  }

  let attempt = cleaned
  const openBrackets = (attempt.match(/\[/g) || []).length
  const closeBrackets = (attempt.match(/\]/g) || []).length
  const openBraces = (attempt.match(/\{/g) || []).length
  const closeBraces = (attempt.match(/\}/g) || []).length

  attempt = attempt.replace(/,\s*"[^"]*"?\s*:?\s*[^}\]]*$/, '')
  attempt = attempt.replace(/,\s*\{[^}]*$/, '')
  attempt = attempt.replace(/,\s*$/, '')

  for (let i = 0; i < openBrackets - closeBrackets; i++) attempt += ']'
  for (let i = 0; i < openBraces - closeBraces; i++) attempt += '}'

  try {
    return JSON.parse(attempt)
  } catch {
    return null
  }
}

const SYSTEM_PROMPT = `Eres un extractor de datos de estados de cuenta bancarios. Responde SIEMPRE y ÚNICAMENTE con JSON válido. Sin explicaciones, sin markdown, sin backticks. Solo el objeto JSON.`

const EXTRACTION_PROMPT = `Analiza este estado de cuenta y extrae TODAS las transacciones.

Responde con este JSON exacto (sin backticks, sin texto adicional):

{"bank":"nombre del banco o Desconocido","period":"Mayo 2026","currency":"GTQ","transactions":[{"date":"2026-05-15","description":"descripción","amount":450.00,"type":"expense","currency":"GTQ","suggested_category":"Alimentación"}]}

IMPORTANTE sobre monedas:
- El campo "currency" a nivel raíz es la moneda principal del estado de cuenta
- Cada transacción DEBE tener su propio campo "currency" (GTQ, USD, EUR, etc.)
- Si una transacción dice USD, US$, dólares, o tiene indicadores como "USA", "BILL USA", u otros indicadores de moneda extranjera, usa "USD"
- Si no hay indicador de moneda en la transacción, usa la moneda principal del estado de cuenta
- amount siempre en la moneda original de la transacción (NO convertir)

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
    return NextResponse.json({ error: 'No se pudo leer el archivo. Intentalo de nuevo.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se selecciono ningun archivo.' }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'El archivo es demasiado grande. El tamaño maximo permitido es 10MB.' }, { status: 400 })
  }

  const imageTypes = ['image/jpeg', 'image/png', 'image/webp']
  const pdfTypes = ['application/pdf', 'application/x-pdf']
  const allowedTypes = [...imageTypes, ...pdfTypes]
  const ext = file.name?.toLowerCase().split('.').pop()
  const isPdfByExt = ext === 'pdf'
  const isPdfByType = pdfTypes.includes(file.type)

  if (!allowedTypes.includes(file.type) && !isPdfByExt) {
    return NextResponse.json({ error: 'Formato no aceptado. Solo se permiten archivos JPG, PNG, WebP o PDF.' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const isPdf = isPdfByType || isPdfByExt

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
    return NextResponse.json({ error: 'Error en el servicio de analisis. Intentalo de nuevo mas tarde.' }, { status: 500 })
  }

  // Use streaming to avoid Vercel serverless timeout on large PDFs
  let text = ''
  let stopReason = ''
  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 16384,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contentBlocks }],
    })

    const finalMessage = await stream.finalMessage()
    stopReason = finalMessage.stop_reason || ''

    const textBlock = finalMessage.content.find(b => b.type === 'text')
    text = textBlock && textBlock.type === 'text' ? textBlock.text : ''
  } catch (err: unknown) {
    console.error('Anthropic API error:', err)
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('Could not process') || errMsg.includes('document') || errMsg.includes('invalid_request')) {
      return NextResponse.json(
        { error: 'No se pudo procesar este PDF. El archivo puede estar protegido, dañado o en un formato no compatible. Intenta con otro archivo o usa una captura de pantalla.' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Error al conectar con el servicio de analisis. Intentalo de nuevo en unos momentos.' },
      { status: 500 }
    )
  }

  const wasTruncated = stopReason === 'max_tokens'

  if (!text) {
    return NextResponse.json(
      { error: 'No se pudo leer el contenido del documento. Verifica que el archivo sea legible y vuelve a intentarlo.' },
      { status: 500 }
    )
  }

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

  type ParsedTransaction = {
    suggested_category: string
    description: string
    date: string
    amount: number
    type: string
    currency?: string
    category_id?: string | null
    original_amount?: number | null
    original_currency?: string | null
  }

  let result: {
    bank?: string
    period?: string
    currency?: string
    transactions?: ParsedTransaction[]
    truncated?: boolean
  }

  try {
    result = JSON.parse(jsonStr)
  } catch {
    const repaired = tryRepairJson(jsonStr)
    if (repaired && typeof repaired === 'object' && 'transactions' in (repaired as Record<string, unknown>)) {
      result = repaired as typeof result
      result.truncated = true
    } else {
      console.error('JSON parse failed. Truncated:', wasTruncated, 'Raw text:', text.substring(0, 300))
      return NextResponse.json(
        { error: 'Error al procesar los datos del estado de cuenta. El documento puede tener un formato no compatible. Intenta con otro archivo.' },
        { status: 500 }
      )
    }
  }

  if (wasTruncated && !result.truncated) {
    result.truncated = true
  }

  // Enrich with category_id
  const { data: categories } = await supabase
    .from('budget_categories')
    .select('id, name')
    .eq('household_id', household.id)

  const stmtCurrency = (result.currency || 'GTQ').toUpperCase()

  if (categories && result.transactions) {
    result.transactions = result.transactions.map((tx) => {
      const match = categories.find(c =>
        c.name.toLowerCase().includes(tx.suggested_category.toLowerCase()) ||
        tx.suggested_category.toLowerCase().includes(c.name.toLowerCase())
      )
      const txCurrency = (tx.currency || stmtCurrency).toUpperCase()
      const isForex = txCurrency !== 'GTQ'
      return {
        ...tx,
        category_id: match?.id ?? null,
        original_amount: isForex ? tx.amount : null,
        original_currency: isForex ? txCurrency : null,
        amount: isForex ? toGTQ(tx.amount, txCurrency) : tx.amount,
      }
    })
  }

  if (result.transactions && result.transactions.length > 200) {
    result.transactions = result.transactions.slice(0, 200)
    result.truncated = true
  }

  return NextResponse.json(result)
}
