
import { useState, useEffect } from 'react'
import './App.css'
import BudgetPanel from './BudgetPanel.jsx'
import CalendarPanel from './CalendarPanel.jsx'
import DashboardPanel from './DashboardPanel.jsx'
import SpendingAnalysis from './SpendingAnalysis.jsx'
import IncomePanel from './IncomePanel.jsx'
import IncomeForm from './IncomeForm.jsx'
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

  const [incomes, setIncomes] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('mymoney-income') || '[]'
      )
  
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
const [incomeName, setIncomeName] = useState('')
const [incomeAmount, setIncomeAmount] = useState('')
const [incomeDate, setIncomeDate] = useState(
  () => `${getLocalDate().slice(0, 7)}-01`
)

const [toast, setToast] = useState(null)
const [calendarDate, setCalendarDate] = useState(expenseDate)
useEffect(() => {
  setCalendarDate(`${selectedMonth}-01`)
}, [selectedMonth])


useEffect(() => {
  if (!toast) return

  const timer = setTimeout(() => {
    setToast(null)
  }, 3000)

  return () => clearTimeout(timer)
}, [toast])


  useEffect(() => {
    localStorage.setItem('mymoney', JSON.stringify(items))
  }, [items])
  useEffect(() => {
    localStorage.setItem(
      'mymoney-income',
      JSON.stringify(incomes)
    )
  }, [incomes])
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
    setToast('expense')

  }

  function addIncome(e) {
    e.preventDefault()
  
    const value = Number(incomeAmount)
  
    if (
      !incomeName.trim() ||
      !Number.isFinite(value) ||
      value <= 0 ||
      !incomeDate
    ) {
      alert('수입 이름, 금액, 날짜를 확인해 주세요.')
      return
    }
  
    setIncomes(prev => [
      {
        id: crypto.randomUUID(),
        name: incomeName.trim(),
        amount: value,
        date: incomeDate
      },
      ...prev
    ])
  
    setIncomeName('')
    setIncomeAmount('')
    setToast('income')

  }
  
  function deleteExpense(id) {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  function updateExpense(id, updatedData) {
    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, ...updatedData }
          : item
      )
    )

  setToast('expense-edit')
  }
  
  return (
    <main className="app">

{toast && (
  <div className="toast-success" role="status">
    <span className="toast-check">✓</span>
    <div>
     
    <strong>
  {toast === 'income'
    ? '수입 등록 완료!'
    : toast === 'income-edit'
      ? '수입 수정 완료!'
      : toast === 'expense-edit'
        ? '지출 수정 완료!'
        : '지출 등록 완료!'}
</strong>
<p>
  {toast === 'income'
    ? '수입 내역이 정상적으로 등록되었습니다.'
    : toast === 'income-edit'
      ? '수입 내역이 정상적으로 수정되었습니다.'
      : toast === 'expense-edit'
        ? '지출 내역이 정상적으로 수정되었습니다.'
        : '지출 내역이 정상적으로 등록되었습니다.'}
</p>


    </div>
  </div>
)}


      <h1>💳 MyMoney</h1>
      <p>나의 스마트 소비 관리 앱</p>

      <section className="month-section">
      <h2>📅 조회할 월 선택</h2>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => {
            const month = e.target.value
            if (!month) return
            setSelectedMonth(month)
            setExpenseDate(`${month}-01`)
            setIncomeDate(`${month}-01`)
          }}
        />
      </section>
      <div className="entry-grid">
<IncomeForm
  name={incomeName}
  amount={incomeAmount}
  date={incomeDate}
  onNameChange={setIncomeName}
  onAmountChange={setIncomeAmount}
  onDateChange={setIncomeDate}
  onSubmit={addIncome}
/>

      <section className="expense-form"> 
      <h2>💸 지출 등록하기</h2>

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
      </div>

      <DashboardPanel
      
  monthlyItems={monthlyItems}
  monthlyTotal={monthlyTotal}
  selectedMonth={selectedMonth}
/>
<IncomePanel
  key={`income-${selectedMonth}`}
  selectedMonth={selectedMonth}
  monthlyTotal={monthlyTotal}
  incomes={incomes}
setIncomes={setIncomes}
onIncomeEdited={() => setToast('income-edit')}

/>
<BudgetPanel
  key={`budget-${selectedMonth}`}
  selectedMonth={selectedMonth}
  monthlyTotal={monthlyTotal}
/>
<CalendarPanel
  selectedMonth={selectedMonth}
  selectedDate={calendarDate}
  items={monthlyItems}
  onSelectDate={setCalendarDate}
  onDeleteExpense={deleteExpense}
  onUpdateExpense={updateExpense}
  categories={categories}
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

   
    </main>
  )
}

export default App
