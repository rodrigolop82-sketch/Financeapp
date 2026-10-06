'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader, PillButton } from '@/components/layout/Pantalla'
import { PRIMARY_BUTTON, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'
import { openAddSheet } from '@/components/dashboard/BottomNav'
import { TRANSACTIONS_CHANGED_EVENT } from '@/components/add/AddSheet'
import { PageSkeleton } from '@/components/motion/PageSkeleton'

export default function NotificacionPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <NotificacionContent />
    </Suspense>
  )
}

/**
 * Pegar notificación: el texto se interpreta en la hoja de Agregar, que
 * muestra el mismo bloque "Entendí esto" (tipo, categoría, fecha, pago).
 */
function NotificacionContent() {
  const params = useSearchParams()
  const [text, setText] = useState('')

  // Texto compartido desde otra app (Web Share Target) o por URL: se analiza solo.
  useEffect(() => {
    const shared = params.get('text') || params.get('title') || ''
    if (!shared) return
    setText(shared)
    // AppShell monta la hoja en el mismo render: se espera un tick.
    const t = setTimeout(() => openAddSheet({ text: shared }), 50)
    return () => clearTimeout(t)
  }, [params])

  // Guardado desde la hoja: el campo queda listo para el siguiente.
  useEffect(() => {
    const clear = () => setText('')
    window.addEventListener(TRANSACTIONS_CHANGED_EVENT, clear)
    return () => window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, clear)
  }, [])

  async function paste() {
    try {
      const clip = await navigator.clipboard.readText()
      if (clip) setText(clip)
    } catch {
      // Sin permiso: se puede pegar a mano en el campo.
    }
  }

  return (
    <AppShell title="Pegar notificación" currentPath="/notificacion" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader
          back={{ href: '/transacciones', label: 'Movimientos' }}
          title="Pegar notificación"
          subtitle="Copia el SMS o la notificación de tu banco y pégala aquí."
        />
        <p className={`hidden text-sm lg:block ${TEXT_MUTED}`}>Copia el SMS o la notificación de tu banco y pégala aquí.</p>

        <div className="mt-3.5 flex flex-col gap-3 zafi-stagger">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Texto de la notificación"
            placeholder={'Ej. "BAM le informa: Compra por Q 150.00 en WALMART aprobada. TC *1234"'}
            className={`min-h-[120px] resize-none rounded-[14px] border-[1.5px] border-electric-soft bg-[var(--zafi-card)] px-3.5 py-3 text-[15px] leading-[1.45] outline-none placeholder:text-ink-400 focus:border-electric ${TEXT_STRONG}`}
          />
          <div className="flex gap-1.5">
            <PillButton onClick={() => void paste()}>Pegar</PillButton>
          </div>
          <button type="button" disabled={!text.trim()} onClick={() => openAddSheet({ text })} className={PRIMARY_BUTTON}>
            Analizar
          </button>
          <p className={`text-center text-[13px] ${TEXT_MUTED}`}>Revisas lo que entendimos antes de guardar.</p>
        </div>
      </div>
    </AppShell>
  )
}
