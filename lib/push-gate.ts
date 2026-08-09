import { getPlatformContext } from '@/lib/platform-detection'

/**
 * Returns true only when the app is running as an installed PWA (standalone).
 * Use this as the sole gate before calling Notification.requestPermission().
 *
 * Push subscription logic does not exist yet in this project.
 * When implemented, wrap the permission request with:
 *   if (canRequestPush()) { Notification.requestPermission()... }
 */
export function canRequestPush(): boolean {
  const ctx = getPlatformContext()
  return ctx.isStandalone
}
