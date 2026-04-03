'use client'

import { useEffect, useState } from 'react'
import { useParams, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Clock, Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface CapsuleData {
  id: string
  title: string
  subtitle: string | null
  content_md: string
  key_takeaway: string | null
  read_time_minutes: number
  module_title: string
  module_slug: string
  module_color: string
}

export default function CapsulePage() {
  const params = useParams()
  const slug = params.slug as string
  const moduleSlug = params.module as string
  const [capsule, setCapsule] = useState<CapsuleData | null>(null)
  const [bookmarked, setBookmarked] = useState(false)
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ReactMarkdown, setReactMarkdown] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [remarkGfm, setRemarkGfm] = useState<any>(null)

  useEffect(() => {
    import('react-markdown').then(mod => setReactMarkdown(() => mod.default))
    import('remark-gfm').then(mod => setRemarkGfm(() => mod.default))
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { data } = await supabase
        .from('capsules')
        .select('*, capsule_modules!inner(title, slug, color)')
        .eq('slug', slug)
        .single()

      if (!data) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = data.capsule_modules as any
      setCapsule({
        id: data.id,
        title: data.title,
        subtitle: data.subtitle,
        content_md: data.content_md,
        key_takeaway: data.key_takeaway,
        read_time_minutes: data.read_time_minutes,
        module_title: mod.title,
        module_slug: mod.slug,
        module_color: mod.color,
      })

      // Mark as read + check bookmark
      if (user) {
        await supabase.from('user_capsule_progress')
          .upsert(
            { user_id: user.id, capsule_id: data.id },
            { onConflict: 'user_id,capsule_id' }
          )

        const { data: progress } = await supabase
          .from('user_capsule_progress')
          .select('bookmarked')
          .eq('user_id', user.id)
          .eq('capsule_id', data.id)
          .single()

        setBookmarked(progress?.bookmarked ?? false)
      }

      setLoading(false)
    }
    load()
  }, [slug])

  const toggleBookmark = async () => {
    if (!capsule) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const newVal = !bookmarked
    setBookmarked(newVal)
    await supabase.from('user_capsule_progress')
      .update({ bookmarked: newVal })
      .eq('user_id', user.id)
      .eq('capsule_id', capsule.id)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-electric-light animate-spin" />
      </div>
    )
  }

  if (!capsule) return notFound()

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Navigation */}
      <div className="mb-2 flex items-center justify-between">
        <Link
          href={`/aprende/${moduleSlug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          {capsule.module_title}
        </Link>
        <button
          onClick={toggleBookmark}
          className="text-muted-foreground hover:text-electric transition-colors"
          title={bookmarked ? 'Quitar marcador' : 'Guardar'}
        >
          {bookmarked ? (
            <BookmarkCheck className="w-5 h-5 text-electric" />
          ) : (
            <Bookmark className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-medium mb-2" style={{ color: capsule.module_color }}>
          {capsule.module_title}
        </p>
        <h1 className="text-xl font-medium text-foreground leading-snug">{capsule.title}</h1>
        {capsule.subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{capsule.subtitle}</p>
        )}
        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <Clock className="w-3 h-3" />
          {capsule.read_time_minutes} min de lectura
        </p>
      </div>

      {/* Key takeaway */}
      {capsule.key_takeaway && (
        <div className="mb-6 p-4 bg-surface-tint border border-electric-soft rounded-xl">
          <p className="text-xs font-medium text-electric-dark mb-1">Lo mas importante</p>
          <p className="text-sm font-medium text-navy">{capsule.key_takeaway}</p>
        </div>
      )}

      {/* Markdown content — article style */}
      <article className="prose prose-sm max-w-none
        prose-headings:text-navy prose-headings:font-semibold
        prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2
        prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
        prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
        prose-strong:text-navy
        prose-ul:my-3 prose-li:text-gray-700 prose-li:leading-relaxed
        prose-ol:my-3
        prose-table:border-collapse prose-table:w-full prose-table:text-sm prose-table:my-4
        prose-thead:bg-surface-tint prose-thead:border-b-2 prose-thead:border-electric-soft
        prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-navy prose-th:font-semibold prose-th:text-xs prose-th:uppercase prose-th:tracking-wide
        prose-td:px-3 prose-td:py-2 prose-td:border-b prose-td:border-gray-100
        prose-tr:even:bg-gray-50/50
        prose-blockquote:border-l-[#2563EB] prose-blockquote:bg-surface-tint prose-blockquote:py-1 prose-blockquote:rounded-r-lg
        prose-a:text-electric prose-a:no-underline hover:prose-a:underline
      ">
        {ReactMarkdown && remarkGfm ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{capsule.content_md}</ReactMarkdown>
        ) : (
          <div className="whitespace-pre-wrap text-gray-700">{capsule.content_md}</div>
        )}
      </article>

      {/* CTA: ask Zafi */}
      <div className="mt-8 p-4 bg-secondary rounded-xl">
        <p className="text-sm font-medium text-foreground mb-1">
          ¿Querés aplicar esto a tu situación?
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Preguntale a Zafi como se aplica esto a tus finanzas reales.
        </p>
        <Link
          href={`/chat?q=Leí sobre ${encodeURIComponent(capsule.title)} — ¿cómo aplica esto a mi situación?`}
          className="inline-block text-sm font-medium text-white bg-electric
                     px-4 py-2 rounded-lg hover:bg-navy transition-colors"
        >
          Preguntarle a Zafi →
        </Link>
      </div>
    </div>
  )
}
