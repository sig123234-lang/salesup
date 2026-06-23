// SalesUp custom Service Worker — handles Web Push notifications.
//
// Registered from /settings (NotificationSettings.tsx) when the user opts in.
// The Push subscription is persisted server-side in
// profiles.metadata.push_subscription; matching VAPID keys live in .env.local.

self.addEventListener('install', (event) => {
  // Activate immediately so subscriptions persist across deploys.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (e) {
    payload = { title: 'SalesUp', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'SalesUp'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/salesup-icon.svg',
    badge: payload.badge || '/salesup-icon.svg',
    tag: payload.tag || 'salesup-notification',
    data: { url: payload.url || '/dashboard' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/dashboard'
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(url)
            } catch (e) {
              // Some browsers throw on cross-origin or already-closed windows.
            }
          }
          return
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url)
      }
    })(),
  )
})
