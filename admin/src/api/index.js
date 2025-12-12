import axios from 'axios'
import { useAuthStore } from '../stores'

// Base URL can be overridden via Vite env (VITE_API_BASE_URL)
const baseURL = (import.meta?.env?.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api').replace(/\/$/, '')

// Create a shared axios instance
export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds timeout for large file uploads
})

// Attach Authorization header from Zustand store for all requests except login endpoints
// Also handle FormData properly by letting browser set Content-Type automatically
api.interceptors.request.use((config) => {
  try {
    const url = (config.url || '').toString()
    const isLogin = url.endsWith('/auth/login') || url.endsWith('/auth/admin/login')
    if (!isLogin) {
      const token = useAuthStore.getState()?.token
      if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
      }
    }

    // CRITICAL: When sending FormData, let the browser set Content-Type automatically
    // This ensures the correct boundary is included for multipart/form-data
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
  } catch (_) { }
  return config
})

// Optional: normalize API errors & handle auth expiry
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    const url = error?.config?.url || ''

    const isLoginEndpoint =
      url.endsWith('/auth/login') || url.endsWith('/auth/admin/login')

    if (status === 401 && !isLoginEndpoint) {
      try {
        const { logout } = useAuthStore.getState() || {}
        if (logout) {
          logout()
        }
      } catch (_) {
        // ignore
      }

      if (typeof window !== 'undefined' && window.location) {
        window.location.href = '/login'
      }
    }

    // برگرداندن خطای اصلی axios به جای Error جدید
    // این اجازه می‌دهد که err.response.data.message در catch قابل دسترس باشد
    return Promise.reject(error)
  },
)

export default api
