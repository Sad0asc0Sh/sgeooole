/**
 * ============================================
 * Production Console Override
 * Silences console.log/info/debug in production
 * while keeping error/warn for critical issues
 * ============================================
 * 
 * Import this at the TOP of server.js:
 * require('./utils/productionConsole')
 */

const isProduction = process.env.NODE_ENV === 'production'
const logger = require('./logger')

if (isProduction) {
    // Store original methods
    const originalConsole = {
        log: console.log,
        info: console.info,
        debug: console.debug,
        warn: console.warn,
        error: console.error,
    }

    // Override console.log - silent in production
    console.log = function (...args) {
        // In production, redirect to logger debug (which is filtered)
        // This ensures legacy console.log calls don't leak to stdout
        if (process.env.DEBUG_CONSOLE === 'true') {
            originalConsole.log.apply(console, args)
        }
        // Log to file only (not console) if LOG_LEGACY is true
        if (process.env.LOG_LEGACY === 'true') {
            logger.debug('[LEGACY LOG]', ...args)
        }
    }

    // Override console.info - silent in production
    console.info = function (...args) {
        if (process.env.DEBUG_CONSOLE === 'true') {
            originalConsole.info.apply(console, args)
        }
    }

    // Override console.debug - silent in production  
    console.debug = function (...args) {
        if (process.env.DEBUG_CONSOLE === 'true') {
            originalConsole.debug.apply(console, args)
        }
    }

    // Keep console.warn - these are important
    console.warn = function (...args) {
        logger.warn('[CONSOLE WARN]', ...args)
        originalConsole.warn.apply(console, args)
    }

    // Keep console.error - these are critical
    console.error = function (...args) {
        const parts = args.map(arg => {
            if (arg instanceof Error) {
                return `${arg.message} | Stack: ${arg.stack || 'N/A'}`
            }
            if (typeof arg === 'object' && arg !== null) {
                try { return JSON.stringify(arg) } catch (_) { return String(arg) }
            }
            return String(arg)
        })
        logger.error(`[CONSOLE ERROR] ${parts.join(' ')}`)
        originalConsole.error.apply(console, args)
    }

    // Log that production mode is active
    originalConsole.log('🔒 Production mode: console.log/info/debug silenced')
    originalConsole.log('   Set DEBUG_CONSOLE=true to enable console output')
    originalConsole.log('   Set LOG_LEGACY=true to log to file instead')
}

module.exports = {
    isProduction,
}
