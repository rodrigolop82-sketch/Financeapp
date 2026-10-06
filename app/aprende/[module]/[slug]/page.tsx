'use client'

import { useEffect, useState } from 'react'
import { useParams, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { isEffectivelyPremium } from '@/lib/plans'
import { PageSkeleton } from '@/components/motion/PageSkeleton'
import { AppShell } from '@/components/layout/AppShell'
import { GroupTitle, HERO, HERO_STYLE, PageHeader, PILL_OUTLINE, PillButton } from '@/components/layout/Pantalla'
import { NavCard, NavRow } from '@/components/layout/NavRow'
import { PRIMARY_BUTTON, TEXT_MUTED } from '@/components/movimientos/ui'
import { Note } from '@/components/plan/ui'

interface Sibling {
  id: string
  slug: string
  title: string
  read_time_minutes: number
}

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
  is_premium: boolean
  locked: boolean
}

export default function CapsulePage() {
  const params = useParams()
  const slug = params.slug as string
  const moduleSlug = params.module as string
  const [capsule, setCapsule] = useState<CapsuleData | null>(null)
  const [bookmarked, setBookmarked] = useState(false)
  const [read, setRead] = useState(false)
  const [siblings, setSiblings] = useState<Sibling[]>([])
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
        .select('*, capsule_modules!inner(id, title, slug, color)')
        .eq('slug', slug)
        .single()

      if (!data) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = data.capsule_modules as any

      let plan: 'free' | 'premium' = 'free'
      if (user) {
        const { data: userRow } = await supabase.from('users').select('plan, trial_ends_at').eq('id', user.id).single()
        plan = userRow && isEffectivelyPremium(userRow) ? 'premium' : 'free'
      }

      const isPremiumCapsule = data.is_premium === true
      const locked = isPremiumCapsule && plan === 'free'

      setCapsule({
        id: data.id,
        title: data.title,
        subtitle: data.subtitle,
        content_md: locked ? '' : data.content_md,
        key_takeaway: locked ? null : data.key_takeaway,
        read_time_minutes: data.read_time_minutes,
        module_title: mod.title,
        module_slug: mod.slug,
        module_color: mod.color,
        is_premium: isPremiumCapsule,
        locked,
      })

      // Lecciones del módulo: "Lección N de M" y "Siguiente".
      const { data: list } = await supabase.from('capsules')
        .select('id, slug, title, read_time_minutes, order_index')
        .eq('module_id', mod.id).order('order_index')
      setSiblings((list ?? []) as Sibling[])

      // Leída = tiene fila de progreso (se crea con "Marcar como leída").
      if (user) {
        const { data: progress } = await supabase
          .from('user_capsule_progress')
          .select('bookmarked')
          .eq('user_id', user.id)
          .eq('capsule_id', data.id)
          .maybeSingle()

        setRead(!!progress)
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
      .upsert({ user_id: user.id, capsule_id: capsule.id, bookmarked: newVal }, { onConflict: 'user_id,capsule_id' })
  }

  const markRead = async () => {
    if (!capsule || read) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setRead(true)
    await supabase.from('user_capsule_progress')
      .upsert({ user_id: user.id, capsule_id: capsule.id }, { onConflict: 'user_id,capsule_id' })
  }

  if (loading) {
    return <PageSkeleton variant="detail" />
  }

  if (!capsule) return notFound()

  const index = siblings.findIndex((c) => c.id === capsule.id)
  const next = index >= 0 ? siblings.slice(index + 1, index + 3) : []
  const back = { href: `/aprende/${moduleSlug}`, label: capsule.module_title }
  // Guardar usa la misma fila de progreso que "leída": solo después de leerla.
  const bookmark = !capsule.locked && read && (
    <PillButton className={bookmarked ? undefined : PILL_OUTLINE} onClick={() => void toggleBookmark()}>
      {bookmarked ? 'Guardada' : 'Guardar'}
    </PillButton>
  )

  return (
    <AppShell title="Lección" currentPath="/aprende" hideMobileBar headerRight={bookmark || undefined}>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={back} title="Lección" right={bookmark || undefined} />

        <div className="flex flex-col zafi-stagger">
          <section className={`mt-3.5 flex flex-col gap-2 p-[22px] ${HERO}`} style={HERO_STYLE}>
            <span className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-electric-pale">
                {capsule.module_title}{index >= 0 ? ` · Lección ${index + 1} de ${siblings.length}` : ''}
              </span>
              <span className="flex-none text-[13px] text-[#9FB3CB]">{capsule.read_time_minutes} min</span>
            </span>
            <h1 className="font-serif text-[28px] leading-[1.15]">{capsule.title}</h1>
            {capsule.subtitle && <p className="text-sm text-[#9FB3CB]">{capsule.subtitle}</p>}
            {index >= 0 && siblings.length > 0 && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#2A4A6E]" aria-hidden>
                <div className="h-full rounded-full bg-electric-pale transition-[width] duration-[600ms]" style={{ width: `${((index + (read ? 1 : 0)) / siblings.length) * 100}%` }} />
              </div>
            )}
          </section>

          {capsule.locked ? (
            <>
              <Note tone="warn">
                <b>Lección Premium.</b> Activa tu plan para leer todo el contenido de Aprende.
              </Note>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch('/api/stripe/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ plan: 'monthly' }),
                  })
                  const { url } = await res.json()
                  if (url) window.location.href = url
                }}
                className={`mt-3.5 ${PRIMARY_BUTTON}`}
              >
                Desbloquear con Premium
              </button>
            </>
          ) : (
            <>
              {capsule.key_takeaway && (
                <Note tone="info" className="mt-[18px]">
                  <b>Lo más importante:</b> {capsule.key_takeaway}
                </Note>
              )}

              <article className="prose mt-[18px] max-w-none text-[16px] leading-[1.65]
                text-ink-700 dark:text-ink-200
                prose-headings:text-ink-900 dark:prose-headings:text-ink-100 prose-headings:font-sans
                prose-h2:text-[17px] prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-2
                prose-h3:text-[16px] prose-h3:font-bold prose-h3:mt-5 prose-h3:mb-2
                prose-p:text-ink-700 dark:prose-p:text-ink-200 prose-p:leading-[1.65] prose-p:my-3
                prose-strong:text-ink-900 dark:prose-strong:text-ink-100
                prose-li:text-ink-700 dark:prose-li:text-ink-200 prose-li:leading-[1.6]
                prose-table:text-sm prose-table:my-4
                prose-thead:bg-[var(--zafi-card-alt)] prose-thead:border-b prose-thead:border-[var(--zafi-border)]
                prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-ink-900 dark:prose-th:text-ink-100 prose-th:text-[12px] prose-th:uppercase prose-th:tracking-[0.04em]
                prose-td:px-3 prose-td:py-2 prose-td:border-b prose-td:border-[var(--zafi-border-light)]
                prose-blockquote:border-l-electric prose-blockquote:bg-[var(--zafi-card-alt)] prose-blockquote:py-1 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
                prose-a:text-electric-dark dark:prose-a:text-electric-soft prose-a:font-semibold prose-a:no-underline
              ">
                {ReactMarkdown && remarkGfm ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{capsule.content_md}</ReactMarkdown>
                ) : (
                  <div className="whitespace-pre-wrap">{capsule.content_md}</div>
                )}
              </article>

              <button
                type="button"
                onClick={() => void markRead()}
                disabled={read}
                className={read
                  ? 'mt-3.5 h-[54px] w-full rounded-[14px] border-[1.5px] border-electric text-base font-semibold text-electric-dark dark:text-electric-soft'
                  : `mt-3.5 ${PRIMARY_BUTTON}`}
              >
                {read ? '✓ Lección completada' : 'Marcar como leída'}
              </button>

              <section>
                <GroupTitle>Aplícalo</GroupTitle>
                <NavCard>
                  <NavRow
                    href={`/chat?q=Leí sobre ${encodeURIComponent(capsule.title)} — ¿cómo aplica esto a mi situación?`}
                    emoji="💬"
                    name="Pregúntale a Zafi"
                    description="Cómo se aplica esto a tus finanzas"
                    last
                  />
                </NavCard>
              </section>
            </>
          )}

          {next.length > 0 && (
            <section>
              <GroupTitle>Siguiente</GroupTitle>
              <NavCard>
                {next.map((c, i) => (
                  <NavRow
                    key={c.id}
                    href={`/aprende/${moduleSlug}/${c.slug}`}
                    emoji="📖"
                    name={c.title}
                    description={`Lección ${index + 2 + i} · ${c.read_time_minutes} min`}
                    last={i === next.length - 1}
                  />
                ))}
              </NavCard>
            </section>
          )}
          {next.length === 0 && <p className={`mt-4 text-center text-[13px] ${TEXT_MUTED}`}>Es la última lección de este tema.</p>}
        </div>
      </div>
    </AppShell>
  )
}
