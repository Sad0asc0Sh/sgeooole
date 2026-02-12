/**
 * ============================================
 * PRODUCTION ERROR HANDLER MIDDLEWARE
 * ============================================
 * 
 * SECURITY FIXES:
 * - [CRITICAL] Prevents Information Disclosure (stack traces, DB errors)
 * - [HIGH] Masks MongoDB/Mongoose internal errors in production
 * - [MEDIUM] Logs full details internally for debugging
 * 
 * OWASP Reference: A01:2021 - Broken Access Control (error leakage)
 */

const logger = require('../utils/logger')

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Map of known error types to user-friendly messages
 * This prevents leaking internal error details to attackers
 */
const ERROR_MESSAGES = {
  // Authentication Errors
  JsonWebTokenError: 'توکن معتبر نیست',
  TokenExpiredError: 'توکن منقضی شده است',
  NotBeforeError: 'توکن هنوز فعال نشده است',

  // MongoDB/Mongoose Errors
  CastError: 'شناسه نامعتبر است',
  ValidationError: 'اطلاعات وارد شده معتبر نیست',
  MongoServerError: 'خطا در پردازش درخواست',
  MongoNetworkError: 'خطا در اتصال به سرور',
  MongoTimeoutError: 'زمان درخواست به پایان رسید',

  // Duplicate Key (MongoDB code 11000)
  DuplicateKey: 'این اطلاعات قبلاً ثبت شده است',

  // Rate Limiting
  TooManyRequests: 'تعداد درخواست‌های شما بیش از حد مجاز است',

  // File Upload Errors
  MulterError: 'خطا در آپلود فایل',
  PayloadTooLargeError: 'حجم داده ارسالی بیشتر از حد مجاز است',

  // Default
  InternalError: 'خطای داخلی سرور رخ داده است',
}

/**
 * Determine if error contains sensitive information that should be hidden
 */
const isSensitiveError = (err) => {
  const sensitivePatterns = [
    /mongodb/i,
    /mongoose/i,
    /connection/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /password/i,
    /credential/i,
    /secret/i,
    /api[_-]?key/i,
    /token/i,
    /authorization/i,
  ]

  const errorString = `${err.message} ${err.stack || ''}`
  return sensitivePatterns.some(pattern => pattern.test(errorString))
}

/**
 * Extract safe error message for client response
 */
const getSafeMessage = (err) => {
  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    return 'حجم فایل بیشتر از حد مجاز است'
  }

  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    return ERROR_MESSAGES.PayloadTooLargeError
  }

  // Check for known error types
  if (ERROR_MESSAGES[err.name]) {
    return ERROR_MESSAGES[err.name]
  }

  // MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    return ERROR_MESSAGES.DuplicateKey
  }

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const fields = Object.keys(err.errors)
    return `فیلد${fields.length > 1 ? 'های' : ''} ${fields.join('، ')} نامعتبر ${fields.length > 1 ? 'هستند' : 'است'}`
  }

  // Rate limit error
  if (err.status === 429) {
    return ERROR_MESSAGES.TooManyRequests
  }

  // For 4xx errors, we can usually show the message (client errors)
  // For 5xx errors in production, always use generic message
  const status = err.status || err.statusCode || 500

  if (status >= 500 || isSensitiveError(err)) {
    return ERROR_MESSAGES.InternalError
  }

  // For non-sensitive 4xx errors, return the actual message
  return err.message || ERROR_MESSAGES.InternalError
}

/**
 * Format validation errors from express-validator or Mongoose
 */
const formatValidationErrors = (err) => {
  if (Array.isArray(err.errors)) {
    // express-validator format
    return err.errors.map(e => ({
      field: e.param || e.path || e.field,
      message: e.msg || e.message,
    }))
  }

  if (err.errors && typeof err.errors === 'object') {
    // Mongoose validation error format
    return Object.entries(err.errors).map(([field, error]) => ({
      field,
      message: error.message,
    }))
  }

  return null
}

/**
 * Main Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  // Prevent sending response if headers already sent
  if (res.headersSent) {
    return next(err)
  }

  const status = err.status || err.statusCode || 500
  const requestId = req.headers['x-request-id'] || req.id || Date.now().toString(36)

  // ============================================
  // INTERNAL LOGGING (Full details for debugging)
  // ============================================
  const logContext = {
    requestId,
    status,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip || req.connection?.remoteAddress,
    userId: req.user?._id?.toString() || 'anonymous',
    userAgent: req.get('user-agent'),
    errorName: err.name,
    errorCode: err.code,
    stack: !isProduction || status >= 500 ? err.stack : undefined,
  }

  // Log based on severity
  if (status >= 500) {
    logger.error(`[ERROR] ${err.message}`, logContext)
  } else if (status >= 400) {
    logger.warn(`[WARN] ${err.message}`, logContext)
  }

  // ============================================
  // SECURITY AUDIT LOG (for suspicious activity)
  // ============================================
  if (isSensitiveError(err) || status === 401 || status === 403) {
    logger.security(`Suspicious request: ${err.message}`, {
      requestId,
      ip: logContext.ip,
      path: logContext.path,
      method: logContext.method,
    })
  }

  // ============================================
  // CLIENT RESPONSE (Sanitized)
  // ============================================
  const response = {
    success: false,
    message: getSafeMessage(err),
    requestId,
  }

  // Add validation errors if present (safe to expose)
  const validationErrors = formatValidationErrors(err)
  if (validationErrors) {
    response.errors = validationErrors
  }

  // In development, include debug information
  if (!isProduction) {
    response.debug = {
      name: err.name,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 5),
    }
  }

  return res.status(status).json(response)
}

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors automatically
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

/**
 * Create a custom error with status code
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message)
    this.status = statusCode
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Not Found handler (404)
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `مسیر ${req.method} ${req.path} یافت نشد`,
  })
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  notFoundHandler,
}
