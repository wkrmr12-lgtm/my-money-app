/* MyMoney 설치형 앱 + 기존 일일 가계부 알림용 단일 서비스 워커.
 * same-origin 정적 리소스만 저장하며 개인 가계부 데이터는 접근하지 않습니다.
 */
const CACHE_PREFIX = 'mymoney-pwa-shell-'
const CACHE_NAME = `${CACHE_PREFIX}2026-11-v1`
const APP_HOME = new URL('./', self.location.href).href
const APP_PATH = new URL(APP_HOME).pathname

self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME)
      await cache.add(new Request(APP_HOME, { cache: 'reload' }))
    } catch (error) {
      // 온라인 설치 자체가 실패하지 않도록 오프라인 준비 오류는 경고만 남깁니다.
      console.warn('MyMoney 첫 화면 저장 실패:', error)
    }
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

async function cacheValidResponse(request, response) {
  if (response?.ok && response.type === 'basic') {
    try {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, response.clone())
    } catch (error) {
      // 저장 공간 부족으로 캐시에 실패해도 온라인 사용은 가능해야 합니다.
      console.warn('MyMoney 오프라인 저장 실패:', error)
    }
  }
  return response
}

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_PATH)) return

  // 개인 재무 데이터는 네트워크 캐시로 취급하지 않습니다.
  // MyMoney 기록은 기존과 동일하게 브라우저 localStorage에만 저장됩니다.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        return await cacheValidResponse(request, response)
      } catch {
        return (await caches.match(request)) ||
          (await caches.match(APP_HOME)) ||
          Response.error()
      }
    })())
    return
  }

  // Vite의 빌드 JS/CSS, 앱 아이콘 등 정적 파일만 캐시합니다.
  // 쿼리/응용프로그램 API 응답, 외부 OCR 서버 응답은 캐시하지 않습니다.
  const isBuildAsset = url.pathname.includes('/assets/')
  const isStaticFile = /\.(?:js|css|svg|png|jpg|jpeg|webp|ico|woff2?|webmanifest)$/.test(url.pathname)
  if (!isBuildAsset && !isStaticFile) return

  event.respondWith((async () => {
    try {
      const response = await fetch(request)
      return await cacheValidResponse(request, response)
    } catch {
      return (await caches.match(request)) || Response.error()
    }
  })())
})

// 이전 1차 알림 기능을 보존합니다.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const tab = tabs.find(client => client.url.startsWith(self.registration.scope))
    if (tab) { await tab.focus(); return }
    if (self.clients.openWindow) await self.clients.openWindow(self.registration.scope)
  })())
})
