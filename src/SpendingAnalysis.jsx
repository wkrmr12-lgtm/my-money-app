

function SpendingAnalysis({
    monthlyItems,
    selectedMonth,
    previousMonthTotal
  }) {
  
    const categoryColors = {
      식비: '#2563eb',
      카페: '#8b5cf6',
      쇼핑: '#60a5fa',
      교통: '#10b981',
      생활: '#f59e0b',
      기타: '#94a3b8'
    }
  
    const categoryTotals = {}
  
    monthlyItems.forEach(item => {
      const category = item.category || '기타'
  
      categoryTotals[category] =
        (categoryTotals[category] || 0) + Number(item.amount)
    })
  
    const total = Object.values(categoryTotals).reduce(
      (sum, amount) => sum + amount,
      0
    )
  
    const ranking = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])

const topExpenses = [...monthlyItems]
.sort((a, b) => Number(b.amount) - Number(a.amount))
.slice(0, 5)

  
    const money = amount =>
      `${amount.toLocaleString('ko-KR')}원`
  
const difference = total - previousMonthTotal

const changeRate = previousMonthTotal > 0
  ? (difference / previousMonthTotal) * 100
  : null

const changeStatus =
  difference > 0 ? 'increase'
  : difference < 0 ? 'decrease'
  : 'same'

    let currentPercent = 0
  
    const chartSegments = ranking.map(([category, amount]) => {
      const start = currentPercent
      const percent = total > 0 ? (amount / total) * 100 : 0
  
      currentPercent += percent
  
      return `${categoryColors[category] || '#94a3b8'} ${start}% ${currentPercent}%`
    })
  
    const chartBackground = total > 0
      ? `conic-gradient(${chartSegments.join(', ')})`
      : '#e2e8f0'
  
    return (
      <section className="spending-analysis">
        <div className="spending-analysis-header">
          <h2>📊 소비 분석 리포트</h2>
          <p>{selectedMonth} 기준</p>
        </div>
  
<div className="spending-comparison">
  <div>
    <span>지난달 총지출</span>
    <strong>{money(previousMonthTotal)}</strong>
  </div>

  <div>
    <span>선택한 달 총지출</span>
    <strong>{money(total)}</strong>
  </div>

  <div>
    <span>지난달 대비 소비 변화</span>

    <strong className={changeStatus}>
      {changeRate === null
        ? difference === 0
          ? '변화 없음'
          : '비교 기준 없음'
        : `${difference > 0 ? '+' : ''}${changeRate.toFixed(1)}%`}
    </strong>

    <small>
      {difference > 0
        ? `지난달보다 ${money(difference)} 더 지출`
        : difference < 0
          ? `지난달보다 ${money(Math.abs(difference))} 절약`
          : '지난달과 지출 금액이 같아요'}
    </small>
  </div>
</div>

<div className="top-expenses">
  <h3>🏆 선택한 달의 지출 TOP 5</h3>

  {topExpenses.length === 0 ? (
    <p className="empty-message">
      선택한 달의 지출 내역이 없어요.
    </p>
  ) : (
    <div className="top-expenses-list">
      {topExpenses.map((item, index) => (
        <div className="top-expense-item" key={item.id}>
          <span className="top-expense-rank">
            {index + 1}
          </span>

          <div className="top-expense-info">
            <strong>{item.name}</strong>
            <span>
              {item.category || '기타'} · {item.date}
            </span>
          </div>

          <strong className="top-expense-amount">
            {Number(item.amount).toLocaleString('ko-KR')}원
          </strong>
        </div>
      ))}
    </div>
  )}
</div>

        <div className="spending-analysis-content">
          <div
            className="spending-donut"
            style={{ background: chartBackground }}
            role="img"
            aria-label="카테고리별 소비 비중 차트"
          >
            <div className="spending-donut-center">
              <span>총지출</span>
              <strong>{money(total)}</strong>
            </div>
          </div>
  
          <div className="spending-ranking">
            <h3>카테고리별 소비 순위</h3>
  
            {ranking.length === 0 ? (
              <p>선택한 달의 지출 내역이 없어요.</p>
            ) : (
              ranking.map(([category, amount], index) => (
                <div className="spending-ranking-item" key={category}>
                  <span>{index + 1}위</span>
  
                  <span
                    className="spending-category-dot"
                    style={{
                      background: categoryColors[category] || '#94a3b8'
                    }}
                  />
  
                  <strong>{category}</strong>
  
                  <span>{money(amount)}</span>
  
                  <span>
                    {((amount / total) * 100).toFixed(1)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    )
  }
  
  export default SpendingAnalysis
  