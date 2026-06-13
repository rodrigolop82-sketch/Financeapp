import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getUserHousehold } from '@/lib/household'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_PROMPT = `Eres un extractor de datos financieros experto en estados de cuenta de bancos guatemaltecos (Banrural, BAM, Banco Industrial, G&T Continental, Bantrab).

Analiza este estado de cuenta y extrae TODAS las transacciones que encuentres.

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin backticks, con esta estructura exacta:

{
  "bank": "nombre del banco detectado o 'Desconocido'",
  "period": "periodo del estado (ej: 'Mayo 2026') o null",
  "currency": "GTQ o USD",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "descripción original del movimiento",
      "amount": 450.00,
      "type": "expense",
      "suggested_category": "Supermercado"
    }
  ]
}

Reglas importantes:
- amount siempre positivo, el campo type indica si es "expense" o "income"
- Si no puedes leer claramente una transacción, omítela
- suggested_category debe ser una de: Vivienda/alquiler, Alimentación, Transporte, Salud/medicinas, Servicios, Educación, Restaurantes y salidas, Ropa, Entretenimiento, Suscripciones, Varios personales, Fondo de emergencia, Ahorro para metas, Pago extra de deudas, Ingreso, Transferencia, Otro
- Si el monto está en USD, conviértelo a GTQ usando tasa ~7.85 y marca currency como "USD_CONVERTED"
- Ordena por fecha descendente (más reciente primero)`

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

  // Build content blocks — use explicit any to avoid SDK type issues with document blocks
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

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: contentBlocks }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''

    if (!text) {
      return NextResponse.json({ error: 'Claude no devolvió texto' }, { status: 500 })
    }

    const clean = text.replace(/```json|```/g, '').trim()

    let result: { bank?: string; period?: string; currency?: string; transactions?: Array<{ suggested_category: string; description: string; date: string; amount: number; type: string }>; truncated?: boolean }
    try {
      result = JSON.parse(clean)
    } catch {
      console.error('Failed to parse Claude response:', clean.substring(0, 500))
      return NextResponse.json({ error: 'No pudimos interpretar la respuesta. Intenta con otra imagen.' }, { status: 500 })
    }

    // Enrich with category_id
    const { data: categories } = await supabase
      .from('budget_categories')
      .select('id, name')
      .eq('household_id', household.id)

    if (categories && result.transactions) {
      result.transactions = result.transactions.map((tx) => {
        const match = categories.find(c =>
          c.name.toLowerCase().includes(tx.suggested_category.toLowerCase()) ||
          tx.suggested_category.toLowerCase().includes(c.name.toLowerCase())
        )
        return { ...tx, category_id: match?.id ?? null }
      })
    }

    if (result.transactions && result.transactions.length > 200) {
      result.transactions = result.transactions.slice(0, 200)
      result.truncated = true
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Statement extraction error:', err)
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json(
      { error: `No pudimos leer el estado de cuenta: ${message}` },
      { status: 500 }
    )
  }
}
