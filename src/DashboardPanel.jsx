
function DashboardPanel({ monthlyItems, monthlyTotal, selectedMonth }) {
    const categories = {}
  
    monthlyItems.forEach(item => {
      const category = item.category || '기타'
      categories[category] =
        (categories[category] || 0) + Number(item.amount)
    })
  
    const topCategory = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])[0]
  
    const [year, month] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
  
    const dailyAverage = daysInMonth > 0
      ? Math.round(monthlyTotal / daysInMonth)
      : 0
  
    const money = value => `₩ ${value.toLocaleString('ko-KR')}`
  
    return (
      <section className="premium-dashboard">
        <div className="premium-hero">
          <p className="premium-eyebrow">MONTHLY FINANCE OVERVIEW</p>
          <p>{selectedMonth} 총지출</p>
          <h1>{money(monthlyTotal)}</h1>
          <p className="premium-caption">
            나의 소비 현황을 한눈에 확인하세요.
          </p>
        </div>
  
        <div className="premium-stats">
          <div className="premium-stat-card">
            <span>일평균 지출</span>
            <strong>{money(dailyAverage)}</strong>
          </div>
  
          <div className="premium-stat-card">
            <span>소비 건수</span>
            <strong>{monthlyItems.length}건</strong>
          </div>
  
          <div className="premium-stat-card">
            <span>가장 큰 소비 카테고리</span>
            <strong>{topCategory?.[0] || '없음'}</strong>
          </div>
  
          <div className="premium-stat-card">
            <span>해당 카테고리 지출</span>
            <strong>{money(topCategory?.[1] || 0)}</strong>
          </div>
        </div>
      </section>
    )
  }
  
  export default DashboardPanel
  