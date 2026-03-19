const jwt = require('jsonwebtoken')
const Admin = require('../models/Admin')
const User = require('../models/User')
const redis = require('../utils/redis')

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined.')
  process.exit(1)
}
const JWT_ISSUER = process.env.JWT_ISSUER || 'ekgkala-api'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ekgkala-clients'

// احراز هویت بر اساس توکن JWT
// Supports both Admin (email/password) and Customer User (OTP) authentication
const protect = async (req, res, next) => {
  try {
    let token

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'توکن ارسال نشده است - لطفاً مجدداً وارد شوید',
      })
    }

    // Check Redis blacklist (logout / password change tokens)
    // ⚠️ FAIL-SAFE: If Redis is down, isTokenBlacklisted returns FALSE
    // This is intentional - we fail-open to prevent Redis from blocking all auth
    const isBlacklisted = await redis.isTokenBlacklisted(token)
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'توکن نامعتبر است (خروج انجام شده).',
      })
    }

    const decoded = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE })

    // Check if it's a customer or admin user
    // Customer tokens include type: 'customer' in payload
    let user

    if (decoded.type === 'customer') {
      // Look up in User (customer) collection
      user = await User.findById(decoded.id)

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'کاربر یافت نشد',
        })
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'حساب کاربری غیرفعال است',
        })
      }
    } else {
      // Look up in Admin collection (legacy/backward compatibility)
      user = await Admin.findById(decoded.id)

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'کاربر ادمین یافت نشد',
        })
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'حساب کاربری ادمین غیرفعال است',
        })
      }
    }

    // Attach user to request
    req.user = user
    req.userId = user._id
    req.userType = decoded.type || 'admin'

    next()
  } catch (error) {
    // Don't log full error for expected JWT errors
    if (error.name !== 'JsonWebTokenError' && error.name !== 'TokenExpiredError') {
      console.error('Auth middleware error:', error.message)
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'توکن نامعتبر است',
      })
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'توکن منقضی شده است - لطفاً مجدداً وارد شوید',
      })
    }

    return res.status(401).json({
      success: false,
      message: 'خطای احراز هویت',
    })
  }
}

// مجوز نقش‌ها (Legacy - kept for backward compatibility)
// Optional authentication: attaches req.user if a valid token is provided,
// otherwise continues as an anonymous request (never blocks the request).
const optional = async (req, res, next) => {
  try {
    let token

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return next()
    }

    // If token is blacklisted, treat as anonymous
    const isBlacklisted = await redis.isTokenBlacklisted(token)
    if (isBlacklisted) {
      return next()
    }

    const decoded = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE })

    let user

    if (decoded.type === 'customer') {
      user = await User.findById(decoded.id)
      if (!user || !user.isActive) {
        return next()
      }
    } else {
      user = await Admin.findById(decoded.id)
      if (!user || !user.isActive) {
        return next()
      }
    }

    req.user = user
    req.userId = user._id
    req.userType = decoded.type || 'admin'

    return next()
  } catch (_error) {
    return next()
  }
}

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'احراز هویت انجام نشده است',
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'شما دسترسی لازم برای انجام این عملیات را ندارید',
      })
    }

    next()
  }
}

// ============================================
// Permission-Based Access Control (RBAC)
// New system for granular permission checking
// ============================================
const { ROLES, PERMISSIONS } = require('../config/rbac')
const { logAccessDenied } = require('../utils/auditLogger')

/**
 * Check if user has a specific permission
 * @param {string} requiredPermission - The permission required for this action (e.g., 'product:create')
 * @returns {Function} Express middleware function
 */
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    // Check if user exists (should be populated by protect middleware)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'احراز هویت انجام نشده است',
      })
    }

    const userRole = req.user.role || 'guest'

    // SECURITY: No hardcoded superadmin bypass
    // Superadmin permissions are defined in config/rbac.js
    // This ensures all access is logged and auditable

    // Get permissions for the user's role (fail-safe: empty array if role not found)
    const userPermissions = ROLES[userRole] || []

    // Check if user has the required permission
    if (userPermissions.includes(requiredPermission)) {
      return next()
    }

    // Access Denied: Log the security event to console
    console.warn(
      `[SECURITY] ⛔ Access Denied: User ID ${req.user._id} (role: ${userRole}) attempted access to "${requiredPermission}" without permission.`
    )

    // Log to audit database (async, non-blocking)
    logAccessDenied(req, req.user._id, requiredPermission).catch(() => { })

    return res.status(403).json({
      success: false,
      message: 'مجوز دسترسی ندارید',
      error: 'Access Denied: Missing Permission',
      requiredPermission,
    })
  }
}

/**
 * Check if user has ANY of the specified permissions
 * @param {...string} permissions - Multiple permissions to check (user needs at least one)
 * @returns {Function} Express middleware function
 */
const checkAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'احراز هویت انجام نشده است',
      })
    }

    const userRole = req.user.role || 'guest'

    // SECURITY: No hardcoded superadmin bypass
    // Superadmin permissions are defined in config/rbac.js

    const userPermissions = ROLES[userRole] || []

    // Check if user has any of the required permissions
    const hasAny = permissions.some((perm) => userPermissions.includes(perm))
    if (hasAny) {
      return next()
    }

    console.warn(
      `[SECURITY] ⛔ Access Denied: User ID ${req.user._id} (role: ${userRole}) attempted access requiring one of [${permissions.join(', ')}] without permission.`
    )

    return res.status(403).json({
      success: false,
      message: 'مجوز دسترسی ندارید',
      error: 'Access Denied: Missing Permission',
      requiredPermissions: permissions,
    })
  }
}

/**
 * Check if user has ALL of the specified permissions
 * @param {...string} permissions - Multiple permissions to check (user needs all)
 * @returns {Function} Express middleware function
 */
const checkAllPermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'احراز هویت انجام نشده است',
      })
    }

    const userRole = req.user.role || 'guest'

    // SECURITY: No hardcoded superadmin bypass
    // Superadmin permissions are defined in config/rbac.js

    const userPermissions = ROLES[userRole] || []

    // Check if user has all required permissions
    const hasAll = permissions.every((perm) => userPermissions.includes(perm))
    if (hasAll) {
      return next()
    }

    const missingPermissions = permissions.filter(
      (perm) => !userPermissions.includes(perm)
    )

    console.warn(
      `[SECURITY] ⛔ Access Denied: User ID ${req.user._id} (role: ${userRole}) missing permissions: [${missingPermissions.join(', ')}]`
    )

    return res.status(403).json({
      success: false,
      message: 'مجوز دسترسی ندارید',
      error: 'Access Denied: Missing Permissions',
      missingPermissions,
    })
  }
}

// میانبر برای مجوز ادمین (admin, manager, superadmin) - Legacy
const admin = authorize('admin', 'manager', 'superadmin')

module.exports = {
  protect,
  optional,
  authorize,
  admin,
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
  PERMISSIONS, // Re-export for convenience
}
