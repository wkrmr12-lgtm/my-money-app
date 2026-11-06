import { useEffect, useRef, useState } from 'react'
import { guessExpenseCategory, normalizeMerchant, parseReceiptText } from './parseReceiptText.js'
import { isSuspiciousMerchantName, retryMerchantPrefixesEnglish } from './englishMerchantOcr.js'
import { extractOcrWords, looksLikeCardList, parseCardLayout, parseCardWithAmounts } from './parseCardLayout.js'

const categories = ['식비', '카페', '쇼핑', '교통', '생활', '기타']
const MAX_FILE_SIZE = 15 * 1024 * 1024

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day
}

function isValidAmount(value) {
  if (value === '' || value === null || value === undefined) return false
  const amount = Number(value)
  return Number.isSafeInteger(amount) && amount > 0 && amount < 1e12
}

function isValidEntry(entry) {
  return isValidDate(entry.date) && isValidAmount(entry.amount) &&
    Boolean(String(entry.name || '').trim()) && categories.includes(entry.category)
}

// These patterns are *suspicions*, not proof that the OCR is wrong. A common
// example is '05월편한세상답동호', which was read as a valid-looking merchant.
function isLikelyIncompleteMerchant(name) {
  const value = String(name || '').trim()
  const compact = value.replace(/\s+/g, '')
  return /^\d{1,2}월(?=[가-힣A-Za-z0-9])/.test(compact) ||
    /[.…�]|\.{3,}|본인\d{3,}|(?:국내|해외)일시불/.test(value) ||
    isSuspiciousMerchantName(value)
}

function hasPendingReview(row) {
  return getReviewIssues(row).length > 0
}

// '확인 필요'는 유효한 숫자/날짜여도 OCR 신뢰도가 낮을 때 남아 있습니다.
// 사용자가 직접 수정하거나 원본을 확인하기 전에는 제출하지 않습니다.
function getReviewIssues(row) {
  const issues = []
  if (!isValidDate(row.date)) issues.push('결제 날짜 입력')
  else if (row.needsDateReview) issues.push('결제 날짜 확인')
  if (!isValidAmount(row.amount)) issues.push('결제 금액 입력')
  else if (row.needsAmountReview) issues.push('결제 금액 확인')
  if (!String(row.name || '').trim()) issues.push('사용처 입력')
  else if (row.needsNameReview || row.needsMerchantReview) issues.push('사용처 확인')
  if (!categories.includes(row.category)) issues.push('카테고리 선택')
  if (row.uncertain && !issues.length) issues.push('인식 결과 확인')
  return issues
}

function reviewFocusField(row) {
  if (!isValidDate(row.date) || row.needsDateReview) return 'date'
  if (!isValidAmount(row.amount) || row.needsAmountReview) return 'amount'
  if (!String(row.name || '').trim() || row.needsNameReview || row.needsMerchantReview) return 'name'
  if (!categories.includes(row.category)) return 'category'
  return 'review'
}

function hasDuplicate(entry, expenses) {
  if (!entry.name.trim() || !entry.amount || !entry.date) return false
  return expenses.some(item =>
    item.date === entry.date &&
    Number(item.amount) === Number(entry.amount)
    // 같은 날짜/금액이면 OCR이 상호명을 다르게 읽더라도 중복 후보로 표시.
    // 사용자가 직접 확인한 경우에만 등록하도록 합니다.
  )
}

