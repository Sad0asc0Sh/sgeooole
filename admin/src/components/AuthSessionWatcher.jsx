import { useEffect, useRef } from 'react'
import { message } from 'antd'
import { useAuthStore } from '../stores'
import { getJwtExpirationMs } from '../utils/jwt'
import { PERMISSIONS } from '../rbac/permissions'
import api from '../api'

const SKEW_MS = 30 * 1000

const redirectToLogin = () => {
  if (typeof window === 'undefined') return
  if (window.location.pathname.includes('/login')) return
  window.location.href = '/login'
}

export default function AuthSessionWatcher() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const permissions = useAuthStore((state) => state.permissions)
  const logout = useAuthStore((state) => state.logout)
  const setUser = useAuthStore((state) => state.setUser)
  const setPermissions = useAuthStore((state) => state.setPermissions)
  const syncedSuperadminRef = useRef(false)

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
    if (!isAuthenticated || !token) {
      syncedSuperadminRef.current = false
      return
    }

    const permsList = Array.isArray(permissions) ? permissions : []
    const needsInitialBootstrap = permsList.length === 0
    const needsSuperadminRefresh =
      user?.role === 'superadmin' &&
      !permsList.includes(PERMISSIONS.BACKUP_READ) &&
      !syncedSuperadminRef.current

    if (!needsInitialBootstrap && !needsSuperadminRefresh) return

    if (needsSuperadminRefresh) {
      syncedSuperadminRef.current = true
    }

    let cancelled = false

    api
      .get('/auth/me')
      .then((res) => {
        if (cancelled) return
        const nextUser = res?.data?.data
        const nextPerms = res?.data?.permissions || []

        if (nextUser) setUser(nextUser)
        if (Array.isArray(nextPerms)) setPermissions(nextPerms)
      })
      .catch(() => {
        // Silent: interceptor handles 401; other errors shouldn't block the UI
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, token, user?.role, permissions, setUser, setPermissions])

  return null
}
