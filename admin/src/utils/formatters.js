/**
 * فرمت ارز به صورت تومان با جداکننده هزارگان فارسی
 * @param {number|string} value
 * @returns {string}
 */
export const formatCurrency = (value) => {
  if (value == null) return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(num)) return '—'
  return `${new Intl.NumberFormat('fa-IR').format(num)} تومان`
}

/**
 * تبدیل ارقام فارسی و عربی به انگلیسی
 * @param {string|number} value
 * @returns {string}
 */
export const normalizeDigits = (value) => {
  if (value == null) return ''
  return String(value)
    .replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584))
}

/**
 * پارس ورودی عددی با پشتیبانی از ارقام فارسی، کاما و فاصله
 * @param {string|number} value
 * @returns {string}
 */
export const parseNumericInput = (value) => {
  if (value == null) return ''
  return normalizeDigits(value)
    .replace(/[\$\s,٬]/g, '')
    .replace(/[^\d.-]/g, '')
}

/**
 * فرمت عدد با جداکننده هزارگان فارسی (بدون واحد)
 * @param {number|string} value
 * @returns {string}
 */
export const formatNumber = (value) => {
  if (value == null) return '۰'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(num)) return '۰'
  return new Intl.NumberFormat('fa-IR').format(num)
}

/**
 * رنگ وضعیت سفارش
 */
export const ORDER_STATUS_COLORS = {
  Pending: 'orange',
  Processing: 'blue',
  Shipped: 'purple',
  Delivered: 'green',
  Cancelled: 'red',
}

/**
 * برچسب فارسی وضعیت سفارش
 */
export const ORDER_STATUS_LABELS = {
  Pending: 'ثبت سفارش',
  Processing: 'درحال پردازش',
  Shipped: 'تحویل به پست',
  Delivered: 'تحویل شده',
  Cancelled: 'لغو شده',
}

/**
 * دریافت رنگ وضعیت سفارش
 * @param {string} status
 * @returns {string}
 */
export const getStatusColor = (status) => ORDER_STATUS_COLORS[status] || 'default'

/**
 * دریافت برچسب فارسی وضعیت سفارش
 * @param {string} status
 * @returns {string}
 */
export const getStatusLabel = (status) => ORDER_STATUS_LABELS[status] || status || '—'

/**
 * رنگ‌ها و برچسب‌های نقش کاربر
 */
export const ROLE_COLORS = {
  user: 'default',
  support: 'cyan',
  editor: 'geekblue',
  admin: 'blue',
  manager: 'purple',
  superadmin: 'red',
}

export const ROLE_LABELS = {
  user: 'کاربر عادی',
  support: 'پشتیبان',
  editor: 'ویرایشگر',
  admin: 'ادمین',
  manager: 'مدیر ارشد',
  superadmin: 'سوپرادمین',
}

export const getRoleColor = (role) => ROLE_COLORS[role] || 'default'
export const getRoleLabel = (role) => ROLE_LABELS[role] || role || '—'
