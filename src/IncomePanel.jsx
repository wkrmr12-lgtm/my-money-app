
import { useState, useEffect } from 'react'
import FinanceChart from './FinanceChart.jsx'
import IncomeForm from './IncomeForm.jsx'
function IncomePanel({ selectedMonth, monthlyTotal }) {
    console.log('수입 관리 조회 월:', selectedMonth)
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
  const [date, setDate] = useState(
    () => `${selectedMonth}-01`
  )

  useEffect(() => {
    localStorage.setItem(
      'mymoney-income',
      JSON.stringify(incomes)
    )
  }, [incomes])

  const monthlyIncomes = incomes.filter(
    item => item.date?.startsWith(selectedMonth)
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

  return (
    <section className="income-panel">
<p>🔍 현재 조회 중인 월: {selectedMonth}</p>
      <h2>💵 수입 관리</h2>


      <IncomeForm
  name={name}
  amount={amount}
  date={date}
  onNameChange={setName}
  onAmountChange={setAmount}
  onDateChange={setDate}
  onSubmit={addIncome}
/>

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

        {monthlyIncomes.length === 0 && (
          <p className="empty-message">
            등록된 수입이 없어요.
          </p>
        )}

        {monthlyIncomes.map(item => (
          <div className="income-item" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <p>{item.date}</p>
            </div>

            <strong>
              {Number(item.amount).toLocaleString()}원
            </strong>

            <button
              type="button"
              onClick={() => deleteIncome(item.id)}
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

export default IncomePanel
