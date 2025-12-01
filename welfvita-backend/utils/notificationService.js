const nodemailer = require('nodemailer')
const Kavenegar = require('kavenegar')
const { SocksProxyAgent } = require('socks')
const axios = require('axios')
const Settings = require('../models/Settings')

// ============================================
// Email Transporter Configuration
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
 * @desc    ارسال پیامک یادآوری سبد خرید
 * @param   {String} phoneNumber - شماره موبایل کاربر
 * @param   {String} userName - نام کاربر
 * @param   {Number} itemsCount - تعداد آیتم‌های سبد
 * @returns {Promise}
 */
exports.sendReminderSMS = async (phoneNumber, userName, itemsCount) => {
  try {
    // تنظیمات Kavenegar
    const apiKey = process.env.KAVENEGAR_API_KEY
    if (!apiKey) {
      throw new Error('KAVENEGAR_API_KEY is not defined in environment variables')
    }

    const api = Kavenegar.KavenegarApi({
      apikey: apiKey,
    })

    // پیام پیامک
    const message = `${userName || 'کاربر گرامی'}، شما ${itemsCount} محصول در سبد خرید ویلف ویتا دارید. برای تکمیل خرید خود به سایت مراجعه کنید.`

    // شماره فرستنده (خط خدماتی کاوه‌نگار)
    const sender = process.env.KAVENEGAR_SENDER || '10004346'

    return new Promise((resolve, reject) => {
      api.Send(
        {
          message,
          sender,
          receptor: phoneNumber,
        },
        (response, status) => {
          if (status === 200) {
            console.log('SMS sent successfully:', response)
            resolve({ success: true, response })
          } else {
            console.error('SMS sending failed:', response)
            reject(new Error('Failed to send SMS'))
          }
        }
      )
    })
  } catch (error) {
    console.error('Error sending SMS:', error)
    throw error
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
    const transporter = createTransporter()

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'ویلف ویتا'}" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'بازنشانی رمز عبور - پنل ادمین ویلف ویتا',
      html: `
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
      `,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Reset password email sent: %s', info.messageId)
    return { success: true, messageId: info.messageId }
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
    const transporter = createTransporter()

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'ویلف ویتا'}" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: 'کد تایید ایمیل - ویلف ویتا',
      html: `
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
      `,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Verification email sent: %s', info.messageId)
    return { success: true, messageId: info.messageId }
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
  try {
    const settings = await Settings.findOne({ singletonKey: 'main_settings' })
      .select('+notificationSettings.smsUsername +notificationSettings.smsPassword +notificationSettings.smsApiKey')

    const { smsUsername, smsPassword, smsSenderNumber } = settings?.notificationSettings || {}

    if (!smsUsername || !smsPassword) {
      console.log('[SMS] نام کاربری یا رمز عبور پنل ملی‌پیامک تنظیم نشده است. پیامک ارسال نمی‌شود.')
      return { success: false, message: 'تنظیمات پیامک ناقص است' }
    }

    console.log(`[SMS] در حال ارسال پیامک به ${mobile} از طریق ملی‌پیامک...`)

    // Melipayamak REST API (روش استاندارد با username/password)
    const payload = {
      username: smsUsername,
      password: smsPassword,
      to: mobile,
      from: smsSenderNumber || smsUsername, // اگر شماره فرستنده تنظیم نشده، از username استفاده می‌شود
      text: `کد تایید شما: ${code}\nویلف ویتا\nلغو11`,
      isflash: false
    }

    console.log('[SMS] ارسال به:', payload.to, 'از:', payload.from)

    // استفاده از REST API ملی‌پیامک
    const response = await axios.post(
      'https://rest.payamak-panel.com/api/SendSMS/SendSMS',
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    )

    console.log('[SMS] پاسخ سرور:', response.data)

    // بررسی وضعیت پاسخ
    // RetStatus کدهای مختلفی دارد:
    // 1 = موفق
    // 35 = اطلاعات نامعتبر
    // و غیره...
    if (response.data.RetStatus === 1) {
      console.log('[SMS] ✅ پیامک با موفقیت ارسال شد')
      return { success: true, data: response.data }
    } else {
      console.error('[SMS] ❌ خطا در ارسال:', response.data.StrRetStatus)
      return { success: false, message: response.data.StrRetStatus, data: response.data }
    }

  } catch (error) {
    console.error('[SMS] ❌ خطا در ارسال پیامک:', error.response?.data || error.message)
    return { success: false, message: error.message }
  }
}
