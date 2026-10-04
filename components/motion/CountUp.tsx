'use client'
import { useCountUp } from '@/hooks/useCountUp'

interface CountUpProps {
  value: number
  format?: (n: number) => string
  /** Desde dónde cuenta al montarse (por defecto no cuenta al montarse). */
  from?: number
  duration?: number
  delay?: number
}

/** Número que cuenta hacia `value` (ease-out cúbica); sin conteo con "reducir movimiento". */
export function CountUp({ value, format = (n) => String(Math.round(n)), from, duration, delay }: CountUpProps) {
  const shown = useCountUp(value, { from, duration, delay })
  return <span className="tabular-nums">{format(shown)}</span>
}
