
function IncomeForm({
    name,
    amount,
    date,
    onNameChange,
    onAmountChange,
    onDateChange,
    onSubmit
  }) {
    return (
      <section className="income-entry">
        <h2>💵 수입 등록하기</h2>
  
        <form className="income-form" onSubmit={onSubmit}>
          <input
            type="text"
            placeholder="수입 이름 (예: 월급)"
            value={name}
            onChange={e => onNameChange(e.target.value)}
          />
  
          <input
            type="number"
            min="1"
            placeholder="수입 금액"
            value={amount}
            onChange={e => onAmountChange(e.target.value)}
          />
  
          <input
            type="date"
            value={date}
            onChange={e => onDateChange(e.target.value)}
          />
  
          <button type="submit">
            + 수입 추가
          </button>
        </form>
      </section>
    )
  }
  
  export default IncomeForm
  