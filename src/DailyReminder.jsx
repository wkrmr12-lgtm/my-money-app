import { useEffect, useState } from 'react'
import './DailyReminder.css'

// 웹앱 1차 버전: 사용자가 MyMoney 페이지를 열어 둔 동안만 예약 시간을 검사합니다.
// 사이트가 완전히 닫힌 상태에서도 알림을 보내려면 별도 서버 푸시(Push API)가 필요합니다.
const SETTINGS_KEY = 'mymoney-daily-entry-reminder-v1'
const LAST_SENT_KEY = 'mymoney-daily-entry-reminder-last-date-v1'
const UPDATE_EVENT = 'mymoney-reminder-settings-changed'
const DEFAULT_SETTINGS = { enabled: false, time: '18:00' }

function validTime(time) {
  return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
}

export function readReminderSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    return {
      enabled: value?.enabled === true,
      time: validTime(value?.time) ? value.time : DEFAULT_SETTINGS.time,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function localDateString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function notificationWorkerURL() {
  // Vite BASE_URL이 '/' 또는 '/my-money-app/'인 환경 모두 대응합니다.
  const base = new URL(import.meta.env.BASE_URL || '/', window.location.href)
  return new URL('mymoney-reminder-sw.js', base).href
}

async function showReminderNotification(test = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    throw new Error('브라우저 알림 권한을 허용해야 합니다.')
  }
  const title = test ? 'MyMoney 알림 테스트' : 'MyMoney · 가계부 기록할 시간'
  const options = {
    body: test ? '알림이 정상적으로 표시됩니다. 원하는 시간에 기록을 잊지 마세요!' : '오늘의 지출을 잊지 말고 기록해 보세요. 💙',
    tag: test ? 'mymoney-reminder-test' : 'mymoney-reminder-daily',
  }

  // Android 등 모바일은 new Notification()을 지원하지 않을 수 있으므로
  // 서비스 워커의 showNotification()을 우선 사용합니다.
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register(notificationWorkerURL())
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(title, options)
      return
    } catch (err) {
      // 데스크톱 환경에서는 Notification 생성자를 대체 수단으로 사용합니다.
      if (!('Notification' in window)) throw err
    }
  }
  new Notification(title, options)
}

