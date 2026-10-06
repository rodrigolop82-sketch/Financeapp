'use client'

import { useEffect } from 'react'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { PRIMARY_BUTTON, TEXT_MUTED } from '@/components/movimientos/ui'
import { BENEFITS, InstallHeader, InstallList } from './ui'
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
    <BottomSheet themed open onClose={handleDismiss} label="Instalar Zafi">
      <div className="flex flex-col gap-4 px-5 pb-[calc(28px+env(safe-area-inset-bottom))] pt-2.5">
        <InstallHeader />
        <InstallList rows={BENEFITS} />
        <button type="button" onClick={() => void handleInstall()} className={PRIMARY_BUTTON}>Instalar</button>
        <button type="button" onClick={handleDismiss} className={`h-11 text-[15px] font-semibold ${TEXT_MUTED}`}>Ahora no</button>
      </div>
    </BottomSheet>
  )
}
