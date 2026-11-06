/** MyMoney 6.0 local-only backup format. No server upload. */
const FORMAT = 'mymoney-local-backup'
const VERSION = 1
const MAX_FILE_BYTES = 12 * 1024 * 1024
const MAX_KEYS = 500
const KEY_PATTERN = /^mymoney(?:-[a-z0-9-]+)?$/
const LIST_KEYS = ['mymoney', 'mymoney-income', 'mymoney-memo-entries-v2']
const NOTES_KEY = 'mymoney-monthly-notes'
const MEMOS_KEY = 'mymoney-memo-entries-v2'

const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x)
const supportedKey = key => typeof key === 'string' && key.length <= 80 && KEY_PATTERN.test(key)

export function captureMyMoneyData(storage = window.localStorage) {
  const data = Object.create(null)
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!supportedKey(key)) continue
    const value = storage.getItem(key)
    if (value !== null) data[key] = value
  }
  return data
}

function parseList(data, key) {
  if (!Object.prototype.hasOwnProperty.call(data, key)) return []
  const value = JSON.parse(data[key])
  if (!Array.isArray(value)) throw new Error(`'${key}' 데이터는 목록이어야 합니다.`)
  return value
}

function parseLegacyNotes(data) {
  if (!Object.prototype.hasOwnProperty.call(data, NOTES_KEY)) return {}
  const value = JSON.parse(data[NOTES_KEY])
  if (!plain(value)) throw new Error('기존 월별 메모 형식이 올바르지 않습니다.')
  return value
}

function validateData(data) {
  if (!plain(data)) throw new Error('가계부 저장 데이터 형식이 올바르지 않습니다.')
  const keys = Object.keys(data)
  if (keys.length === 0) throw new Error('MyMoney 데이터가 없는 파일입니다.')
  if (keys.length > MAX_KEYS) throw new Error('저장 항목 수가 너무 많습니다.')
  for (const key of keys) {
    if (!supportedKey(key)) throw new Error('MyMoney와 관련 없는 저장 항목이 포함되어 있습니다.')
    if (typeof data[key] !== 'string') throw new Error(`'${key}'의 저장 값이 문자열이 아닙니다.`)
    if (data[key].length > MAX_FILE_BYTES) throw new Error('너무 큰 저장 항목이 있습니다.')
  }
  LIST_KEYS.forEach(key => parseList(data, key))
  parseLegacyNotes(data)
  return data
}

export function createBackupDocument(storage = window.localStorage) {
  const data = captureMyMoneyData(storage)
  if (Object.keys(data).length === 0) {
    throw new Error('백업할 MyMoney 기록이 없습니다.')
  }
  validateData(data)
  return {
    format: FORMAT,
    version: VERSION,
    createdAt: new Date().toISOString(),
    app: 'MyMoney v6.0',
    storage: data,
  }
}

/** Supports v1 exports and older manual console exports containing MyMoney localStorage keys. */
export function readBackupDocument(source) {
  const parsed = typeof source === 'string' ? JSON.parse(source) : source
  if (!plain(parsed)) throw new Error('올바른 JSON 백업 파일이 아닙니다.')
  let data
  if (parsed.format === FORMAT) {
    if (parsed.version !== VERSION || !plain(parsed.storage)) {
      throw new Error('이 백업 파일 버전은 지원하지 않습니다.')
    }
    data = parsed.storage
  } else {
    // Compatibility with previous user-created console JSON backups.
    const candidates = [parsed.storage, parsed.data, parsed.localStorage, parsed]
    const candidate = candidates.find(x => plain(x) && Object.keys(x).some(supportedKey))
    if (!candidate) throw new Error('MyMoney 기록이 들어 있는 백업 파일이 아닙니다.')
    data = Object.create(null)
    for (const [key, val] of Object.entries(candidate)) {
      if (!supportedKey(key)) continue
      data[key] = typeof val === 'string' ? val : JSON.stringify(val)
    }
  }
  validateData(data)
  return { data, createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : null }
}

export function getBackupSummary(data) {
  const expenses = parseList(data, 'mymoney').length
  const incomes = parseList(data, 'mymoney-income').length
  const modernMemos = parseList(data, MEMOS_KEY).length
  const legacyMemos = Object.entries(parseLegacyNotes(data))
    .filter(([month, note]) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && typeof note === 'string' && note.trim()).length
  const budgets = Object.keys(data).filter(key => key.startsWith('mymoney-budget-')).length
  return { expenses, incomes, memos: modernMemos || legacyMemos, budgets, keys: Object.keys(data).length }
}

