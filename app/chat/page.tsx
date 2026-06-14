'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { VoiceButton } from '@/components/voice/VoiceButton'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkAuthAndLoadHistory() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setAuthChecked(true)

      const { data } = await supabase
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100)

      if (data && data.length > 0) {
        setMessages(data.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })))
      }
      setHistoryLoaded(true)
    }
    checkAuthAndLoadHistory()
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
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-electric-light animate-spin" />
      </div>
    )
  }

  return (
    <AppShell title="Zafi AI" currentPath="/chat">
      <div className="flex flex-col h-[calc(100vh-64px)] max-w-2xl mx-auto">
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
                           hover:border-electric-soft hover:bg-surface-tint transition-colors"
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
                ? 'bg-electric text-white rounded-br-sm whitespace-pre-wrap'
                : 'bg-secondary text-foreground rounded-bl-sm'
              }`}>
              {msg.content ? (
                msg.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0
                    prose-headings:text-navy prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
                    prose-strong:text-navy prose-p:text-foreground prose-li:text-foreground
                    prose-a:text-electric prose-blockquote:border-l-electric prose-blockquote:text-muted-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content
              ) : (isStreaming && i === messages.length - 1
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
                       focus:outline-none focus:border-electric-light"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2.5 bg-electric text-white rounded-xl text-sm
                       disabled:opacity-40 hover:bg-navy transition-colors"
          >
            Enviar
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Zafi conoce tu situación financiera real y responde en base a ella.
        </p>
      </div>
      </div>
    </AppShell>
  )
}