// settings 탭을 벗어나도 실행되도록 App 최상단에 항상 마운트됩니다.
export function DailyReminderRunner() {
  const [settings, setSettings] = useState(readReminderSettings)

  useEffect(() => {
    const update = () => setSettings(readReminderSettings())
    window.addEventListener(UPDATE_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(UPDATE_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])

  useEffect(() => {
    if (!settings.enabled) return
    let sending = false
    const check = async () => {
      if (sending || !('Notification' in window) || Notification.permission !== 'granted') return
      const now = new Date()
      const [hour, minute] = settings.time.split(':').map(Number)
      const elapsed = now.getHours() * 60 + now.getMinutes() - hour * 60 - minute
      // 백그라운드 탭 타이머가 늦게 실행되어도 몇 시간 늦은 알림은 보내지 않습니다.
      if (elapsed < 0 || elapsed > 4) return
      const date = localDateString(now)
      if (localStorage.getItem(LAST_SENT_KEY) === date) return
      sending = true
      try {
        // 같은 날 탭 여러 개에서 중복으로 알리지 않도록 전송 전에 기록합니다.
        localStorage.setItem(LAST_SENT_KEY, date)
        await showReminderNotification(false)
      } catch (err) {
        localStorage.removeItem(LAST_SENT_KEY)
        console.warn('MyMoney 알림 표시 실패:', err)
      } finally {
        sending = false
      }
    }
    check()
    const id = window.setInterval(check, 20000)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [settings.enabled, settings.time])

  return null
}

export function DailyReminderPanel() {
  const [enabled, setEnabled] = useState(() => readReminderSettings().enabled)
  const [time, setTime] = useState(() => readReminderSettings().time)
  const [savedSettings, setSavedSettings] = useState(readReminderSettings)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))

  function permissionText() {
    if (permission === 'granted') return '브라우저 알림 허용됨'
    if (permission === 'denied') return '브라우저 알림 차단됨 · 사이트 설정에서 허용해 주세요'
    if (permission === 'default') return '알림을 켤 때 허용 여부를 묻습니다'
    return '이 브라우저에서는 알림을 지원하지 않을 수 있습니다'
  }

  async function ensurePermission() {
    if (!window.isSecureContext || !('Notification' in window)) {
      throw new Error('알림 기능은 지원되는 브라우저의 HTTPS 또는 localhost에서 이용할 수 있어요.')
    }
    let result = Notification.permission
    if (result === 'default') result = await Notification.requestPermission()
    setPermission(result)
    if (result !== 'granted') throw new Error('브라우저 알림 권한이 허용되지 않았어요. 사이트 설정에서 알림을 허용해 주세요.')
  }

  async function saveSettings() {
    setFeedback('')
    if (!validTime(time)) { setFeedback('올바른 알림 시간을 선택해 주세요.'); return }
    setBusy(true)
    try {
      if (enabled) await ensurePermission()
      // 기존 가계부 및 백업 저장 키는 변경하지 않습니다.
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ enabled, time }))
      setSavedSettings({ enabled, time })
      window.dispatchEvent(new Event(UPDATE_EVENT))
      setFeedback(enabled ? `매일 ${time} 알림 설정을 저장했어요. MyMoney가 열려 있을 때 작동해요.` : '알림이 꺼졌어요. 더 이상 알림을 보내지 않아요.')
    } catch (err) {
      setFeedback(err.message || '알림 설정을 저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function testNotification() {
    setFeedback('')
    setBusy(true)
    try {
      await ensurePermission()
      await showReminderNotification(true)
      setFeedback('테스트 알림을 보냈어요. 운영체제 알림 센터에서 확인해 주세요.')
    } catch (err) {
      setFeedback(err.message || '테스트 알림을 표시하지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  const isDirty = enabled !== savedSettings.enabled || time !== savedSettings.time

  return (
    <section className="v6-card mymoney-reminder" aria-labelledby="mymoney-reminder-title">
      <div className="mymoney-reminder__head">
        <div>
          <h3 id="mymoney-reminder-title">🔔 가계부 등록 알림</h3>
          <p>잊지 않도록 원하는 시간에 오늘의 지출 등록을 알려드려요.</p>
        </div>
        <span className={'mymoney-reminder__status ' + (savedSettings.enabled ? 'is-on' : '')}>{isDirty ? '변경 사항 저장 필요' : savedSettings.enabled ? `켜짐 · ${savedSettings.time}` : '꺼짐'}</span>
      </div>

      <label className="mymoney-reminder__toggle-row">
        <span><strong>매일 알림 받기</strong><small>원하는 사람만 켤 수 있어요.</small></span>
        <input type="checkbox" role="switch" checked={enabled} onChange={e => {setEnabled(e.target.checked);setFeedback('')}} aria-label="매일 알림 받기" />
      </label>

      <label className="mymoney-reminder__time-row">
        <span>알림 시간</span>
        <input type="time" value={time} onChange={e => {setTime(e.target.value);setFeedback('')}} disabled={!enabled} />
      </label>
      <p className="mymoney-reminder__permission">{permissionText()}</p>
      <div className="mymoney-reminder__actions">
        <button className="mymoney-reminder__save" type="button" onClick={saveSettings} disabled={busy}>{busy ? '처리 중…' : '알림 설정 저장'}</button>
        <button className="mymoney-reminder__test" type="button" onClick={testNotification} disabled={busy}>테스트 알림 보내기</button>
      </div>
      {feedback && <p className="mymoney-reminder__feedback" role="status" aria-live="polite">{feedback}</p>}
      <p className="mymoney-reminder__limit">현재는 웹앱 1차 버전이에요. <strong>MyMoney 페이지가 열려 있을 때</strong> 예약 시각을 확인하므로 브라우저를 완전히 종료하거나 휴대폰이 앱 실행을 중단하면 알림이 누락될 수 있어요. 앱을 닫아도 도착하는 알림은 정식 푸시 기능으로 개발할 예정이에요.</p>
    </section>
  )
}
