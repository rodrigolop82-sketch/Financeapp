'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Camera, Mic, Pencil, FileUp, Plus } from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

interface AddExpenseOption {
  id: string
  icon: typeof Camera
  title: string
  subtitleMobile: string
  subtitleDesktop: string
  iconBg: string
  iconColor: string
}

const OPTIONS: AddExpenseOption[] = [
  {
    id: 'photo',
    icon: Camera,
    title: 'Foto al recibo',
    subtitleMobile: 'Captura el ticket, Zafi lee el monto y la categoría',
    subtitleDesktop: 'Sube o arrastra una imagen del ticket',
    iconBg: '#FFF1E6',
    iconColor: '#E37B2C',
  },
  {
    id: 'voice',
    icon: Mic,
    title: 'Dictar por voz',
    subtitleMobile: 'Dile a Zafi qué gastaste, él lo registra por ti',
    subtitleDesktop: 'Dile a Zafi qué gastaste, él lo registra por ti',
    iconBg: '#E6F8F0',
    iconColor: '#15A36E',
  },
  {
    id: 'manual',
    icon: Pencil,
    title: 'Registrar manualmente',
    subtitleMobile: 'Ingresa monto, categoría y nota a tu propio ritmo',
    subtitleDesktop: 'Ingresa monto, categoría y nota a tu propio ritmo',
    iconBg: '#E8F1FF',
    iconColor: '#2563EB',
  },
  {
    id: 'import',
    icon: FileUp,
    title: 'Importar estado de cuenta',
    subtitleMobile: 'Sube un PDF o foto, Zafi detecta varios movimientos',
    subtitleDesktop: 'Sube un PDF o foto, Zafi detecta varios movimientos',
    iconBg: '#EFEAFB',
    iconColor: '#7C5CFF',
  },
]

interface AddExpenseTriggerProps {
  onVoice?: () => void
  onManual?: () => void
  onPhoto?: () => void
  onImport?: () => void
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
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: option.iconBg }}
      >
        <option.icon className="h-5 w-5" style={{ color: option.iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-900">{option.title}</p>
        <p className="text-xs text-ink-500 leading-snug">
          {isMobile ? option.subtitleMobile : option.subtitleDesktop}
        </p>
      </div>
    </button>
  )
}

export function AddExpenseTrigger({ onVoice, onManual, onPhoto, onImport }: AddExpenseTriggerProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const router = useRouter()
  const pathname = usePathname()
  const onDashboard = pathname === '/dashboard'

  function handleSelect(id: string) {
    setOpen(false)
    switch (id) {
      case 'voice':
        if (onVoice) { onVoice(); return }
        if (!onDashboard) router.push('/dashboard?action=voice')
        break
      case 'manual':
        if (onManual) { onManual(); return }
        if (!onDashboard) router.push('/dashboard?action=manual')
        break
      case 'photo':
        // TODO: implement photo receipt capture flow
        if (onPhoto) onPhoto()
        break
      case 'import':
        if (onImport) { onImport(); return }
        if (!onDashboard) router.push('/dashboard?action=import')
        break
    }
  }

  const optionsList = (
    <div className="flex flex-col gap-0.5">
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
        <button className="flex items-center gap-2.5 w-full px-3 py-2.5 mb-4 rounded-xl bg-electric text-white text-sm font-semibold transition-colors hover:bg-electric-dark">
          <Plus className="h-5 w-5" />
          Agregar gasto
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={12} className="w-80">
        <div className="px-1 pt-1 pb-1">
          <h3 className="text-sm font-semibold text-ink-900 px-2 mb-1">Agregar gasto</h3>
          {optionsList}
        </div>
      </PopoverContent>
    </Popover>
  )
}
