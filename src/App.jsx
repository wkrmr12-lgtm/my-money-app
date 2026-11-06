
import { useState, useEffect } from 'react'
import './App.css'
import BudgetPanel from './BudgetPanel.jsx'
import CalendarPanel from './CalendarPanel.jsx'
import DashboardPanel from './DashboardPanel.jsx'
import SpendingAnalysis from './SpendingAnalysis.jsx'
import IncomePanel from './IncomePanel.jsx'
import IncomeForm from './IncomeForm.jsx'
import FinanceChart from './FinanceChart.jsx'
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
  
  // v6.0: 화면 전환 상태는 데이터 저장 상태와 분리합니다.
  const [activeTab, setActiveTab] = useState('home')
  const [incomeFormOpen, setIncomeFormOpen] = useState(false)
  const [expenseFormOpen, setExpenseFormOpen] = useState(false)
  const [homeMemo, setHomeMemo] = useState(() => {
    try { return localStorage.getItem('mymoney-home-note') || '' }
    catch { return '' }
  })
  useEffect(() => {
    try { localStorage.setItem('mymoney-home-note', homeMemo) }
    catch { /* 저장소가 차단된 경우 화면은 계속 사용 가능 */ }
  }, [homeMemo])

  const monthlyIncomes = incomes.filter(item => item.date?.startsWith(selectedMonth))
  const monthlyIncomeTotal = monthlyIncomes.reduce((sum, item) => sum + Number(item.amount), 0)
  const monthlyBalance = monthlyIncomeTotal - monthlyTotal
  const recentTransactions = [
    ...monthlyItems.map(item => ({...item, kind: 'expense'})),
    ...monthlyIncomes.map(item => ({...item, kind: 'income'}))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 3)
  const navItems = [
    ['home', '⌂', '홈'], ['income', '₩', '수입'],
    ['expense', '▣', '지출'], ['stats', '◔', '통계'],
    ['settings', '⚙', '설정']
  ]
  const krw = value => `${Number(value).toLocaleString('ko-KR')}원`
  const goTo = tab => {
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const monthPicker = (
    <label className="v6-month-picker">
      <span>조회 월</span>
      <input type="month" value={selectedMonth} onChange={e => {
        const month = e.target.value
        if (!month) return
        setSelectedMonth(month)
        setExpenseDate(`${month}-01`)
        setIncomeDate(`${month}-01`)
      }} />
    </label>
  )

  return (
    <main className="app mymoney-v6">
      {toast && (
        <div className="toast-success" role="status">
          <span className="toast-check">✓</span>
          <div>
            <strong>{toast === 'income' ? '수입 등록 완료!' : toast === 'income-edit' ? '수입 수정 완료!' : toast === 'expense-edit' ? '지출 수정 완료!' : '지출 등록 완료!'}</strong>
            <p>{toast === 'income' ? '수입 내역이 정상적으로 등록되었습니다.' : toast === 'income-edit' ? '수입 내역이 정상적으로 수정되었습니다.' : toast === 'expense-edit' ? '지출 내역이 정상적으로 수정되었습니다.' : '지출 내역이 정상적으로 등록되었습니다.'}</p>
          </div>
        </div>
      )}
      <div className="v6-shell">
        <aside className="v6-sidebar" aria-label="PC 메뉴">
          <div className="v6-brand">MyMoney<small>나의 스마트 가계부</small></div>
          <nav className="v6-side-links">
            {navItems.map(([id, icon, label]) => (
              <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => goTo(id)} type="button" aria-current={activeTab === id ? 'page' : undefined}>
                <span aria-hidden="true">{icon}</span>{label}
              </button>
            ))}
          </nav>
          <span className="v6-side-footer">MyMoney v6.0</span>
        </aside>

        <div className="v6-main-column">
          <header className="v6-topbar">
            <div><h1>MyMoney</h1><p>{selectedMonth.replace('-', '년 ')}월 가계부</p></div>
            <span className="v6-version">v6.0</span>
          </header>
          <div className="v6-page-content">
            <div className="v6-page-heading">
              <h2>{({home:'월간 대시보드',income:'💵 수입 관리',expense:'💸 지출 관리',stats:'📊 통계 분석',settings:'⚙️ 설정'})[activeTab]}</h2>
              {activeTab !== 'settings' && monthPicker}
            </div>

            {activeTab === 'home' && (
              <div className="v6-stack">
                <div className="v6-summary-grid">
                  <div className="v6-summary-card v6-income"><span>총수입</span><strong>{krw(monthlyIncomeTotal)}</strong></div>
                  <div className="v6-summary-card v6-expense"><span>총지출</span><strong>{krw(monthlyTotal)}</strong></div>
                </div>
                <section className="v6-balance-card"><span>이번 달 잔액</span><strong>{krw(monthlyBalance)}</strong></section>
                <div className="v6-quick-actions">
                  <button type="button" onClick={() => {goTo('income');setIncomeFormOpen(true)}}>＋ 수입 등록</button>
                  <button type="button" onClick={() => {goTo('expense');setExpenseFormOpen(true)}}>＋ 지출 등록</button>
                </div>
                <section className="v6-card">
                  <div className="v6-section-head"><h3>최근 거래</h3><span>선택한 달 · 최근 3건</span></div>
                  {recentTransactions.length === 0 ? <p className="v6-empty">이번 달 등록된 거래가 없어요.</p> : recentTransactions.map(item => (
                    <div className="v6-recent-item" key={`${item.kind}-${item.id}`}>
                      <div><strong>{item.name}</strong><small>{item.date} · {item.kind === 'income' ? '수입' : item.category || '지출'}</small></div>
                      <strong className={item.kind === 'income' ? 'v6-green' : 'v6-red'}>{item.kind === 'income' ? '+' : '-'}{krw(item.amount)}</strong>
                    </div>
                  ))}
                </section>
                <section className="v6-card">
                  <div className="v6-section-head"><h3>나의 메모</h3><span>자동 저장</span></div>
                  <textarea className="v6-memo" rows={3} maxLength={1000} value={homeMemo} onChange={e => setHomeMemo(e.target.value)} placeholder="이번 달 기억할 내용을 적어보세요." />
                </section>
              </div>
            )}

            {activeTab === 'income' && (
              <div className="v6-stack v6-income-page">
                <div className="v6-summary-card v6-income"><span>이번 달 총수입</span><strong>{krw(monthlyIncomeTotal)}</strong></div>
                <button className="v6-expand-trigger" type="button" aria-expanded={incomeFormOpen} onClick={() => setIncomeFormOpen(open => !open)}>
                  {incomeFormOpen ? '수입 등록창 접기 ▲' : '＋ 새 수입 등록'}
                </button>
                {incomeFormOpen && (
                  <div className="v6-form-wrap"><IncomeForm name={incomeName} amount={incomeAmount} date={incomeDate} onNameChange={setIncomeName} onAmountChange={setIncomeAmount} onDateChange={setIncomeDate} onSubmit={addIncome} /></div>
                )}
                <IncomePanel key={`income-${selectedMonth}`} selectedMonth={selectedMonth} monthlyTotal={monthlyTotal} incomes={incomes} setIncomes={setIncomes} onIncomeEdited={() => setToast('income-edit')} />
              </div>
            )}

            {activeTab === 'expense' && (
              <div className="v6-stack v6-expense-page">
                <div className="v6-summary-card v6-expense"><span>이번 달 총지출</span><strong>{krw(monthlyTotal)}</strong></div>
                <button className="v6-expand-trigger" type="button" aria-expanded={expenseFormOpen} onClick={() => setExpenseFormOpen(open => !open)}>
                  {expenseFormOpen ? '지출 등록창 접기 ▲' : '＋ 새 지출 등록'}
                </button>
                {expenseFormOpen && (
                  <section className="expense-form"><h2>💸 지출 등록하기</h2>
                    <form onSubmit={addExpense}>
                      <label className="expense-date-label">지출 날짜
                        <input type="date" value={expenseDate} onChange={e => {
                          if (!e.target.value) return
                          setExpenseDate(e.target.value)
                          setSelectedMonth(e.target.value.slice(0, 7))
                        }} />
                      </label>
                      <input placeholder="사용처 (예: 카페)" value={name} onChange={e => setName(e.target.value)} />
                      <input type="number" placeholder="지출 금액" min="1" value={amount} onChange={e => setAmount(e.target.value)} />
                      <select value={category} onChange={e => setCategory(e.target.value)}>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <button type="submit">＋ 지출 추가</button>
                    </form>
                  </section>
                )}
                <CalendarPanel selectedMonth={selectedMonth} selectedDate={calendarDate} items={monthlyItems} onSelectDate={setCalendarDate} onDeleteExpense={deleteExpense} onUpdateExpense={updateExpense} categories={categories} />
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="v6-stack">
                <FinanceChart incomeTotal={monthlyIncomeTotal} expenseTotal={monthlyTotal} selectedMonth={selectedMonth} />
                <BudgetPanel key={`budget-${selectedMonth}`} selectedMonth={selectedMonth} monthlyTotal={monthlyTotal} />
                <SpendingAnalysis monthlyItems={monthlyItems} selectedMonth={selectedMonth} previousMonthTotal={previousMonthTotal} />
                <section className="category-analysis">
                  <h2>카테고리별 소비 분석</h2>
                  {monthlyTotal === 0 ? <p className="empty-message">선택한 달의 지출 내역이 없어요.</p> : categoryTotals.filter(cat => cat.amount > 0).sort((a,b) => b.amount - a.amount).map(cat => (
                    <div className="category-row" key={cat.name}>
                      <div className="category-label"><div className="category-left"><span className="category-name">{cat.name}</span><span className="category-percent">{((cat.amount / monthlyTotal) * 100).toFixed(2)}%</span></div><strong className="category-amount">{krw(cat.amount)}</strong></div>
                      <div className="category-track"><div className="category-fill" style={{width:`${cat.amount / monthlyTotal * 100}%`,background:categoryColors[cat.name]}} /></div>
                    </div>
                  ))}
                </section>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="v6-stack">
                <section className="v6-card"><h3>앱 정보</h3><p>MyMoney v6.0 · 나의 스마트 가계부</p></section>
                <section className="v6-card"><h3>화면 설정</h3><p>추후 테마 설정 기능이 추가될 예정이에요.</p></section>
                <section className="v6-card"><h3>데이터 관리</h3><p>데이터 백업·복원과 계정 연결은 추후 제공 예정이에요.</p><p>현재 수입·지출 기록은 이 브라우저의 로컬 저장소에 보관돼요.</p></section>
              </div>
            )}
          </div>
        </div>
        <nav className="v6-bottom-nav" aria-label="모바일 메뉴">
          {navItems.map(([id, icon, label]) => (
            <button type="button" key={id} className={activeTab === id ? 'active' : ''} onClick={() => goTo(id)} aria-current={activeTab === id ? 'page' : undefined}>
              <span aria-hidden="true">{icon}</span><small>{label}</small>
            </button>
          ))}
        </nav>
      </div>
    </main>
  )
}

export default App
