'use client'
import { useEffect, useState, type CSSProperties } from 'react'
import { prefersReducedMotion } from '@/hooks/useCountUp'

// Colores de marca: electric, pale, verde, ámbar y blanco.
const COLORS = ['#2563EB', '#60A5FA', '#4ADE80', '#FCD34D', '#FFFFFF']

interface Piece {
  left: number
  size: number
  color: string
  duration: number
  delay: number
  dx: number
  rotate: number
  round: boolean
}

function makePieces(n: number): Piece[] {
  return Array.from({ length: n }, () => ({
    left: Math.random() * 100,
    size: 6 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    duration: 1.4 + Math.random() * 0.9,
    delay: Math.random() * 0.35,
    dx: (Math.random() - 0.5) * 140,
    rotate: Math.random() * 720,
    round: Math.random() > 0.5,
  }))
}

/**
 * Confeti breve (30 piezas, 1.4–2.3 s), una sola vez. No se pinta con
 * "reducir movimiento". Va dentro de un contenedor `relative`.
 */
export function Confetti({ count = 30, top = 120 }: { count?: number; top?: number }) {
  const [pieces, setPieces] = useState<Piece[] | null>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    setPieces(makePieces(count))
    const t = setTimeout(() => setPieces(null), 2800)
    return () => clearTimeout(t)
  }, [count])

  if (!pieces) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute animate-confetti"
          style={{
            top,
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            borderRadius: p.round ? '50%' : 2,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            '--dx': `${p.dx}px`,
            '--r': `${p.rotate}deg`,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}
