import { useState } from 'react'
import {
  captureMyMoneyData, createBackupDocument, downloadBackupDocument,
  getBackupSummary, makeBackupFilename, MAX_FILE_BYTES,
  prepareRestoredData, readBackupDocument, writeRestoredData,
} from './mymoneyBackup.js'
import './DataBackupPanel.css'

const formatCount = count => `${count.toLocaleString('ko-KR')}건`

export default function DataBackupPanel() {
  const [loadedFile, setLoadedFile] = useState(null)
  const [mode, setMode] = useState('merge')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  let currentSummary = null
  try { currentSummary = getBackupSummary(captureMyMoneyData()) } catch { /* existing malformed data, backup will explain */ }

  const backup = () => {
    setError('')
    setStatus('')
    try {
      downloadBackupDocument(createBackupDocument(), makeBackupFilename())
      setStatus('현재 가계부 백업 파일을 다운로드했어요. 다운로드 폴더를 확인해 주세요.')
    } catch (e) {
      setError(e.message || '백업 중 오류가 발생했습니다.')
    }
  }

  const chooseFile = async event => {
    const file = event.target.files?.[0]
    setLoadedFile(null)
    setError('')
    setStatus('')
    event.target.value = '' // allow selecting the same file again
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setError('파일 크기가 너무 큽니다. 12MB 이하의 JSON 백업을 선택해 주세요.')
      return
    }
    setBusy(true)
    try {
      const parsed = readBackupDocument(await file.text())
      setLoadedFile({ name: file.name, data: parsed.data, summary: getBackupSummary(parsed.data), createdAt: parsed.createdAt })
      setStatus('백업 파일 확인 완료! 아직 가계부에 반영되지는 않았어요.')
    } catch (e) {
      setError(`파일을 불러올 수 없어요. ${e.message || 'JSON 형식을 확인해 주세요.'}`)
    } finally {
      setBusy(false)
    }
  }

  const restore = () => {
    if (!loadedFile || busy) return
    setError('')
    setStatus('')
    const question = mode === 'merge'
      ? '백업에 있는 기록을 현재 가계부에 추가할까요?\n같은 ID의 수입·지출·메모는 중복 등록하지 않고 기존 데이터를 우선합니다.\n\n복원 직전 현재 데이터를 안전 백업 파일로 내려받습니다.'
      : '주의! 현재 MyMoney의 수입·지출·메모·예산을 백업 파일 내용으로 교체할까요?\n백업에 없는 현재 기록은 사라집니다.\n\n복원 직전 현재 데이터를 안전 백업 파일로 내려받습니다.'
    if (!window.confirm(question)) return
    setBusy(true)
    try {
      const current = captureMyMoneyData()
      const target = prepareRestoredData(current, loadedFile.data, mode, {
        fallbackMonth: new Date().toLocaleDateString('sv-SE').slice(0, 7),
      })
      // Never mutate existing data until a before-restore checkpoint has been offered.
      if (Object.keys(current).length > 0) {
        downloadBackupDocument(createBackupDocument(), makeBackupFilename('MyMoney-before-restore'))
      }
      writeRestoredData(window.localStorage, target)
      window.alert('복원이 완료되었습니다!\n가계부 화면을 새로고침하여 변경된 기록을 불러옵니다.\n복원 전 안전 백업 파일도 보관해 주세요.')
      window.location.reload()
    } catch (e) {
      setError(e.message || '복원하는 중 오류가 발생했습니다.')
      setBusy(false)
    }
  }

  return (
    <section className="v6-card v6-backup-card" aria-label="데이터 백업과 복원">
      <div className="v6-backup-heading">
        <h3>💾 데이터 백업·복원</h3>
        <p>수입·지출·메모·월별 예산을 내 컴퓨터에 안전하게 보관해요. 파일은 서버로 전송되지 않아요.</p>
      </div>
      <div className="v6-backup-section">
        <div className="v6-backup-section-title"><strong>① 현재 기록 백업</strong><span>추천 · 수시로 백업하기</span></div>
        {currentSummary && (
          <div className="v6-backup-metrics" aria-label="현재 저장된 기록">
            <span>지출 <b>{formatCount(currentSummary.expenses)}</b></span>
            <span>수입 <b>{formatCount(currentSummary.incomes)}</b></span>
            <span>메모 <b>{formatCount(currentSummary.memos)}</b></span>
            <span>예산 <b>{currentSummary.budgets}개월</b></span>
          </div>
        )}
        <p className="v6-backup-help">아래 버튼을 누르면 현재 MyMoney 기록을 JSON 파일 하나로 다운로드해요.</p>
        <button type="button" className="v6-backup-primary" onClick={backup} disabled={busy}>↓ 내 가계부 백업하기</button>
      </div>
      <div className="v6-backup-section">
        <div className="v6-backup-section-title"><strong>② 파일로 기록 복원</strong><span>다른 컴퓨터에서도 사용 가능</span></div>
        <label className="v6-backup-file-label" htmlFor="v6-backup-file-input">백업 JSON 파일 선택</label>
        <input id="v6-backup-file-input" type="file" accept=".json,application/json" onChange={chooseFile} disabled={busy}/>
        {loadedFile && (
          <div className="v6-backup-preview">
            <strong>✓ 파일 확인 완료</strong>
            <small className="v6-backup-filename" title={loadedFile.name}>{loadedFile.name}</small>
            <div className="v6-backup-metrics">
              <span>지출 <b>{formatCount(loadedFile.summary.expenses)}</b></span>
              <span>수입 <b>{formatCount(loadedFile.summary.incomes)}</b></span>
              <span>메모 <b>{formatCount(loadedFile.summary.memos)}</b></span>
              <span>예산 <b>{loadedFile.summary.budgets}개월</b></span>
            </div>
            <fieldset className="v6-backup-modes">
              <legend>복원 방식 선택</legend>
              <label className={mode === 'merge' ? 'selected' : ''}>
                <input type="radio" name="v6-backup-mode" value="merge" checked={mode === 'merge'} onChange={() => setMode('merge')}/>
                <span><strong>기존 기록 유지하고 합치기 (추천)</strong><small>현재 기록을 우선 보존해요. 같은 ID의 거래·메모는 중복 추가하지 않아요. 같은 달 예산은 기존 값을 유지해요.</small></span>
              </label>
              <label className={mode === 'replace' ? 'selected' : ''}>
                <input type="radio" name="v6-backup-mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')}/>
                <span><strong>백업 파일 내용으로 교체</strong><small>백업에 없는 현재 기록은 삭제돼요. 예전 시점으로 완전히 복구할 때 사용하세요.</small></span>
              </label>
            </fieldset>
            <button type="button" className={mode === 'replace' ? 'v6-backup-restore-danger' : 'v6-backup-primary'} onClick={restore} disabled={busy}>
              {busy ? '처리 중…' : mode === 'replace' ? '백업 내용으로 교체 복원' : '현재 기록에 합쳐서 복원'}
            </button>
          </div>
        )}
        <p className="v6-backup-help">복원 전에는 현재 기록도 자동으로 안전 백업해요. 실수로 교체하더라도 해당 파일로 복구할 수 있어요.</p>
      </div>
      {status && <p className="v6-backup-status" role="status" aria-live="polite">✓ {status}</p>}
      {error && <p className="v6-backup-error" role="alert">⚠ {error}</p>}
      <p className="v6-backup-caution">⚠ 백업 파일에는 개인 소비 내역이 포함돼요. 다른 사람에게 공유하지 말고 안전한 곳에 보관해 주세요. 브라우저 데이터를 삭제하면 이 기기의 원본 기록은 사라질 수 있어요.</p>
    </section>
  )
}
