/* MyMoney 알림 표시용 최소 Service Worker. 원격 전송/데이터 접근 없음. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type:'window', includeUncontrolled:true })
    const tab = tabs.find(client => client.url.startsWith(self.registration.scope))
    if (tab) { await tab.focus(); return }
    if (self.clients.openWindow) await self.clients.openWindow(self.registration.scope)
  })())
})
