
import { useState, useEffect, useRef } from 'react'
import './App.css'
import BudgetPanel from './BudgetPanel.jsx'
import CalendarPanel from './CalendarPanel.jsx'
import DashboardPanel from './DashboardPanel.jsx'
import SpendingAnalysis from './SpendingAnalysis.jsx'
import IncomePanel from './IncomePanel.jsx'
import FinanceChart from './FinanceChart.jsx'
import PhotoExpenseImport from './PhotoExpenseImport.jsx'
import DataBackupPanel from './DataBackupPanel.jsx'
import { DailyReminderRunner, DailyReminderPanel } from './DailyReminder.jsx'
import InstallAppPanel from './InstallAppPanel.jsx'
import './pwaClient.js'
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

// 월별 다중 메모 v2: 원본 데이터는 보존하고 새 키로 한 번만 복사합니다.
const MEMO_ENTRIES_KEY = 'mymoney-memo-entries-v2'
const OLD_MONTHLY_MEMO_KEY = 'mymoney-monthly-notes'

function isValidMonth(month) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

function makeMemoId() {
  return crypto.randomUUID()
}

function readMemoEntries() {
  const existing = localStorage.getItem(MEMO_ENTRIES_KEY)
  if (existing !== null) {
    const value = JSON.parse(existing)
    if (!Array.isArray(value)) throw new Error('메모 보관함 데이터 형식 오류')
    return value.filter(entry => entry && typeof entry.id === 'string' &&
      isValidMonth(entry.month) && typeof entry.content === 'string')
  }

  // 기존 월별 메모(월마다 문자열 1건)를 새 형식으로 복사합니다.
  const previous = localStorage.getItem(OLD_MONTHLY_MEMO_KEY)
  const entries = []
  if (previous !== null) {
    const parsed = JSON.parse(previous)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('기존 월별 메모 형식 오류')
    }
    Object.entries(parsed).forEach(([month, content]) => {
      if (isValidMonth(month) && typeof content === 'string' && content.trim()) {
        entries.push({ id: makeMemoId(), month, content, createdAt: new Date().toISOString() })
      }
    })
  } else {
    const legacy = localStorage.getItem('mymoney-home-note')
    if (legacy && legacy.trim()) {
      entries.push({ id: makeMemoId(), month: getLocalDate().slice(0, 7), content: legacy, createdAt: new Date().toISOString() })
    }
  }

  // 새 저장 키를 먼저 생성해야 나중에 전부 삭제해도 옛 메모가 부활하지 않습니다.
  localStorage.setItem(MEMO_ENTRIES_KEY, JSON.stringify(entries))
  return entries
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
  const [expenseMemo, setExpenseMemo] = useState('')
  const [incomeMemo, setIncomeMemo] = useState('')
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
        memo: expenseMemo.trim(),
        date: expenseDate
      },
      ...prev
    ])

    setSelectedMonth(expenseDate.slice(0, 7))
    setName('')
    setAmount('')
    setExpenseMemo('')
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
        memo: incomeMemo.trim(),
        amount: value,
        date: incomeDate
      },
      ...prev
    ])
  
    setIncomeName('')
    setIncomeAmount('')
    setIncomeMemo('')
    setToast('income')

  }
  
  function importExpensesFromPhoto(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return
    const imported = entries.map(entry => ({
      id: crypto.randomUUID(),
      name: entry.name,
      amount: Number(entry.amount),
      category: entry.category,
      memo: entry.memo || '',
      date: entry.date,
      source: 'photo',
    }))
    setItems(previous => [...imported, ...previous])
    setSelectedMonth(imported[0].date.slice(0, 7))
    setCalendarDate(imported[0].date)
    setPhotoImportOpen(false)
    setToast('photo-import')
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
  const [photoImportOpen, setPhotoImportOpen] = useState(false)
  // 저장은 '메모 저장' 버튼을 누를 때만 실행합니다. 기존 글을 입력만으로 덮어쓰지 않습니다.
  const [memoEntries, setMemoEntries] = useState(() => {
    try { return readMemoEntries() } catch { return [] }
  })
  const [memoArchiveOpen, setMemoArchiveOpen] = useState(false)
  const [memoDraft, setMemoDraft] = useState('')
  const [editingMemoId, setEditingMemoId] = useState(null)
  const [memoNotice, setMemoNotice] = useState('')
  const [memoSaveMessage, setMemoSaveMessage] = useState('저장 버튼으로 등록')

  const memoEditNavigation = useRef(null)
  useEffect(() => {
    if (memoEditNavigation.current === selectedMonth) {
      memoEditNavigation.current = null
      return
    }
    setMemoDraft('')
    setEditingMemoId(null)
  }, [selectedMonth])

  useEffect(() => {
    if (!memoNotice) return
    const timer = setTimeout(() => setMemoNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [memoNotice])

  const savedMemoEntries = [...memoEntries]
    .sort((a, b) => b.month.localeCompare(a.month) || (b.createdAt || '').localeCompare(a.createdAt || ''))

  function scrollToMemoArchive() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.getElementById('v6-memo-archive-list')?.scrollIntoView({behavior:'smooth',block:'start'})
    }))
  }

  function saveMemo() {
    const content = memoDraft.trim()
    if (!content) {
      setMemoNotice('메모 내용을 먼저 입력해 주세요.')
      return
    }
    try {
      const current = readMemoEntries()
      let updated
      if (editingMemoId) {
        if (!current.some(entry => entry.id === editingMemoId)) {
          setEditingMemoId(null)
          setMemoNotice('수정할 메모가 없습니다. 다시 선택해 주세요.')
          return
        }
        updated = current.map(entry => entry.id === editingMemoId
          ? {...entry, content, updatedAt:new Date().toISOString()} : entry)
      } else {
        updated = [...current, {
          id:makeMemoId(), month:selectedMonth, content, createdAt:new Date().toISOString()
        }]
      }
      localStorage.setItem(MEMO_ENTRIES_KEY, JSON.stringify(updated))
      setMemoEntries(updated)
      setMemoDraft('')
      setEditingMemoId(null)
      setMemoArchiveOpen(true)
      setMemoSaveMessage('✓ 저장 완료')
      setMemoNotice(editingMemoId ? '메모 수정이 완료되었습니다.' : '새 메모가 저장되었습니다.')
      scrollToMemoArchive()
    } catch {
      setMemoSaveMessage('저장 실패')
      setMemoNotice('메모를 저장하지 못했어요. 저장 공간을 확인해 주세요.')
    }
  }

  function openMemoForEdit(entry) {
    memoEditNavigation.current = entry.month
    setSelectedMonth(entry.month)
    setExpenseDate(`${entry.month}-01`)
    setIncomeDate(`${entry.month}-01`)
    setEditingMemoId(entry.id)
    setMemoDraft(entry.content)
    setMemoSaveMessage('수정 중 · 아직 저장되지 않음')
    setMemoNotice(`${entry.month.replace('-', '년 ')}월 메모를 수정하고 저장 버튼을 눌러 주세요.`)
    requestAnimationFrame(() => document.getElementById('v6-monthly-memo-input')?.focus())
  }

  function cancelMemoEdit() {
    setEditingMemoId(null)
    setMemoDraft('')
    setMemoSaveMessage('저장 버튼으로 등록')
    setMemoNotice('수정을 취소했습니다. 기존 메모는 그대로 유지됩니다.')
  }

  function deleteMemo(entry) {
    if (!window.confirm(`${entry.month.replace('-', '년 ')}월의 선택한 메모를 삭제할까요?\n삭제한 메모는 되돌릴 수 없습니다.`)) return
    try {
      const current = readMemoEntries()
      const updated = current.filter(item => item.id !== entry.id)
      localStorage.setItem(MEMO_ENTRIES_KEY, JSON.stringify(updated))
      setMemoEntries(updated)
      if (editingMemoId === entry.id) {
        setEditingMemoId(null)
        setMemoDraft('')
      }
      setMemoSaveMessage('삭제 완료')
      setMemoNotice('메모가 삭제되었습니다.')
    } catch {
      setMemoNotice('메모를 삭제하지 못했어요. 다시 시도해 주세요.')
    }
  }

  useEffect(() => {
    const onStorage = event => {
      if (event.key !== MEMO_ENTRIES_KEY) return
      try { setMemoEntries(readMemoEntries()) }
      catch { setMemoNotice('다른 창의 메모 변경을 불러오지 못했어요.') }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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
    <>
    <DailyReminderRunner />
    <main className="app mymoney-v6">
      {toast && (
        <div className="toast-success" role="status">
          <span className="toast-check">✓</span>
          <div>
            <strong>{toast === 'income' ? '수입 등록 완료!' : toast === 'income-edit' ? '수입 수정 완료!' : toast === 'expense-edit' ? '지출 수정 완료!' : toast === 'photo-import' ? '사진 인식 지출 등록 완료!' : '지출 등록 완료!'}</strong>
            <p>{toast === 'income' ? '수입 내역이 정상적으로 등록되었습니다.' : toast === 'income-edit' ? '수입 내역이 정상적으로 수정되었습니다.' : toast === 'expense-edit' ? '지출 내역이 정상적으로 수정되었습니다.' : toast === 'photo-import' ? '선택한 카드·계좌 거래가 지출 내역에 추가되었습니다.' : '지출 내역이 정상적으로 등록되었습니다.'}</p>
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
                <section className="v6-card v6-monthly-memo-card">
                  <div className="v6-section-head"><h3>📝 월별 가계부 메모</h3><span>{memoSaveMessage}</span></div>
                  <p className="v6-memo-description">{selectedMonth.replace('-', '년 ')}월에는 메모를 여러 개 저장할 수 있어요. 기존 메모는 덮어쓰지 않습니다.</p>
                  <label className="v6-memo-month-label" htmlFor="v6-monthly-memo-input">
                    {editingMemoId ? '선택한 메모 수정' : `${selectedMonth.replace('-', '년 ')}월 새 메모 작성`}
                  </label>
                  <textarea id="v6-monthly-memo-input" className="v6-memo" rows={4} maxLength={1000}
                    value={memoDraft} onChange={e => {setMemoDraft(e.target.value);setMemoSaveMessage('작성 중 · 아직 저장되지 않음')}}
                    placeholder="예: 자동차 수리비가 발생해서 이번 달 지출이 많았음." />
                  <div className="v6-memo-footnote"><span>저장 버튼을 눌러야 목록에 등록돼요.</span><span>{memoDraft.length}/1000자</span></div>
                  <div className="v6-memo-actions">
                    {editingMemoId && <button type="button" className="v6-memo-edit" onClick={cancelMemoEdit}>수정 취소</button>}
                    <button type="button" className="v6-memo-save" onClick={saveMemo}>{editingMemoId ? '✓ 수정 저장' : '＋ 새 메모 저장'}</button>
                  </div>
                  {memoNotice && <p className="v6-memo-notice" role="status" aria-live="polite">{memoNotice}</p>}
                  <button className="v6-memo-archive-toggle" type="button" aria-expanded={memoArchiveOpen}
                    onClick={() => setMemoArchiveOpen(open => !open)}>
                    <span>저장된 메모 목록 ({savedMemoEntries.length}개)</span>
                    <span aria-hidden="true">{memoArchiveOpen ? '접기 ▲' : '펼치기 ▼'}</span>
                  </button>
                  {memoArchiveOpen && (
                    <div id="v6-memo-archive-list" className="v6-memo-archive">
                      {savedMemoEntries.length === 0 ? (
                        <p className="v6-empty">아직 저장된 메모가 없어요.</p>
                      ) : savedMemoEntries.map(entry => (
                        <div className="v6-memo-record" key={entry.id}>
                          <div className="v6-memo-record-main">
                            <strong>{entry.month.replace('-', '년 ')}월</strong>
                            <p>{entry.content}</p>
                          </div>
                          <div className="v6-memo-record-actions">
                            <button type="button" className="v6-memo-edit" onClick={() => openMemoForEdit(entry)}>수정</button>
                            <button type="button" className="v6-memo-delete" onClick={() => deleteMemo(entry)}>삭제</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                  <section className="v6-form-wrap v6-inline-entry">
                    <h3>수입 등록하기</h3>
                    <form className="income-form" onSubmit={addIncome}>
                      <label className="income-date-label">수입 날짜
                        <input type="date" value={incomeDate} onChange={e => {
                          if (!e.target.value) return
                          setIncomeDate(e.target.value)
                          setSelectedMonth(e.target.value.slice(0, 7))
                        }} required />
                      </label>
                      <input placeholder="수입 이름 (예: 용돈)" value={incomeName} onChange={e => setIncomeName(e.target.value)} required />
                      <input type="number" placeholder="수입 금액" min="1" value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} required />
                      <label className="v6-entry-memo-label">거래 메모 (선택)
                        <textarea maxLength={200} rows={2} value={incomeMemo} onChange={e => setIncomeMemo(e.target.value)} placeholder="예: 부모님께 받은 용돈" />
                        <small>{incomeMemo.length}/200자</small>
                      </label>
                      <button type="submit">＋ 수입 추가</button>
                    </form>
                  </section>
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
                <button className="v6-photo-open-trigger" type="button" aria-expanded={photoImportOpen} onClick={() => setPhotoImportOpen(open => !open)}>
                  {photoImportOpen ? '📷 사진 등록창 접기 ▲' : '📷 사진으로 지출 등록'}
                </button>
                {photoImportOpen && (
                  <PhotoExpenseImport existingExpenses={items} onImport={importExpensesFromPhoto} onClose={() => setPhotoImportOpen(false)} />
                )}
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
                      <label className="v6-entry-memo-label">거래 메모 (선택)
                        <textarea maxLength={200} rows={2} value={expenseMemo} onChange={e => setExpenseMemo(e.target.value)} placeholder="예: 아이스 아메리카노 2잔" />
                        <small>{expenseMemo.length}/200자</small>
                      </label>
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
                <InstallAppPanel />
                <DailyReminderPanel />
                <DataBackupPanel />
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
    </>
  )
}

export default App
