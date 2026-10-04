'use client'
import { useEffect, useState } from 'react'
import {
  isSplashRoute, splashExitAt, SPLASH_EXIT_MS, SPLASH_MAX_MS, SPLASH_SESSION_KEY,
} from '@/lib/motion'

const READY_EVENT = 'zafi:app-ready'

declare global {
  interface Window { __zafiReady?: boolean }
}

/**
 * Avisa que la sesión y los datos de la primera pantalla están listos (lo
 * llama AppShell al montarse): el splash puede salir.
 */
export function signalAppReady() {
  if (typeof window === 'undefined' || window.__zafiReady) return
  window.__zafiReady = true
  window.dispatchEvent(new Event(READY_EVENT))
}

type Phase = 'in' | 'out' | 'gone'

/**
 * Splash al abrir la app (una vez por sesión): tile con la "Z" que aparece
 * con `pop` y luego respira. Sale con opacity 0 + scale 1.06 cuando hay datos
 * (mín. 900 ms, máx. 2.5 s).
 */
export function Splash() {
  const [phase, setPhase] = useState<Phase>('in')

  useEffect(() => {
    const html = document.documentElement
    if (html.getAttribute('data-splash') === 'off' || !isSplashRoute(window.location.pathname)) {
      setPhase('gone')
      return
    }
    try { sessionStorage.setItem(SPLASH_SESSION_KEY, '1') } catch { /* sin almacenamiento */ }

    const timers: ReturnType<typeof setTimeout>[] = []
    let leaving = false
    const leave = (readyAt: number | null) => {
      if (leaving) return
      leaving = true
      const wait = Math.max(0, splashExitAt(readyAt) - performance.now())
      timers.push(setTimeout(() => setPhase('out'), wait))
      timers.push(setTimeout(() => {
        setPhase('gone')
        html.setAttribute('data-splash', 'off')
      }, wait + SPLASH_EXIT_MS))
    }
    // performance.now() cuenta desde que se abrió la página.
    const onReady = () => leave(performance.now())
    if (window.__zafiReady) onReady()
    else window.addEventListener(READY_EVENT, onReady)
    // Si los datos nunca llegan (sin sesión, error), sale al máximo.
    timers.push(setTimeout(() => leave(null), Math.max(0, SPLASH_MAX_MS - performance.now())))
    return () => {
      window.removeEventListener(READY_EVENT, onReady)
      timers.forEach(clearTimeout)
    }
  }, [])

  if (phase === 'gone') return null
  const out = phase === 'out'
  return (
    <div
      aria-hidden
      className="zafi-splash fixed inset-0 z-[100] flex flex-col items-center justify-center gap-[18px] bg-navy-deep"
      style={{
        opacity: out ? 0 : 1,
        transform: out ? 'scale(1.06)' : 'none',
        transition: `opacity ${SPLASH_EXIT_MS}ms ease, transform ${SPLASH_EXIT_MS}ms ease`,
        pointerEvents: out ? 'none' : 'auto',
      }}
    >
      <div className="animate-pop" style={{ animationDuration: '.6s' }}>
        <div
          className="flex h-[88px] w-[88px] items-center justify-center rounded-[26px] border border-white/10 bg-navy font-outfit text-[50px] font-extrabold text-white animate-breath"
        >
          Z
        </div>
      </div>
      <span
        className="font-outfit text-[26px] font-bold tracking-[0.02em] text-white animate-fade-up"
        style={{ animationDelay: '.25s' }}
      >
        zafi
      </span>
      <div className="absolute flex gap-[7px]" style={{ bottom: 'calc(70px + env(safe-area-inset-bottom))' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[7px] w-[7px] rounded-full bg-electric-pale animate-dot"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
