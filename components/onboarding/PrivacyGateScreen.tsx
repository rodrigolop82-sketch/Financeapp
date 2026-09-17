'use client'

import { ShieldCheck, Lock, UserCheck, BarChart3, Trash2 } from 'lucide-react'

interface PrivacyGateScreenProps {
  onContinue: () => void
}

const PRIVACY_CARDS = [
  {
    icon: UserCheck,
    title: 'Acceso exclusivo tuyo',
    description:
      'Tus datos están protegidos por RLS — cada consulta está ligada a tu cuenta. Nadie más puede verlos.',
  },
  {
    icon: BarChart3,
    title: 'Cero venta de datos',
    description:
      'No vendemos ni monetizamos tu información. Zafi se financia con tu suscripción, no con tus datos.',
  },
  {
    icon: Trash2,
    title: 'Tú decides cuándo salir',
    description:
      'Puedes exportar o eliminar tu cuenta y todos tus datos en cualquier momento desde Configuración.',
  },
] as const

export function PrivacyGateScreen({ onContinue }: PrivacyGateScreenProps) {
  return (
    <div
      style={{
        background: '#1E3A5F',
        borderRadius: 20,
        padding: '36px 24px 32px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(37,99,235,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        <ShieldCheck size={30} color="#7EB3FF" />
      </div>

      <h2
        className="font-serif"
        style={{
          fontSize: 22,
          fontWeight: 400,
          color: '#FFFFFF',
          margin: '0 0 10px',
          lineHeight: 1.3,
        }}
      >
        Tu información es tuya. Solo tuya.
      </h2>

      <p
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.55)',
          margin: '0 0 20px',
          lineHeight: 1.5,
        }}
      >
        Zafi no puede ver, vender ni compartir tu información financiera — ni
        nosotros mismos.
      </p>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(37,99,235,0.15)',
          border: '1px solid rgba(37,99,235,0.35)',
          borderRadius: 20,
          padding: '5px 14px',
          marginBottom: 24,
        }}
      >
        <Lock size={13} color="#7EB3FF" />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#7EB3FF' }}>
          Encriptación activa
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 28,
          textAlign: 'left',
        }}
      >
        {PRIVACY_CARDS.map((card) => (
          <div
            key={card.title}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 14,
              padding: '16px 18px',
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(37,99,235,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <card.icon size={18} color="#7EB3FF" />
            </div>
            <div>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  margin: '0 0 4px',
                }}
              >
                {card.title}
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.55)',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {card.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onContinue}
        style={{
          width: '100%',
          padding: '14px 24px',
          background: '#2563EB',
          border: 'none',
          borderRadius: 12,
          color: '#FFFFFF',
          fontSize: 15,
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 16,
        }}
      >
        Entendido — continuar
      </button>

      <a
        href="/privacidad"
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.4)',
          textDecoration: 'none',
        }}
      >
        Ver política de privacidad completa
      </a>
    </div>
  )
}
