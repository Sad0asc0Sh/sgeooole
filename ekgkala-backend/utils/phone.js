const PERSIAN_DIGITS_MAP = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
}

const toEnglishDigits = (value) => String(value).replace(/[۰-۹٠-٩]/g, (digit) => PERSIAN_DIGITS_MAP[digit] || digit)

/**
 * Normalize Iranian mobile numbers to `09xxxxxxxxx`.
 * Accepts common formats like `+98...`, `0098...`, `98...`, `9...`, with spaces/dashes and Persian digits.
 * Returns `null` if invalid.
 */
const normalizeIranMobile = (value) => {
  if (value === null || value === undefined) return null

  const digitsOnly = toEnglishDigits(value).replace(/\D/g, '')
  if (!digitsOnly) return null

  let normalized = digitsOnly

  if (normalized.startsWith('0098')) normalized = normalized.slice(4)
  else if (normalized.startsWith('098')) normalized = normalized.slice(3)
  else if (normalized.startsWith('98')) normalized = normalized.slice(2)

  if (normalized.length === 10 && normalized.startsWith('9')) normalized = `0${normalized}`

  if (!/^09\d{9}$/.test(normalized)) return null
  return normalized
}

const maskMobile = (mobile) => {
  const normalized = normalizeIranMobile(mobile) || String(mobile || '')
  if (normalized.length === 11) return `${normalized.slice(0, 3)}****${normalized.slice(-2)}`
  return '***'
}

module.exports = {
  normalizeIranMobile,
  maskMobile,
  toEnglishDigits,
}

