'use client'

import { useEffect, useRef } from 'react'
import { AppIcon } from '@/components/brand/AppIcon'
import { installAnalytics } from '@/lib/install-analytics'
import type { PlatformContext } from '@/lib/platform-detection'

interface Props {
  deferredPrompt: BeforeInstallPromptEvent
  platform: PlatformContext
  onDismiss: () => void
  onInstalled: () => void
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function AndroidInstallSheet({ deferredPrompt, platform, onDismiss, onInstalled }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    installAnalytics('install_trigger_shown', { type: 'android_sheet', platform })
  }, [platform])

  async function handleInstall() {
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      installAnalytics('install_prompt_accepted', { platform })
      onInstalled()
    } else {
      installAnalytics('install_prompt_dismissed', { platform })
      onDismiss()
    }
  }

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

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: '#fff', borderRadius: '24px 24px 0 0',
          padding: '32px 28px', paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 40px rgba(18,35,59,0.2)',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {/* App icon */}
          <div style={{ marginBottom: 16 }}>
            <AppIcon size="lg" variant="electric" />
          </div>

          {/* Title */}
          <h2 style={{
            fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400,
            color: '#1E3A5F', margin: '0 0 8px',
          }}>
            Instalar Zafi
          </h2>

          {/* Description */}
          <p style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#64748B',
            margin: '0 0 28px', lineHeight: 1.5, maxWidth: 300,
          }}>
            Accede a tu diagnóstico financiero y alertas directamente desde tu pantalla de inicio.
          </p>

          {/* Install button */}
          <button
            onClick={handleInstall}
            style={{
              width: '100%', padding: '14px 24px', borderRadius: 14,
              background: '#2563EB', color: '#fff', border: 'none',
              fontFamily: "'Outfit', sans-serif", fontWeight: 700,
              fontSize: 16, cursor: 'pointer', marginBottom: 12,
            }}
          >
            Instalar
          </button>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif", fontSize: 14,
              color: '#94A3B8', fontWeight: 500, padding: '8px 16px',
            }}
          >
            Ahora no
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