function deduplicateList(current, imported) {
  const merged = [...current]
  const seenIds = new Set()
  const seenWithoutId = new Set()
  const signature = row => JSON.stringify(row)
  for (const row of current) {
    if (plain(row) && row.id != null && String(row.id).trim()) seenIds.add(String(row.id))
    else seenWithoutId.add(signature(row))
  }
  for (const row of imported) {
    if (plain(row) && row.id != null && String(row.id).trim()) {
      const id = String(row.id)
      if (seenIds.has(id)) continue
      seenIds.add(id)
    } else {
      const sig = signature(row)
      if (seenWithoutId.has(sig)) continue
      seenWithoutId.add(sig)
    }
    merged.push(row)
  }
  return merged
}

function memoEntryFromLegacy(month, content) {
  return {
    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID() : `memo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    month, content, createdAt: new Date().toISOString(),
  }
}

function addLegacyMemos(data, entries, fallbackMonth) {
  const knownContent = new Set(entries.filter(plain).map(m => `${m.month}\u0000${m.content}`))
  const notes = parseLegacyNotes(data)
  for (const [month, content] of Object.entries(notes)) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || typeof content !== 'string' || !content.trim()) continue
    const identity = `${month}\u0000${content}`
    if (!knownContent.has(identity)) {
      entries.push(memoEntryFromLegacy(month, content))
      knownContent.add(identity)
    }
  }
  // Oldest version had one unscoped text memo. Only import it if not already represented.
  if (!Object.keys(notes).length && !Object.prototype.hasOwnProperty.call(data, MEMOS_KEY)) {
    const legacy = data['mymoney-home-note']
    if (typeof legacy === 'string' && legacy.trim() && !entries.some(m => plain(m) && m.content === legacy)) {
      entries.push(memoEntryFromLegacy(fallbackMonth, legacy))
    }
  }
  return entries
}

export function prepareRestoredData(current, imported, mode, options = {}) {
  validateData(imported)
  if (mode !== 'merge' && mode !== 'replace') throw new Error('복원 방식을 먼저 선택해 주세요.')
  if (mode === 'replace') return { ...imported }
  const combined = { ...current }
  // Existing entries win on a collision: never silently overwrite a user's edits.
  for (const [key, value] of Object.entries(imported)) {
    if (!(key in combined)) combined[key] = value
    else if (key === 'mymoney' || key === 'mymoney-income') {
      combined[key] = JSON.stringify(deduplicateList(parseList(current, key), parseList(imported, key)))
    } else if (key === NOTES_KEY) {
      combined[key] = JSON.stringify({ ...parseLegacyNotes(imported), ...parseLegacyNotes(current) })
    }
    // For budget keys and other settings, keep the current value if present.
  }
  const entries = deduplicateList(parseList(current, MEMOS_KEY), parseList(imported, MEMOS_KEY))
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(options.fallbackMonth || '')
    ? options.fallbackMonth : new Date().toISOString().slice(0, 7)
  addLegacyMemos(current, entries, month)
  addLegacyMemos(imported, entries, month)
  if (entries.length || Object.prototype.hasOwnProperty.call(current, MEMOS_KEY) || Object.prototype.hasOwnProperty.call(imported, MEMOS_KEY)) {
    combined[MEMOS_KEY] = JSON.stringify(deduplicateList([], entries))
  }
  validateData(combined)
  return combined
}

/** All-or-nothing (best effort rollback) update, scoped strictly to MyMoney keys. */
export function writeRestoredData(storage, nextData) {
  validateData(nextData)
  const before = captureMyMoneyData(storage)
  const beforeKeys = Object.keys(before)
  const nextKeys = Object.keys(nextData)
  try {
    for (const key of beforeKeys) storage.removeItem(key)
    for (const key of nextKeys) storage.setItem(key, nextData[key])
  } catch (error) {
    // Restore prior state on storage quota or permission failures.
    try {
      const partialKeys = Object.keys(captureMyMoneyData(storage))
      for (const key of partialKeys) storage.removeItem(key)
      for (const [key, val] of Object.entries(before)) storage.setItem(key, val)
    } catch {
      throw new Error('복원 중 저장소 오류가 발생했습니다. 자동 복구도 실패했으니 복원 전 다운로드된 안전 백업 파일을 보관해 주세요.')
    }
    throw new Error('저장 공간 또는 브라우저 설정 문제로 복원하지 못했습니다. 기존 데이터는 복구했습니다.')
  }
}

export function downloadBackupDocument(document, filename) {
  const data = JSON.stringify(document, null, 2)
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  window.document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

export function makeBackupFilename(prefix = 'MyMoney-backup') {
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const clock = `${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`
  return `${prefix}-${date}-${clock}.json`
}

export { MAX_FILE_BYTES }
