export const hasPermission = (permissions, permission) => {
  if (!permission) return true
  if (!Array.isArray(permissions)) return false
  return permissions.includes(permission)
}

export const hasAnyPermission = (permissions, required = []) => {
  if (!required || required.length === 0) return true
  if (!Array.isArray(required)) return hasPermission(permissions, required)
  return required.some((perm) => hasPermission(permissions, perm))
}

export const hasAllPermissions = (permissions, required = []) => {
  if (!required || required.length === 0) return true
  if (!Array.isArray(required)) return hasPermission(permissions, required)
  return required.every((perm) => hasPermission(permissions, perm))
}

