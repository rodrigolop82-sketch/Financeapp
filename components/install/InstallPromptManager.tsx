'use client'

import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { getPlatformContext, type PlatformContext } from '@/lib/platform-detection'
import { installAnalytics } from '@/lib/install-analytics'
import { AndroidInstallSheet } from './AndroidInstallSheet'
import { IOSInstallWalkthrough } from './IOSInstallWalkthrough'
import { InAppBrowserBounce } from './InAppBrowserBounce'

const LS_DISMISSED = 'zafi_install_dismissed_at'
const LS_COMPLETED = 'zafi_install_completed'
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

type InstallState = 'idle' | 'inapp_bounce' | 'android_sheet' | 'ios_walkthrough' | 'installed' | 'dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Context for the trigger hook
const InstallTriggerContext = createContext<() => void>(() => {})

export function useInstallTrigger() {
  return useContext(InstallTriggerContext)
}

export function InstallPromptManager({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InstallState>('idle')
  const [platform, setPlatform] = useState<PlatformContext | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  // Detect platform on mount
  useEffect(() => {
    const ctx = getPlatformContext()
    setPlatform(ctx)

    // Already installed — mark and never evaluate again
    if (ctx.isStandalone) {
      localStorage.setItem(LS_COMPLETED, 'true')
      installAnalytics('install_confirmed_standalone', { platform: ctx })
      setState('installed')
      return
    }

    // Already completed in a previous session
    if (localStorage.getItem(LS_COMPLETED) === 'true') {
      setState('installed')
      return
    }

    // In-app browser — show bounce immediately
    if (ctx.isInAppBrowser) {
      setState('inapp_bounce')
      return
    }

    // Capture beforeinstallprompt for Android/Chrome
    function handleBIP(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handleBIP)

    return () => window.removeEventListener('beforeinstallprompt', handleBIP)
  }, [])

  // Check cooldown
  function isDismissedRecently(): boolean {
    const ts = localStorage.getItem(LS_DISMISSED)
    if (!ts) return false
    return Date.now() - Number(ts) < COOLDOWN_MS
  }

  // Trigger exposed via hook — called externally at "first value" moment
  const trigger = useCallback(() => {
    if (!platform) return
    if (platform.isStandalone) return
    if (localStorage.getItem(LS_COMPLETED) === 'true') return
    if (isDismissedRecently()) return
    if (state !== 'idle') return

    if (platform.os === 'android' && deferredPrompt) {
      setState('android_sheet')
    } else if (platform.os === 'ios' && platform.browser === 'safari') {
      setState('ios_walkthrough')
    }
    // Other browsers: do nothing
  }, [platform, deferredPrompt, state]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDismiss() {
    localStorage.setItem(LS_DISMISSED, String(Date.now()))
    setState('dismissed')
  }

  function handleInstalled() {
    localStorage.setItem(LS_COMPLETED, 'true')
    setState('installed')
  }

  function handleContinueInApp() {
    setState('dismissed')
  }

  return (
    <InstallTriggerContext.Provider value={trigger}>
      {children}

      {state === 'inapp_bounce' && platform && (
        <InAppBrowserBounce platform={platform} onContinueInApp={handleContinueInApp} />
      )}

      {state === 'android_sheet' && platform && deferredPrompt && (
        <AndroidInstallSheet
          deferredPrompt={deferredPrompt}
          platform={platform}
          onDismiss={handleDismiss}
          onInstalled={handleInstalled}
        />
      )}

      {state === 'ios_walkthrough' && platform && (
        <IOSInstallWalkthrough platform={platform} onDismiss={handleDismiss} />
      )}
    </InstallTriggerContext.Provider>
  )
}
