'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { VoiceButton } from '@/components/voice/VoiceButton'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_QUESTIONS = [
  '¿Qué hago con el dinero que me sobra este mes?',
  '¿Cómo salgo de mis deudas más rápido?',
  '¿Estoy ahorrando suficiente?',
  '¿Cuándo puedo dejar de preocuparme por el dinero?',
  '¿Qué pasa si viene el aguinaldo?',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setAuthChecked(true)
    }
    checkAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return

    const userMessage: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: messages,
        }),
      })

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      }
    } catch (err) {
      console.error('Error en chat:', err)
    } finally {
      setIsStreaming(false)
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center">
          <span className="text-white text-sm font-bold">Z</span>
        </div>
        <div>
          <p className="font-medium text-sm">Zafi</p>
          <p className="text-xs text-muted-foreground">Tu planner financiero personal</p>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center py-4">
              Preguntame lo que quieras sobre tus finanzas
            </p>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => sendMessage(q)}
                className="w-full text-left text-sm px-4 py-3 rounded-xl border border-border
                           hover:border-[#93C5FD] hover:bg-[#F8F9FF] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed
              ${msg.role === 'user'
                ? 'bg-[#2563EB] text-white rounded-br-sm'
                : 'bg-secondary text-foreground rounded-bl-sm'
              }`}>
              {msg.content || (isStreaming && i === messages.length - 1
                ? <span className="animate-pulse">...</span>
                : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <VoiceButton
            mode="chat"
            onTranscription={(text) => {
              setInput(text)
              sendMessage(text)
            }}
            onError={() => {}}
          />
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Preguntale algo a Zafi..."
            disabled={isStreaming}
            className="flex-1 px-4 py-2.5 rounded-xl border text-sm
                       focus:outline-none focus:border-[#3B82F6]"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm
                       disabled:opacity-40 hover:bg-[#1E3A5F] transition-colors"
          >
            Enviar
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Zafi conoce tu situación financiera real y responde en base a ella.
        </p>
      </div>
    </div>
  )
}
