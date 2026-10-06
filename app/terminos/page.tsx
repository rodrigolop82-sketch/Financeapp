'use client'

import Link from 'next/link'
import { LINK_TEXT } from '@/components/layout/Pantalla'
import { TEXT_BODY, TEXT_MUTED, TEXT_STRONG } from '@/components/movimientos/ui'

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[var(--zafi-bg)] px-5 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-[680px] pb-16 pt-[calc(16px+env(safe-area-inset-top))]">
        <Link href="/" className={`flex h-11 items-center text-[15px] font-semibold ${LINK_TEXT}`}>‹ Zafi</Link>
        <h1 className={`font-serif text-[30px] leading-[1.15] ${TEXT_STRONG}`}>Términos de servicio</h1>
        <p className={`mb-8 mt-1 text-[13px] ${TEXT_MUTED}`}>Última actualización: 2 de agosto de 2026</p>

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
            <Link href="/privacidad" className={LINK_TEXT}>
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

        <div className="mt-10 border-t border-[var(--zafi-border)] pt-5">
          <div className={`flex gap-6 text-[13px] ${TEXT_MUTED}`}>
            <Link href="/privacidad" className={LINK_TEXT}>
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
    <section>
      <h2 className={`mb-2 text-[17px] font-bold ${TEXT_STRONG}`}>{title}</h2>
      <div className={`text-base leading-[1.65] ${TEXT_BODY}`}>{children}</div>
    </section>
  )
}
