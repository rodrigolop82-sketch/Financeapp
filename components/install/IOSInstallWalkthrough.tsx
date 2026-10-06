'use client'

import { useEffect } from 'react'
import { Share } from 'lucide-react'
import { BottomSheet } from '@/components/transactions/BottomSheet'
import { GroupTitle } from '@/components/layout/Pantalla'
import { PRIMARY_BUTTON } from '@/components/movimientos/ui'
import { BENEFITS, InstallHeader, InstallList, StepNumber } from './ui'
import { installAnalytics } from '@/lib/install-analytics'
import type { PlatformContext } from '@/lib/platform-detection'

interface Props {
  platform: PlatformContext
  onDismiss: () => void
}

export function IOSInstallWalkthrough({ platform, onDismiss }: Props) {
  useEffect(() => {
    installAnalytics('install_trigger_shown', { type: 'ios_walkthrough', platform })
  }, [platform])

  function handleDismiss() {
    installAnalytics('install_prompt_dismissed', { platform })
    onDismiss()
  }

  return (
    <BottomSheet themed open onClose={handleDismiss} label="Instalar Zafi">
      <div className="flex flex-col gap-4 px-5 pb-[calc(28px+env(safe-area-inset-bottom))] pt-2.5">
        <InstallHeader />
        <InstallList rows={BENEFITS} />
        <GroupTitle className="-mb-2.5 mt-1">Cómo instalarla en Safari</GroupTitle>
        <InstallList
          rows={[
            { lead: <StepNumber n={1} />, text: <>Toca <b>Compartir</b> <Share size={15} className="-mt-1 inline" aria-label="(el cuadro con flecha)" /> en la barra de Safari</> },
            { lead: <StepNumber n={2} />, text: <>Elige <b>Agregar a pantalla de inicio</b></> },
            { lead: <StepNumber n={3} />, text: <>Toca <b>Agregar</b> arriba a la derecha</> },
          ]}
        />
        <button type="button" onClick={handleDismiss} className={PRIMARY_BUTTON}>Entendido</button>
      </div>
    </BottomSheet>
  )
}
