'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ScanLine, Mic, Pencil, Plus } from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

interface AddExpenseOption {
  id: string
  icon: typeof ScanLine
  title: string
  subtitleMobile: string
  subtitleDesktop: string
  iconBg: string
  iconColor: string
  badge?: string
  featured?: boolean
}

const OPTIONS: AddExpenseOption[] = [
  {
    id: 'scan',
    icon: ScanLine,
    title: 'Escanear',
    subtitleMobile: 'Foto de un recibo o tu estado de cuenta — Zafi detecta los movimientos',
    subtitleDesktop: 'Sube una foto de un recibo o tu estado de cuenta — Zafi detecta los movimientos',
    iconBg: '#EFEAFB',
    iconColor: '#7C5CFF',
    badge: 'Con IA',
    featured: true,
  },
  {
    id: 'voice',
    icon: Mic,
    title: 'Dictar por voz',
    subtitleMobile: 'Dile a Zafi qué gastaste, él lo registra por ti',
    subtitleDesktop: 'Dile a Zafi qué gastaste, él lo registra',
    iconBg: '#E6F8F0',
    iconColor: '#15A36E',
    badge: 'Rápido',
  },
  {
    id: 'manual',
    icon: Pencil,
    title: 'Registrar manualmente',
    subtitleMobile: 'Ingresa monto, categoría y nota a tu propio ritmo',
    subtitleDesktop: 'Ingresa monto, categoría y nota',
    iconBg: '#E8F1FF',
    iconColor: '#2563EB',
  },
]

interface AddExpenseTriggerProps {
  onVoice?: () => void
  onManual?: () => void
  onScan?: () => void
}

function OptionItem({
  option,
  isMobile,
  onSelect,
}: {
  option: AddExpenseOption
  isMobile: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-3 w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-ink-50 active:bg-ink-100"
      style={option.featured ? {
        background: '#F9F7FE',
        border: '1.5px solid #E2DAF9',
        borderRadius: 12,
      } : undefined}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: option.iconBg }}
      >
        <option.icon className="h-5 w-5" style={{ color: option.iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink-900">{option.title}</p>
          {option.badge && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none"
              style={{
                background: option.featured ? '#EFEAFB' : '#E6F8F0',
                color: option.featured ? '#7C5CFF' : '#15A36E',
              }}
            >
              {option.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-500 leading-snug mt-0.5">
          {isMobile ? option.subtitleMobile : option.subtitleDesktop}
        </p>
      </div>
    </button>
  )
}

export function AddExpenseTrigger({ onVoice, onManual, onScan }: AddExpenseTriggerProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const router = useRouter()
  const pathname = usePathname()
  const onDashboard = pathname === '/dashboard'

  function handleSelect(id: string) {
    setOpen(false)
    switch (id) {
      case 'scan':
        if (onScan) { onScan(); return }
        if (!onDashboard) router.push('/dashboard?action=scan')
        break
      case 'voice':
        if (onVoice) { onVoice(); return }
        if (!onDashboard) router.push('/dashboard?action=voice')
        break
      case 'manual':
        if (onManual) { onManual(); return }
        if (!onDashboard) router.push('/dashboard?action=manual')
        break
    }
  }

  const optionsList = (
    <div className="flex flex-col gap-1.5">
      {OPTIONS.map((opt) => (
        <OptionItem
          key={opt.id}
          option={opt}
          isMobile={isMobile}
          onSelect={() => handleSelect(opt.id)}
        />
      ))}
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            className="flex flex-col items-center gap-0.5"
            style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: -16, padding: 0 }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 12px rgba(37,99,235,.4)',
              }}
            >
              <Plus className="h-[22px] w-[22px] text-white" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
              Agregar
            </span>
          </button>
        </SheetTrigger>
        <SheetContent>
          <div className="px-4 pt-1 pb-2">
            <h3 className="text-base font-semibold text-ink-900">Agregar gasto</h3>
            <p className="text-xs text-ink-500 mt-0.5">¿Cómo querés registrarlo?</p>
          </div>
          <div className="px-2 pb-6">
            {optionsList}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center justify-center rounded-full bg-electric text-white shadow-lg transition-all hover:bg-electric-dark hover:scale-105 active:scale-95"
          style={{
            width: 56,
            height: 56,
            boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
          }}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={12} className="w-80">
        <div className="px-1 pt-1 pb-1">
          <h3 className="text-sm font-semibold text-ink-900 px-2 mb-1">Agregar gasto</h3>
          {optionsList}
        </div>
      </PopoverContent>
    </Popover>
  )
}
