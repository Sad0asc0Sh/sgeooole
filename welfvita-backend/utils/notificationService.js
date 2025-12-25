const nodemailer = require('nodemailer')
const Kavenegar = require('kavenegar')
const { SocksProxyAgent } = require('socks')
const https = require('https')
const axios = require('axios')
const Settings = require('../models/Settings')
const { maskMobile, normalizeIranMobile } = require('./phone')

// ============================================
// Resend API Configuration (Primary for Cloud)
// ============================================
let resendClient = null

const getResendClient = () => {
  if (!resendClient && process.env.RESEND_API_KEY) {
    const { Resend } = require('resend')
    resendClient = new Resend(process.env.RESEND_API_KEY)
    console.log('[EMAIL] ✅ Using Resend API for email delivery')
  }
  return resendClient
}

// Check if we should use Resend
const useResend = () => {
  return !!process.env.RESEND_API_KEY
}

// Get the from email for Resend
const getResendFromEmail = () => {
  // Resend requires verified domain or onboarding@resend.dev for testing
  return process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
}

// ============================================
// SMS Configuration Helpers
// ============================================
let smsSettingsCache = { value: null, expiresAt: 0 }
const SMS_SETTINGS_CACHE_TTL_MS = Math.max(0, Number(process.env.SMS_SETTINGS_CACHE_TTL_MS || 30000))

const getSmsSettings = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && smsSettingsCache.value && smsSettingsCache.expiresAt > Date.now()) {
    return smsSettingsCache.value
  }

  const settings = await Settings.findOne({ singletonKey: 'main_settings' }).select(
    '+notificationSettings.smsUsername +notificationSettings.smsPassword +notificationSettings.smsApiKey +notificationSettings.smsSenderNumber'
  )

  const smsUsernameRaw = settings?.notificationSettings?.smsUsername
  const smsPasswordRaw = settings?.notificationSettings?.smsPassword
  const smsApiKeyRaw = settings?.notificationSettings?.smsApiKey
  const smsSenderNumberRaw = settings?.notificationSettings?.smsSenderNumber

  const smsUsername = typeof smsUsernameRaw === 'string' ? smsUsernameRaw.trim() : ''
  const smsPassword = typeof smsPasswordRaw === 'string' ? smsPasswordRaw.trim() : ''
  const smsApiKey = typeof smsApiKeyRaw === 'string' ? smsApiKeyRaw.trim() : ''
  const smsSenderNumber = typeof smsSenderNumberRaw === 'string' ? smsSenderNumberRaw.trim() : ''

  const value = {
    smsUsername,
    smsPassword,
    smsApiKey,
    smsSenderNumber,
    configured: Boolean(smsUsername && smsPassword),
  }

  smsSettingsCache = { value, expiresAt: Date.now() + SMS_SETTINGS_CACHE_TTL_MS }
  return value
}

exports.getSmsSettings = getSmsSettings

let smsHttpsAgent = null
const getSmsHttpsAgent = () => {
  if (smsHttpsAgent) return smsHttpsAgent

  const proxyUrl = process.env.SMS_PROXY
  if (proxyUrl) {
    console.warn('[SMS] Using SMS_PROXY for outbound SMS requests')
    smsHttpsAgent = new SocksProxyAgent(proxyUrl)
    return smsHttpsAgent
  }

  smsHttpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
  })
  return smsHttpsAgent
}

// ============================================
// Email Transporter Configuration (Fallback SMTP)
// ============================================
const createTransporter = () => {
  const config = {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '',
    },
    tls: {
      rejectUnauthorized: false
    },
    family: 4,
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  }

  if (process.env.EMAIL_PROXY) {
    console.log(`[EMAIL] Using Proxy: ${process.env.EMAIL_PROXY}`)
    config.proxy_socks_module = require('socks')
    config.agent = new SocksProxyAgent(process.env.EMAIL_PROXY)
  }

  return nodemailer.createTransport(config)
}

