import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import updateLocale from 'dayjs/plugin/updateLocale'
import 'dayjs/locale/fa'

try {
  // فعال‌کردن تقویم جلالی برای dayjs در کل پنل ادمین
  dayjs.extend(jalaliday)
  dayjs.extend(updateLocale)

  // dayjs.calendar ممکن است در برخی نسخه‌ها static نباشد
  if (typeof dayjs.calendar === 'function') {
    dayjs.calendar('jalali')
  }

  dayjs.locale('fa')

  // بازنویسی نام ماه‌ها برای استفاده از ماه‌های شمسی
  dayjs.updateLocale('fa', {
    months: [
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
    ],
    monthsShort: [
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
    ],
  })
} catch (e) {
  // از کرش کردن کل اپ جلوگیری می‌کنیم
  console.warn('[jalaliSetup] Failed to initialize Jalali calendar:', e)
}

