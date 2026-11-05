

function CalendarPanel({
    selectedMonth,
    selectedDate,
    items,
    onSelectDate,
    onDeleteExpense
  }) {
  
    const [year, month] = selectedMonth.split('-').map(Number)
  
    // 해당 월의 첫 번째 날짜와 마지막 날짜
    const firstDay = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
  
    // 달력은 월요일부터 시작
    const startOffset = (firstDay.getDay() + 6) % 7
  
    const cells = Array.from(
      { length: Math.ceil((startOffset + daysInMonth) / 7) * 7 },
      (_, index) => {
        const day = index - startOffset + 1
        return day >= 1 && day <= daysInMonth ? day : null
      }
    )
  
    function dateFor(day) {
      return `${selectedMonth}-${String(day).padStart(2, '0')}`
    }
  
    function expensesFor(date) {
      return items.filter(item => item.date === date)
    }
  
    const selectedExpenses = expensesFor(selectedDate)
  
    const selectedTotal = selectedExpenses.reduce(
      (sum, item) => sum + Number(item.amount), 0
    )
  
    return (
      <section className="calendar-panel">
        <h2>📅 소비 캘린더</h2>
        <h3>{year}년 {month}월</h3>
  
        <div className="calendar-grid">
          {['월', '화', '수', '목', '금', '토', '일'].map(day => (
            <div className="calendar-weekday" key={day}>
              {day}
            </div>
          ))}
  
          {cells.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} />
            }
  
            const date = dateFor(day)
            const dailyExpenses = expensesFor(date)
            const dailyTotal = dailyExpenses.reduce(
              (sum, item) => sum + Number(item.amount), 0
            )
  
            return (
              <button
                type="button"
                key={date}
                className={
                  'calendar-day' +
                  (selectedDate === date ? ' selected' : '')
                }
                onClick={() => onSelectDate(date)}
              >
                <span>{day}</span>
  
                {dailyExpenses.length > 0 && (
                  <small>
                    {dailyTotal.toLocaleString()}원
                  </small>
                )}
              </button>
            )
          })}
        </div>
  
        <div className="calendar-detail">
          <h3>{selectedDate} 지출 내역</h3>
  
          {selectedExpenses.length === 0 ? (
            <p>이 날짜에 등록된 지출이 없어요.</p>
          ) : (
            selectedExpenses.map(item => (
              <div className="calendar-expense" key={item.id}>
                <span>{item.name}</span>
                <strong>
                  {Number(item.amount).toLocaleString()}원
                </strong>
              </div>
            ))
          )}
  
          <div className="calendar-total">
            <span>선택한 날짜 합계</span>
            <strong>{selectedTotal.toLocaleString()}원</strong>
          </div>
        </div>
      </section>
    )
  }
  
  export default CalendarPanel
  