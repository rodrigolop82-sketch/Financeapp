import { cn } from '@/lib/utils'

type WordmarkVariant = 'light' | 'dark' | 'electric'
type WordmarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const sizes: Record<WordmarkSize, string> = {
  xs:  'text-[18px]',
  sm:  'text-[24px]',
  md:  'text-[32px]',
  lg:  'text-[44px]',
  xl:  'text-[56px]',
  '2xl': 'text-[72px]',
}

const baseColors: Record<WordmarkVariant, string> = {
  light:    'text-navy',
  dark:     'text-white',
  electric: 'text-white',
}

const accentColors: Record<WordmarkVariant, string> = {
  light:    'text-electric',
  dark:     'text-electric-pale',
  electric: 'text-electric-ghost',
}

interface WordmarkProps {
  variant?: WordmarkVariant
  size?: WordmarkSize
  className?: string
  withTagline?: boolean
}

export function Wordmark({
  variant = 'light',
  size = 'md',
  className,
  withTagline = false,
}: WordmarkProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span
        className={cn(
          'font-outfit font-extrabold tracking-[-0.04em] leading-none',
          sizes[size],
          baseColors[variant]
        )}
      >
        zaf<span className={accentColors[variant]}>i</span>
      </span>
      {withTagline && (
        <span
          className={cn(
            'font-sans font-medium uppercase tracking-[0.2em] mt-1',
            size === 'xs' || size === 'sm' ? 'text-[9px]' : 'text-[11px]',
            variant === 'light' ? 'text-electric' : 'text-electric-pale/70'
          )}
        >
          tu planeador financiero
        </span>
      )}
    </div>
  )
}
