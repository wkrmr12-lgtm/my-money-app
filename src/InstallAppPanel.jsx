import { useEffect, useState } from 'react'
import { canRequestInstall, isAppInstalled, requestPwaInstall, subscribeInstallState } from './pwaClient.js'
import './InstallAppPanel.css'

function isIOS() {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export default function InstallAppPanel() {
  const [available, setAvailable] = useState(canRequestInstall)
  const [installed, setInstalled] = useState(isAppInstalled)
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeInstallState(() => {
    setAvailable(canRequestInstall())
    setInstalled(isAppInstalled())
  }), [])

  async function install() {
    setInfo('')
    setBusy(true)
    try {
      const result = await requestPwaInstall()
      if (result === 'accepted') setInfo('설치 요청을 보냈어요. 기기에서 설치가 완료되었는지 확인해 주세요.')
      else if (result === 'dismissed') setInfo('설치를 취소했어요. 언제든 다시 시도할 수 있어요.')
      else if (result === 'unavailable') setInfo('현재는 설치 버튼이 지원되지 않아요. 브라우저 메뉴에서 설치해 주세요.')
      else setInfo('이미 앱으로 실행 중이에요.')
    } catch (error) {
      setInfo('설치 요청에 실패했어요. 브라우저 메뉴에서 설치를 시도해 주세요.')
      console.warn('MyMoney 설치 요청 실패', error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="v6-card mymoney-install" aria-labelledby="mymoney-install-title">
      <div className="mymoney-install__heading">
        <div>
          <h3 id="mymoney-install-title">📱 MyMoney 앱 설치</h3>
          <p>홈 화면에 추가하면 앱처럼 빠르게 실행할 수 있어요.</p>
        </div>
        <span className="mymoney-install__tag">{installed ? '앱 실행 중' : '선택 설치'}</span>
      </div>
      {installed ? (
        <p className="mymoney-install__good" role="status">✓ MyMoney가 설치형 화면에서 실행되고 있어요.</p>
      ) : available ? (
        <button type="button" className="mymoney-install__button" onClick={install} disabled={busy}>
          {busy ? '설치 요청 중…' : '⬇ MyMoney 설치하기'}
        </button>
      ) : (
        <div className="mymoney-install__hint">
          {isIOS() ? (
            <p><strong>아이폰·아이패드:</strong> 공유 메뉴 → <strong>홈 화면에 추가</strong>를 선택해 주세요.</p>
          ) : (
            <p><strong>안드로이드·PC:</strong> Chrome 또는 삼성 인터넷 메뉴에서 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택해 주세요.</p>
          )}
          <small>설치 메뉴가 없다면, HTTPS로 배포된 주소에서 열었는지 확인해 주세요.</small>
        </div>
      )}
      {info && <p className="mymoney-install__message" role="status">{info}</p>}
      <p className="mymoney-install__notice">
        <strong>데이터 안내:</strong> 설치해도 기록이 클라우드로 전송되거나 다른 기기와 자동 동기화되지는 않아요.
        휴대폰에서 기록을 사용하려면 설정 → 데이터 백업·복원 기능으로 옮겨주세요.
      </p>
      <p className="mymoney-install__notice">일부 기본 화면은 오프라인에서도 열릴 수 있지만, 사진 인식은 인터넷 연결이 필요할 수 있어요. 매일 알림 역시 앱을 완전히 닫은 상태에서는 보장되지 않아요.</p>
    </section>
  )
}