// ============================================
// Universal Email Sender (Resend or SMTP)
// ============================================
const sendEmail = async ({ to, subject, html }) => {
  // Try Resend first (works better on cloud platforms)
  if (useResend()) {
    try {
      const resend = getResendClient()
      const fromName = process.env.EMAIL_FROM_NAME || 'ویلف ویتا'
      const fromEmail = getResendFromEmail()

      const { data, error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html,
      })

      if (error) {
        console.error('[EMAIL-RESEND] ❌ Error:', error)
        throw new Error(error.message)
      }

      console.log('[EMAIL-RESEND] ✅ Email sent:', data?.id)
      return { success: true, messageId: data?.id, provider: 'resend' }
    } catch (resendError) {
      console.error('[EMAIL-RESEND] ❌ Failed, trying SMTP fallback:', resendError.message)
      // Fall through to SMTP
    }
  }

  // Fallback to SMTP (Nodemailer)
  try {
    const transporter = createTransporter()
    const fromName = process.env.EMAIL_FROM_NAME || 'ویلف ویتا'
    const fromEmail = process.env.EMAIL_USER

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
    })

    console.log('[EMAIL-SMTP] ✅ Email sent:', info.messageId)
    return { success: true, messageId: info.messageId, provider: 'smtp' }
  } catch (smtpError) {
    console.error('[EMAIL-SMTP] ❌ Error:', smtpError.message)
    throw smtpError
  }
}

/**
 * @desc    ارسال ایمیل یادآوری سبد خرید
 * @param   {String} userEmail - ایمیل کاربر
 * @param   {String} userName - نام کاربر
 * @param   {Array} cartItems - آیتم‌های سبد خرید
 * @returns {Promise}
 */
