import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores'
import { hasAnyPermission, hasAllPermissions } from '../../rbac/access'

export default function RequirePermission({
  permission,
  anyOf,
  allOf,
  redirectTo = '/',
  children,
}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const token = useAuthStore((state) => state.token)
  const permissions = useAuthStore((state) => state.permissions || [])

  const anyRequired = permission ? [permission] : anyOf
  const ok =
    Array.isArray(allOf) && allOf.length > 0
      ? hasAllPermissions(permissions, allOf)
      : hasAnyPermission(permissions, anyRequired)

  // Wait for auth bootstrap (/auth/me) to populate permissions after refresh.
  if (isAuthenticated && token && Array.isArray(permissions) && permissions.length === 0) {
    return null
  }

  if (!ok) {
    return <Navigate to={redirectTo} replace />
  }

  return children
}
