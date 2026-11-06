
import { useState, useEffect } from 'react'
import FinanceChart from './FinanceChart.jsx'
import IncomeForm from './IncomeForm.jsx'

function IncomePanel({
    selectedMonth,
    monthlyTotal,
    incomes,
    setIncomes,
    onIncomeEdited
  }) {
const [showAllIncomes, setShowAllIncomes] = useState(false)
const [editingIncome, setEditingIncome] = useState(null)
const [searchQuery, setSearchQuery] = useState('')

    console.log('수입 관리 조회 월:', selectedMonth)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(
    () => `${selectedMonth}-01`
  )



  const monthlyIncomes = incomes
  .filter(item => item.date?.startsWith(selectedMonth))
  .sort((a, b) => b.date.localeCompare(a.date))

  const filteredIncomes = monthlyIncomes.filter(item =>
    `${item.name || ''} ${item.memo || ''}`.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())
  )


  const incomeTotal = monthlyIncomes.reduce(
    (sum, item) => sum + Number(item.amount), 0
  )

  const balance = incomeTotal - monthlyTotal

  function addIncome(e) {
    e.preventDefault()

    const value = Number(amount)

    if (!name.trim() || !Number.isFinite(value) || value <= 0) {
      alert('수입 이름과 올바른 금액을 입력해 주세요.')
      return
    }

    setIncomes(prev => [
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        amount: value,
        date
      },
      ...prev
    ])

    setName('')
    setAmount('')
  }

  function deleteIncome(id) {
    setIncomes(prev => prev.filter(item => item.id !== id))
  }

  function updateIncome(id, updatedData) {
    setIncomes(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, ...updatedData }
          : item
      )
    )
  }
  
  return (
    <section className="income-panel">
<p>🔍 현재 조회 중인 월: {selectedMonth}</p>
      <h2>💵 수입 관리</h2>




<FinanceChart
  incomeTotal={incomeTotal}
  expenseTotal={monthlyTotal}
  selectedMonth={selectedMonth}
/>

      <div className="income-summary">
        <div>
          <span>이번 달 수입</span>
          <strong>{incomeTotal.toLocaleString()}원</strong>
        </div>

        <div>
          <span>이번 달 지출</span>
          <strong>{monthlyTotal.toLocaleString()}원</strong>
        </div>

        <div>
          <span>월간 잔액</span>
          <strong className={balance < 0 ? 'negative' : ''}>
            {balance.toLocaleString()}원
          </strong>
        </div>
      </div>

      

      <div className="income-list">
        <h3>선택한 달의 수입 내역</h3>
        <input className="v6-transaction-search" type="search" value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setShowAllIncomes(false) }}
          placeholder="수입 이름·메모 검색" aria-label="수입 이름·메모 검색" />

        {filteredIncomes.length === 0 && (
          <p className="empty-message">
            등록된 수입이 없어요.
          </p>
        )}

     
{(showAllIncomes ? filteredIncomes : filteredIncomes.slice(0, 5)).map(item => (


          <div className="income-item" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <p>{item.date}</p>
              {item.memo && <p className="v6-transaction-memo">{item.memo}</p>}
            </div>

            <strong>
              {Number(item.amount).toLocaleString()}원
            </strong>

            <button
  type="button"
  className="income-edit-btn"
  
onClick={() => {
    setEditingIncome({ ...item })
  
    requestAnimationFrame(() => {
      document.getElementById('income-edit-form')?.scrollIntoView({
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
              onClick={() => deleteIncome(item.id)}
            >
              삭제
            </button>
          </div>
        ))}

{editingIncome && (
  <form
    id="income-edit-form"
    className="income-edit-form"
    onSubmit={e => {
      e.preventDefault()

      if (
        !editingIncome.name?.trim() ||
        !Number.isFinite(Number(editingIncome.amount)) ||
        Number(editingIncome.amount) <= 0 ||
        !editingIncome.date
      ) {
        alert('수입 정보를 올바르게 입력해 주세요.')
        return
      }

      updateIncome(editingIncome.id, {
        name: editingIncome.name.trim(),
        amount: Number(editingIncome.amount),
        date: editingIncome.date,
        memo: (editingIncome.memo || '').trim()
      })
    
      onIncomeEdited()
      setEditingIncome(null)
    }}
  >
    <h3>✏️ 수입 내역 수정</h3>

    <label>
      수입 이름
      <input
        type="text"
        value={editingIncome.name}
        onChange={e =>
          setEditingIncome(prev => ({
            ...prev,
            name: e.target.value
          }))
        }
      />
    </label>

    <label>
      수입 금액
      <input
        type="number"
        min="1"
        value={editingIncome.amount}
        onChange={e =>
          setEditingIncome(prev => ({
            ...prev,
            amount: e.target.value
          }))
        }
      />
    </label>

    <label>
      수입 날짜
      <input
        type="date"
        value={editingIncome.date}
        onChange={e =>
          setEditingIncome(prev => ({
            ...prev,
            date: e.target.value
          }))
        }
      />
    </label>

    <label>거래 메모 (선택)
      <textarea maxLength={200} rows={2} value={editingIncome.memo || ''}
        onChange={e => setEditingIncome(prev => ({...prev, memo: e.target.value}))} />
    </label>
    <button type="submit">수정 완료</button>

    <button
      type="button"
      onClick={() => setEditingIncome(null)}
    >
      취소
    </button>
  </form>
)}

{filteredIncomes.length > 5 && (
  <button
    type="button"
    className="income-more-btn"
    onClick={() => setShowAllIncomes(!showAllIncomes)}
  >
    {showAllIncomes ? '접기 ▲' : `전체 수입 내역 보기 (${filteredIncomes.length}건) ▼`}
  </button>
)}

      </div>
    </section>
  )
}

export default IncomePanel
