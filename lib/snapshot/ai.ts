// Llamada a la API de Claude para el comentario semanal (Premium). Solo
// servidor. Cualquier error ⇒ null y la pantalla usa la observación
// determinista (nunca una pantalla de error).

import Anthropic from '@anthropic-ai/sdk'
import { buildSnapshotPrompt, validateCommentary } from './prompt'
import type { WeeklySnapshot } from './weekly'

const MODEL = 'claude-haiku-5-5'

export async function generateSnapshotCommentary(s: WeeklySnapshot): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 1 })
    const { system, user } = buildSnapshotPrompt(s)
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: user }],
    })
    if (response.stop_reason !== 'end_turn') return null
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    return validateCommentary(text, s)
  } catch (e) {
    console.warn('[snapshot/ai] Sin comentario de IA', e instanceof Anthropic.APIError ? e.status : 'error')
    return null
  }
}
