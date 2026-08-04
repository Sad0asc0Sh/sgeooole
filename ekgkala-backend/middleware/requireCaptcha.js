const { verifyCaptcha } = require('../utils/nativeCaptcha')
const { getClientIp } = require('../utils/clientIp')
const { recordIpFailure } = require('./ipBlocklist')

/**
 * Middleware to require valid Native Captcha solution
 * Expects `captchaId` and `captchaText` in req.body or headers
 */
async function requireCaptcha(req, res, next) {
  const captchaId = req.body?.captchaId || req.headers['x-captcha-id']
  const captchaText = req.body?.captchaText || req.headers['x-captcha-text']

  if (!captchaId || !captchaText) {
    recordIpFailure(getClientIp(req), 'Missing captcha fields', 5)
    return res.status(400).json({
      success: false,
      message: 'شناسه و کد کپچا الزامی است.',
      code: 'CAPTCHA_REQUIRED',
    })
  }

  try {
    const result = await verifyCaptcha(captchaId, captchaText)
    if (!result.success) {
      recordIpFailure(getClientIp(req), `Captcha failed: ${result.code}`, 5)
      return res.status(400).json({
        success: false,
        message: result.message,
        code: result.code,
      })
    }

    next()
  } catch (err) {
    console.error('[CAPTCHA MIDDLEWARE ERROR]', err)
    return res.status(500).json({
      success: false,
      message: 'خطا در بررسی کپچا. لطفاً مجدداً تلاش کنید.',
    })
  }
}

module.exports = {
  requireCaptcha,
}