exports.sendReminderEmail = async (userEmail, userName, cartItems) => {
  try {
    const transporter = createTransporter()

    // ساخت محتوای HTML ایمیل
    let itemsHtml = ''
    let totalPrice = 0

    cartItems.forEach((item) => {
      const price = item.price || 0
      const quantity = item.quantity || 0
      const subtotal = price * quantity
      totalPrice += subtotal

      itemsHtml += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.product?.name || 'محصول'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${price.toLocaleString('fa-IR')} تومان</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${subtotal.toLocaleString('fa-IR')} تومان</td>
        </tr>
      `
    })

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'ویلف ویتا'}" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'یادآوری سبد خرید شما در ویلف ویتا',
      html: `
        <div dir="rtl" style="font-family: Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #333; text-align: center;">سلام ${userName || 'کاربر گرامی'}!</h2>
          <p style="color: #555; font-size: 14px;">
            شما محصولاتی را در سبد خرید خود داشتید که هنوز سفارش شما نهایی نشده است.
          </p>
          <p style="color: #555; font-size: 14px;">
            آیتم‌های سبد خرید شما:
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">محصول</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">تعداد</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">قیمت واحد</th>
                <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">جمع</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">جمع کل:</td>
                <td style="padding: 10px; font-weight: bold; color: #1890ff;">${totalPrice.toLocaleString('fa-IR')} تومان</td>
              </tr>
            </tfoot>
          </table>
          <p style="color: #555; font-size: 14px;">
            برای تکمیل خرید خود، به سایت ویلف ویتا مراجعه کنید.
          </p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/cart"
               style="background-color: #1890ff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              مشاهده سبد خرید
            </a>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
            با تشکر، تیم ویلف ویتا
          </p>
        </div>
      `,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Email sent: %s', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

/**
 * @desc    ارسال پیامک یادآوری سبد خرید (ملی‌پیامک)
 *          از خط تبلیغاتی 2170006555 استفاده می‌شود که به لیست سیاه هم ارسال می‌کند
 * @param   {String} phoneNumber - شماره موبایل کاربر
 * @param   {String} userName - نام کاربر
 * @param   {Number} itemsCount - تعداد آیتم‌های سبد
 * @returns {Promise}
 */
exports.sendReminderSMS = async (phoneNumber, userName, itemsCount) => {
  try {
    const settings = await Settings.findOne({ singletonKey: 'main_settings' })
      .select('+notificationSettings.smsUsername +notificationSettings.smsPassword +notificationSettings.smsSenderNumber')

    const { smsUsername, smsPassword, smsSenderNumber } = settings?.notificationSettings || {}

    if (!smsUsername || !smsPassword) {
      console.log('[SMS Reminder] تنظیمات پنل پیامک ناقص است')
      throw new Error('تنظیمات پنل پیامک تنظیم نشده است')
    }

    const message = `${userName || 'کاربر گرامی'}، شما ${itemsCount} محصول در سبد خرید ویلف ویتا دارید. برای تکمیل خرید خود به سایت مراجعه کنید.\nویلف ویتا\nلغو11`

    // استفاده از همان خط OTP تا زمانی که خط تبلیغاتی فعال شود
    const senderLine = smsSenderNumber || smsUsername

    console.log(`[SMS Reminder] ارسال به ${phoneNumber} از خط ${senderLine}...`)

    const response = await axios.post(
      'https://rest.payamak-panel.com/api/SendSMS/SendSMS',
      {
        username: smsUsername,
        password: smsPassword,
        to: phoneNumber,
        from: senderLine,
        text: message,
        isflash: false
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    )

    if (response.data.RetStatus === 1) {
      console.log('[SMS Reminder] ✅ پیامک ارسال شد')
      return { success: true, data: response.data }
    } else {
      console.error('[SMS Reminder] ❌ خطا:', response.data.StrRetStatus)
      throw new Error(response.data.StrRetStatus || 'خطا در ارسال پیامک')
    }

  } catch (error) {
    console.error('[SMS Reminder] ❌ خطا:', error.message)
    throw error
  }
}

/**
 * @desc    ارسال ایمیل هشدار انقضای سبد خرید
 * @param   {String} userEmail - ایمیل کاربر
 * @param   {Object} params - پارامترهای هشدار
 * @param   {String} params.userName - نام کاربر
 * @param   {Number} params.itemCount - تعداد آیتم‌ها
 * @param   {Number} params.totalPrice - قیمت کل
 * @param   {Number} params.expiryMinutes - دقایق باقیمانده تا انقضا
 * @returns {Promise}
 */
exports.sendExpiryWarningEmail = async (userEmail, params) => {
  try {
    const transporter = createTransporter()
    const { userName, itemCount, totalPrice, expiryMinutes } = params

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'ویلف ویتا'}" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: '⏰ هشدار: سبد خرید شما در حال انقضا است!',
      html: `
        <div dir="rtl" style="font-family: Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #fff8e6;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px;">⏰</span>
          </div>
          <h2 style="color: #d48806; text-align: center;">هشدار انقضای سبد خرید</h2>
          <p style="color: #333; font-size: 14px; text-align: center;">
            سلام <strong>${userName || 'کاربر گرامی'}</strong>!
          </p>
          <div style="background-color: #fff; border: 2px solid #fa8c16; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="color: #d48806; font-size: 18px; font-weight: bold; margin: 0;">
              ⚠️ سبد خرید شما تا ${expiryMinutes} دقیقه دیگر منقضی می‌شود!
            </p>
          </div>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #555; font-size: 14px; margin: 5px 0;">
              📦 تعداد محصولات: <strong>${itemCount}</strong>
            </p>
            <p style="color: #555; font-size: 14px; margin: 5px 0;">
              💰 مبلغ کل: <strong>${(totalPrice || 0).toLocaleString('fa-IR')} تومان</strong>
            </p>
          </div>
          <p style="color: #555; font-size: 14px; text-align: center;">
            برای جلوگیری از از دست دادن محصولات خود، همین الان خرید را تکمیل کنید.
          </p>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/cart"
               style="background-color: #fa8c16; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              🛒 تکمیل خرید
            </a>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
            با تشکر، تیم ویلف ویتا
          </p>
        </div>
      `,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('[EXPIRY WARNING] Email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('[EXPIRY WARNING] Error sending email:', error)
    throw error
  }
}

/**
 * @desc    ارسال پیامک هشدار انقضای سبد خرید (ملی‌پیامک)
 * @param   {String} phoneNumber - شماره موبایل کاربر
 * @param   {Object} params - پارامترهای هشدار
 * @param   {String} params.userName - نام کاربر
 * @param   {Number} params.itemCount - تعداد آیتم‌ها
 * @param   {Number} params.expiryMinutes - دقایق باقیمانده تا انقضا
 * @returns {Promise}
 */
exports.sendExpiryWarningSMS = async (phoneNumber, params) => {
  try {
    const { userName, itemCount, expiryMinutes } = params

    const settings = await Settings.findOne({ singletonKey: 'main_settings' })
      .select('+notificationSettings.smsUsername +notificationSettings.smsPassword +notificationSettings.smsSenderNumber')

    const { smsUsername, smsPassword, smsSenderNumber } = settings?.notificationSettings || {}

    if (!smsUsername || !smsPassword) {
      console.log('[EXPIRY WARNING SMS] تنظیمات پیامک ناقص است')
      return { success: false, message: 'تنظیمات پیامک ناقص است' }
    }

    const message = `${userName || 'کاربر گرامی'}، سبد خرید شما (${itemCount} محصول) تا ${expiryMinutes} دقیقه دیگر منقضی می‌شود. همین الان خرید را تکمیل کنید.\nویلف ویتا\nلغو11`

    // استفاده از همان خط OTP تا زمانی که خط تبلیغاتی فعال شود
    const senderLine = smsSenderNumber || smsUsername

    console.log(`[EXPIRY WARNING SMS] ارسال به ${phoneNumber} از خط ${senderLine}...`)

    const response = await axios.post(
      'https://rest.payamak-panel.com/api/SendSMS/SendSMS',
      {
        username: smsUsername,
        password: smsPassword,
        to: phoneNumber,
        from: senderLine,
        text: message,
        isflash: false
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    )

    if (response.data.RetStatus === 1) {
      console.log('[EXPIRY WARNING SMS] ✅ ارسال شد')
      return { success: true, data: response.data }
    } else {
      console.error('[EXPIRY WARNING SMS] ❌ خطا:', response.data.StrRetStatus)
      return { success: false, message: response.data.StrRetStatus }
    }

  } catch (error) {
    console.error('[EXPIRY WARNING SMS] ❌ خطا:', error.message)
    return { success: false, message: error.message }
  }
}

/**
 * @desc    ارسال ایمیل بازنشانی رمز عبور
 * @param   {String} userEmail - ایمیل کاربر
 * @param   {String} userName - نام کاربر
 * @param   {String} resetUrl - لینک بازنشانی رمز عبور
 * @returns {Promise}
 */
exports.sendResetPasswordEmail = async (userEmail, userName, resetUrl) => {
  try {
    const html = `
      <div dir="rtl" style="font-family: Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333; text-align: center;">بازنشانی رمز عبور</h2>
        <p style="color: #555; font-size: 14px;">
          سلام ${userName || 'کاربر گرامی'}،
        </p>
        <p style="color: #555; font-size: 14px;">
          شما درخواست بازنشانی رمز عبور خود را ارسال کرده‌اید. برای ادامه، روی دکمه زیر کلیک کنید:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="background-color: #1890ff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            بازنشانی رمز عبور
          </a>
        </div>
        <p style="color: #999; font-size: 13px;">
          یا این لینک را کپی کنید:
        </p>
        <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 12px;">
          ${resetUrl}
        </p>
        <p style="color: #d9534f; font-size: 13px; margin-top: 20px;">
          ⚠️ این لینک فقط برای <strong>10 دقیقه</strong> معتبر است.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          اگر شما درخواست بازنشانی رمز عبور نداده‌اید، این ایمیل را نادیده بگیرید.
        </p>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
          با تشکر، تیم ویلف ویتا
        </p>
      </div>
    `

    const result = await sendEmail({
      to: userEmail,
      subject: 'بازنشانی رمز عبور - ویلف ویتا',
      html,
    })

    console.log('[RESET PASSWORD] Email sent via', result.provider)
    return result
  } catch (error) {
    console.error('Error sending reset password email:', error)
    throw error
  }
}

/**
 * @desc    ارسال ایمیل تایید (OTP)
 * @param   {String} userEmail - ایمیل کاربر
 * @param   {String} code - کد تایید
 * @returns {Promise}
 */
exports.sendVerificationEmail = async (userEmail, code) => {
  try {
    const html = `
      <div dir="rtl" style="font-family: Tahoma, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333; text-align: center;">کد تایید ایمیل</h2>
        <p style="color: #555; font-size: 14px;">
          کاربر گرامی،
        </p>
        <p style="color: #555; font-size: 14px;">
          برای تایید آدرس ایمیل خود، لطفا کد زیر را وارد کنید:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="background-color: #f0f0f0; color: #333; padding: 15px 30px; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; border: 1px solid #ccc;">
            ${code}
          </span>
        </div>
        <p style="color: #d9534f; font-size: 13px; margin-top: 20px;">
          ⚠️ این کد فقط برای <strong>2 دقیقه</strong> معتبر است.
        </p>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
          با تشکر، تیم ویلف ویتا
        </p>
      </div>
    `

    const result = await sendEmail({
      to: userEmail,
      subject: 'کد تایید ایمیل - ویلف ویتا',
      html,
    })

    console.log('[VERIFICATION EMAIL] Email sent via', result.provider)
    return result
  } catch (error) {
    console.error('Error sending verification email:', error)
    throw error
  }
}

/**
 * @desc    ارسال پیامک OTP (ملی پیامک REST API)
 * @param   {String} mobile - شماره موبایل
 * @param   {String} code - کد تایید
 * @returns {Promise}
 */
exports.sendOtpSMS = async (mobile, code) => {
  const normalizedMobile = normalizeIranMobile(mobile)
  if (!normalizedMobile) {
    const err = new Error('شماره موبایل برای ارسال پیامک معتبر نیست')
    err.code = 'INVALID_MOBILE'
    err.statusCode = 400
    throw err
  }

  const smsSettings = await getSmsSettings()
  const smsUsername = smsSettings.smsUsername
  const smsPassword = smsSettings.smsPassword
  const smsApiKey = smsSettings.smsApiKey
  const smsSenderNumber = smsSettings.smsSenderNumber

  if (!smsSettings.configured) {
    const err = new Error('تنظیمات پیامک (نام کاربری/رمز) در پنل ادمین کامل نیست')
    err.code = 'SMS_NOT_CONFIGURED'
    err.statusCode = 503
    throw err
  }

  const senderLine = smsSenderNumber || smsUsername
  const text = `کد تایید شما: ${code}\nویلف ویتا\nلغو11`

  const timeoutMs = Math.max(1000, Number(process.env.SMS_TIMEOUT_MS || 25000))
  const maxAttempts = Math.max(1, Number(process.env.SMS_MAX_ATTEMPTS || 3))
  const retryDelayMs = Math.max(0, Number(process.env.SMS_RETRY_DELAY_MS || 1000))

  const axiosConfig = {
    headers: { 'Content-Type': 'application/json' },
    timeout: timeoutMs,
    validateStatus: () => true,
    httpsAgent: getSmsHttpsAgent(),
    proxy: false,
  }

  const shouldRetry = (error) => {
    const retryableCodes = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'])
    if (retryableCodes.has(error?.code)) return true
    const status = error?.response?.status
    if (typeof status === 'number' && status >= 500) return true
    return false
  }

  const sendViaPayamakRest = async () => {
    const url = 'https://rest.payamak-panel.com/api/SendSMS/SendSMS'
    const payload = {
      username: smsUsername,
      password: smsPassword,
      to: normalizedMobile,
      from: senderLine,
      text,
      isflash: false,
    }

    const response = await axios.post(url, payload, axiosConfig)
    const retStatus = Number(response?.data?.RetStatus)

    if (retStatus === 1) {
      return { success: true, data: response.data, provider: 'melipayamak-rest' }
    }

    const providerMessage = response?.data?.StrRetStatus || 'خطای نامشخص از سرویس پیامک'
    const err = new Error(providerMessage)
    err.code = 'SMS_PROVIDER_ERROR'
    err.statusCode = 503
    err.details = response.data
    throw err
  }

  const sendViaMelipayamakConsole = async () => {
    const url = `https://console.melipayamak.com/api/send/simple/${smsApiKey}`
    const payload = { from: senderLine, to: normalizedMobile, text }

    const response = await axios.post(url, payload, axiosConfig)

    if (response.status >= 200 && response.status < 300) {
      return { success: true, data: response.data, provider: 'melipayamak-console' }
    }

    const providerMessage =
      (typeof response?.data?.status === 'string' && response.data.status) ||
      (typeof response?.data?.message === 'string' && response.data.message) ||
      'خطای نامشخص از سرویس پیامک'

    const err = new Error(providerMessage)
    err.code = 'SMS_PROVIDER_ERROR'
    err.statusCode = 503
    err.details = response.data
    throw err
  }

  const providers = []
  if (smsApiKey) providers.push({ name: 'melipayamak-console', send: sendViaMelipayamakConsole })
  providers.push({ name: 'melipayamak-rest', send: sendViaPayamakRest })

  let lastError = null
  for (const provider of providers) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        if (attempt === 1) {
          console.log(`[SMS] در حال ارسال پیامک OTP به ${maskMobile(normalizedMobile)} (${provider.name})...`)
        } else {
          console.warn(`[SMS] تلاش مجدد ارسال پیامک OTP (attempt ${attempt}) به ${maskMobile(normalizedMobile)} (${provider.name})...`)
        }

        return await provider.send()
      } catch (error) {
        lastError = error
        if (attempt < maxAttempts && shouldRetry(error)) {
          await new Promise((r) => setTimeout(r, retryDelayMs * attempt))
          continue
        }
        break
      }
    }
  }

  if (lastError?.statusCode) throw lastError
  const err = new Error(lastError?.message || 'خطا در ارسال پیامک')
  err.code = lastError?.code || 'SMS_SEND_FAILED'
  err.statusCode = 503
  throw err
}
