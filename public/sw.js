const CACHE_NAME = 'zafi-v2'

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    )
    return
  }

  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            return response
          })
      )
    )
    return
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { body: event.data.text() }
  }
  const title = data.title || 'Zafi'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'zafi-notification',
    // Pantalla relacionada: la abre notificationclick.
    data: { url: data.url || '/dashboard' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Tocar el aviso abre su pantalla (data.url, siempre del mismo origen):
// si Zafi ya está abierta, la enfoca y navega; si no, abre una ventana.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  let target = new URL('/dashboard', self.location.origin)
  try {
    const candidate = new URL(event.notification.data?.url || '/dashboard', self.location.origin)
    if (candidate.origin === self.location.origin) target = candidate
  } catch {
    // URL inválida: Inicio.
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue
      try {
        const focused = 'focus' in client ? await client.focus() : client
        if ('navigate' in focused) {
          const navigated = await focused.navigate(target.href)
          if (navigated) return
        }
      } catch {
        // Ventana no controlada por el SW: se abre una nueva abajo.
      }
    }
    await self.clients.openWindow(target.href)
  })())
})
