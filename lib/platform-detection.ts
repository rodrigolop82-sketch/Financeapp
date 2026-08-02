export type PlatformContext = {
  os: 'android' | 'ios' | 'other'
  browser: 'chrome' | 'safari' | 'other'
  isInAppBrowser: boolean
  inAppSource: 'instagram' | 'tiktok' | 'facebook' | 'whatsapp' | null
  isStandalone: boolean
}

export function getPlatformContext(): PlatformContext {
  if (typeof window === 'undefined') {
    return { os: 'other', browser: 'other', isInAppBrowser: false, inAppSource: null, isStandalone: false }
  }

  const ua = navigator.userAgent || ''

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true

  let inAppSource: PlatformContext['inAppSource'] = null
  if (/Instagram/i.test(ua)) inAppSource = 'instagram'
  else if (/musical_ly|BytedanceWebview/i.test(ua)) inAppSource = 'tiktok'
  else if (/FBAN|FBAV/i.test(ua)) inAppSource = 'facebook'
  else if (/WhatsApp/i.test(ua)) inAppSource = 'whatsapp'

  const isInAppBrowser = inAppSource !== null

  let os: PlatformContext['os'] = 'other'
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'ios'
  else if (/Android/i.test(ua)) os = 'android'

  let browser: PlatformContext['browser'] = 'other'
  if (!isInAppBrowser) {
    if (os === 'ios' && /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS/i.test(ua)) {
      browser = 'safari'
    } else if (/Chrome/i.test(ua) && !/Edge|OPR/i.test(ua)) {
      browser = 'chrome'
    }
  }

  return { os, browser, isInAppBrowser, inAppSource, isStandalone }
}
