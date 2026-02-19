import { useAuthStore } from '../../stores'
import { hasAnyPermission, hasAllPermissions } from '../../rbac/access'

export default function Can({ permission, anyOf, allOf, fallback = null, children }) {
  const permissions = useAuthStore((state) => state.permissions || [])

  const anyRequired = permission ? [permission] : anyOf
  const ok =
    Array.isArray(allOf) && allOf.length > 0
      ? hasAllPermissions(permissions, allOf)
      : hasAnyPermission(permissions, anyRequired)

  if (!ok) return fallback

  return children
}

