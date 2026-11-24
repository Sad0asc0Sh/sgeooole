const svgCaptcha = require('svg-captcha')
const crypto = require('crypto')
const Captcha = require('../models/Captcha')

const CAPTCHA_TTL_SECONDS = Number(process.env.CAPTCHA_TTL_SECONDS || 120)

/**
 * Generate a new native SVG captcha challenge
 * Saves hashed answer to DB with TTL
 */
async function generateCaptcha() {
  const captcha = svgCaptcha.create({
    size: 5,
    noise: 3,
    color: true,
    background: '#f8fafc',
    width: 140,
    height: 44,
    fontSize: 48,
    ignoreChars: '0o1iIlO',
  })

  const captchaId = crypto.randomBytes(16).toString('hex')
  const codeHash = Captcha.hashAnswer(captcha.text)
  const expiresAt = new Date(Date.now() + CAPTCHA_TTL_SECONDS * 1000)

  await Captcha.create({
    captchaId,
    codeHash,
    attempts: 0,
    solved: false,
    expiresAt,
  })

  return {
    captchaId,
    svg: captcha.data,
    expiresIn: CAPTCHA_TTL_SECONDS,
  }
}

/**
 * Verify a native captcha challenge (One-time use, max 3 attempts)
 */
async function verifyCaptcha(captchaId, text) {
  if (typeof captchaId !== 'string' || !captchaId.trim() || typeof text !== 'string' || !text.trim()) {
    return {
      success: false,
      message: 'شناسه و کد کپچا الزامی است.',
      code: 'CAPTCHA_REQUIRED',
    }
  }

  const normalizedId = captchaId.trim()
  const inputHash = Captcha.hashAnswer(text)
  const now = new Date()

  // Atomic one-time claim on valid, unsolved, unexpired captcha
  const matched = await Captcha.findOneAndDelete({
    captchaId: normalizedId,
    codeHash: inputHash,
    solved: false,
    attempts: { $lt: 3 },
    expiresAt: { $gt: now },
  })

  if (matched) {
    return { success: true }
  }

  // Otherwise atomically increment failed attempt count (if challenge still exists)
  const updated = await Captcha.findOneAndUpdate(
    { captchaId: normalizedId, solved: false, expiresAt: { $gt: now } },
    { $inc: { attempts: 1 } },
    { new: true }
  )

  if (!updated) {
    return {
      success: false,
      message: 'کپچا منقضی یا یافت نشد. لطفاً کد جدید دریافت کنید.',
      code: 'CAPTCHA_EXPIRED',
    }
  }

  if (updated.attempts >= 3) {
    await Captcha.deleteOne({ _id: updated._id })
    return {
      success: false,
      message: 'تعداد تلاش‌های ناموفق کپچا بیش از حد است. کد جدید دریافت کنید.',
      code: 'CAPTCHA_MAX_ATTEMPTS',
    }
  }

  return {
    success: false,
    message: 'کد کپچا وارد شده اشتباه است.',
    code: 'CAPTCHA_INVALID',
  }
}

module.exports = {
  generateCaptcha,
  verifyCaptcha,
}
