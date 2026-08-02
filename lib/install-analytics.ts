import type { PlatformContext } from '@/lib/platform-detection'

type InstallEvent =
  | 'install_trigger_shown'
  | 'install_prompt_accepted'
  | 'install_prompt_dismissed'
  | 'install_confirmed_standalone'
  | 'inapp_bounce_opened_external'
  | 'inapp_bounce_continued_inapp'
  | 'push_permission_requested'
  | 'push_permission_granted'
  | 'push_permission_denied'

export function installAnalytics(
  event: InstallEvent,
  data: { platform: PlatformContext; type?: string; [key: string]: unknown },
) {
  // No analytics stack exists yet — log with prefix for DevTools visibility.
  // Replace with PostHog/GA/Vercel Analytics call when a stack is adopted.
  console.log('[zafi:install]', event, {
    os: data.platform.os,
    browser: data.platform.browser,
    isInApp: data.platform.isInAppBrowser,
    inAppSource: data.platform.inAppSource,
    isStandalone: data.platform.isStandalone,
    ...data,
    platform: undefined,
  })
}