// Second-pass OCR is important for screenshots with a date heading followed by
// multiple rows of purchases. It does not rely on the OCR full-page text order.
async function recognizeColumn(worker, bitmap, rect, {numeric = false, dates = false} = {}) {
  const left = Math.max(0, Math.floor(bitmap.width * rect[0]))
  const top = Math.max(0, Math.floor(bitmap.height * rect[1]))
  const right = Math.min(bitmap.width, Math.ceil(bitmap.width * rect[2]))
  const bottom = Math.min(bitmap.height, Math.ceil(bitmap.height * rect[3]))
  const w = right - left, h = bottom - top
  if (w < 20 || h < 20) return []
  const scale = numeric ? 2 : 1.5
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  ctx.drawImage(bitmap, left, top, w, h, 0, 0, canvas.width, canvas.height)

  // Numeric-only pass avoids Korean/English OCR merging adjacent prices.
  // Sparse-text segmentation allows values on different rows of one date.
  const param = {
    tessedit_pageseg_mode:'11',
    tessedit_char_whitelist:numeric ? '0123456789,' : dates ? '0123456789./-' : ''
  }
  await worker.setParameters(param)
  try {
    const result = await worker.recognize(canvas, {}, {text:true, tsv:true, blocks:true})
    const words = extractOcrWords(result.data, {x:left,y:top,scale}).words
    return words
  } finally {
    // Restore the default mixed-language recognition settings for later images.
    await worker.setParameters({tessedit_pageseg_mode:'3',tessedit_char_whitelist:''})
  }
}

async function readCardLayoutWithFallback(worker, file, data, rawText, onStep) {
  const bitmap = await createImageBitmap(file)
  try {
    const width=bitmap.width, height=bitmap.height
    const initial = parseCardLayout(data.tsv, rawText, {width,height,blocks:data.blocks}) || []
    let extraAmountWords=[]
    let dateWords=[]
    let merchantWords=[]
    try {
      onStep('금액 영역을 따로 확인하는 중')
      extraAmountWords=await recognizeColumn(worker,bitmap,[.68,.085,.96,.93],{numeric:true})
    } catch (err) { console.warn('금액 열 재인식 실패:',err) }
    const fullWords=extractOcrWords(data).words
    // Some browser versions omit one type of positional OCR output.
    // A dedicated date scan keeps dates associated with every amount row.
    const rawDateCount=fullWords.filter(w=>/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(w.text)).length
    // Statements can print one date *beneath each price*. Retry the date
    // column if some dates are missing, even if at least one date was read.
    const detailLayout=/이용대금명세서|(?:본인\d{3,}\*?).{0,25}일시불/.test(rawText.replace(/\s/g,''))
    if (rawDateCount===0 || (detailLayout && rawDateCount<Math.max(initial.length,extraAmountWords.length))) {
      try {
        onStep('카드 거래 날짜 확인 중')
        const scanned=await recognizeColumn(worker,bitmap,[.03,.11,.58,.94],{dates:true})
        dateWords=[...fullWords,...scanned]
      } catch (err) { console.warn('날짜 열 재인식 실패:',err) }
    }
    let withColumns=parseCardWithAmounts(data,rawText,{width,height,extraAmountWords,dateWords}) || []
    // A left-column scan repairs missing merchant names when the full OCR
    // output grouped the merchant and card-detail line into one text block.
    if (withColumns.some(r=>r.needsNameReview) || fullWords.length < 10) {
      try {
        onStep('상호명 영역 다시 확인 중')
        merchantWords=await recognizeColumn(worker,bitmap,[.03,.09,.72,.94])
        withColumns=parseCardWithAmounts(data,rawText,{width,height,extraAmountWords,dateWords,merchantWords}) || withColumns
      } catch (err) { console.warn('상호명 열 재인식 실패:',err) }
    }
    return withColumns.length >= initial.length ? withColumns : initial
  } finally { bitmap.close?.() }
}

