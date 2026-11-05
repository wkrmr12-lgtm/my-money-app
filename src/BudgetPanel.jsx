
import { useEffect, useState } from 'react'

function BudgetPanel({ selectedMonth, monthlyTotal }) {
  const storageKey = `mymoney-budget-${selectedMonth}`

  const [budget, setBudget] = useState(() => {
    return localStorage.getItem(storageKey) || ''
  })

  useEffect(() => {
    if (budget === '') {
      localStorage.removeItem(storageKey)
    } else {
      localStorage.setItem(storageKey, budget)
    }
  }, [budget, storageKey])

  const budgetNumber = Number(budget)
  const remaining = budgetNumber - monthlyTotal

  const usageRate = budgetNumber > 0
    ? (monthlyTotal / budgetNumber) * 100
    : 0

  const isOver = usageRate > 100
  const isWarning = usageRate >= 80

  return (
    <section className="budget-panel">
      <h2>💰 월 예산 관리</h2>

      <label htmlFor="monthly-budget">
        {selectedMonth} 예산 설정
      </label>

      <div className="budget-input">
        <input
          id="monthly-budget"
          type="number"
          min="0"
          placeholder="예: 500000"
          value={budget}
          onChange={e => {
            const value = e.target.value
            if (value === '' || Number(value) >= 0) {
              setBudget(value)
            }
          }}
        />
        <span>원</span>
      </div>

      {budgetNumber > 0 ? (
        <>
          <div className="budget-stats">
            <div>
              <span>이번 달 지출</span>
              <strong>
                {monthlyTotal.toLocaleString()}원
              </strong>
            </div>

            <div>
              <span>남은 예산</span>
              <strong className={isOver ? 'over' : ''}>
                {remaining.toLocaleString()}원
              </strong>
            </div>
          </div>

          <div className="budget-progress-label">
            <span>예산 사용률</span>
            <strong>{usageRate.toFixed(1)}%</strong>
          </div>

          <div className="budget-track">
            <div
              className={
                'budget-fill' +
                (isOver ? ' danger' : isWarning ? ' warning' : '')
              }
              style={{
                width: `${Math.min(usageRate, 100)}%`
              }}
            />
          </div>

          {isOver ? (
            <p className="budget-alert over">
              🚨 설정한 예산을 초과했어요!
            </p>
          ) : isWarning ? (
            <p className="budget-alert warning">
              ⚠️ 예산의 80% 이상을 사용했어요.
            </p>
          ) : (
            <p className="budget-alert normal">
              ✅ 예산 내에서 잘 관리하고 있어요.
            </p>
          )}
        </>
      ) : (
        <p className="empty-message">
          예산을 입력하면 사용률이 표시돼요.
        </p>
      )}
    </section>
  )
}

export default BudgetPanel
