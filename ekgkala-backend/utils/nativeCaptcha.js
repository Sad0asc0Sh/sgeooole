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
  if (!captchaId || !text) {
    return {
      success: false,
      message: 'شناسه و کد کپچا الزامی است.',
      code: 'CAPTCHA_REQUIRED',
    }
  }

  const captcha = await Captcha.findOne({ captchaId })

  if (!captcha || captcha.expiresAt < new Date()) {
    return {
      success: false,
      message: 'کپچا منقضی یا یافت نشد. لطفاً کد جدید دریافت کنید.',
      code: 'CAPTCHA_EXPIRED',
    }
  }

  if (captcha.solved) {
    return {
      success: false,
      message: 'این کپچا قبلاً استفاده شده است. لطفاً کد جدید دریافت کنید.',
      code: 'CAPTCHA_ALREADY_USED',
    }
  }

  if (captcha.attempts >= 3) {
    await Captcha.deleteOne({ _id: captcha._id })
    return {
      success: false,
      message: 'تعداد تلاش‌های ناموفق کپچا بیش از حد است. کد جدید دریافت کنید.',
      code: 'CAPTCHA_MAX_ATTEMPTS',
    }
  }

  const inputHash = Captcha.hashAnswer(text)

  if (inputHash !== captcha.codeHash) {
    captcha.attempts += 1
    if (captcha.attempts >= 3) {
      await Captcha.deleteOne({ _id: captcha._id })
    } else {
      await captcha.save()
    }
    return {
      success: false,
      message: 'کد کپچا وارد شده اشتباه است.',
      code: 'CAPTCHA_INVALID',
    }
  }

  // Mark as solved & delete/invalidate so it cannot be reused
  captcha.solved = true
  captcha.attempts += 1
  await Captcha.deleteOne({ _id: captcha._id })

  return { success: true }
}

module.exports = {
  generateCaptcha,
  verifyCaptcha,
}
