// Spatial card-statement reader (MyMoney 6.0).
// A date header is not a purchase. Every detected purchase amount becomes one row.
// Works with Tesseract.js v7's TSV *and* block JSON output, including a separate
// OCR pass over the amount column. Neither merchants nor missing dates are invented.
import { guessExpenseCategory } from './parseReceiptText.js'

const DATE_RE = /^(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?$/
const AMOUNT_RE = /^\d{1,3}(?:,\d{3}){1,3}(?:원)?$/
const SMALL_AMOUNT_RE = /^\d{1,3}원?$/
const PLAIN_AMOUNT_RE = /^\d{1,9}$/

function parseDate(value = '') {
  const found = String(value).replace(/\s/g, '').match(DATE_RE)
  if (!found) return ''
  const [y,m,d] = found.slice(1).map(Number)
  const valid = new Date(y,m-1,d)
  if (valid.getFullYear() !== y || valid.getMonth() !== m-1 || valid.getDate() !== d) return ''
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function wordFromBox(text, bbox, conf, offset) {
  if (!bbox || !text) return null
  const left = Number(bbox.x0), top = Number(bbox.y0)
  const width = Number(bbox.x1)-left, height = Number(bbox.y1)-top
  if (![left,top,width,height].every(Number.isFinite) || width<=0 || height<=0) return null
  const scale = offset.scale || 1
  const x = (left/scale) + (offset.x || 0), y = (top/scale) + (offset.y || 0)
  const w=width/scale,h=height/scale
  return {text:String(text).trim(),left:x,top:y,width:w,height:h,cy:y+h/2,conf:Number(conf)||0}
}

export function extractOcrWords(data = {}, offset = {}) {
  const words = []
  let pageWidth = 0, pageHeight = 0
  const tsv = typeof data === 'string' ? data : data?.tsv
  if (typeof tsv === 'string' && tsv.length) {
    for (const line of tsv.trim().split(/\r?\n/).slice(1)) {
      const p = line.split('\t')
      if (p.length < 12) continue
      if (p[0] === '1') { pageWidth = Number(p[8]); pageHeight = Number(p[9]); continue }
      if (p[0] !== '5') continue
      const txt = p.slice(11).join('\t').trim()
      const [x,y,w,h,conf]=[p[6],p[7],p[8],p[9],p[10]].map(Number)
      if (!txt || ![x,y,w,h].every(Number.isFinite) || w<=0 || h<=0) continue
      const scale = offset.scale || 1
      words.push({text:txt,left:x/scale+(offset.x||0),top:y/scale+(offset.y||0),width:w/scale,height:h/scale,cy:(y+h/2)/scale+(offset.y||0),conf})
    }
  }
  // Some platforms expose blocks but not TSV. Request both and use either.
  if (words.length === 0 && Array.isArray(data?.blocks)) {
    for (const block of data.blocks) {
      for (const para of block.paragraphs || []) {
        for (const line of para.lines || []) {
          for (const w of line.words || []) {
            const normalized = wordFromBox(w.text, w.bbox, w.confidence, offset)
            if (normalized?.text) words.push(normalized)
          }
        }
      }
    }
  }
  return { words, width:pageWidth/(offset.scale||1), height:pageHeight/(offset.scale||1) }
}

export function looksLikeCardList(rawText = '', ocrData = {}) {
  const all = `${rawText} ${String(ocrData?.tsv || '').replace(/\t/g, ' ')}`.replace(/\s/g, '')
  // A card statement can contain 3+ rows for one date; bank debits / balances
  // are deliberately kept on the existing bank parser path.
  return /카드별.{0,6}(?:이용|내역)|카드이용내역|카드별이용내역|이용대금명세서|카드사용내역|(?:본인\d{3,}\*?).{0,25}(?:일시불|할부)|국내일시불|해외일시불|쿠팡전용/.test(all) && !/입출금거래내역조회/.test(all)
}

function getAmount(text, isRetry = false) {
  const original = String(text || '').trim().replace(/\s/g, '').replace(/[₩￦]/g, '')
  if (/^[\-−–—+]/.test(original)) return null
  // '200원' was invisible to the former 1,000+ only regex. A numeric-only OCR
  // crop may yield just '200', so it is accepted with explicit review.
  let numeric = ''
  let uncertain = false
  if (AMOUNT_RE.test(original)) {
    numeric = original.replace(/원$/, '')
  } else if (SMALL_AMOUNT_RE.test(original)) {
    numeric = original.replace(/원$/, '')
    uncertain = !original.endsWith('원')
    if (uncertain && !isRetry) return null
  } else if (isRetry && PLAIN_AMOUNT_RE.test(original)) {
    numeric = original
    uncertain = true
  } else if (isRetry || /^\d{1,3}(?:,\d{3}){1,3}/.test(original)) {
    // Full OCR can attach noise to a price, e.g. '2,0002!'. Keep 2,000 as
    // an uncertain candidate rather than silently dropping the transaction.
    const partial = original.match(/^(\d{1,3}(?:,\d{3}){1,3}|\d{1,9})/)
    if (!partial) return null
    numeric = partial[1]
    uncertain = true
  } else return null
  const amount = Number(numeric.replace(/,/g, ''))
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount >= 1e12) return null
  return { amount: String(amount), uncertain }
}

function uniqueAmounts(amountWords) {
  const items = []
  for (const amountWord of amountWords.sort((a,b)=>a.cy-b.cy)) {
    const candidate = getAmount(amountWord.text, amountWord.isRetry)
    if (!candidate) continue
    // Only one amount per visual row in this card layout. Keep the more
    // confident/exactly recognized token if both passes spotted the same line.
    const duplicate = items.find(item=>Math.abs(item.cy-amountWord.cy)<Math.max(13,amountWord.height*.60))
    const record = {...amountWord, ...candidate}
    if (duplicate) {
      if (duplicate.uncertain && !record.uncertain) Object.assign(duplicate,record)
      continue
    }
    items.push(record)
  }
  return items
}

function readDateHeaders(words,width) {
  const headers = []
  for (const w of words) {
    if (w.left > width*.67) continue
    const date = parseDate(w.text)
    if (date) headers.push({date,cy:w.cy})
  }
  // Some OCR layouts divide year and month/day into adjacent words. Recombine
  // words sharing a horizontal line without inventing a date.
  const byLine = []
  for (const w of words.filter(w=>w.left<width*.67).sort((a,b)=>a.cy-b.cy||a.left-b.left)) {
    let line = byLine.find(group=>Math.abs(group.cy-w.cy)<Math.max(10,w.height*.55))
    if (!line) {line={cy:w.cy, words:[]};byLine.push(line)}
    line.words.push(w)
  }
  for (const line of byLine) {
    line.words.sort((a,b)=>a.left-b.left)
    const joined = line.words.map(w=>w.text).join('')
    const candidate = joined.match(/(?:^|[^\d])(20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})/ )
    const date = parseDate(candidate?.[1] || '')
    if (date && !headers.some(item=>item.date===date && Math.abs(item.cy-line.cy)<24)) {
      headers.push({date,cy:line.cy})
    }
  }
  // Two OCR passes can report the *same date at the same Y*. Distinct rows
  // legitimately share the date (e.g. three payments on June 4).
  return headers.sort((a,b)=>a.cy-b.cy).filter((item,i,arr)=>!arr.slice(0,i).some(prev=>prev.date===item.date && Math.abs(prev.cy-item.cy)<18))
}

