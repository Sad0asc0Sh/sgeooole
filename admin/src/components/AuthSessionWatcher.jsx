import { useEffect } from 'react'
import { message } from 'antd'
import { useAuthStore } from '../stores'
import { getJwtExpirationMs } from '../utils/jwt'
import api from '../api'

const SKEW_MS = 30 * 1000

const redirectToLogin = () => {
  if (typeof window === 'undefined') return
  if (window.location.pathname.includes('/login')) return
  window.location.href = '/login'
}

export default function AuthSessionWatcher() {
  const token = useAuthStore((state) => state.token)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const permissions = useAuthStore((state) => state.permissions)
  const logout = useAuthStore((state) => state.logout)
  const setUser = useAuthStore((state) => state.setUser)
  const setPermissions = useAuthStore((state) => state.setPermissions)

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

  useEffect(() => {
    if (!isAuthenticated || !token) return
    if (Array.isArray(permissions) && permissions.length > 0) return

    let cancelled = false

    api
      .get('/auth/me')
      .then((res) => {
        if (cancelled) return
        const user = res?.data?.data
        const perms = res?.data?.permissions || []

        if (user) setUser(user)
        if (Array.isArray(perms)) setPermissions(perms)
      })
      .catch(() => {
        // Silent: interceptor handles 401; other errors shouldn't block the UI
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, token, permissions, setUser, setPermissions])

  return null
}
