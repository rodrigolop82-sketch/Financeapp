'use client'

import { useState, useEffect } from 'react'
import { AppIcon } from '@/components/brand/AppIcon'
import { installAnalytics } from '@/lib/install-analytics'
import type { PlatformContext } from '@/lib/platform-detection'

interface Props {
  platform: PlatformContext
  onDismiss: () => void
}

export function IOSInstallWalkthrough({ platform, onDismiss }: Props) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    installAnalytics('install_trigger_shown', { type: 'ios_walkthrough', platform })
  }, [platform])

  function handleDismiss() {
    installAnalytics('install_prompt_dismissed', { platform })
    onDismiss()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleDismiss}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(18,35,59,0.6)',
          zIndex: 9998, backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 9999, background: '#fff', borderRadius: 24,
        padding: '36px 28px 28px', width: 'min(340px, calc(100vw - 40px))',
        boxShadow: '0 12px 48px rgba(18,35,59,0.25)',
        animation: 'fadeScaleIn 0.25s ease-out',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {/* App icon */}
          <div style={{ marginBottom: 16 }}>
            <AppIcon size="lg" variant="electric" />
          </div>

          {step === 0 ? (
            <>
              <h2 style={{
                fontFamily: "'DM Serif Display', serif", fontSize: 20, fontWeight: 400,
                color: '#1E3A5F', margin: '0 0 8px',
              }}>
                Agrega Zafi a tu inicio
              </h2>
              <p style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#64748B',
                margin: '0 0 24px', lineHeight: 1.5,
              }}>
                Paso 1: Toca el botón de compartir en la barra de Safari
              </p>

              {/* Share icon illustration */}
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: '#F0F4FA', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 24, position: 'relative',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L12 16" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                  <path d="M8 6L12 2L16 6" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 14V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V14" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {/* Pulsing pointer */}
                <div style={{
                  position: 'absolute', bottom: -8, right: -8,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#2563EB', opacity: 0.6,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              </div>

              <button
                onClick={() => setStep(1)}
                style={{
                  width: '100%', padding: '12px 24px', borderRadius: 14,
                  background: '#2563EB', color: '#fff', border: 'none',
                  fontFamily: "'Outfit', sans-serif", fontWeight: 700,
                  fontSize: 15, cursor: 'pointer',
                }}
              >
                Siguiente
              </button>
            </>
          ) : (
            <>
              <h2 style={{
                fontFamily: "'DM Serif Display', serif", fontSize: 20, fontWeight: 400,
                color: '#1E3A5F', margin: '0 0 8px',
              }}>
                Agregar a pantalla de inicio
              </h2>
              <p style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#64748B',
                margin: '0 0 24px', lineHeight: 1.5,
              }}>
                Paso 2: Busca &quot;Agregar a pantalla de inicio&quot; y toca &quot;Agregar&quot;
              </p>

              {/* Plus icon illustration */}
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: '#F0F4FA', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 24, position: 'relative',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="4" stroke="#2563EB" strokeWidth="2" />
                  <path d="M12 8V16M8 12H16" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div style={{
                  position: 'absolute', bottom: -8, right: -8,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#2563EB', opacity: 0.6,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              </div>

              <button
                onClick={handleDismiss}
                style={{
                  width: '100%', padding: '12px 24px', borderRadius: 14,
                  background: '#2563EB', color: '#fff', border: 'none',
                  fontFamily: "'Outfit', sans-serif", fontWeight: 700,
                  fontSize: 15, cursor: 'pointer',
                }}
              >
                Entendido
              </button>
            </>
          )}

          {/* Step dots */}
          <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
            {[0, 1].map(i => (
              <div key={i} style={{
                width: i === step ? 20 : 8, height: 8, borderRadius: 4,
                background: i === step ? '#2563EB' : '#E2E8F0',
                transition: 'all 0.2s ease',
              }} />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0.2; }
        }
      `}</style>
    </>
  )
}
