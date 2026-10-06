'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import {
  DANGER_TEXT_BUTTON, GroupTitle, ListCard, PageHeader, ROW_DIVIDER, RowBody, Tile,
} from '@/components/layout/Pantalla'
import { TEXT_MUTED } from '@/components/movimientos/ui'
import { Note } from '@/components/plan/ui'
import { StatusToast, type StatusMessage } from '@/components/movimientos/StatusToast'
import { SkeletonRows } from '@/components/motion/PageSkeleton'

interface AuditEntry {
  id: string
  event_type: string
  created_at: string
}

const EVENT_MAP: Record<string, { label: string; emoji: string }> = {
  login: { label: 'Inicio de sesión', emoji: '🔓' },
  logout: { label: 'Cierre de sesión', emoji: '🚪' },
  data_export: { label: 'Exportación de datos', emoji: '📤' },
  password_changed: { label: 'Contraseña actualizada', emoji: '🔑' },
  email_changed: { label: 'Correo actualizado', emoji: '✉️' },
  mfa_enabled: { label: 'Verificación en dos pasos activada', emoji: '🛡️' },
  mfa_disabled: { label: 'Verificación en dos pasos desactivada', emoji: '⚠️' },
  account_deletion_requested: { label: 'Solicitud de eliminación de cuenta', emoji: '🗑️' },
}

function when(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-GT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Justo ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} día${days !== 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  return `hace ${months} mes${months !== 1 ? 'es' : ''}`
}

export default function HistorialAccesoPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('audit_log')
        .select('id, event_type, created_at')
        .order('created_at', { ascending: false })
        .limit(20)

      setEntries((data as AuditEntry[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const [closing, setClosing] = useState(false)
  const [message, setMessage] = useState<StatusMessage | null>(null)

  async function signOutOthers() {
    setClosing(true)
    const { error } = await createClient().auth.signOut({ scope: 'others' })
    setClosing(false)
    setMessage(error
      ? { text: 'No se pudieron cerrar las demás sesiones. Intenta de nuevo.', tone: 'error' }
      : { text: 'Cerramos tus otras sesiones', tone: 'ok' })
  }

  return (
    <AppShell title="Historial de acceso" currentPath="/cuenta" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={{ href: '/cuenta', label: 'Cuenta' }} title="Historial de acceso" />

        <div className="flex flex-col zafi-stagger">
          <section>
            <GroupTitle>Últimos accesos</GroupTitle>
            {loading ? (
              <SkeletonRows count={6} />
            ) : entries.length === 0 ? (
              <p className={`px-1 py-4 text-sm ${TEXT_MUTED}`}>No hay registros de acceso todavía.</p>
            ) : (
              <ListCard>
                {entries.map((entry) => {
                  const mapped = EVENT_MAP[entry.event_type] ?? { label: entry.event_type, emoji: '🔓' }
                  return (
                    <div key={entry.id} className={`flex min-h-16 items-center gap-3 py-2.5 ${ROW_DIVIDER}`}>
                      <RowBody
                        tile={<Tile>{mapped.emoji}</Tile>}
                        name={mapped.label}
                        help={`${when(entry.created_at)} · ${timeAgo(entry.created_at)}`}
                      />
                    </div>
                  )
                })}
              </ListCard>
            )}
          </section>

          <Note tone="warn">
            ¿No reconoces un acceso? <b>Cierra las demás sesiones</b> y escríbenos a hola@zafiapp.com.
          </Note>
          <button type="button" onClick={() => void signOutOthers()} disabled={closing} className={`mt-2 ${DANGER_TEXT_BUTTON}`}>
            {closing ? 'Cerrando…' : 'Cerrar las demás sesiones'}
          </button>
        </div>
      </div>
      <StatusToast message={message} onDone={() => setMessage(null)} />
    </AppShell>
  )
}
