'use client'

import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

const SECTIONS = [
  {
    title: 'Acceso exclusivo',
    body: 'Usamos Row Level Security (RLS) de Supabase. Esto significa que cada consulta a la base de datos está vinculada a tu usuario. Aunque alguien tuviera acceso directo a la base de datos, no podría ver tus datos — la base misma los bloquea.',
  },
  {
    title: 'Nosotros tampoco vemos tus datos',
    body: 'Ni el equipo de Zafi puede consultar tu información financiera individual. Usamos métricas agregadas y anónimas para mejorar el producto, nunca datos personales identificables.',
  },
  {
    title: 'Tus datos e IA',
    body: 'Cuando Zafi usa IA para darte recomendaciones, tu información se envía procesada en ese momento y no se almacena en los servidores de IA. Claude y Whisper actúan como procesadores de datos, no como almacenadores.',
  },
  {
    title: 'Modelo de negocio',
    body: 'Zafi se financia con tu suscripción. No tenemos modelo de ingresos basado en publicidad ni en venta de datos. Tu información no es nuestro producto.',
  },
] as const

export default function PrivacidadPage() {
  const router = useRouter()

  return (
    <AppShell title="Privacidad" currentPath="/cuenta">
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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShieldCheck size={24} color="#2563EB" />
        </div>
        <h1
          className="font-serif"
          style={{ fontSize: 22, fontWeight: 400, color: '#1E3A5F', margin: 0 }}
        >
          Tu información está blindada
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {SECTIONS.map((section) => (
          <div
            key={section.title}
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 14,
              padding: '18px 20px',
            }}
          >
            <p
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#1E3A5F',
                margin: '0 0 8px',
              }}
            >
              {section.title}
            </p>
            <p
              style={{
                fontSize: 13,
                color: '#64748B',
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {section.body}
            </p>
          </div>
        ))}
      </div>

      <div className="h-24" />
    </AppShell>
  )
}
