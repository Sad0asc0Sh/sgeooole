import { useEffect } from 'react'
import { message } from 'antd'
import { useAuthStore } from '../stores'
import { getJwtExpirationMs } from '../utils/jwt'

const SKEW_MS = 30 * 1000

const redirectToLogin = () => {
  if (typeof window === 'undefined') return
  if (window.location.pathname.includes('/login')) return
  window.location.href = '/login'
}

export default function AuthSessionWatcher() {
  const token = useAuthStore((state) => state.token)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const logout = useAuthStore((state) => state.logout)

  useEffect(() => {
    if (!isAuthenticated || !token) return

    const expMs = getJwtExpirationMs(token)
    if (!expMs) return

    const now = Date.now()
    const msUntilExpiry = expMs - now

    if (msUntilExpiry <= SKEW_MS) {
      logout()
      message.warning('مدت نشست شما پایان یافت. لطفاً دوباره وارد شوید.')
      redirectToLogin()
      return
    }

    const timeoutId = setTimeout(() => {
      logout()
      message.warning('مدت نشست شما پایان یافت. لطفاً دوباره وارد شوید.')
      redirectToLogin()
    }, msUntilExpiry - SKEW_MS)

    return () => clearTimeout(timeoutId)
  }, [isAuthenticated, token, logout])

  return null
}

