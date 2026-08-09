'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TerminosPage() {
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
          Términos de servicio
        </h1>
        <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 32px' }}>
          Última actualización: 2 de agosto de 2026
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Section title="1. Aceptación">
            Al crear una cuenta o usar Zafi aceptas estos términos. Si no estás de acuerdo,
            no uses la aplicación.
          </Section>

          <Section title="2. Descripción del servicio">
            Zafi es una herramienta de planificación financiera personal que te ayuda a
            organizar ingresos, gastos, presupuestos y metas de ahorro. Zafi ofrece
            diagnósticos y recomendaciones generadas por inteligencia artificial. Estas
            recomendaciones son orientativas y no constituyen asesoría financiera profesional,
            legal ni fiscal.
          </Section>

          <Section title="3. Cuenta de usuario">
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li>Eres responsable de mantener la confidencialidad de tu cuenta.</li>
              <li>La información que ingreses debe ser veraz y actualizada.</li>
              <li>Puedes eliminar tu cuenta en cualquier momento desde la sección &quot;Mi cuenta&quot;.</li>
            </ul>
          </Section>

          <Section title="4. Plan gratuito y Premium">
            Zafi ofrece un plan gratuito con funcionalidades básicas y un plan Premium con
            acceso a funciones avanzadas. Los precios del plan Premium se muestran al momento
            de la suscripción y pueden cambiar con aviso previo de 30 días. Los pagos se
            procesan mediante Stripe.
          </Section>

          <Section title="5. Reembolsos">
            Si no estás satisfecho con el plan Premium, puedes cancelar en cualquier momento.
            La cancelación toma efecto al final del período de facturación actual. No se
            emiten reembolsos parciales por períodos no utilizados, salvo que la ley
            aplicable lo requiera.
          </Section>

          <Section title="6. Uso aceptable">
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li>No uses Zafi para actividades ilegales o fraudulentas.</li>
              <li>No intentes acceder a datos de otros usuarios.</li>
              <li>No intentes interferir con el funcionamiento de la aplicación.</li>
              <li>No compartas tu cuenta con terceros.</li>
            </ul>
          </Section>

          <Section title="7. Propiedad intelectual">
            Todo el contenido, diseño, código y marca de Zafi son propiedad de sus creadores.
            Tu contenido financiero te pertenece — Zafi solo lo usa para brindarte el
            servicio según se describe en la{' '}
            <Link href="/privacidad" style={{ color: '#2563EB' }}>
              política de privacidad
            </Link>.
          </Section>

          <Section title="8. Limitación de responsabilidad">
            Zafi se ofrece &quot;tal cual&quot;. No garantizamos que la aplicación esté libre de
            errores ni que esté disponible de forma ininterrumpida. Zafi no es un asesor
            financiero certificado. Las decisiones financieras que tomes basándote en la
            información de Zafi son tu responsabilidad. En la medida permitida por la ley,
            Zafi no será responsable por daños indirectos, incidentales o consecuentes.
          </Section>

          <Section title="9. Disponibilidad">
            Nos esforzamos por mantener el servicio disponible, pero pueden ocurrir
            interrupciones por mantenimiento o circunstancias fuera de nuestro control.
            Te notificaremos de interrupciones programadas cuando sea posible.
          </Section>

          <Section title="10. Modificaciones">
            Podemos actualizar estos términos. Te notificaremos de cambios materiales por
            correo electrónico o mediante un aviso dentro de la aplicación al menos 15 días
            antes de que entren en vigor.
          </Section>

          <Section title="11. Ley aplicable">
            Estos términos se rigen por las leyes de la República de Guatemala. Cualquier
            disputa se resolverá ante los tribunales competentes de la ciudad de Guatemala.
          </Section>

          <Section title="12. Contacto">
            Para consultas sobre estos términos, escríbenos a{' '}
            <strong>legal@zafiapp.com</strong>.
          </Section>
        </div>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#64748B' }}>
            <Link href="/privacidad" style={{ color: '#2563EB', textDecoration: 'none' }}>
              Política de privacidad
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
