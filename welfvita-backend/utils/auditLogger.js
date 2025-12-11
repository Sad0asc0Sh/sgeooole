/**
 * ============================================
 * Audit Logger Utility
 * Centralized security event logging
 * ============================================
 */

const AuditLog = require('../models/AuditLog')

// ============================================
// Security Event Types
// ============================================
const SECURITY_EVENTS = {
    // Authentication Events
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILED: 'LOGIN_FAILED',
    LOGOUT: 'LOGOUT',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',
    PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
    PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS',
    OTP_SENT: 'OTP_SENT',
    OTP_VERIFIED: 'OTP_VERIFIED',
    OTP_FAILED: 'OTP_FAILED',

    // Authorization Events
    ACCESS_DENIED: 'ACCESS_DENIED',
    ROLE_CHANGE: 'ROLE_CHANGE',
    PERMISSION_DENIED: 'PERMISSION_DENIED',

    // Admin Management Events
    ADMIN_CREATED: 'ADMIN_CREATED',
    ADMIN_UPDATED: 'ADMIN_UPDATED',
    ADMIN_DELETED: 'ADMIN_DELETED',
    ADMIN_DEACTIVATED: 'ADMIN_DEACTIVATED',

    // User Management Events
    USER_CREATED: 'USER_CREATED',
    USER_UPDATED: 'USER_UPDATED',
    USER_DELETED: 'USER_DELETED',
    USER_BANNED: 'USER_BANNED',

    // Data Events
    DATA_EXPORT: 'DATA_EXPORT',
    DATA_IMPORT: 'DATA_IMPORT',
    BULK_DELETE: 'BULK_DELETE',

    // Security Events
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    FILE_UPLOAD_BLOCKED: 'FILE_UPLOAD_BLOCKED',
}

// ============================================
// Get Client IP from Request
// ============================================
const getClientIP = (req) => {
    if (!req) return 'unknown'
    const forwarded = req.headers?.['x-forwarded-for']
    if (forwarded) {
        return forwarded.split(',')[0].trim()
    }
    return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || 'unknown'
}

// ============================================
// Log Action (Original Function - Preserved for Compatibility)
// ============================================
const logAction = async ({ action, entity, entityId, userId, details, req }) => {
    try {
        const logEntry = new AuditLog({
            action,
            entity,
            entityId,
            user: userId,
            details,
            ip: getClientIP(req),
            userAgent: req?.headers?.['user-agent'],
        })

        await logEntry.save()

        if (process.env.NODE_ENV === 'development') {
            console.log(`[AUDIT] ${action} on ${entity} ${entityId} by ${userId}`)
        }
    } catch (error) {
        console.error('[AUDIT ERROR] Failed to log action:', error.message)
    }
}

// ============================================
// Log Security Event (Enhanced Version)
// ============================================
const logSecurityEvent = async ({
    action,
    entity = 'System',
    entityId = null,
    userId = null,
    details = {},
    req = null,
    status = 'success',
}) => {
    try {
        const logEntry = {
            action,
            entity,
            entityId,
            user: userId,
            details: {
                ...details,
                status,
                timestamp: new Date().toISOString(),
            },
            ip: getClientIP(req),
            userAgent: req?.headers?.['user-agent'] || 'unknown',
        }

        // Add request info if available
        if (req) {
            logEntry.details.method = req.method
            logEntry.details.path = req.originalUrl || req.path

            // Add user info from request if not provided
            if (!userId && req.user) {
                logEntry.user = req.user._id || req.user.id
            }
        }

        // Save to database
        await AuditLog.create(logEntry)

        // Also log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.log(`[AUDIT] ${action}:`, {
                entity,
                entityId,
                userId: logEntry.user,
                status,
                ip: logEntry.ip,
            })
        }

        return true
    } catch (error) {
        // Don't throw - logging should never break the main flow
        console.error('[AUDIT ERROR] Failed to log security event:', error.message)
        return false
    }
}

// ============================================
// Quick Log Functions
// ============================================

const logLoginSuccess = (req, userId, userType = 'Admin') => {
    return logSecurityEvent({
        action: SECURITY_EVENTS.LOGIN_SUCCESS,
        entity: userType,
        entityId: userId,
        userId,
        req,
        status: 'success',
        details: { userType },
    })
}

const logLoginFailed = (req, email, reason = 'Invalid credentials') => {
    return logSecurityEvent({
        action: SECURITY_EVENTS.LOGIN_FAILED,
        entity: 'System',
        req,
        status: 'failed',
        details: { email, reason },
    })
}

const logPasswordChange = (req, userId) => {
    return logSecurityEvent({
        action: SECURITY_EVENTS.PASSWORD_CHANGE,
        entity: 'User',
        entityId: userId,
        userId,
        req,
        status: 'success',
    })
}

const logRoleChange = (req, targetUserId, oldRole, newRole, changedBy) => {
    return logSecurityEvent({
        action: SECURITY_EVENTS.ROLE_CHANGE,
        entity: 'Admin',
        entityId: targetUserId,
        userId: changedBy,
        req,
        status: 'success',
        details: { oldRole, newRole, targetUserId },
    })
}

const logAccessDenied = (req, userId, requiredPermission) => {
    return logSecurityEvent({
        action: SECURITY_EVENTS.ACCESS_DENIED,
        entity: 'System',
        userId,
        req,
        status: 'denied',
        details: { requiredPermission },
    })
}

const logAdminCreated = (req, newAdminId, createdBy) => {
    return logSecurityEvent({
        action: SECURITY_EVENTS.ADMIN_CREATED,
        entity: 'Admin',
        entityId: newAdminId,
        userId: createdBy,
        req,
        status: 'success',
    })
}

const logAdminDeleted = (req, deletedAdminId, deletedBy) => {
    return logSecurityEvent({
        action: SECURITY_EVENTS.ADMIN_DELETED,
        entity: 'Admin',
        entityId: deletedAdminId,
        userId: deletedBy,
        req,
        status: 'success',
    })
}

const logDataExport = (req, userId, exportType, recordCount) => {
    return logSecurityEvent({
        action: SECURITY_EVENTS.DATA_EXPORT,
        entity: exportType,
        userId,
        req,
        status: 'success',
        details: { exportType, recordCount },
    })
}

const logSuspiciousActivity = (req, description) => {
    return logSecurityEvent({
        action: SECURITY_EVENTS.SUSPICIOUS_ACTIVITY,
        entity: 'System',
        req,
        status: 'warning',
        details: { description },
    })
}

// ============================================
// Exports
// ============================================
module.exports = {
    // Original function
    logAction,

    // Enhanced functions
    SECURITY_EVENTS,
    logSecurityEvent,
    logLoginSuccess,
    logLoginFailed,
    logPasswordChange,
    logRoleChange,
    logAccessDenied,
    logAdminCreated,
    logAdminDeleted,
    logDataExport,
    logSuspiciousActivity,
    getClientIP,
}
