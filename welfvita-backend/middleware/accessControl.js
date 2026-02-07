/**
 * ============================================
 * ACCESS CONTROL MIDDLEWARE
 * ============================================
 * 
 * SECURITY FIXES:
 * - [HIGH] Prevents Broken Access Control via query parameter manipulation
 * - [HIGH] Blocks unauthorized access to admin filters (isActive=false, etc.)
 * - [MEDIUM] Sanitizes and validates query parameters
 * 
 * OWASP Reference: A01:2021 - Broken Access Control
 * 
 * VULNERABILITY FIXED:
 * Attackers could access inactive/hidden products by adding ?isActive=false
 * to API endpoints. This middleware ensures only admins can use such filters.
 */

const { ROLES, PERMISSIONS } = require('../config/rbac')
const logger = require('../utils/logger')

/**
 * List of query parameters that require admin privileges
 * These parameters can expose sensitive data if allowed for public users
 */
const ADMIN_ONLY_FILTERS = [
    'isActive',
    'isDeleted',
    'isHidden',
    'isBanned',
    'salesCount',
    'viewCount',
    'internalNotes',
    'costPrice',
    'profitMargin',
    'supplierInfo',
    'createdBy',
    'updatedBy',
]

/**
 * Whitelist of allowed sort fields for public users
 * Any sort field not in this list requires admin privileges
 */
const PUBLIC_ALLOWED_SORT_FIELDS = [
    'name',
    'price',
    '-price',
    'createdAt',
    '-createdAt',
    'updatedAt',
    '-updatedAt',
    'rating',
    '-rating',
    'reviewCount',
    '-reviewCount',
]

/**
 * Admin-only sort fields
 */
const ADMIN_ONLY_SORT_FIELDS = [
    'salesCount',
    '-salesCount',
    'viewCount',
    '-viewCount',
    'costPrice',
    '-costPrice',
    'profitMargin',
    '-profitMargin',
    'stock',
    '-stock',
]

/**
 * Check if user has admin privileges
 */
const isAdmin = (user) => {
    if (!user) return false
    const adminRoles = ['admin', 'manager', 'superadmin', 'editor']
    return adminRoles.includes(user.role)
}

/**
 * Check if user has specific permission
 */
const hasPermission = (user, permission) => {
    if (!user) return false
    const userPermissions = ROLES[user.role] || []
    return userPermissions.includes(permission)
}

/**
 * Sanitize query parameters to prevent type coercion attacks
 * MongoDB is vulnerable to type coercion: {password: {$gt: ""}} always matches
 */
const sanitizeQueryValue = (value) => {
    // If value is an object (potential injection), convert to string
    if (typeof value === 'object' && value !== null) {
        logger.security('Query injection attempt blocked', { value })
        return String(value)
    }
    return value
}

/**
 * Middleware: Check Product Access
 * 
 * Ensures that admin-only filters cannot be used by non-admin users.
 * Applied to product listing/search endpoints.
 * 
 * Usage: router.get('/products', checkProductAccess, getProducts)
 */
const checkProductAccess = (req, res, next) => {
    const userIsAdmin = isAdmin(req.user)
    const blockedParams = []

    // ============================================
    // 1. Check for admin-only query parameters
    // ============================================
    for (const param of ADMIN_ONLY_FILTERS) {
        if (req.query[param] !== undefined) {
            if (!userIsAdmin) {
                blockedParams.push(param)
                // Remove the parameter instead of blocking the request
                // This allows graceful degradation
                delete req.query[param]
            }
        }
    }

    // ============================================
    // 2. Validate sort field
    // ============================================
    if (req.query.sort) {
        const sortField = req.query.sort
        const isAdminSort = ADMIN_ONLY_SORT_FIELDS.includes(sortField)
        const isPublicSort = PUBLIC_ALLOWED_SORT_FIELDS.includes(sortField)

        if (isAdminSort && !userIsAdmin) {
            blockedParams.push(`sort=${sortField}`)
            req.query.sort = '-createdAt' // Default safe sort
        } else if (!isAdminSort && !isPublicSort) {
            // Unknown sort field - use default
            req.query.sort = '-createdAt'
        }
    }

    // ============================================
    // 3. Force isActive=true for non-admin users
    // ============================================
    if (!userIsAdmin) {
        // Always force active products only for public users
        req.query.isActive = 'true'
        req.query.isDeleted = 'false'
    }

    // ============================================
    // 4. Sanitize all query values
    // ============================================
    for (const [key, value] of Object.entries(req.query)) {
        req.query[key] = sanitizeQueryValue(value)
    }

    // ============================================
    // 5. Log security event if params were blocked
    // ============================================
    if (blockedParams.length > 0) {
        logger.security('Admin-only filters blocked', {
            ip: req.ip,
            path: req.path,
            blockedParams,
            userId: req.user?._id?.toString() || 'anonymous',
        })
    }

    next()
}

