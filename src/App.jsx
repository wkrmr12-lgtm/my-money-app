
import { useState, useEffect } from 'react'
import './App.css'
import BudgetPanel from './BudgetPanel.jsx'
import CalendarPanel from './CalendarPanel.jsx'
import DashboardPanel from './DashboardPanel.jsx'
import SpendingAnalysis from './SpendingAnalysis.jsx'
import IncomePanel from './IncomePanel.jsx'
const categories = ['식비', '카페', '쇼핑', '교통', '생활', '기타']

const categoryColors = {
  식비: '#2563eb',
  카페: '#8b5cf6',
  쇼핑: '#60a5fa',
  교통: '#10b981',
  생활: '#f59e0b',
  기타: '#94a3b8'
}

function getLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function App() {
  const [items, setItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mymoney') || '[]')
      return Array.isArray(saved) ? saved : []
    } catch {
      return []
    }
  })

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('식비')
  const [selectedMonth, setSelectedMonth] = useState(
    getLocalDate().slice(0, 7)
  )
  const [expenseDate, setExpenseDate] = useState(getLocalDate())

  useEffect(() => {
    localStorage.setItem('mymoney', JSON.stringify(items))
  }, [items])

  const monthlyItems = items.filter(item =>
    item.date?.startsWith(selectedMonth)
  )

  const monthlyTotal = monthlyItems.reduce(
    (sum, item) => sum + Number(item.amount), 0
  )

  const [year, month] = selectedMonth.split('-').map(Number)

 
const previousDate = new Date(year, month - 2, 1)

const previousMonth = [
  previousDate.getFullYear(),
  String(previousDate.getMonth() + 1).padStart(2, '0')
].join('-')

  
  const previousMonthTotal = items
    .filter(item => item.date?.startsWith(previousMonth))
    .reduce((sum, item) => sum + Number(item.amount), 0)
  
  const categoryTotals = categories.map(cat => ({
    name: cat,
    amount: monthlyItems
      .filter(item => item.category === cat)
      .reduce((sum, item) => sum + Number(item.amount), 0)
  }))

  function addExpense(e) {
    e.preventDefault()

    const value = Number(amount)

    if (!name.trim() || !Number.isFinite(value) || value <= 0) {
      alert('사용처와 올바른 금액을 입력해 주세요.')
      return
    }

    setItems(prev => [
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        amount: value,
        category,
        date: expenseDate
      },
      ...prev
    ])

    setSelectedMonth(expenseDate.slice(0, 7))
    setName('')
    setAmount('')
  }

  function deleteExpense(id) {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  return (
    <main className="app">
      <h1>💳 MyMoney</h1>
      <p>나의 스마트 소비 관리 앱</p>

      <section className="month-section">
        <h2>조회할 월 선택</h2>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => {
            const month = e.target.value
            if (!month) return
            setSelectedMonth(month)
            setExpenseDate(`${month}-01`)
          }}
        />
      </section>
      <section className="expense-form"> 
        <h2>지출 등록하기</h2>

        <form onSubmit={addExpense}>
        <label className="expense-date-label">
  지출 날짜
  <input
    type="date"
    value={expenseDate}
    onChange={e => {
      if (!e.target.value) return
      setExpenseDate(e.target.value)
      setSelectedMonth(e.target.value.slice(0, 7))
    }}
  />
</label>
          <input
            placeholder="사용처 (예: 카페)"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          <input
            type="number"
            placeholder="지출 금액"
            min="1"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />

          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <button type="submit">+ 지출 추가</button>
        </form>
      </section>

      <DashboardPanel
      
  monthlyItems={monthlyItems}
  monthlyTotal={monthlyTotal}
  selectedMonth={selectedMonth}
/>
<IncomePanel
  key={`income-${selectedMonth}`}
  selectedMonth={selectedMonth}
  monthlyTotal={monthlyTotal}
/>
<BudgetPanel
  key={`budget-${selectedMonth}`}
  selectedMonth={selectedMonth}
  monthlyTotal={monthlyTotal}
/>
<CalendarPanel
  selectedMonth={selectedMonth}
  selectedDate={expenseDate}
  items={monthlyItems}
  onSelectDate={setExpenseDate}
/>


<SpendingAnalysis
  monthlyItems={monthlyItems}
  selectedMonth={selectedMonth}
  previousMonthTotal={previousMonthTotal}
/>



      <section className="category-analysis">
        <h2>카테고리별 소비 분석</h2>

        {monthlyTotal === 0 ? (
          <p className="empty-message">
            선택한 달의 지출 내역이 없어요.
          </p>
        ) : (
          categoryTotals
            .filter(cat => cat.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .map(cat => (
              <div className="category-row" key={cat.name}>
              
              <div className="category-label" key={cat.name}>
  <div className="category-left">
    <span className="category-name">{cat.name}</span>
    <span className="category-percent">
      {((cat.amount / monthlyTotal) * 100).toFixed(2)}%
    </span>
  </div>

  <strong className="category-amount">
    {cat.amount.toLocaleString()}원
  </strong>
</div>


                <div className="category-track">
                  <div
                    className="category-fill"
                    style={{
                      width: `${cat.amount / monthlyTotal * 100}%`,
                      background: categoryColors[cat.name]
                    }}
                  />
                </div>
              </div>
            ))
        )}
      </section>

      <section className="expense-list">
        <h2>선택한 달의 소비 내역</h2>

        {monthlyItems.length === 0 && (
          <p className="empty-message">
            아직 등록된 지출이 없어요.
          </p>
        )}

        {monthlyItems.map(item => (
          <div className="expense-item" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <p>{item.category} · {item.date}</p>
            </div>

            <strong>
              {Number(item.amount).toLocaleString()}원
            </strong>

            <button onClick={() => deleteExpense(item.id)}>
              삭제
            </button>
          </div>
        ))}
      </section>
    </main>
  )
}

export default App
