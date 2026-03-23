import { createServerSupabaseClient } from '@/lib/supabase-server'
import { buildZafiSystemPrompt } from '@/lib/ai-context'
import { NextRequest, NextResponse } from 'next/server'

function requiresDeepAnalysis(message: string): boolean {
  const deepKeywords = [
    'plan', 'estrategia', 'cuándo', 'simula', 'proyecta',
    'inversión', 'invertir', 'jubilación', 'comprar', 'conviene',
    'comparar', 'diferencia', 'ayudame a decidir',
  ]
  return deepKeywords.some(k => message.toLowerCase().includes(k))
}

export async function POST(req: NextRequest) {
  const { message, conversationHistory } = await req.json()

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const systemPrompt = await buildZafiSystemPrompt(user.id, supabase)

  const model = requiresDeepAnalysis(message)
    ? 'claude-sonnet-4-6'
    : 'claude-haiku-4-5-20251001'

  const messages = [
    ...(conversationHistory || []).slice(-10),
    { role: 'user' as const, content: message },
  ]

  await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'user',
    content: message,
    model_used: model,
  })

  const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  })

  if (!apiResponse.ok || !apiResponse.body) {
    const errorText = await apiResponse.text()
    return NextResponse.json(
      { error: 'Error al contactar la API de Anthropic', details: errorText },
      { status: apiResponse.status }
    )
  }

  let fullResponse = ''
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const readable = new ReadableStream({
    async start(controller) {
      const reader = apiResponse.body!.getReader()

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'content_block_delta' &&
                parsed.delta?.type === 'text_delta') {
              fullResponse += parsed.delta.text
              controller.enqueue(encoder.encode(parsed.delta.text))
            }
          } catch {
            // skip non-JSON lines
          }
        }
      }

      await supabase.from('chat_messages').insert({
        user_id: user.id,
        role: 'assistant',
        content: fullResponse,
        model_used: model,
      })

      controller.close()
    },
  })

  return new NextResponse(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