/**
 * Middleware: Check User Access
 * 
 * Ensures users can only access their own data unless admin.
 * Applied to user-specific endpoints.
 * 
 * Usage: router.get('/users/:userId', protect, checkUserAccess, getUser)
 */
const checkUserAccess = (req, res, next) => {
    const requestedUserId = req.params.userId || req.params.id
    const currentUserId = req.user?._id?.toString()

    // Admin can access any user
    if (isAdmin(req.user)) {
        return next()
    }

    // User can only access their own data
    if (requestedUserId && requestedUserId !== currentUserId) {
        logger.security('Unauthorized user access attempt', {
            ip: req.ip,
            path: req.path,
            requestedUserId,
            currentUserId,
        })

        return res.status(403).json({
            success: false,
            message: 'شما دسترسی به این اطلاعات را ندارید',
        })
    }

    next()
}

/**
 * Middleware: Check Order Access
 * 
 * Ensures users can only access their own orders unless admin.
 */
const checkOrderAccess = async (req, res, next) => {
    const orderId = req.params.orderId || req.params.id

    // Admin can access any order
    if (isAdmin(req.user)) {
        return next()
    }

    // For user-specific order access, verify ownership in the controller
    // Set flag for controller to verify
    req.verifyOrderOwnership = true
    req.currentUserId = req.user?._id

    next()
}

/**
 * Middleware: Sanitize Request Body
 * 
 * Removes admin-only fields from request body for non-admin users.
 * Prevents privilege escalation via body manipulation.
 */
const sanitizeRequestBody = (adminOnlyFields = []) => {
    return (req, res, next) => {
        if (!isAdmin(req.user) && req.body) {
            const removedFields = []

            for (const field of adminOnlyFields) {
                if (req.body[field] !== undefined) {
                    removedFields.push(field)
                    delete req.body[field]
                }
            }

            if (removedFields.length > 0) {
                logger.security('Admin-only body fields removed', {
                    ip: req.ip,
                    path: req.path,
                    removedFields,
                    userId: req.user?._id?.toString() || 'anonymous',
                })
            }
        }

        next()
    }
}

/**
 * Middleware Factory: Require Permission
 * 
 * More flexible than checkPermission in auth.js
 * Supports custom error messages and fallback behavior
 */
const requirePermission = (permission, options = {}) => {
    const {
        errorMessage = 'مجوز دسترسی ندارید',
        fallbackBehavior = 'block', // 'block' | 'filter' | 'readonly'
    } = options

    return (req, res, next) => {
        if (hasPermission(req.user, permission)) {
            return next()
        }

        if (fallbackBehavior === 'readonly') {
            req.readOnly = true
            return next()
        }

        if (fallbackBehavior === 'filter') {
            req.filterSensitive = true
            return next()
        }

        // Default: block access
        return res.status(403).json({
            success: false,
            message: errorMessage,
        })
    }
}

module.exports = {
    checkProductAccess,
    checkUserAccess,
    checkOrderAccess,
    sanitizeRequestBody,
    requirePermission,
    isAdmin,
    hasPermission,
    ADMIN_ONLY_FILTERS,
    PUBLIC_ALLOWED_SORT_FIELDS,
}
