import { useState } from 'react'

function BudgetPanel({ selectedMonth, monthlyTotal }) {
  const storageKey = `mymoney-budget-${selectedMonth}`
  const [savedBudget, setSavedBudget] = useState(() => localStorage.getItem(storageKey) || '')
  const [draft, setDraft] = useState(savedBudget)
  const [status, setStatus] = useState('')
  const changed = draft !== savedBudget
  const budgetNumber = Number(savedBudget)
  const remaining = budgetNumber - monthlyTotal
  const usageRate = budgetNumber > 0 ? (monthlyTotal / budgetNumber) * 100 : 0
  const isOver = usageRate > 100
  const isWarning = usageRate >= 80

  function saveBudget(event) {
    event.preventDefault()
    const value = draft.trim()
    if (value === '' && savedBudget === '') {
      setStatus('예산 금액을 입력한 후 저장해 주세요.')
      return
    }
    if (value !== '' && (!Number.isSafeInteger(Number(value)) || Number(value) < 0)) {
      setStatus('0원 이상의 올바른 정수 금액을 입력해 주세요.')
      return
    }
    try {
      if (value === '') localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, value)
      setSavedBudget(value)
      setDraft(value)
      setStatus(value === '' ? '✓ 이번 달 예산을 삭제했어요.' : `✓ ${selectedMonth} 예산 ${Number(value).toLocaleString('ko-KR')}원이 저장됐어요.`)
      // 휴대폰 숫자 키보드를 닫아 결과와 저장 안내가 바로 보이도록 합니다.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    } catch {
      setStatus('예산 저장에 실패했어요. 저장 공간을 확인한 후 다시 시도해 주세요.')
    }
  }

  return (
    <section className="budget-panel">
      <h2>💰 월 예산 관리</h2>
      <form className="mymoney-budget-save-form" onSubmit={saveBudget}>
        <label htmlFor="monthly-budget">{selectedMonth} 예산 설정</label>
        <div className="budget-input">
          <input
            id="monthly-budget"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="예: 500000"
            value={draft}
            aria-describedby="budget-save-status"
            onChange={event => {
              const value = event.target.value
              if (value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0)) {
                setDraft(value)
                setStatus('')
              }
            }}
          />
          <span>원</span>
        </div>
        <button type="submit" className="mymoney-budget-save-btn" disabled={!changed && savedBudget !== ''}>
          {changed ? '예산 저장' : savedBudget !== '' ? '저장 완료 ✓' : '예산 저장'}
        </button>
        <p id="budget-save-status" className={`mymoney-budget-status ${changed ? 'is-unsaved' : 'is-saved'}`} role="status" aria-live="polite">
          {status || (changed ? '아직 저장되지 않았어요. 예산 저장 버튼을 눌러 주세요.' : savedBudget !== '' ? '저장된 예산입니다. 수정하려면 금액을 바꿔 주세요.' : '예산 금액을 입력하고 저장 버튼을 눌러 주세요.')}
        </p>
      </form>
      {budgetNumber > 0 ? (
        <>
          <div className="budget-stats">
            <div><span>이번 달 지출</span><strong>{monthlyTotal.toLocaleString('ko-KR')}원</strong></div>
            <div><span>남은 예산</span><strong className={isOver ? 'over' : ''}>{remaining.toLocaleString('ko-KR')}원</strong></div>
          </div>
          <div className="budget-progress-label"><span>예산 사용률</span><strong>{usageRate.toFixed(1)}%</strong></div>
          <div className="budget-track">
            <div className={'budget-fill' + (isOver ? ' danger' : isWarning ? ' warning' : '')} style={{width:`${Math.min(usageRate,100)}%`}} />
          </div>
          {isOver ? <p className="budget-alert over">🚨 설정한 예산을 초과했어요!</p>
            : isWarning ? <p className="budget-alert warning">⚠️ 예산의 80% 이상을 사용했어요.</p>
            : <p className="budget-alert normal">✅ 예산 내에서 잘 관리하고 있어요.</p>}
        </>
      ) : (
        <p className="empty-message">예산을 저장하면 사용률이 표시돼요.</p>
      )}
    </section>
  )
}

export default BudgetPanel
