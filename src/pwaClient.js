// MyMoney PWA 부팅: 기존 알림 서비스 워커와 동일한 파일을 등록합니다.
// 앱 설치만 추가하며, 가계부 localStorage 데이터는 읽거나 변경하지 않습니다.
const BASE_URL = import.meta.env.BASE_URL || '/'
const APP_BASE = new URL(BASE_URL, window.location.href)

let installPrompt = null
const EVENT_NAME = 'mymoney-pwa-state'

function notify() {
  window.dispatchEvent(new Event(EVENT_NAME))
}

function addHeadLink(rel, href, sizes) {
  const existing = document.head.querySelector(`link[rel="${rel}"]`)
  const node = existing || document.createElement('link')
  node.rel = rel
  node.href = new URL(href, APP_BASE).href
  if (sizes) node.sizes = sizes
  if (!existing) document.head.appendChild(node)
}

function upsertMeta(name, content) {
  const el = document.head.querySelector(`meta[name="${name}"]`) || document.createElement('meta')
  el.name = name
  el.content = content
  if (!el.parentNode) document.head.appendChild(el)
}

addHeadLink('manifest', 'manifest.webmanifest')
addHeadLink('apple-touch-icon', 'icons/mymoney-180.png', '180x180')
upsertMeta('theme-color', '#17345b')
upsertMeta('apple-mobile-web-app-capable', 'yes')
upsertMeta('apple-mobile-web-app-status-bar-style', 'default')
upsertMeta('apple-mobile-web-app-title', 'MyMoney')

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  installPrompt = event
  notify()
})

window.addEventListener('appinstalled', () => {
  installPrompt = null
  notify()
})

// Vite base가 '/'든 '/my-money-app/'든 서비스 워커 경로를 정확히 계산합니다.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('mymoney-reminder-sw.js', APP_BASE).href, {
      scope: APP_BASE.pathname,
    }).catch(error => {
      console.warn('MyMoney 앱 설치용 서비스 워커 등록 실패:', error)
    })
  }, { once: true })
}

export function isAppInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true
}

export function canRequestInstall() {
  return !!installPrompt
}

export function subscribeInstallState(callback) {
  window.addEventListener(EVENT_NAME, callback)
  return () => window.removeEventListener(EVENT_NAME, callback)
}

export async function requestPwaInstall() {
  if (isAppInstalled()) return 'installed'
  const prompt = installPrompt
  if (!prompt) return 'unavailable'
  installPrompt = null
  notify()
  await prompt.prompt()
  const choice = await prompt.userChoice
  notify()
  return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed'
}
