'use client'
// Piezas de las pantallas de acceso (login, registro, invitación): página
// sin tarjeta, marca arriba, título DM Serif 30 y botón de Google.

import { AppIcon } from '@/components/brand/AppIcon'
import { Wordmark } from '@/components/brand/Wordmark'
import { FieldLabel } from '@/components/layout/Pantalla'
import { BORDER, CARD_BG, TEXT_FAINT, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'

export function AuthPage({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className="min-h-screen bg-[var(--zafi-bg)]">
      <div className={`mx-auto flex max-w-md flex-col gap-[22px] px-5 pb-10 pt-[calc(28px+env(safe-area-inset-top))] ${center ? 'items-center text-center' : ''}`}>
        <div className="flex items-center gap-2.5">
          <AppIcon size="sm" variant="electric" />
          <Wordmark size="sm" />
        </div>
        {children}
      </div>
    </div>
  )
}

export function AuthTitle({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className={`font-serif text-[30px] leading-[1.15] [text-wrap:pretty] ${TEXT_STRONG}`}>{title}</h1>
      {sub && <p className={`text-[15px] leading-[1.45] [text-wrap:pretty] ${TEXT_MUTED}`}>{sub}</p>}
    </div>
  )
}

export function AuthField({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
    </div>
  )
}

/** Divisor "o continúa con". */
export function OrDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2.5 text-[13px] ${TEXT_FAINT}`}>
      <span className="h-px flex-1 bg-ink-100 dark:bg-white/10" />
      {children}
      <span className="h-px flex-1 bg-ink-100 dark:bg-white/10" />
    </div>
  )
}

export function GoogleButton({ onClick, children = 'Continuar con Google' }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[46px] w-full items-center justify-center gap-2 rounded-full border text-[15px] font-semibold transition duration-150 active:scale-[0.96] ${BORDER} ${CARD_BG} ${TEXT_STRONG}`}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      {children}
    </button>
  )
}

/** Enlace de texto 600 azul. */
export const AUTH_LINK = 'font-semibold text-electric-dark dark:text-electric-soft'
