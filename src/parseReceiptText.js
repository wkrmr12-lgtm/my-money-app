// MyMoney v6.0 - 카드/계좌 거래내역 스크린샷의 OCR 텍스트 파서
// 인식 결과가 확실하지 않은 항목은 추측하지 않고 빈칸으로 둡니다.
export function normalizeMerchant(value = '') {
  return String(value).replace(/\s+/g, '').toLowerCase()
}

const DATE_RE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/g
const MONEY_RE = /([\-−–—]?\s*\d[\d,]*\s*원)/g
const TIME_RE = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g

function dateFromMatch(match) {
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function cleanMerchant(value) {
  return value
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '')
    .replace(/잔액|거래후잔액|거래\s*후\s*잔액|원화잔액|출금액|승인금액|사용금액/g, '')
    .replace(/[|:·•\-−–—₩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function merchantLineIsNoise(value) {
  if (!value) return true
  if (/^(?:거래내역|입출금|조회|결제내역|카드이용|신용카드|체크카드|이용내역|전체|가계부|승인|취소)/.test(value)) return true
  if (/^\d[\d,.\s]*$/.test(value)) return true
  if (/^\d{1,2}:\d{2}$/.test(value)) return true
  return false
}

export function guessExpenseCategory(merchant) {
  const name = normalizeMerchant(merchant)
  if (!name) return '기타'
  if (/커피|카페|스타벅스|메가엠지|메가커피|컴포즈|이디야|투썸|빽다방|폴바셋|할리스/.test(name)) return '카페'
  if (/편의점|gs25|cu|세븐일레븐|이마트24|마트|다이소/.test(name)) return '생활'
  if (/식당|곰탕|국밥|맥도날드|버거|치킨|피자|분식|핵밥|식사|김밥|반점|족발|삼겹/.test(name)) return '식비'
  if (/버스|지하철|택시|코레일|주유|고속도로|톨게이트|기차/.test(name)) return '교통'
  if (/쿠팡|네이버쇼핑|무신사|29cm|올리브영|11번가|지마켓/.test(name)) return '쇼핑'
  return '기타'
}

// 반환된 항목은 화면에서 검토한 뒤에만 저장하도록 합니다.
export function parseReceiptText(rawText) {
  const lines = String(rawText || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.replace(/[\t\u00a0]/g, ' ').trim())
    .filter(Boolean)
  const groups = []
  let current = null

  for (const originalLine of lines) {
    // 날짜가 새 그룹을 시작합니다. 한 줄에 날짜/상호/금액이 붙어도 처리합니다.
    const dateMatches = [...originalLine.matchAll(DATE_RE)]
    if (dateMatches.length > 0) {
      for (let i = 0; i < dateMatches.length; i++) {
        const match = dateMatches[i]
        const date = dateFromMatch(match)
        if (!date) continue
        if (current) groups.push(current)
        current = { date, lines: [] }
        const start = match.index + match[0].length
        const end = i + 1 < dateMatches.length ? dateMatches[i+1].index : originalLine.length
        const remainder = originalLine.slice(start, end).replace(TIME_RE, '').trim()
        if (remainder) current.lines.push(remainder)
      }
    } else if (current) {
      current.lines.push(originalLine)
    }
  }
  if (current) groups.push(current)

  return groups.map(group => {
    const moneyCandidates = []
    const merchantParts = []
    let seenBalance = false

    group.lines.forEach((line, index) => {
      const tokens = [...line.matchAll(MONEY_RE)].map(match => {
        const raw = match[1]
        const amount = Number(raw.replace(/[^\d]/g, ''))
        const negative = /[\-−–—]/.test(raw)
        return { raw, amount, negative, index }
      }).filter(item => item.amount > 0)
      moneyCandidates.push(...tokens)

      let remainder = line.replace(MONEY_RE, ' ').replace(TIME_RE, ' ')
      remainder = cleanMerchant(remainder)
      if (tokens.some(t => !t.negative) && !remainder) {
        // 회색의 거래 후 잔액을 상호명으로 잘못 읽지 않도록 차단
        seenBalance = true
        return
      }
      if (!seenBalance && !merchantLineIsNoise(remainder)) merchantParts.push({ text: remainder, index })
    })

    const debit = moneyCandidates.find(item => item.negative)
    const positives = moneyCandidates.filter(item => !item.negative)
    // 잔액 화면에서 양수 금액이 여러 개 나오면 추측하지 않습니다.
    const selectedAmount = debit || (positives.length === 1 ? positives[0] : null)
    const merchant = merchantParts
      .filter(part => !selectedAmount || part.index <= selectedAmount.index + 2)
      .slice(0, 3)
      .map(part => part.text)
      .join('')
      .trim()
      .slice(0, 100)

    return {
      date: group.date,
      name: merchant,
      amount: selectedAmount ? String(selectedAmount.amount) : '',
      category: guessExpenseCategory(merchant),
      memo: '',
      uncertain: !selectedAmount || !merchant || !debit,
    }
  }).filter(row => row.date && (row.amount || row.name))
}
