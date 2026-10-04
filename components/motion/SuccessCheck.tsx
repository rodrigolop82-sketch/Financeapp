import type { ReactNode } from 'react'

interface SuccessCheckProps {
  /** Diámetro del círculo en px. Por defecto 96. */
  size?: number
  /** Retraso de la animación en segundos. */
  delay?: number
  /** Texto grande bajo el check (por ejemplo, el monto). */
  title?: ReactNode
  /** Línea de apoyo bajo el título. */
  subtitle?: ReactNode
  /** Clases del título (por defecto Outfit 800 40px). */
  titleClassName?: string
  /** Clases del subtítulo (por defecto 15px gris). */
  subtitleClassName?: string
  className?: string
}

/**
 * Éxito: círculo verde que aparece con `pop`, check que se dibuja y un halo
 * que se expande. Opcionalmente, un título y un subtítulo que suben.
 * Se usa al guardar un gasto, al importar, al enviar una idea y en Apple Pay.
 * Con "reducir movimiento" solo se funde (ver globals.css).
 */
export function SuccessCheck({
  size = 96,
  delay = 0,
  title,
  subtitle,
  titleClassName = 'font-outfit font-extrabold text-[40px] leading-tight text-ink-900 dark:text-ink-100',
  subtitleClassName = 'text-[15px] text-ink-700 dark:text-ink-200',
  className = '',
}: SuccessCheckProps) {
  const icon = Math.round(size * 0.48)
  return (
    <div className={`flex flex-col items-center gap-3.5 text-center ${className}`}>
      <div className="relative flex-none" style={{ width: size, height: size }} aria-hidden>
        <span
          className="absolute inset-0 rounded-full bg-success opacity-0 animate-ring"
          style={{ animationDelay: `${delay + 0.2}s` }}
        />
        <div
          className="absolute inset-0 rounded-full bg-success-dark flex items-center justify-center animate-pop"
          style={{ animationDelay: `${delay}s` }}
        >
          <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="#FFFFFF"
              strokeWidth={2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-draw"
              style={{ strokeDasharray: 24, strokeDashoffset: 24, animationDelay: `${delay + 0.25}s` }}
            />
          </svg>
        </div>
      </div>
      {title !== undefined && (
        <span className={`animate-fade-up ${titleClassName}`} style={{ animationDelay: `${delay + 0.3}s` }}>
          {title}
        </span>
      )}
      {subtitle !== undefined && (
        <span className={`animate-fade-up ${subtitleClassName}`} style={{ animationDelay: `${delay + 0.4}s` }}>
          {subtitle}
        </span>
      )}
    </div>
  )
}
