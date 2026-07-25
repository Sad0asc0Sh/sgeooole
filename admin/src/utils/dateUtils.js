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

/**
 * تبدیل تاریخ به شمسی با dayjs
 * @param {string|Date} date
 * @returns {dayjs.Dayjs|null}
 */
export const toJalali = (date) => {
  if (!date) return null
  const d = dayjs(date)
  if (!d.isValid()) return null
  return d.calendar('jalali').locale('fa')
}

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

  const year = jalaliDate.format('YYYY')
  const monthIndex = parseInt(jalaliDate.format('M'), 10) - 1
  const month = persianMonths[monthIndex] || jalaliDate.format('MM')
  const day = jalaliDate.format('DD')

  if (includeTime) {
    const time = jalaliDate.format('HH:mm')
    return `${day} ${month} ${year} - ساعت ${time}`
  }
  return `${day} ${month} ${year}`
}

/**
 * فرمت کردن تاریخ برای نمودارها (روزانه یا ماهانه)
 * @param {string} value
 * @param {'day'|'month'} granularity
 * @returns {string}
 */
export const formatChartDate = (value, granularity = 'day') => {
  if (!value) return '-'
  const jalaliDate = toJalali(value)
  if (!jalaliDate) return '-'

  const year = jalaliDate.format('YYYY')
  const monthIndex = parseInt(jalaliDate.format('M'), 10) - 1
  const month = persianMonths[monthIndex] || jalaliDate.format('MM')

  if (granularity === 'month') {
    return `${month} ${year}`
  }

  const day = jalaliDate.format('DD')
  return `${day} ${month} ${year}`
}
