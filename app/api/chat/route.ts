import Anthropic from '@anthropic-ai/sdk'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { buildZafiSystemPrompt } from '@/lib/ai-context'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

  const messages: Anthropic.MessageParam[] = [
    ...(conversationHistory || []).slice(-10),
    { role: 'user', content: message },
  ]

  await supabase.from('chat_messages').insert({
    user_id: user.id,
    role: 'user',
    content: message,
    model_used: model,
  })

  let fullResponse = ''
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      const stream = anthropic.messages.stream({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      })

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          fullResponse += event.delta.text
          controller.enqueue(encoder.encode(event.delta.text))
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
