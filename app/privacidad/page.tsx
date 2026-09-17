'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PrivacidadPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F0F4FA',
      padding: '0 16px env(safe-area-inset-bottom)',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 0 64px' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: '#2563EB',
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
            marginBottom: 32,
          }}
        >
          <ArrowLeft size={18} />
          Volver
        </Link>

        <h1
          className="font-serif"
          style={{ fontSize: 28, fontWeight: 400, color: '#1E3A5F', margin: '0 0 8px' }}
        >
          Política de privacidad
        </h1>
        <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 32px' }}>
          Última actualización: 2 de agosto de 2026
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Section title="1. Quiénes somos">
            Zafi es una aplicación web progresiva (PWA) de planificación financiera personal
            operada desde Guatemala, accesible en <strong>zafiapp.com</strong>. Esta política
            describe qué datos recopilamos, cómo los usamos y cómo los protegemos.
          </Section>

          <Section title="2. Datos que recopilamos">
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li><strong>Cuenta:</strong> correo electrónico y nombre al registrarte.</li>
              <li><strong>Datos financieros:</strong> ingresos, gastos, presupuestos, deudas y metas de ahorro que ingresas manualmente o mediante captura de estado de cuenta.</li>
              <li><strong>Audio de voz:</strong> cuando usas la captura por voz, el audio se envía para transcripción y se descarta inmediatamente después — no almacenamos grabaciones.</li>
              <li><strong>Datos de uso:</strong> eventos de navegación, tipo de dispositivo y sistema operativo, para mejorar la experiencia.</li>
            </ul>
          </Section>

          <Section title="3. Cómo usamos tus datos">
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li>Generar tu diagnóstico financiero y recomendaciones personalizadas.</li>
              <li>Calcular tu Health Score y plan de acción.</li>
              <li>Enviarte alertas y recordatorios (si activas notificaciones).</li>
              <li>Mejorar el producto mediante métricas agregadas y anónimas.</li>
            </ul>
          </Section>

          <Section title="4. Procesadores externos">
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li><strong>Supabase</strong> — base de datos y autenticación. Tus datos están protegidos con Row Level Security (RLS): cada consulta está vinculada a tu usuario.</li>
              <li><strong>Claude (Anthropic)</strong> — genera recomendaciones financieras. Tu información se envía procesada en el momento y no se almacena en los servidores de IA.</li>
              <li><strong>Whisper (OpenAI)</strong> — transcripción de audio. El audio se procesa y se descarta; no se retiene ni se usa para entrenar modelos.</li>
              <li><strong>Stripe</strong> — procesamiento de pagos. Zafi no almacena datos de tarjeta; Stripe los gestiona bajo su propia política PCI-DSS.</li>
              <li><strong>Vercel</strong> — hosting y despliegue de la aplicación.</li>
            </ul>
          </Section>

          <Section title="5. Seguridad">
            Toda la comunicación se realiza mediante HTTPS. Los datos en reposo están cifrados
            por Supabase. Usamos Row Level Security para que ni el equipo de Zafi pueda
            consultar tu información financiera individual.
          </Section>

          <Section title="6. Tus derechos">
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li><strong>Acceso:</strong> puedes exportar todos tus datos en cualquier momento desde tu cuenta.</li>
              <li><strong>Eliminación:</strong> puedes solicitar la eliminación completa de tu cuenta y datos desde la sección &quot;Mi cuenta&quot;.</li>
              <li><strong>Portabilidad:</strong> la exportación genera un archivo JSON con toda tu información.</li>
            </ul>
          </Section>

          <Section title="7. Cookies y almacenamiento local">
            Zafi usa cookies esenciales para mantener tu sesión activa y localStorage para
            preferencias de la aplicación (como el estado de instalación). No usamos cookies
            de publicidad ni de seguimiento de terceros.
          </Section>

          <Section title="8. Menores de edad">
            Zafi no está dirigida a menores de 13 años. Si descubrimos que un menor ha
            creado una cuenta, la eliminaremos junto con sus datos.
          </Section>

          <Section title="9. Cambios a esta política">
            Te notificaremos de cambios materiales por correo electrónico o mediante un
            aviso dentro de la aplicación. El uso continuado de Zafi después de la
            notificación constituye aceptación de la política actualizada.
          </Section>

          <Section title="10. Contacto">
            Para preguntas sobre privacidad o para ejercer tus derechos, escríbenos a{' '}
            <strong>privacidad@zafiapp.com</strong>.
          </Section>
        </div>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#64748B' }}>
            <Link href="/terminos" style={{ color: '#2563EB', textDecoration: 'none' }}>
              Términos de servicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1E3A5F', margin: '0 0 8px' }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  )
}
