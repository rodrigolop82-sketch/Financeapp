'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import {
  ArrowLeft,
  Loader2,
  LogIn,
  LogOut,
  Download,
  KeyRound,
  Mail,
  ShieldCheck,
  ShieldOff,
  UserX,
} from 'lucide-react'

interface AuditEntry {
  id: string
  event_type: string
  created_at: string
}

const EVENT_MAP: Record<string, { label: string; icon: typeof LogIn }> = {
  login: { label: 'Inicio de sesión', icon: LogIn },
  logout: { label: 'Cierre de sesión', icon: LogOut },
  data_export: { label: 'Exportación de datos', icon: Download },
  password_changed: { label: 'Contraseña actualizada', icon: KeyRound },
  email_changed: { label: 'Email actualizado', icon: Mail },
  mfa_enabled: { label: 'Verificación en dos pasos activada', icon: ShieldCheck },
  mfa_disabled: { label: 'Verificación en dos pasos desactivada', icon: ShieldOff },
  account_deletion_requested: { label: 'Solicitud de eliminación de cuenta', icon: UserX },
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
  const router = useRouter()
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

  return (
    <AppShell title="Historial de acceso" currentPath="/cuenta">
      <button
        onClick={() => router.back()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#2563EB',
          fontSize: 14,
          fontWeight: 500,
          padding: 0,
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={18} />
        Volver
      </button>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 className="w-8 h-8 text-electric animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#94A3B8', padding: '40px 0', fontSize: 14 }}>
          No hay registros de acceso todavía.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((entry) => {
            const mapped = EVENT_MAP[entry.event_type] ?? {
              label: entry.event_type,
              icon: LogIn,
            }
            const Icon = mapped.icon
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: '#EFF6FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} color="#2563EB" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1E3A5F', margin: 0 }}>
                    {mapped.label}
                  </p>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>
                    {timeAgo(entry.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="h-24" />
    </AppShell>
  )
}
