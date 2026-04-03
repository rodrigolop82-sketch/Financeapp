import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  label?: string
  showValue?: boolean
  variant?: 'light' | 'dark'
  colorOverride?: string
  height?: 'sm' | 'md' | 'lg'
  className?: string
}

function colorForValue(v: number): string {
  if (v >= 75) return '#10B981'
  if (v >= 50) return '#2563EB'
  if (v >= 25) return '#F59E0B'
  return '#EF4444'
}

const heights = { sm: 'h-1', md: 'h-1.5', lg: 'h-2' }

export function ProgressBar({
  value,
  label,
  showValue = true,
  variant = 'light',
  colorOverride,
  height = 'md',
  className,
}: ProgressBarProps) {
  const color = colorOverride ?? colorForValue(value)
  const clamp = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && (
            <span className={cn(
              'font-sans font-medium text-caption',
              variant === 'dark' ? 'text-white/60' : 'text-ink-500'
            )}>
              {label}
            </span>
          )}
          {showValue && (
            <span
              className="font-outfit font-bold text-caption ml-auto"
              style={{ color }}
            >
              {value}
            </span>
          )}
        </div>
      )}
      <div className={cn(
        'w-full rounded-full overflow-hidden',
        heights[height],
        variant === 'dark' ? 'bg-white/10' : 'bg-ink-100'
      )}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${clamp}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
