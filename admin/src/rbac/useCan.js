import { useAuthStore } from '../stores'
import { hasAnyPermission, hasAllPermissions, hasPermission } from './access'

export function useCan() {
  const permissions = useAuthStore((state) => state.permissions || [])
  const resolvedPermissions = Array.isArray(permissions) ? permissions : []

  return {
    permissions: resolvedPermissions,
    can: (permission) => hasPermission(resolvedPermissions, permission),
    canAny: (required) => hasAnyPermission(resolvedPermissions, required),
    canAll: (required) => hasAllPermissions(resolvedPermissions, required),
  }
}

