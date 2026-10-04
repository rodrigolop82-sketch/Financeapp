'use client'
import { useEffect, useRef, useState } from 'react'
import { countUpValue } from '@/lib/motion'

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

/** ¿El sistema pide reducir movimiento? (false en el servidor). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(REDUCE_QUERY).matches
}

/** Igual que `prefersReducedMotion`, pero se actualiza si cambia el ajuste. */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia?.(REDUCE_QUERY)
    if (!mq) return
    setReduce(mq.matches)
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduce
}

interface CountUpOptions {
  /** Duración del conteo en ms. Por defecto 900. */
  duration?: number
  /** Valor desde el que se cuenta la primera vez. Por defecto, sin conteo inicial. */
  from?: number
  /** Espera antes de empezar (ms). */
  delay?: number
}

/**
 * Número que cuenta (requestAnimationFrame, ease-out cúbica) hacia `target`
 * cada vez que cambia, desde el valor que se estaba mostrando. Con
 * "reducir movimiento" devuelve `target` directo, sin conteo.
 */
export function useCountUp(target: number, { duration = 900, from, delay = 0 }: CountUpOptions = {}): number {
  const [value, setValue] = useState(from ?? target)
  const shown = useRef(from ?? target)

  useEffect(() => {
    const start = shown.current
    if (start === target || prefersReducedMotion()) {
      shown.current = target
      setValue(target)
      return
    }
    let raf = 0
    let t0: number | null = null
    const tick = (now: number) => {
      if (t0 === null) t0 = now
      const v = countUpValue(start, target, now - t0, duration)
      shown.current = v
      setValue(v)
      if (v !== target) raf = requestAnimationFrame(tick)
    }
    const timer = setTimeout(() => { raf = requestAnimationFrame(tick) }, delay)
    return () => { clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [target, duration, delay])

  return value
}