function findMerchant(words, amountWord, width) {
  const range = Math.max(20, Math.min(35, amountWord.height*.9))
  const nearRow=words.filter(w=>w.left>=width*.025 && w.left<Math.min(width*.78,amountWord.left-7) &&
    Math.abs(w.cy-amountWord.cy)<range && !parseDate(w.text)).sort((a,b)=>a.left-b.left)
  const parts=nearRow.filter(w=>{
    // '05월카드사용알림서비스이용료' and '05월 e편한...' begin with a
    // number + '월'. Do not discard that merchant prefix as numeric noise.
    if (/^\d{1,2}$/.test(w.text) && nearRow.some(other=>other.text==='월' && other.left>w.left &&
      other.left<w.left+w.width+26 && Math.abs(other.cy-w.cy)<range)) return true
    return !/^(?:본인\d*|국내일시불|해외일시불|국내할부|일시불|할부|원|\d[\d,.]*|[|·•])$/.test(w.text)
  })
  const name=parts.map(w=>w.text).join('').replace(/\s+/g,' ').trim().slice(0,100)
  const weak = !name || /[…]|\.{3}$/.test(name) || /본인\d+|국내일시불/.test(name) ||
    /[@!?�]/.test(name) || (name.length < 3 && !/[가-힣]/.test(name)) ||
    (parts.length && parts.every(w=>w.conf>=0 && w.conf<45))
  return {name,weak}
}

