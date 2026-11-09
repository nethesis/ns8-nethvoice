// chat-island service worker: shows a notification for a Web Push sent by the
// NethVoice chat gateway and brings the app to the conversation on click.
// Host apps copy this file next to their pages and pass its URL to ChatIsland.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }
  const title = data.name || data.from || 'New message'
  event.waitUntil(self.registration.showNotification(title, { body: data.body || '', tag: 'chat-' + (data.from || ''), renotify: true, data }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const from = event.notification.data && event.notification.data.from
  // The app's own tab, the one under this worker's scope, not any window of the site.
  const scope = self.registration.scope
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const target = list.find((c) => c.url.startsWith(scope)) || list[0]
    if (target) { target.focus(); target.postMessage({ type: 'chat-island-open', username: from }) }
    else self.clients.openWindow(scope)
  }))
})
