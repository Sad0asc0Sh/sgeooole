const { createLogger, format, transports } = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const path = require('path')
const fs = require('fs')

const logDir = path.join(__dirname, '..', 'logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir)
}

const sensitiveKeys = ['password', 'token', 'authorization', 'refreshToken', 'apiKey', 'secret']

const redact = (meta = {}) => {
  const clone = { ...meta }
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      clone[key] = '[REDACTED]'
    }
  }
  return clone
}

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.printf(info => {
      const { timestamp, level, message, stack, ...meta } = info
      const safeMeta = redact(meta)
      const base = `${timestamp} [${level}] ${message}`
      const metaStr = Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : ''
      return stack ? `${base} ${metaStr} | ${stack}` : `${base} ${metaStr}`
    }),
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(info => `${info.timestamp} [${info.level}] ${info.message}`),
      ),
    }),
    new DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '10m',
      level: process.env.LOG_LEVEL || 'info',
    }),
    new DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '10m',
      level: 'error',
    }),
  ],
})

module.exports = logger