function PhotoExpenseImport({ existingExpenses = [], onImport, onClose }) {
  const fileInput = useRef(null)
  const rowElements = useRef({})
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [step, setStep] = useState('')
  const [rows, setRows] = useState([])
  const [rawText, setRawText] = useState('')
  const [englishNotice, setEnglishNotice] = useState('')
  const [layoutNotice, setLayoutNotice] = useState('')
  const [layoutMismatch, setLayoutMismatch] = useState(null)
  const [error, setError] = useState('')
  const [submitFeedback, setSubmitFeedback] = useState(null)
  const [recentlyReviewed, setRecentlyReviewed] = useState('')

  useEffect(() => {
    if (!file) { setPreviewUrl(''); return undefined }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function updateRow(id, values) {
    setSubmitFeedback(null)
    setRecentlyReviewed('')
    setRows(previous => previous.map(row => {
      if (row.id !== id) return row
      const updated = { ...row, ...values }
      // A previously blocked row becomes ready when the user corrects the
      // last problem. Select it automatically unless it looks duplicated.
      const correctedField = ['date', 'amount', 'name'].some(field => Object.hasOwn(values, field))
      if (correctedField && !row.selected && hasPendingReview(row) &&
        isValidEntry(updated) && !hasPendingReview(updated) && !hasDuplicate(updated, existingExpenses)) {
        updated.selected = true
      }
      return updated
    }))
  }

  function goToReviewRow(id) {
    const row = rows.find(item => item.id === id)
    const element = rowElements.current[id]
    if (!row || !element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const field = reviewFocusField(row)
    const input = element.querySelector(`[data-photo-field="${field}"]`) || element.querySelector('input')
    input?.focus({ preventScroll: true })
  }

  function confirmReviewedRow(row) {
    if (!isValidEntry(row)) return
    updateRow(row.id, {
      uncertain: false,
      needsDateReview: false,
      needsAmountReview: false,
      needsNameReview: false,
      needsMerchantReview: false,
      requiresSourceReview: false,
      suggestedName: '',
      selected: !hasDuplicate(row, existingExpenses),
    })
    setRecentlyReviewed(row.id)
  }

  async function analyzeImage(chosen) {
    setFile(chosen)
    setRows([])
    setRawText('')
    setEnglishNotice('')
    setLayoutNotice('')
    setLayoutMismatch(null)
    setError('')
    setSubmitFeedback(null)
    setRecentlyReviewed('')
    rowElements.current = {}
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
      const { data } = await worker.recognize(chosen, {}, { text: true, tsv: true, blocks: true })
      const text = data.text || ''
      setRawText(text)
      const isCard = looksLikeCardList(text,data)
      // Card screens are *never* sent to the old date-group parser: that
      // parser incorrectly merges several purchases into one dated entry.
      const cardRows = isCard ? await readCardLayoutWithFallback(worker,chosen,data,text,setStep) : null
      const parsed = isCard ? (cardRows || []) : parseReceiptText(text)
      if (isCard) {
        const missingDates = parsed.filter(row => !row.date).length
        const dateRows=parsed[0]?.detectedDateCount || 0
        const detailMode=parsed[0]?.recognitionMode==='card-detail'
        const possiblyMissing=detailMode && dateRows>parsed.length
        if (possiblyMissing) setLayoutMismatch({dates:dateRows,amounts:parsed.length})
        setLayoutNotice(`카드 화면에서 금액별 거래 ${parsed.length}건을 구분했어요.${missingDates ? ` 날짜를 확인해야 할 거래 ${missingDates}건이 있어요.` : ''}${possiblyMissing ? ` ⚠️ 날짜 ${dateRows}개에 비해 금액이 ${parsed.length}개만 인식되어 누락된 거래가 있을 수 있어요. 원본과 대조해 주세요.` : ''} 사진의 거래 개수와 금액을 반드시 비교해 주세요.`)
        if (possiblyMissing) setEnglishNotice('⚠️ 카드내역의 일부 금액이 누락됐을 수 있어요. 전체 거래 건수를 원본 사진과 비교하기 전에는 일괄 등록하지 마세요.')
        if (parsed.length <= 3) {
          setEnglishNotice('⚠️ 카드 내역이 일부 누락됐을 수 있습니다. 이 사진은 등록 전에 인식 건수를 꼭 확인해 주세요.')
        }
      }
      if (parsed.length === 0) {
        setError(isCard ? '카드 금액을 읽지 못했어요. 다른 사진이나 더 선명한 캡처를 사용해 주세요. 날짜별 3건으로 합쳐서 등록하지 않습니다.' : '날짜와 금액을 함께 인식하지 못했어요. 선명한 거래내역 화면을 캡처해서 다시 시도해 주세요. 아래에서 인식된 텍스트를 확인할 수 있습니다.')
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
        // Fast review: trust explicit parser warnings, missing fields, and
        // conservative merchant-name heuristics, but do not force the user to
        // approve every card item individually. This is NOT an OCR guarantee.
        setRows(parsed.map((entry, index) => {
          const duplicated = hasDuplicate(entry, existingExpenses)
          const needsMerchantReview = Boolean(suggestions.get(index) || isLikelyIncompleteMerchant(entry.name))
          const needsNameReview = Boolean(entry.needsNameReview || needsMerchantReview)
          const uncertain = Boolean(entry.uncertain || needsNameReview || entry.needsDateReview || entry.needsAmountReview)
          const row = {
            ...entry,
            id: crypto.randomUUID(),
            suggestedName: suggestions.get(index) || '',
            requiresSourceReview: false,
            isCardPhoto: Boolean(isCard),
            needsMerchantReview,
            needsNameReview,
            uncertain,
          }
          return {
            ...row,
            // Ready items are preselected; doubtful or duplicate items are not.
            selected: isValidEntry(row) && !uncertain && !duplicated,
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

  const selected = rows.filter(row => row.selected)
  const selectedTotal = selected.reduce((total, row) => total + Number(row.amount || 0), 0)
  const reviewRows = rows.map((row, index) => ({ id:row.id, number:index + 1, issues:getReviewIssues(row), selected:row.selected }))
    .filter(row => row.issues.length > 0)
  const selectedReviewRows = reviewRows.filter(row => row.selected)
  const firstReview = selectedReviewRows[0] || reviewRows[0]

  function submitImport() {
    const chosen = rows.filter(row => row.selected)
    if (!chosen.length) {
      setSubmitFeedback({
        text: firstReview
          ? `등록할 거래가 선택되지 않았어요. 확인 필요한 거래 ${reviewRows.length}건이 있어요. 등록할 거래의 체크박스를 선택하거나 필요한 부분을 수정해 주세요.`
          : '등록할 거래가 선택되지 않았어요. 거래 왼쪽 체크박스를 선택한 뒤 다시 일괄 등록을 눌러 주세요.',
        rowId: firstReview?.id || null,
      })
      return
    }
    const problemRows = chosen.map(row => ({row, issues:getReviewIssues(row)})).filter(x => x.issues.length)
    if (problemRows.length) {
      const transactionNumbers = problemRows.map(x => rows.findIndex(item => item.id === x.row.id) + 1)
      const issues = [...new Set(problemRows.flatMap(x => x.issues))].join(' · ')
      setSubmitFeedback({
        text: `아직 등록할 수 없어요. 선택한 거래 중 ${problemRows.length}건(거래 ${transactionNumbers.join(', ')})에 확인이 필요합니다: ${issues}. 해당 거래를 수정하거나 ‘이 거래 확인 완료’를 눌러 주세요. 그다음 일괄 등록을 다시 눌러 주세요.`,
        rowId: problemRows[0].row.id,
      })
      return
    }
    // If a line-item statement contains more dates than amounts, one or more
    // prices may have been missed. Never silently treat that as a complete import.
    if (layoutMismatch && !window.confirm(`⚠️ 거래 누락 가능성이 있습니다.\n사진에서 날짜 ${layoutMismatch.dates}개가 검출됐지만 금액은 ${layoutMismatch.amounts}개만 인식됐어요.\n원본과 비교한 뒤 선택한 거래만 부분 등록할까요?`)) {
      setSubmitFeedback({text:'사진에서 거래가 일부 누락된 것으로 보여요. 원본 사진의 거래 건수를 확인하고 다시 인식해 주세요.',rowId:null})
      return
    }
    const duplicateCount = chosen.filter(row => hasDuplicate(row, existingExpenses)).length
    const skippedCount = rows.length - chosen.length
    const msg = `선택한 지출 ${chosen.length}건을 등록할까요?\n총 ${chosen.reduce((total, row) => total + Number(row.amount), 0).toLocaleString('ko-KR')}원${skippedCount ? `\n\n선택하지 않은 ${skippedCount}건은 등록되지 않습니다.` : ''}${duplicateCount ? `\n\n주의: 기존 기록과 일치하는 거래 ${duplicateCount}건이 포함되어 있습니다.` : ''}`
    if (!window.confirm(msg)) return
    setSubmitFeedback(null)
    try {
      onImport(chosen.map(row => ({
        date: row.date,
        name: row.name.trim(),
        amount: Number(row.amount),
        category: row.category,
        memo: row.memo.trim().slice(0, 200),
      })))
    } catch (err) {
      console.error(err)
      setSubmitFeedback({text:'지출 내역 등록 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.',rowId:null})
    }
  }

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
      {layoutNotice && <p className="v6-photo-notice" role="status">📋 {layoutNotice}</p>}

      {rows.length > 0 && (
        <div className="v6-photo-results">
          <div className="v6-photo-results-head">
            <h4>인식된 거래 {rows.length}건</h4>
            <span>사용처·금액·날짜를 꼭 확인하세요</span>
          </div>
          <p className="v6-photo-notice">회색 잔액은 등록 대상이 아니며, 인식되지 않은 칸은 직접 입력할 수 있어요. 기존 기록과 동일한 거래는 중복 후보로 표시됩니다.</p>
          {rows.some(row => row.isCardPhoto) && (
            <div className="v6-photo-notice" role="status" style={{border:'1px solid #cbd5e1',borderRadius:12,padding:'12px 14px',lineHeight:1.6}}>
              <strong>✨ 간편 검토 모드</strong>
              <p style={{margin:'5px 0 0'}}>문제가 발견되지 않은 거래는 미리 선택했어요. 날짜·금액·상호명이 누락되거나 인식 오류가 의심되는 거래만 노란색으로 표시합니다. OCR이 틀려도 자동으로 발견하지 못할 수 있으니 목록을 빠르게 훑어봐 주세요.</p>
            </div>
          )}
          <div className="v6-photo-notice" role="status" style={{borderRadius:12,padding:'12px 14px',lineHeight:1.6,display:'flex',gap:12,flexWrap:'wrap'}}>
            <strong>✅ 등록 가능 {rows.filter(row => !hasPendingReview(row) && !hasDuplicate(row, existingExpenses)).length}건</strong>
            <strong>⚠️ 확인 필요 {reviewRows.length}건</strong>
            <strong>🔁 중복 후보 {rows.filter(row => hasDuplicate(row, existingExpenses)).length}건</strong>
          </div>
          {rows.map((row, index) => {
            const duplicate = hasDuplicate(row, existingExpenses)
            const valid = isValidEntry(row)
            return (
              <div
                className={`v6-photo-result ${row.selected ? 'is-selected' : ''}`}
                key={row.id}
                ref={element => { if (element) rowElements.current[row.id] = element; else delete rowElements.current[row.id] }}
              >
                <div className="v6-photo-result-head">
                  <label className="v6-photo-checkbox">
                    <input type="checkbox" data-photo-field="select" checked={row.selected} onChange={e => updateRow(row.id, {selected:e.target.checked})} />
                    <strong>거래 {index + 1}</strong>
                  </label>
                  <div className="v6-photo-tags">
                    {duplicate && <span className="v6-photo-tag warning">중복 후보</span>}
                    {row.needsMerchantReview && <span className="v6-photo-tag warning">영문 확인 필요</span>}
                    {getReviewIssues(row).length > 0 && <span className="v6-photo-tag warning">확인 필요</span>}
                    {getReviewIssues(row).length === 0 && !duplicate && <span className="v6-photo-tag success">{'등록 가능'}</span>}
                  </div>
                </div>
                <div className="v6-photo-fields">
                  <label>결제 날짜
                    <input type="date" data-photo-field="date" value={row.date} onChange={e => updateRow(row.id, {date:e.target.value,needsDateReview:false,uncertain:Boolean(row.needsNameReview || row.needsMerchantReview || row.needsAmountReview)})} />
                  </label>
                  <label>결제 금액 (원)
                    <input type="number" data-photo-field="amount" min="1" inputMode="numeric" value={row.amount} placeholder="직접 입력" onChange={e => updateRow(row.id, {amount:e.target.value,needsAmountReview:false,uncertain:Boolean(row.needsDateReview || row.needsNameReview || row.needsMerchantReview)})} />
                  </label>
                  <label className="v6-photo-wide">사용처 / 상호명
                    <input type="text" data-photo-field="name" maxLength="100" value={row.name} placeholder="인식되지 않음 — 직접 입력" onChange={e => updateRow(row.id, {name:e.target.value,category:guessExpenseCategory(e.target.value),needsMerchantReview:false,suggestedName:'',needsNameReview:false,uncertain:Boolean(row.needsDateReview || row.needsAmountReview)})} />
                    {row.suggestedName && (
                      <button type="button" className="v6-photo-apply-suggestion" style={{display:'block',width:'100%',marginTop:9,padding:'10px 12px',border:'1px solid #90b4eb',borderRadius:10,background:'#edf5ff',color:'#163b7b',fontSize:13,fontWeight:700,textAlign:'left',cursor:'pointer'}} onClick={() => updateRow(row.id, {name:row.suggestedName,category:guessExpenseCategory(row.suggestedName),needsMerchantReview:false,needsNameReview:false,uncertain:Boolean(row.needsDateReview || row.needsAmountReview),suggestedName:''})}>
                        ✨ 영어 재인식 제안: {row.suggestedName} — 눌러서 적용
                      </button>
                    )}
                    {row.needsAmountReview && <small style={{display:'block',marginTop:8,fontSize:12,color:'#a45a1a'}}>금액 영역을 다시 읽은 결과입니다. 사진에서 실제 금액을 확인해 주세요.</small>}
                    {row.needsDateReview && <small style={{display:'block',marginTop:8,fontSize:12,color:'#a45a1a'}}>사진에서 결제 날짜가 잘려 있습니다. 날짜를 직접 확인해 주세요.</small>}
                    {row.needsNameReview && <small style={{display:'block',marginTop:8,fontSize:12,color:'#a45a1a'}}>{'상호명이 잘렸거나 잘못 읽혔을 수 있어요. 필요한 경우 아래에서 수정해 주세요.'}</small>}
                    {row.needsMerchantReview && !row.suggestedName && <small className="v6-photo-merchant-hint" style={{display:'block',marginTop:8,fontSize:12,color:'#a45a1a'}}>영문 부분이 정확한지 원본 사진과 비교해 수정해 주세요.</small>}
                  </label>
                  <label>카테고리
                    <select data-photo-field="category" value={row.category} onChange={e => updateRow(row.id, {category:e.target.value})}>
                      {categories.map(category => <option value={category} key={category}>{category}</option>)}
                    </select>
                  </label>
                  <label>거래 메모 (선택)
                    <input type="text" maxLength="200" value={row.memo} placeholder="메모" onChange={e => updateRow(row.id, {memo:e.target.value})} />
                  </label>
                </div>
                {getReviewIssues(row).length > 0 && (
                  <div style={{marginTop:13,padding:'12px 14px',borderRadius:10,background:'#fffbeb',border:'1px solid #fde68a',color:'#92400e',fontSize:12,lineHeight:1.6}}>
                    <strong>⚠️ 등록 전 확인: {getReviewIssues(row).join(' · ')}</strong>
                    <p style={{margin:'5px 0 8px'}}>문제가 의심되는 부분만 사진과 비교해 주세요. 정보가 맞다면 아래 버튼을 눌러 검토를 마칠 수 있어요.</p>
                    <button
                      type="button"
                      data-photo-field="review"
                      disabled={!valid}
                      onClick={() => confirmReviewedRow(row)}
                      style={{border:'1px solid #f59e0b',borderRadius:8,background:valid?'#fff':'#f1f5f9',color:valid?'#92400e':'#64748b',padding:'8px 12px',fontWeight:700,cursor:valid?'pointer':'not-allowed'}}
                    >
                      ✓ 이 거래 확인 완료
                    </button>
                    {!valid && <p style={{margin:'6px 0 0'}}>날짜·금액·사용처 등 비어 있는 정보를 먼저 입력하면 확인할 수 있어요.</p>}
                  </div>
                )}
                {recentlyReviewed === row.id && getReviewIssues(row).length === 0 && (
                  <p style={{margin:'10px 0 0',color:'#047857',fontSize:12}} role="status">✓ 확인 완료! 중복 후보가 아니라면 자동으로 등록 대상에 선택됐어요.</p>
                )}
              </div>
            )
          })}
          {reviewRows.length > 0 && (
            <div style={{border:'1px solid #fcd34d',borderRadius:12,background:'#fffbeb',padding:'14px 16px',color:'#92400e',fontSize:13,lineHeight:1.65}} role="status">
              <strong>⚠️ 확인이 필요한 거래 {reviewRows.length}건</strong>
              <p style={{margin:'5px 0 10px'}}>
                {selectedReviewRows.length
                  ? `선택한 거래 중 ${selectedReviewRows.length}건은 추가 확인이 필요해요. 수정하거나 ‘확인 완료’를 눌러 주세요.`
                  : `확인 필요 거래는 자동 선택하지 않았어요. 등록 가능한 거래만 먼저 등록하거나, 의심되는 거래만 추가 확인해 주세요.`}
              </p>
              {firstReview && (
                <button type="button" onClick={() => goToReviewRow(firstReview.id)} style={{padding:'8px 12px',background:'#fff',border:'1px solid #fbbf24',borderRadius:8,color:'#92400e',fontWeight:700,cursor:'pointer'}}>
                  ↑ 거래 {firstReview.number} 확인하러 가기
                </button>
              )}
            </div>
          )}
          <div className="v6-photo-total">
            <span>선택된 거래 {selected.length}건</span>
            <strong>{selectedTotal.toLocaleString('ko-KR')}원</strong>
          </div>
          {reviewRows.some(r => !r.selected) && selected.length > 0 && (
            <p className="v6-photo-notice" role="status">⚠️ 확인이 필요한 거래 {reviewRows.filter(r => !r.selected).length}건은 이번 등록에서 제외돼요. 나중에 등록하려면 사진을 다시 선택해야 하니, 먼저 확인하고 함께 등록해도 좋아요.</p>
          )}
          {submitFeedback && (
            <div className="v6-photo-error" role="alert" aria-live="assertive" style={{margin:'0 0 2px'}}>
              <strong>⚠️ 등록 전 확인해 주세요</strong>
              <p style={{margin:'5px 0 10px'}}>{submitFeedback.text}</p>
              {submitFeedback.rowId && (
                <button type="button" onClick={() => goToReviewRow(submitFeedback.rowId)} style={{padding:'9px 12px',background:'#fff',border:'1px solid #fda4af',borderRadius:8,color:'#9f1239',fontWeight:700,cursor:'pointer'}}>
                  ↑ 해당 거래로 이동하기
                </button>
              )}
            </div>
          )}
          <button className="v6-photo-submit" type="button" disabled={busy} onClick={submitImport}>
            {selected.length ? `선택한 지출 ${selected.length}건 일괄 등록` : '등록할 거래 선택 / 확인하기'}
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
