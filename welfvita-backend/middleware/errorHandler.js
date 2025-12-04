const logger = require('../utils/logger')

const isProduction = process.env.NODE_ENV === 'production'

const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500

  // Known error types
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'توکن معتبر نیست' })
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'توکن منقضی شده است' })
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'شناسه نامعتبر است' })
  }

  // Validation errors shaped by express-validator or Mongoose
  if (Array.isArray(err.errors) && err.errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'ورودی نامعتبر است',
      errors: err.errors.map(e => ({ field: e.param || e.path, message: e.msg || e.message })),
    })
  }

  const publicMessage = status >= 500
    ? 'خطای داخلی سرور رخ داده است'
    : err.message || 'خطای نامشخص'

  // Log with sanitized context
  logger.error(err.message, {
    status,
    method: req.method,
    path: req.originalUrl,
    stack: err.stack,
  })

  return res.status(status).json({
    success: false,
    message: publicMessage,
    error: isProduction ? undefined : err.message,
  })
}

module.exports = errorHandler
