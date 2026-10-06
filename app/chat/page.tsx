'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { VoiceButton } from '@/components/voice/VoiceButton'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PageSkeleton, SkeletonRows } from '@/components/motion/PageSkeleton'
import { UndoToast } from '@/components/transactions/UndoToast'
import { DELETE_UNDO_MS } from '@/lib/transactions/undo-delete'
import { BORDER, CARD_BG, TEXT_FAINT, TEXT_MUTED, TEXT_STRONG, TILE_BG } from '@/components/movimientos/ui'
import {
  Chevron, GroupTitle, HERO, HERO_MUTED, HERO_STYLE, LINK_TEXT, ListCard, PageHeader, ROW_DIVIDER, RowBody, Tile,
} from '@/components/layout/Pantalla'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Conversation {
  id: string
  title: string
  updated_at: string
}

const SUGGESTED_QUESTIONS: [emoji: string, text: string][] = [
  ['🐷', '¿Estoy ahorrando suficiente?'],
  ['💳', '¿Cómo salgo de mis deudas más rápido?'],
  ['🎁', '¿Qué hago con el aguinaldo?'],
  ['💸', '¿Qué hago con el dinero que me sobra este mes?'],
  ['🧘', '¿Cuándo puedo dejar de preocuparme por el dinero?'],
]

const NEW_TITLE = 'Nueva conversación'

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "Hace un momento", "Hace 2 horas", "Ayer", "Hace 1 semana" o "12 sep". */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Hace un momento'
  if (minutes < 60) return `Hace ${plural(minutes, 'minuto', 'minutos')}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${plural(hours, 'hora', 'horas')}`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 28) return `Hace ${plural(Math.floor(days / 7), 'semana', 'semanas')}`
  return new Date(dateStr).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' }).replace('.', '')
}

