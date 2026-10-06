'use client'

import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { LINK_TEXT, PageHeader } from '@/components/layout/Pantalla'
import { TEXT_BODY, TEXT_STRONG } from '@/components/movimientos/ui'

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
  return (
    <AppShell title="Privacidad" currentPath="/cuenta" hideMobileBar>
      <div className="mx-auto flex max-w-2xl flex-col lg:mx-0">
        <PageHeader back={{ href: '/cuenta', label: 'Cuenta' }} title="Tu información está blindada" />
        <div className="mt-3.5 flex flex-col gap-[18px] zafi-stagger">
          {SECTIONS.map((section) => (
            <section key={section.title} className="flex flex-col gap-1.5">
              <h2 className={`text-[17px] font-bold ${TEXT_STRONG}`}>{section.title}</h2>
              <p className={`text-base leading-[1.65] ${TEXT_BODY}`}>{section.body}</p>
            </section>
          ))}
          <Link href="/privacidad" className={`text-[15px] font-semibold ${LINK_TEXT}`}>Leer la política de privacidad completa ›</Link>
        </div>
      </div>
    </AppShell>
  )
}
