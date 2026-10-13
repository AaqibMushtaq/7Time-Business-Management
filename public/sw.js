// 7TIME Production Static Asset Cache Service Worker
const CACHE_NAME = '7time-static-v2'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only cache fingerprinted static assets in /assets/ and SVG icons
  // Never intercept HTML documents, version.json, or Supabase backend API calls
  if (
    event.request.method === 'GET' &&
    (url.pathname.includes('/assets/') || url.pathname.endsWith('.svg'))
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone)
            })
          }
          return networkResponse
        })
      })
    )
    return
  }

  // Passthrough (Network-First) for everything else
})
