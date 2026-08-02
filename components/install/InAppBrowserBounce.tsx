'use client'

import { useEffect } from 'react'
import { AppIcon } from '@/components/brand/AppIcon'
import { Wordmark } from '@/components/brand/Wordmark'
import { installAnalytics } from '@/lib/install-analytics'
import type { PlatformContext } from '@/lib/platform-detection'

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
}

interface Props {
  platform: PlatformContext
  onContinueInApp: () => void
}

export function InAppBrowserBounce({ platform, onContinueInApp }: Props) {
  const sourceLabel = platform.inAppSource ? SOURCE_LABELS[platform.inAppSource] || platform.inAppSource : 'una app'
  const targetBrowser = platform.os === 'ios' ? 'Safari' : 'Chrome'

  useEffect(() => {
    installAnalytics('install_trigger_shown', { type: 'inapp_bounce', platform })
  }, [platform])

  function handleOpenExternal() {
    installAnalytics('inapp_bounce_opened_external', { platform })
    // Best-effort: attempt to open current URL in external browser.
    // Not all in-app browsers support this — the button is a best effort.
    const url = window.location.href
    window.open(url, '_blank')
  }

  function handleContinue() {
    installAnalytics('inapp_bounce_continued_inapp', { platform })
    onContinueInApp()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'linear-gradient(180deg, #12233B 0%, #1E3A5F 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 28px', paddingBottom: 'max(40px, env(safe-area-inset-bottom))',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
        <AppIcon size="sm" variant="electric" />
        <Wordmark variant="dark" size="sm" />
      </div>

      {/* Chip: source */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 20,
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
        marginBottom: 28,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
        <span style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
          color: 'rgba(255,255,255,0.7)',
        }}>
          Abierto dentro de {sourceLabel}
        </span>
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: "'DM Serif Display', serif", fontSize: 26, fontWeight: 400,
        color: '#fff', margin: '0 0 12px', textAlign: 'center',
      }}>
        Abre Zafi en {targetBrowser}
      </h1>

      {/* Description */}
      <p style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.6)',
        margin: '0 0 36px', lineHeight: 1.6, textAlign: 'center', maxWidth: 320,
      }}>
        Para la mejor experiencia e instalarlo en tu pantalla de inicio, abre Zafi en {targetBrowser}.
      </p>

      {/* Primary button */}
      <button
        onClick={handleOpenExternal}
        style={{
          width: '100%', maxWidth: 320, padding: '14px 24px', borderRadius: 14,
          background: '#2563EB', color: '#fff', border: 'none',
          fontFamily: "'Outfit', sans-serif", fontWeight: 700,
          fontSize: 16, cursor: 'pointer', marginBottom: 14,
        }}
      >
        Abrir en {targetBrowser}
      </button>

      {/* Secondary button */}
      <button
        onClick={handleContinue}
        style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 14, padding: '12px 24px', cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
          color: 'rgba(255,255,255,0.5)', width: '100%', maxWidth: 320,
        }}
      >
        Continuar aquí por ahora
      </button>
    </div>
  )
}
