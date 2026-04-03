import { cn } from '@/lib/utils'

type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type IconVariant = 'navy' | 'electric' | 'gradient' | 'white'
type IconShape = 'rounded' | 'circle'

const sizes: Record<IconSize, { container: string; text: string }> = {
  xs:  { container: 'w-7 h-7',    text: 'text-[18px]' },
  sm:  { container: 'w-9 h-9',    text: 'text-[24px]' },
  md:  { container: 'w-12 h-12',  text: 'text-[30px]' },
  lg:  { container: 'w-16 h-16',  text: 'text-[40px]' },
  xl:  { container: 'w-24 h-24',  text: 'text-[58px]' },
}

const variants: Record<IconVariant, string> = {
  navy:     'bg-navy',
  electric: 'bg-electric',
  gradient: 'bg-gradient-to-br from-electric to-navy-darker',
  white:    'bg-white border border-navy/10',
}

const textColors: Record<IconVariant, string> = {
  navy:     'text-white',
  electric: 'text-white',
  gradient: 'text-white',
  white:    'text-navy',
}

const shapes: Record<IconShape, string> = {
  rounded: 'rounded-[22%]',
  circle:  'rounded-full',
}

interface AppIconProps {
  size?: IconSize
  variant?: IconVariant
  shape?: IconShape
  className?: string
}

export function AppIcon({
  size = 'md',
  variant = 'navy',
  shape = 'rounded',
  className,
}: AppIconProps) {
  const s = sizes[size]
  return (
    <div
      className={cn(
        'flex items-center justify-center flex-shrink-0',
        s.container,
        variants[variant],
        shapes[shape],
        className
      )}
    >
      <span
        className={cn(
          'font-outfit font-extrabold tracking-[-0.04em] leading-none select-none',
          s.text,
          textColors[variant]
        )}
      >
        z
      </span>
    </div>
  )
}