interface UsageData {
  plan: 'free' | 'premium' | 'family'
  ai: { used: number; limit: number | null; remaining: number | null }
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
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const [resetsAt, setResetsAt] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null)
  const pendingRef = useRef<Conversation | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setAuthChecked(true)
      await loadConversations()
      const usageRes = await fetch('/api/usage')
      if (usageRes.ok) {
        const ud = await usageRes.json()
        setUsage(ud)
        if (ud.plan === 'free' && ud.ai.remaining === 0) {
          setLimitReached(true)
        }
      }
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

  // Borrar espera al toast: si tocas Deshacer, la conversación vuelve.
  const commitDelete = useCallback(async (conv: Conversation) => {
    await fetch(`/api/chat/conversations?id=${conv.id}`, { method: 'DELETE' })
    setConversations(prev => prev.filter(c => c.id !== conv.id))
  }, [])

  function deleteConversation(conv: Conversation) {
    if (pendingRef.current) void commitDelete(pendingRef.current)
    pendingRef.current = conv
    setPendingDelete(conv)
    if (activeConversation?.id === conv.id) setActiveConversation(null)
  }

  const dismissDelete = useCallback(() => {
    const conv = pendingRef.current
    pendingRef.current = null
    setPendingDelete(null)
    if (conv) void commitDelete(conv)
  }, [commitDelete])

  function undoDelete() {
    pendingRef.current = null
    setPendingDelete(null)
  }

  /** Abre una conversación nueva y manda la pregunta. */
  function ask(text: string) {
    setActiveConversation(null)
    setMessages([])
    setView('chat')
    void sendMessage(text, true)
  }

  async function sendMessage(text: string, fresh = false) {
    if (!text.trim() || isStreaming) return

    const history = fresh ? [] : messages
    let convId = fresh ? undefined : activeConversation?.id

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
      if (activeConversation?.title === NEW_TITLE) {
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
          conversationHistory: history,
          conversationId: convId,
        }),
      })

      if (res.status === 402) {
        const errData = await res.json()
        setLimitReached(true)
        setResetsAt(errData.resetsAt)
        setUsage(prev => prev ? { ...prev, ai: { used: errData.used, limit: errData.limit, remaining: 0 } } : prev)
        setMessages(prev => prev.slice(0, -1))
        setIsStreaming(false)
        return
      }

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

      setUsage(prev => {
        if (!prev || prev.plan !== 'free') return prev
        const newUsed = (prev.ai.used ?? 0) + 1
        const limit = prev.ai.limit ?? 0
        return { ...prev, ai: { used: newUsed, limit: prev.ai.limit, remaining: Math.max(0, limit - newUsed) } }
      })
    } catch (err) {
      console.error('Error en chat:', err)
    } finally {
      setIsStreaming(false)
    }
  }

  if (!authChecked) {
    return <PageSkeleton variant="list" />
  }

  const free = usage?.plan === 'free' && usage.ai.limit !== null && usage.ai.remaining !== null
  const quota = free ? (
    <>Te quedan <b className={`font-outfit ${TEXT_STRONG}`}>{usage!.ai.remaining} de {usage!.ai.limit}</b> preguntas gratis este mes</>
  ) : null
  const visible = conversations.filter(c => c.id !== pendingDelete?.id)

  const undoToast = (
    <UndoToast
      key={pendingDelete?.id}
      visible={!!pendingDelete}
      title="Conversación borrada"
      subtitle={pendingDelete?.title}
      onUndo={undoDelete}
      onDismiss={dismissDelete}
      duration={DELETE_UNDO_MS}
    />
  )

  // Conversation list view
  if (view === 'list') {
    return (
      <AppShell title="Pregúntale a Zafi" currentPath="/chat" hideMobileBar>
        <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
          <PageHeader
            back={{ href: '/mas', label: 'Más' }}
            title="Pregúntale a Zafi"
            subtitle="Responde con tus números reales, no con consejos genéricos."
          />
          <p className={`hidden text-sm lg:block ${TEXT_MUTED}`}>Responde con tus números reales, no con consejos genéricos.</p>

          <div className="mt-3.5 flex flex-col gap-2">
            <button
              type="button"
              onClick={startNewConversation}
              className="h-[50px] rounded-full bg-electric text-[15px] font-bold text-white transition-transform duration-150 hover:bg-electric-dark active:scale-[0.97]"
            >
              + Nueva pregunta
            </button>
            {quota && <span className={`text-center text-[13px] ${TEXT_MUTED}`}>{quota}</span>}
          </div>

          <GroupTitle>Prueba con</GroupTitle>
          <ListCard>
            {SUGGESTED_QUESTIONS.map(([emoji, q]) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className={`flex min-h-[48px] w-full items-center gap-3 py-1.5 text-left ${ROW_DIVIDER}`}
              >
                <span aria-hidden className="flex-none text-lg">{emoji}</span>
                <span className={`flex-1 text-[15px] [text-wrap:pretty] ${TEXT_STRONG}`}>{q}</span>
                <Chevron />
              </button>
            ))}
          </ListCard>

          {(loadingConversations || visible.length > 0) && <GroupTitle>Tus conversaciones</GroupTitle>}
          {loadingConversations ? (
            <SkeletonRows count={3} />
          ) : visible.length > 0 && (
            <ListCard>
              {visible.map(conv => (
                <div key={conv.id} className={`flex items-center gap-3 py-3 ${ROW_DIVIDER}`}>
                  <button
                    type="button"
                    onClick={() => openConversation(conv)}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <RowBody tile={<Tile>💬</Tile>} name={conv.title} help={timeAgo(conv.updated_at)} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteConversation(conv)}
                    aria-label={`Borrar “${conv.title}”`}
                    className={`-mr-2.5 flex h-11 w-11 flex-none items-center justify-center text-base ${TEXT_FAINT}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </ListCard>
          )}
        </div>
        {undoToast}
      </AppShell>
    )
  }

  // Chat view
  return (
    <AppShell title="Pregúntale a Zafi" currentPath="/chat" hideMobileBar>
      <div className="mx-auto flex min-h-[calc(100dvh-180px)] max-w-2xl flex-col lg:mx-0">
        {/* Encabezado */}
        <div className={`-mx-4 flex flex-col items-start gap-0.5 border-b px-5 pb-2.5 pt-[env(safe-area-inset-top)] lg:mx-0 lg:px-0 ${BORDER}`}>
          <button
            type="button"
            onClick={() => { setView('list'); loadConversations() }}
            className={`flex h-11 items-center text-[15px] font-semibold ${LINK_TEXT}`}
          >
            ‹ Pregúntale a Zafi
          </button>
          <span className={`max-w-full truncate text-[17px] font-bold ${TEXT_STRONG}`}>
            {activeConversation?.title || NEW_TITLE}
          </span>
        </div>

        {/* Mensajes */}
        <div className="flex flex-1 flex-col gap-2.5 py-4">
          {messages.length === 0 && (
            <>
              <GroupTitle className="mb-1.5">Prueba con</GroupTitle>
              <ListCard>
                {SUGGESTED_QUESTIONS.map(([emoji, q]) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className={`flex min-h-[48px] w-full items-center gap-3 py-1.5 text-left ${ROW_DIVIDER}`}
                  >
                    <span aria-hidden className="flex-none text-lg">{emoji}</span>
                    <span className={`flex-1 text-[15px] [text-wrap:pretty] ${TEXT_STRONG}`}>{q}</span>
                    <Chevron />
                  </button>
                ))}
              </ListCard>
            </>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[84%] px-3.5 py-[11px] text-[15px] leading-[1.45] [text-wrap:pretty] ${
                  msg.role === 'user'
                    ? 'whitespace-pre-wrap rounded-[18px_18px_6px_18px] bg-electric text-white'
                    : `rounded-[18px_18px_18px_6px] border ${BORDER} ${CARD_BG} ${TEXT_STRONG}`
                }`}
              >
                {msg.content ? (
                  msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none text-[15px] leading-[1.45] text-inherit prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0
                      prose-headings:mb-1 prose-headings:mt-3 prose-headings:font-semibold prose-headings:text-inherit
                      prose-p:text-inherit prose-li:text-inherit prose-strong:text-inherit prose-a:text-electric-dark dark:prose-a:text-electric-soft
                      prose-blockquote:border-l-electric prose-blockquote:text-[var(--zafi-text-secondary)] prose-code:text-inherit">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content
                ) : (isStreaming && i === messages.length - 1
                  ? <span className="animate-pulse">…</span>
                  : '')}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Barra para escribir */}
        <div className={`sticky bottom-[calc(68px+env(safe-area-inset-bottom))] -mx-4 border-t px-3.5 pb-3 pt-2.5 lg:bottom-0 lg:mx-0 lg:rounded-t-2xl ${BORDER} ${CARD_BG}`}>
          {limitReached ? (
            <div className={`flex flex-col gap-1.5 p-5 ${HERO}`} style={HERO_STYLE}>
              <p className="text-base font-bold">Pregunta sin límites</p>
              <p className={`text-[13.5px] leading-[1.45] ${HERO_MUTED}`}>
                Con Premium puedes preguntarle a Zafi todas las veces que necesites.
                {resetsAt && ` Tus preguntas gratis se renuevan el ${new Date(resetsAt).toLocaleDateString('es-GT', { day: 'numeric', month: 'long' })}.`}
              </p>
              <button
                type="button"
                onClick={() => { window.location.href = '/planes?from=ia' }}
                className="mt-2 h-[46px] rounded-full bg-white text-[15px] font-bold text-navy transition-transform duration-150 active:scale-[0.97]"
              >
                Pasar a Premium
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <VoiceButton
                  mode="chat"
                  className={`h-11 w-11 flex-none rounded-full border-0 ${TILE_BG}`}
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
                  placeholder="Pregúntale algo a Zafi…"
                  aria-label="Tu pregunta"
                  disabled={isStreaming}
                  className={`h-11 min-w-0 flex-1 rounded-full border px-4 text-[15px] outline-none placeholder:text-[var(--zafi-text-secondary)] focus:border-electric ${BORDER} ${TILE_BG} ${TEXT_STRONG}`}
                />
                <button
                  type="button"
                  onClick={() => sendMessage(input)}
                  disabled={isStreaming || !input.trim()}
                  aria-label="Enviar"
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-electric text-lg font-bold text-white transition-transform duration-150 active:scale-[0.92] disabled:opacity-50"
                >
                  ↑
                </button>
              </div>
              {free && (
                <span className={`text-center text-[12.5px] ${TEXT_MUTED}`}>
                  Te quedan {usage!.ai.remaining} de {usage!.ai.limit} preguntas este mes
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {undoToast}
    </AppShell>
  )
}
