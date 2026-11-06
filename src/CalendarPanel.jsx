import { useState } from 'react'

// 달력 칸은 짧게 보여주되, 실제 저장 금액은 변경하지 않습니다.
// 선택한 날짜의 상세 내역에서는 언제나 원래 금액이 표시됩니다.
function formatCalendarPreview(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  if (Math.abs(amount) >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(1).replace(/\.0$/, '')}억`
  }
  if (Math.abs(amount) >= 10_000_000) {
    return `${Math.round(amount / 10_000).toLocaleString('ko-KR')}만`
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `${Math.round(amount / 10_000).toLocaleString('ko-KR')}만`
  }
  if (Math.abs(amount) >= 10_000) {
    return `${(amount / 10_000).toFixed(1).replace(/\.0$/, '')}만`
  }
  return amount.toLocaleString('ko-KR')
}

function CalendarPanel({
    selectedMonth,
    selectedDate,
    items,
    onSelectDate,
    onDeleteExpense,
    onUpdateExpense,
    categories
  }) {
const [showAllExpenses, setShowAllExpenses] = useState(false)
const [editingExpense, setEditingExpense] = useState(null)


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
                title={dailyExpenses.length ? `총 ${dailyTotal.toLocaleString('ko-KR')}원` : undefined}
                aria-label={dailyExpenses.length
                  ? `${date} 지출 ${dailyExpenses.length}건, 총 ${dailyTotal.toLocaleString('ko-KR')}원`
                  : `${date} 지출 없음`}
                className={
                  'calendar-day' +
                  (selectedDate === date ? ' selected' : '')
                }
                
onClick={() => {
    setShowAllExpenses(false)
    onSelectDate(date)
  }}
  
              >
                <span>{day}</span>
  
                {dailyExpenses.length > 0 && (
                  <small>
                    {formatCalendarPreview(dailyTotal)}
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
            
    (showAllExpenses ? selectedExpenses : selectedExpenses.slice(0, 5)).map(item => (

              <div className="calendar-expense" key={item.id}>
                <span>{item.name}</span>
                <strong>
                  {Number(item.amount).toLocaleString()}원
                </strong>

<button
  type="button"
  className="calendar-edit-btn"

  onClick={() => {
    setEditingExpense({ ...item })
  
    requestAnimationFrame(() => {
      document.getElementById('expense-edit-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    })
  }}
  
>
  ✏️ 수정
</button>

<button
  type="button"
  className="calendar-delete-btn"
  onClick={() => onDeleteExpense(item.id)}
>
  삭제
</button>

              </div>
            ))
          )}
  
{selectedExpenses.length > 5 && (
  <button
    type="button"
    className="calendar-more-btn"
    onClick={() => setShowAllExpenses(!showAllExpenses)}
  >
    {showAllExpenses
      ? '접기 ▲'
      : `나머지 ${selectedExpenses.length - 5}건 더 보기 ▼`}
  </button>
)}

{editingExpense && (
  <form
    id="expense-edit-form"
    className="calendar-edit-form"
    onSubmit={e => {
      e.preventDefault()

      if (
        !editingExpense.name?.trim() ||
        !Number.isFinite(Number(editingExpense.amount)) ||
        Number(editingExpense.amount) <= 0 ||
        !editingExpense.date ||
        !editingExpense.category
      ) {
        alert('수정할 지출 정보를 올바르게 입력해 주세요.')
        return
      }

      onUpdateExpense(editingExpense.id, {
        name: editingExpense.name.trim(),
        amount: Number(editingExpense.amount),
        date: editingExpense.date,
        category: editingExpense.category
      })

      setEditingExpense(null)
    }}
  >
    <h3>✏️ 지출 내역 수정</h3>

    <label>
      사용처
      <input
        type="text"
        value={editingExpense.name}
        onChange={e =>
          setEditingExpense(prev => ({
            ...prev,
            name: e.target.value
          }))
        }
      />
    </label>

    <label>
      지출 금액
      <input
        type="number"
        min="1"
        value={editingExpense.amount}
        onChange={e =>
          setEditingExpense(prev => ({
            ...prev,
            amount: e.target.value
          }))
        }
      />
    </label>

    <label>
      지출 날짜
      <input
        type="date"
        value={editingExpense.date}
        onChange={e =>
          setEditingExpense(prev => ({
            ...prev,
            date: e.target.value
          }))
        }
      />
    </label>

    <label>
      카테고리
      <select
        value={editingExpense.category}
        onChange={e =>
          setEditingExpense(prev => ({
            ...prev,
            category: e.target.value
          }))
        }
      >
       
        {categories.map(cat => (
        <option key={cat} value={cat}>
        {cat}
        </option>
))}

      </select>
    </label>

    <button type="submit">수정 완료</button>

    <button
      type="button"
      onClick={() => setEditingExpense(null)}
    >
      취소
    </button>
  </form>
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
  