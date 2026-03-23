import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { buildZafiSystemPrompt } from '@/lib/ai-context'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic()

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

  const stream = await anthropic.messages.stream({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  let fullResponse = ''
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta') {
          fullResponse += chunk.delta.text
          controller.enqueue(encoder.encode(chunk.delta.text))
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
