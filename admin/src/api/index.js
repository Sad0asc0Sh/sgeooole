import axios from 'axios'
import { useAuthStore } from '../stores' // مسیر استور خود را چک کنید

// ----------------------------------------------------------------------
// 1. تنظیم هوشمند آدرس پایه (Base URL)
// ----------------------------------------------------------------------
// اولویت‌ها:
// ۱. اگر در فایل .env متغیر VITE_API_BASE_URL باشد، از آن استفاده می‌کند.
// ۲. اگر نباشد و در حالت Production (نِتلیفای) باشیم، از '/api-proxy' استفاده می‌کند (برای حل مشکل CORS).
// ۳. اگر در حالت Development باشیم، به لوکال‌هاست وصل می‌شود.

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  const isProd = import.meta.env.PROD

  if (envUrl) return envUrl.replace(/\/$/, '') // اگر متغیر محیطی ست شده بود
  if (isProd) return '/api-proxy'              // پیش‌فرض برای نِتلیفای (از طریق Rewrite)
  return 'http://localhost:5000/api'           // پیش‌فرض برای سیستم خودتان
}

const shouldUseCredentials = (baseUrl) => {
  if (!baseUrl) return false

  // Relative URLs (e.g. /api-proxy) are same-origin by definition.
  if (baseUrl.startsWith('/')) return true

  // In browser runtime, allow credentials only for same-origin absolute URLs.
  if (typeof window !== 'undefined') {
    try {
      return new URL(baseUrl).origin === window.location.origin
    } catch (_) {
      return false
    }
  }

  return false
}

const baseURL = getBaseUrl()

export const api = axios.create({
  baseURL,
  // Prevent invalid CORS combos on cross-origin APIs (e.g. ACAO=* with credentials).
  withCredentials: shouldUseCredentials(baseURL),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // ۶۰ ثانیه مهلت برای آپلود فایل
})

// ----------------------------------------------------------------------
// 2. Request Interceptor: تزریق توکن و مدیریت فایل‌ها
// ----------------------------------------------------------------------
api.interceptors.request.use(
  (config) => {
    try {
      const token = useAuthStore.getState()?.token

      // اگر توکن داریم، به هدر اضافه کن
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      // نکته حیاتی برای آپلود عکس/فایل (FormData)
      // اگر دیتا از نوع FormData باشد، Content-Type را حذف می‌کنیم
      // تا خود مرورگر آن را با Boundary صحیح تنظیم کند.
      if (config.data instanceof FormData) {
        delete config.headers['Content-Type']
      }
    } catch (error) {
      console.error('Error in request interceptor:', error)
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ----------------------------------------------------------------------
// 3. Response Interceptor: مدیریت خطاهای عمومی و انقضای توکن
// ----------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status

    // Network-level errors often point to CORS/proxy/SSL issues.
    if (!error.response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error')) {
      error.userMessage = 'اتصال به API برقرار نشد. تنظیمات CORS، آدرس API و پروکسی را بررسی کنید.'
    }

    // اگر خطای 401 (عدم احراز هویت) گرفتیم و درخواست مربوط به لاگین نبود
    if (status === 401 && !originalRequest._retry) {
      // جلوگیری از لوپ بی‌نهایت
      originalRequest._retry = true

      try {
        const { logout } = useAuthStore.getState() || {}
        if (logout) {
          logout() // پاک کردن توکن از استور
        }

        // ریدایرکت به صفحه لاگین (فقط در سمت کلاینت)
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
      } catch (e) {
        console.error('Logout failed:', e)
      }
    }

    // بازگرداندن متن خطا برای نمایش در کامپوننت‌ها
    return Promise.reject(error)
  }
)

export default api
