
function FinanceChart({ incomeTotal, expenseTotal, selectedMonth }) {
    const maxAmount = Math.max(incomeTotal, expenseTotal, 1)
  
    const incomePercent = (incomeTotal / maxAmount) * 100
    const expensePercent = (expenseTotal / maxAmount) * 100
  
    const balance = incomeTotal - expenseTotal
  
    const money = value => `${value.toLocaleString('ko-KR')}원`
  
    return (
      <section className="finance-chart">
        <div className="finance-chart-header">
          <h2>📊 월별 수입 · 지출 비교</h2>
          <p>{selectedMonth} 기준</p>
        </div>
  
        <div className="finance-chart-body">
          <div className="finance-chart-row">
            <div className="finance-chart-label">
              <span>수입</span>
              <strong>{money(incomeTotal)}</strong>
            </div>
  
            <div className="finance-chart-track">
              <div
                className="finance-chart-bar income-bar"
                style={{ width: `${incomePercent}%` }}
              />
            </div>
          </div>
  
          <div className="finance-chart-row">
            <div className="finance-chart-label">
              <span>지출</span>
              <strong>{money(expenseTotal)}</strong>
            </div>
  
            <div className="finance-chart-track">
              <div
                className="finance-chart-bar expense-bar"
                style={{ width: `${expensePercent}%` }}
              />
            </div>
          </div>
        </div>
  
        <div className="finance-chart-footer">
          <span>선택한 달의 잔액</span>
          <strong className={balance < 0 ? 'negative' : ''}>
            {money(balance)}
          </strong>
        </div>
      </section>
    )
  }
  
  export default FinanceChart
  