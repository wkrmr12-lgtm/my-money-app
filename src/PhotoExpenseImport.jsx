import { useEffect, useRef, useState } from 'react'
import { guessExpenseCategory, normalizeMerchant, parseReceiptText } from './parseReceiptText.js'
import { isSuspiciousMerchantName, retryMerchantPrefixesEnglish } from './englishMerchantOcr.js'

const categories = ['식비', '카페', '쇼핑', '교통', '생활', '기타']
const MAX_FILE_SIZE = 15 * 1024 * 1024

function isValidEntry(entry) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return false
  const [year, month, day] = entry.date.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return false
  const amount = Number(entry.amount)
  return Boolean(entry.name.trim()) && Number.isSafeInteger(amount) && amount > 0 && amount < 1e12 && categories.includes(entry.category)
}

function hasDuplicate(entry, expenses) {
  if (!entry.name.trim() || !entry.amount || !entry.date) return false
  return expenses.some(item =>
    item.date === entry.date &&
    Number(item.amount) === Number(entry.amount) &&
    normalizeMerchant(item.name) === normalizeMerchant(entry.name)
  )
}

function PhotoExpenseImport({ existingExpenses = [], onImport, onClose }) {
  const fileInput = useRef(null)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [step, setStep] = useState('')
  const [rows, setRows] = useState([])
  const [rawText, setRawText] = useState('')
  const [englishNotice, setEnglishNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) { setPreviewUrl(''); return undefined }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function updateRow(id, values) {
    setRows(previous => previous.map(row => row.id === id ? { ...row, ...values } : row))
  }

  async function analyzeImage(chosen) {
    setFile(chosen)
    setRows([])
    setRawText('')
    setEnglishNotice('')
    setError('')
    setProgress(0)
    if (!chosen) return
    if (!chosen.type.startsWith('image/')) {
      setError('이미지 파일(PNG, JPG 등)을 선택해 주세요.')
      return
    }
    if (chosen.size > MAX_FILE_SIZE) {
      setError('이미지 크기가 15MB를 초과합니다. 더 작은 사진을 사용해 주세요.')
      return
    }

    setBusy(true)
    setStep('한글 글자 인식 도구 준비 중')
    let worker
    try {
      // 이미지 자체는 서버에 업로드하지 않습니다. OCR 모델은 최초 실행 때 다운로드됩니다.
      const { createWorker } = await import('tesseract.js')
      worker = await createWorker(['kor', 'eng'], 1, {
        logger: message => {
          if (message.status === 'recognizing text') {
            setStep('사진 속 글자 인식 중')
            setProgress(Math.round((message.progress || 0) * 100))
          }
        }
      })
      // TSV word boxes allow a targeted English-only retry without changing
      // successful Korean merchant/date/amount recognition.
      const { data } = await worker.recognize(chosen, {}, { text: true, tsv: true })
      const text = data.text || ''
      setRawText(text)
      const parsed = parseReceiptText(text)
      if (parsed.length === 0) {
        setError('날짜와 금액을 함께 인식하지 못했어요. 선명한 거래내역 화면을 캡처해서 다시 시도해 주세요. 아래에서 인식된 텍스트를 확인할 수 있습니다.')
      } else {
        const suspiciousCount = parsed.filter(row => isSuspiciousMerchantName(row.name)).length
        if (suspiciousCount) {
          setStep('영문·숫자 상호명 다시 확인 중')
        }
        // A second pass is restricted to suspicious *prefix* boxes. Never
        // silently replace text from a model guess.
        const proposals = await retryMerchantPrefixesEnglish(chosen, data.tsv, parsed, createWorker)
        const suggestions = new Map(proposals.map(item => [item.rowIndex, item.suggestedName]))
        const hasSuggestions = proposals.length > 0
        if (hasSuggestions) setEnglishNotice('영문 상호명 수정 후보가 있어요. 후보를 확인하고 직접 적용해 주세요.')
        else if (suspiciousCount) setEnglishNotice('영문·숫자 상호명에 인식 오류가 있을 수 있어요. 원본과 비교해 직접 수정해 주세요.')
        setRows(parsed.map((entry, index) => {
          const duplicated = hasDuplicate(entry, existingExpenses)
          const needsMerchantReview = Boolean(suggestions.get(index) || isSuspiciousMerchantName(entry.name))
          return {
            ...entry,
            id: crypto.randomUUID(),
            suggestedName: suggestions.get(index) || '',
            needsMerchantReview,
            // 잘못 읽었을 가능성이 있는 이름은 자동 선택하지 않음
            selected: Boolean(entry.date && entry.name && entry.amount && !duplicated && !entry.uncertain && !needsMerchantReview),
          }
        }))
      }
    } catch (err) {
      setError('사진 인식에 실패했어요. 인터넷 연결과 이미지 형식을 확인해 주세요. 처음 실행할 때는 한글 인식 모델 다운로드가 필요합니다.')
      console.error('MyMoney 사진 인식 오류:', err)
    } finally {
      if (worker) {
        try { await worker.terminate() } catch { /* worker 종료 실패가 저장에 영향을 주지 않도록 */ }
      }
      setBusy(false)
      setStep('')
    }
  }

  function submitImport() {
    const selected = rows.filter(row => row.selected)
    if (!selected.length) { setError('등록할 거래를 선택해 주세요.'); return }
    if (selected.some(row => !isValidEntry(row))) {
      setError('선택한 거래에 빈 사용처, 잘못된 날짜 또는 금액이 있어요. 수정 후 등록해 주세요.')
      return
    }
    if (selected.some(row => row.needsMerchantReview)) {
      setError('영문 상호명이 의심되는 거래가 선택됐어요. 사진과 비교해 사용처를 수정하거나 제안된 이름을 적용해 주세요.')
      return
    }
    const duplicateCount = selected.filter(row => hasDuplicate(row, existingExpenses)).length
    const msg = `선택한 지출 ${selected.length}건을 등록할까요?\n총 ${selected.reduce((total, row) => total + Number(row.amount), 0).toLocaleString('ko-KR')}원${duplicateCount ? `\n\n주의: 기존 기록과 일치하는 거래 ${duplicateCount}건이 포함되어 있습니다.` : ''}`
    if (!window.confirm(msg)) return
    try {
      onImport(selected.map(row => ({
        date: row.date,
        name: row.name.trim(),
        amount: Number(row.amount),
        category: row.category,
        memo: row.memo.trim().slice(0, 200),
      })))
    } catch (err) {
      console.error(err)
      setError('지출 내역 등록 중 문제가 발생했어요. 다시 시도해 주세요.')
    }
  }

  const selected = rows.filter(row => row.selected)
  const selectedTotal = selected.reduce((total, row) => total + Number(row.amount || 0), 0)
  const invalidSelected = selected.some(row => !isValidEntry(row) || row.needsMerchantReview)

  return (
    <section className="v6-photo-import-panel" aria-label="사진으로 지출 등록">
      <div className="v6-photo-head">
        <div>
          <h3>📷 사진으로 지출 등록</h3>
          <p>카드·은행 거래내역 캡처에서 날짜, 사용처, 출금액을 읽어요.</p>
        </div>
        <button className="v6-photo-close" type="button" onClick={onClose} disabled={busy}>닫기 ✕</button>
      </div>
      <input
        ref={fileInput}
        className="v6-photo-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="카드 또는 은행 사용내역 이미지 선택"
        disabled={busy}
        onChange={event => {
          const selectedFile = event.target.files?.[0]
          if (selectedFile) analyzeImage(selectedFile)
          event.target.value = ''
        }}
      />
      <button className="v6-photo-select" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
        <span className="v6-photo-select-icon" aria-hidden="true">▧</span>
        <strong>{file ? '다른 거래내역 사진 선택' : '거래내역 사진 선택하기'}</strong>
        <small>PNG · JPG · WEBP (최대 15MB)</small>
      </button>
      <p className="v6-photo-hint">사진 속 글자를 기기에서 분석합니다. 최초 실행 시 한글 인식 모델을 다운로드하므로 인터넷 연결이 필요해요.</p>
      {previewUrl && <img className="v6-photo-preview" src={previewUrl} alt="사용자가 선택한 결제 내역 사진 미리보기" />}
      {busy && (
        <div className="v6-photo-progress" role="status" aria-live="polite">
          <span>{step} {progress ? `${progress}%` : ''}</span>
          <div className="v6-photo-progress-track"><div style={{width:`${progress}%`}} /></div>
        </div>
      )}
      {error && <p className="v6-photo-error" role="alert">{error}</p>}
      {englishNotice && <p className="v6-photo-notice" role="status">🔎 {englishNotice}</p>}

      {rows.length > 0 && (
        <div className="v6-photo-results">
          <div className="v6-photo-results-head">
            <h4>인식된 거래 {rows.length}건</h4>
            <span>사용처·금액·날짜를 꼭 확인하세요</span>
          </div>
          <p className="v6-photo-notice">회색 잔액은 등록 대상이 아니며, 인식되지 않은 칸은 직접 입력할 수 있어요. 기존 기록과 동일한 거래는 중복 후보로 표시됩니다.</p>
          {rows.map((row, index) => {
            const duplicate = hasDuplicate(row, existingExpenses)
            const valid = isValidEntry(row)
            return (
              <div className={`v6-photo-result ${row.selected ? 'is-selected' : ''}`} key={row.id}>
                <div className="v6-photo-result-head">
                  <label className="v6-photo-checkbox">
                    <input type="checkbox" checked={row.selected} onChange={e => updateRow(row.id, {selected:e.target.checked})} />
                    <strong>거래 {index + 1}</strong>
                  </label>
                  <div className="v6-photo-tags">
                    {duplicate && <span className="v6-photo-tag warning">중복 후보</span>}
                    {row.needsMerchantReview && <span className="v6-photo-tag warning">영문 확인 필요</span>}
                    {(!valid || row.uncertain) && <span className="v6-photo-tag warning">확인 필요</span>}
                    {valid && !duplicate && !row.uncertain && !row.needsMerchantReview && <span className="v6-photo-tag success">확인 가능</span>}
                  </div>
                </div>
                <div className="v6-photo-fields">
                  <label>결제 날짜
                    <input type="date" value={row.date} onChange={e => updateRow(row.id, {date:e.target.value})} />
                  </label>
                  <label>결제 금액 (원)
                    <input type="number" min="1" inputMode="numeric" value={row.amount} placeholder="직접 입력" onChange={e => updateRow(row.id, {amount:e.target.value})} />
                  </label>
                  <label className="v6-photo-wide">사용처 / 상호명
                    <input type="text" maxLength="100" value={row.name} placeholder="인식되지 않음 — 직접 입력" onChange={e => updateRow(row.id, {name:e.target.value,category:guessExpenseCategory(e.target.value),needsMerchantReview:false,suggestedName:''})} />
                    {row.suggestedName && (
                      <button type="button" className="v6-photo-apply-suggestion" style={{display:'block',width:'100%',marginTop:9,padding:'10px 12px',border:'1px solid #90b4eb',borderRadius:10,background:'#edf5ff',color:'#163b7b',fontSize:13,fontWeight:700,textAlign:'left',cursor:'pointer'}} onClick={() => updateRow(row.id, {name:row.suggestedName,category:guessExpenseCategory(row.suggestedName),needsMerchantReview:false,suggestedName:''})}>
                        ✨ 영어 재인식 제안: {row.suggestedName} — 눌러서 적용
                      </button>
                    )}
                    {row.needsMerchantReview && !row.suggestedName && <small className="v6-photo-merchant-hint" style={{display:'block',marginTop:8,fontSize:12,color:'#a45a1a'}}>영문 부분이 정확한지 원본 사진과 비교해 수정해 주세요.</small>}
                  </label>
                  <label>카테고리
                    <select value={row.category} onChange={e => updateRow(row.id, {category:e.target.value})}>
                      {categories.map(category => <option value={category} key={category}>{category}</option>)}
                    </select>
                  </label>
                  <label>거래 메모 (선택)
                    <input type="text" maxLength="200" value={row.memo} placeholder="메모" onChange={e => updateRow(row.id, {memo:e.target.value})} />
                  </label>
                </div>
              </div>
            )
          })}
          <div className="v6-photo-total">
            <span>선택된 거래 {selected.length}건</span>
            <strong>{selectedTotal.toLocaleString('ko-KR')}원</strong>
          </div>
          <button className="v6-photo-submit" type="button" disabled={busy || selected.length === 0 || invalidSelected} onClick={submitImport}>
            선택한 지출 {selected.length}건 일괄 등록
          </button>
        </div>
      )}
      {rawText && (
        <details className="v6-photo-raw">
          <summary>인식된 원문 텍스트 확인 (인식 오류 점검용)</summary>
          <pre>{rawText}</pre>
        </details>
      )}
    </section>
  )
}

export default PhotoExpenseImport
