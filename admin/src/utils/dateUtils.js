import dayjs from 'dayjs'
import jalaliday from 'jalaliday'

// Ensure jalaliday is extended (safe to call multiple times)
dayjs.extend(jalaliday)

/**
 * نام ماه‌های شمسی — Single Source of Truth
 */
export const persianMonths = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

const PERSIAN_WEEKDAYS = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
]

/**
 * تبدیل امن انواع ورودی تاریخ (Date، ISO String، dayjs، DateObject) به JS Date
 * @param {*} value
 * @returns {Date|null}
 */
export const toSafeDate = (value) => {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value?.toDate === 'function') {
    const d = value.toDate()
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/**
 * تبدیل تاریخ به شمسی با dayjs
 * @param {string|Date|object} date
 * @returns {dayjs.Dayjs|null}
 */
export const toJalali = (date) => {
  const safe = toSafeDate(date)
  if (!safe) return null
  const d = dayjs(safe)
  if (!d.isValid()) return null
  return d.calendar('jalali').locale('fa')
}

const toFaDigits = (str) =>
  String(str).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])

/**
 * فرمت کردن تاریخ به شمسی با نام ماه فارسی
 * @param {string|Date} date
 * @param {boolean} includeTime
 * @returns {string}
 */
export const formatPersianDate = (date, includeTime = false) => {
  if (!date) return '—'
  const jalaliDate = toJalali(date)
  if (!jalaliDate) return '—'

  const year = toFaDigits(jalaliDate.format('YYYY'))
  const monthIndex = parseInt(jalaliDate.format('M'), 10) - 1
  const month = persianMonths[monthIndex] || jalaliDate.format('MM')
  const day = toFaDigits(Number(jalaliDate.format('D')))

  if (includeTime) {
    const time = toFaDigits(jalaliDate.format('HH:mm'))
    return `${day} ${month} ${year} - ${time}`
  }
  return `${day} ${month} ${year}`
}

/**
 * فرمت فشرده تاریخ شمسی (مثلاً ۱۴۰۵/۰۹/۱۴ - ۱۴:۳۰) مناسب جداول و ستون‌ها
 * @param {string|Date} date
 * @param {boolean} includeTime
 * @returns {string}
 */
export const formatPersianShortDate = (date, includeTime = false) => {
  if (!date) return '—'
  const jalaliDate = toJalali(date)
  if (!jalaliDate) return '—'

  const dateStr = toFaDigits(jalaliDate.format('YYYY/MM/DD'))
  if (includeTime) {
    const timeStr = toFaDigits(jalaliDate.format('HH:mm'))
    return `${dateStr} - ${timeStr}`
  }
  return dateStr
}

/**
 * فرمت کردن تاریخ برای نمودارها (روزانه یا ماهانه)
 * @param {string} value
 * @param {'day'|'month'} granularity
 * @returns {string}
 */
export const formatChartDate = (value, granularity = 'day') => {
  if (!value) return '—'
  // If monthly bucket 'YYYY-MM', append '-01' for safe parsing
  const normalized = /^\d{4}-\d{2}$/.test(String(value).trim())
    ? `${String(value).trim()}-15T12:00:00Z`
    : String(value).trim()
  const jalaliDate = toJalali(normalized)
  if (!jalaliDate) return '—'

  const year = toFaDigits(jalaliDate.format('YYYY'))
  const monthIndex = parseInt(jalaliDate.format('M'), 10) - 1
  const month = persianMonths[monthIndex] || jalaliDate.format('MM')

  if (granularity === 'month') {
    return `${month} ${year}`
  }

  const day = toFaDigits(Number(jalaliDate.format('D')))
  return `${day} ${month}`
}

/**
 * زمان نسبی به فارسی (مثلاً ۳ دقیقه پیش)
 * @param {string|Date} date
 * @returns {string}
 */
export const formatRelativeTime = (date) => {
  const safe = toSafeDate(date)
  if (!safe) return ''
  const diffSec = Math.floor((Date.now() - safe.getTime()) / 1000)
  if (diffSec < 60) return 'چند لحظه پیش'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${toFaDigits(diffMin)} دقیقه پیش`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${toFaDigits(diffHour)} ساعت پیش`
  const diffDay = Math.floor(diffHour / 24)
  return `${toFaDigits(diffDay)} روز پیش`
}

/**
 * تاریخ کامل امروز برای هدر پنل (مثلاً: سه‌شنبه، ۴ آذر ۱۴۰۵)
 * @returns {string}
 */
export const getTodayJalaliLabel = () => {
  const now = new Date()
  const jalali = toJalali(now)
  if (!jalali) return ''
  const weekday = PERSIAN_WEEKDAYS[now.getDay()] || ''
  const day = toFaDigits(Number(jalali.format('D')))
  const monthIndex = parseInt(jalali.format('M'), 10) - 1
  const month = persianMonths[monthIndex] || ''
  const year = toFaDigits(jalali.format('YYYY'))
  return `${weekday}، ${day} ${month} ${year}`
}
