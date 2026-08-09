'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Loader2, Plus, ArrowLeft, Trash2, MessageSquare } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { VoiceButton } from '@/components/voice/VoiceButton'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Conversation {
  id: string
  title: string
  updated_at: string
}

const SUGGESTED_QUESTIONS = [
  '¿Qué hago con el dinero que me sobra este mes?',
  '¿Cómo salgo de mis deudas más rápido?',
  '¿Estoy ahorrando suficiente?',
  '¿Cuándo puedo dejar de preocuparme por el dinero?',
  '¿Qué pasa si viene el aguinaldo?',
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Ahora'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [view, setView] = useState<'list' | 'chat'>('list')
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setAuthChecked(true)
      await loadConversations()
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadConversations() {
    setLoadingConversations(true)
    const res = await fetch('/api/chat/conversations')
    if (res.ok) {
      const data = await res.json()
      setConversations(data)
    }
    setLoadingConversations(false)
  }

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (data) {
      setMessages(data.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })))
    }
  }, [supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function openConversation(conv: Conversation) {
    setActiveConversation(conv)
    setMessages([])
    setView('chat')
    await loadMessages(conv.id)
  }

  async function startNewConversation() {
    const res = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) {
      const conv = await res.json()
      setActiveConversation(conv)
      setMessages([])
      setView('chat')
      setConversations(prev => [conv, ...prev])
    }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/chat/conversations?id=${id}`, { method: 'DELETE' })
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeConversation?.id === id) {
      setActiveConversation(null)
      setView('list')
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return

    let convId = activeConversation?.id

    // Auto-create conversation if none active
    if (!convId) {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: text.slice(0, 60) }),
      })
      if (res.ok) {
        const conv = await res.json()
        convId = conv.id
        setActiveConversation(conv)
        setConversations(prev => [conv, ...prev])
      }
    } else if (messages.length === 0) {
      // Update title to first message if it's still default
      if (activeConversation?.title === 'Nueva conversación') {
        const newTitle = text.slice(0, 60)
        await supabase
          .from('chat_conversations')
          .update({ title: newTitle })
          .eq('id', convId)
        setActiveConversation(prev => prev ? { ...prev, title: newTitle } : prev)
        setConversations(prev =>
          prev.map(c => c.id === convId ? { ...c, title: newTitle } : c)
        )
      }
    }

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
          conversationId: convId,
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

  // Conversation list view
  if (view === 'list') {
    return (
      <AppShell title="Zafi AI" currentPath="/chat">
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* Header with new chat button — only when conversations exist */}
          {conversations.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 14, color: '#8B9AAE' }}>
                {conversations.length} conversación{conversations.length !== 1 ? 'es' : ''}
              </p>
              <button
                onClick={startNewConversation}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#2563EB', color: '#fff',
                  border: 'none', borderRadius: 10, padding: '10px 18px',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Plus size={16} strokeWidth={2.5} />
                Nueva conversación
              </button>
            </div>
          )}

          {loadingConversations ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <Loader2 className="w-8 h-8 text-electric animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#EFF6FF', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <MessageSquare size={28} style={{ color: '#2563EB' }} />
              </div>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#1E3A5F', marginBottom: 6 }}>
                No tenés conversaciones aún
              </p>
              <p style={{ fontSize: 14, color: '#8B9AAE', lineHeight: 1.5, marginBottom: 20 }}>
                Preguntale a Zafi sobre tus finanzas — te conoce y responde en base a tu situación real.
              </p>
              <button
                onClick={startNewConversation}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: '#2563EB', color: '#fff',
                  border: 'none', borderRadius: 12, padding: '14px 28px',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
                }}
              >
                <Plus size={18} strokeWidth={2.5} />
                Iniciar conversación
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: '#fff', border: '1px solid #E2E8F0',
                    borderRadius: 14, padding: '16px 18px',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'border-color 150ms',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: '#EFF6FF', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <MessageSquare size={18} color="#2563EB" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 14, fontWeight: 600, color: '#1E3A5F',
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {conv.title}
                    </p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: '3px 0 0' }}>
                      {timeAgo(conv.updated_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conv.id, e)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 6, borderRadius: 8, color: '#94A3B8',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </button>
              ))}
            </div>
          )}

          <div className="h-24" />
        </div>
      </AppShell>
    )
  }

  // Chat view
  return (
    <AppShell title="Zafi AI" currentPath="/chat">
      <div className="flex flex-col h-[calc(100vh-64px)] max-w-2xl mx-auto">
        {/* Chat header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 0 12px', borderBottom: '1px solid #E2E8F0',
          marginBottom: 8,
        }}>
          <button
            onClick={() => { setView('list'); loadConversations() }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, color: '#2563EB', display: 'flex',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <p style={{
            fontSize: 15, fontWeight: 600, color: '#1E3A5F',
            margin: 0, flex: 1, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {activeConversation?.title || 'Nueva conversación'}
          </p>
        </div>

        {/* Messages */}
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
