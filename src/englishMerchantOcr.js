// A conservative English retry for merchant prefixes that mixed-language OCR
// misread. This module only proposes a correction; it never overwrites a row.

// TSV is an optional Tesseract.js OCR output. Each word has a source-image box.
export function findSuspiciousPrefixes(tsv, rows) {
  if (!tsv || !Array.isArray(rows)) return []
  const groups = new Map()
  for (const line of tsv.split(/\r?\n/).slice(1)) {
    const p = line.split('\t')
    if (p.length < 12 || p[0] !== '5') continue
    const word = {
      text: p.slice(11).join('\t').trim(),
      word: Number(p[5]),
      left: Number(p[6]), top: Number(p[7]),
      width: Number(p[8]), height: Number(p[9])
    }
    if (!word.text || !Number.isFinite(word.left) || !Number.isFinite(word.top) || word.width <= 0 || word.height <= 0) continue
    const key = p.slice(1, 5).join('/')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(word)
  }

  const found = []
  const used = new Set()
  for (const words of groups.values()) {
    words.sort((a, b) => a.word - b.word)
    // Shop names with a mixed Latin+number prefix commonly have a Korean
    // branch name immediately after the prefix: GS25답십리동아점, etc.
    const koreanAt = words.findIndex(w => /[가-힣]/.test(w.text))
    if (koreanAt <= 0) continue
    const prefixWords = words.slice(0, koreanAt)
    if (!prefixWords.length || prefixWords.length > 4) continue
    const prefix = prefixWords.map(w => w.text).join('').replace(/\s/g, '')
    if (!/25/.test(prefix) || /^GS25$/i.test(prefix)) continue
    if (!/^[^가-힣]{2,10}$/.test(prefix)) continue
    const rowIndex = rows.findIndex((row, index) => !used.has(index) &&
      String(row.name).replace(/\s/g, '').startsWith(prefix))
    if (rowIndex < 0) continue
    const left = Math.min(...prefixWords.map(w => w.left))
    const top = Math.min(...prefixWords.map(w => w.top))
    const right = Math.max(...prefixWords.map(w => w.left + w.width))
    const bottom = Math.max(...prefixWords.map(w => w.top + w.height))
    found.push({ rowIndex, prefix, box: { left, top, width: right - left, height: bottom - top } })
    used.add(rowIndex)
  }
  return found
}

// Do not auto-correct uncertain names. Only well-established, fully
// recognized English prefixes become clickable suggestions.
export function merchantPrefixSuggestion(englishText, name, oldPrefix) {
  const recognized = String(englishText).replace(/[^a-z0-9]/gi, '').toUpperCase()
  if (recognized !== 'GS25') return ''
  const compactName = String(name).replace(/\s/g, '')
  if (!compactName.startsWith(oldPrefix)) return ''
  const suffix = compactName.slice(oldPrefix.length)
  if (!suffix || !/[가-힣]/.test(suffix)) return ''
  return `GS25${suffix}`
}

// OCR errors resembling 'GS25' deserve an extra warning even if an English
// retry was unavailable. Correct names like 'GS25...' are not flagged.
export function isSuspiciousMerchantName(name) {
  const compact = String(name || '').replace(/\s/g, '')
  if (/^GS25/i.test(compact)) return false
  return /^(?:[ㄱ-ㅎㅏ-ㅣ○〇()6GgSs5]{1,5})25(?=[가-힣])/.test(compact)
}

export async function retryMerchantPrefixesEnglish(file, tsv, rows, createWorker) {
  const suspects = findSuspiciousPrefixes(tsv, rows)
  if (!suspects.length) return []
  let bitmap, englishWorker
  const proposals = []
  try {
    bitmap = await createImageBitmap(file)
    englishWorker = await createWorker('eng')
    await englishWorker.setParameters({ tessedit_pageseg_mode: '7' })
    // Limit rare noisy images to a few retries, to keep OCR responsive.
    for (const suspect of suspects.slice(0, 8)) {
      const b = suspect.box
      const pad = Math.max(4, Math.round(b.height * 0.18))
      const left = Math.max(0, b.left - pad)
      const top = Math.max(0, b.top - pad)
      const right = Math.min(bitmap.width, b.left + b.width + pad)
      const bottom = Math.min(bitmap.height, b.top + b.height + pad)
      const width = right - left
      const height = bottom - top
      if (width < 8 || height < 8) continue
      const canvas = document.createElement('canvas')
      const scale = 4
      canvas.width = Math.ceil(width * scale)
      canvas.height = Math.ceil(height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(bitmap, left, top, width, height, 0, 0, canvas.width, canvas.height)
      const result = await englishWorker.recognize(canvas)
      const suggestedName = merchantPrefixSuggestion(result.data.text, rows[suspect.rowIndex].name, suspect.prefix)
      if (suggestedName) proposals.push({rowIndex: suspect.rowIndex, suggestedName})
    }
  } catch (err) {
    // The original recognition remains available for manual edits.
    console.warn('MyMoney 영어 상호명 보강 인식 생략:', err)
  } finally {
    if (englishWorker) try { await englishWorker.terminate() } catch { /* ignore */ }
    bitmap?.close?.()
  }
  return proposals
}
