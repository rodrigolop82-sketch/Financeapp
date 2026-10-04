import type { CSSProperties } from 'react'
import { BottomNav } from '@/components/dashboard/BottomNav'

export type SkeletonVariant = 'home' | 'list' | 'detail'
export type SkeletonTone = 'dark' | 'app'

/** Bloque de silueta con brillo que recorre (1.3 s). */
export function SkeletonBlock({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={`zafi-skel animate-shimmer rounded-[14px] ${className}`} style={style} />
}

/** Filas de lista (64 px) para cargas dentro de una página. */
export function SkeletonRows({ count = 5, className = '' }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-label="Cargando" className={`flex flex-col gap-[5px] ${className}`}>
      {Array.from({ length: count }, (_, i) => <SkeletonBlock key={i} className="h-16" />)}
      <span className="sr-only">Cargando…</span>
    </div>
  )
}

function HomeBlocks() {
  return (
    <>
      <SkeletonBlock className="ml-1 h-3.5 w-[120px]" />
      <SkeletonBlock className="ml-1 mb-1.5 h-7 w-[190px]" />
      <SkeletonBlock className="h-[190px] !rounded-[20px]" />
      <SkeletonBlock className="ml-1 mt-2 h-4 w-[130px]" />
      <SkeletonBlock className="h-[62px]" />
      <SkeletonBlock className="h-[62px]" />
      <SkeletonBlock className="h-[62px]" />
    </>
  )
}

function ListBlocks() {
  return (
    <>
      <SkeletonBlock className="ml-1 mb-1.5 h-7 w-[170px]" />
      <SkeletonBlock className="h-[76px] !rounded-2xl" />
      <SkeletonBlock className="h-11 !rounded-full" />
      <SkeletonBlock className="ml-1 mt-2 h-3.5 w-[90px]" />
      {Array.from({ length: 6 }, (_, i) => <SkeletonBlock key={i} className="h-16" />)}
    </>
  )
}

function DetailBlocks() {
  return (
    <>
      <SkeletonBlock className="ml-1 h-3.5 w-[70px]" />
      <SkeletonBlock className="ml-1 mb-1.5 h-7 w-[210px]" />
      <SkeletonBlock className="h-[150px] !rounded-[20px]" />
      <SkeletonBlock className="ml-1 mt-2 h-4 w-[140px]" />
      {Array.from({ length: 4 }, (_, i) => <SkeletonBlock key={i} className="h-[52px]" />)}
    </>
  )
}

interface PageSkeletonProps {
  variant?: SkeletonVariant
  /** `dark` (por defecto): fondo #0D1F36. `app`: el fondo de la app según el tema. */
  tone?: SkeletonTone
  /** Muestra la barra inferior (móvil) mientras carga. Por defecto, sí. */
  nav?: boolean
}

/**
 * Siluetas de página completa mientras llegan los datos. Reemplaza al
 * spinner sobre fondo claro.
 */
export function PageSkeleton({ variant = 'list', tone = 'dark', nav = true }: PageSkeletonProps) {
  const dark = tone === 'dark'
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={`min-h-screen animate-fade-quick ${dark ? 'zafi-skel-dark bg-navy-deep' : ''}`}
      style={dark ? undefined : { background: 'var(--zafi-bg)' }}
    >
      <div
        className="mx-auto flex max-w-2xl flex-col gap-3 px-4 pb-28 lg:mx-0 lg:px-[52px]"
        style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}
      >
        {variant === 'home' ? <HomeBlocks /> : variant === 'detail' ? <DetailBlocks /> : <ListBlocks />}
      </div>
      <span className="sr-only">Cargando…</span>
      {nav && <BottomNav />}
    </div>
  )
}