export function parseCardWithAmounts(fullData, rawText, options = {}) {
  const {width,height} = options
  if (!width || !height) return null
  const fullWords = extractOcrWords(fullData).words
  const dateWords = options.dateWords?.length ? options.dateWords : fullWords
  const rightFullWords=fullWords.filter(w => w.left>width*.69 && w.top>height*.09 && w.top<height*.95)
  const sources = [
    ...rightFullWords.map(w=>{
      // Tesseract often returns '200' and '원' as separate word boxes.
      // A small plain number counts as a price only if '원' is beside it;
      // otherwise it could be a card number, status indicator, or date.
      const hasCurrency=/^\d{1,3}$/.test(w.text) && rightFullWords.some(currency=>
        currency.text==='원' && currency.left>w.left && currency.left<w.left+w.width+32 &&
        Math.abs(currency.cy-w.cy)<Math.max(22,w.height*.72))
      return {...w,text:hasCurrency ? `${w.text}원` : w.text,isRetry:false}
    }),
    ...(options.extraAmountWords||[]).filter(w => w.left>width*.66 && w.top>height*.09 && w.top<height*.95).map(w=>({...w,isRetry:true}))
  ]
  const amounts=uniqueAmounts(sources)
  if (!amounts.length) return null
  const headers=readDateHeaders(dateWords,width)
  const maxBelowDistance = Math.min(145, Math.max(80, height*.077))
  function dateBelow(index) {
    const a = amounts[index]
    const nextY = amounts[index+1]?.cy ?? Infinity
    // In an itemized billing statement the date is under the merchant/price,
    // but always *before the next merchant/price*. Never steal the next date.
    return headers.filter(h=>h.cy>a.cy+8 && h.cy<a.cy+maxBelowDistance && h.cy<nextY-9)
      .sort((x,y)=>x.cy-y.cy)[0]
  }
  const belowCount=amounts.reduce((total,_,index)=>total+(dateBelow(index)?1:0),0)
  const isItemizedStatement=/이용대금명세서|(?:본인\d{3,}\*?).{0,25}일시불/.test(String(rawText||'').replace(/\s/g,''))
  const dateBelowMode=(belowCount>=Math.max(1,Math.ceil(amounts.length*.55))) || (isItemizedStatement && belowCount>0)
  return amounts.map((a,index)=>{
    const dateHit=dateBelowMode ? dateBelow(index) : headers.filter(d=>d.cy<a.cy-10).at(-1)
    const currentDate=dateHit?.date || ''
    const primaryMerchant=findMerchant(fullWords,a,width)
    const secondaryMerchant=options.merchantWords?.length ? findMerchant(options.merchantWords,a,width) : {name:'',weak:true}
    const merchant=secondaryMerchant.name && (primaryMerchant.weak || (!secondaryMerchant.weak && secondaryMerchant.name.length > primaryMerchant.name.length + 2)) ? secondaryMerchant : primaryMerchant
    const missingDate=!currentDate
    return {
      date:currentDate,
      name:merchant.name,
      amount:a.amount,
      category:guessExpenseCategory(merchant.name),
      memo:'',
      uncertain:missingDate || merchant.weak || a.uncertain,
      needsDateReview:missingDate,
      needsNameReview:merchant.weak,
      needsAmountReview:Boolean(a.uncertain),
      recognitionMode:dateBelowMode?'card-detail':'card-header',
      detectedDateCount:headers.length,
      _amountY:a.cy,
      reviewReason:[missingDate?'이 거래의 날짜를 확인하지 못했습니다.':'', merchant.weak?'상호명을 확인해 주세요.':'',a.uncertain?'금액을 원본과 비교해 주세요.':''].filter(Boolean).join(' ')
    }
  })
}

// Backward-compatible entry point for the original one-pass parser.
export function parseCardLayout(tsv, rawText = '', options = {}) {
  const data = typeof tsv === 'string' ? {tsv, blocks:options.blocks} : { ...(tsv || {}), blocks: options.blocks || tsv?.blocks }
  const meta = extractOcrWords(data)
  const width=options.width || meta.width
  const height=options.height || meta.height
  if (!looksLikeCardList(rawText,data)) return null
  return parseCardWithAmounts(data,rawText,{...options,width,height})
}
