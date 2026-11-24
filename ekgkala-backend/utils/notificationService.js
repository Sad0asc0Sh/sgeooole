const axios = require('axios');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const Settings = require('../models/Settings');

// System-wide SMS Circuit Breaker history (timestamps array)
const globalSmsTracker = []

function checkGlobalSmsCircuitBreaker() {
  const now = Date.now()
  const tenMinutesAgo = now - 10 * 60 * 1000
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

  // Filter valid timestamps
  const recent10Min = globalSmsTracker.filter(ts => ts > tenMinutesAgo)
  const recent24Hours = globalSmsTracker.filter(ts => ts > twentyFourHoursAgo)

  // Max SMS per 10 minutes across ENTIRE site (configurable via env)
  const max10Min = Math.max(1, Number(process.env.SMS_MAX_PER_10_MIN) || 60)
  if (recent10Min.length >= max10Min) {
    return { allowed: false, reason: 'global_10m_limit', count: recent10Min.length }
  }

  // Max SMS per 24 hours across ENTIRE site (configurable via env)
  const max24Hours = Math.max(1, Number(process.env.SMS_MAX_PER_24_HOURS) || 500)
  if (recent24Hours.length >= max24Hours) {
    return { allowed: false, reason: 'global_24h_limit', count: recent24Hours.length }
  }

  return { allowed: true }
}

function recordGlobalSms() {
  globalSmsTracker.push(Date.now())
  // Clean up entries older than 24 hours
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000
  while (globalSmsTracker.length > 0 && globalSmsTracker[0] < twentyFourHoursAgo) {
    globalSmsTracker.shift()
  }
}

class NotificationService {
  constructor() {
    this.emailProvider = null;
    this.smsConfig = null;
  }

  async initialize() {
    try {
      // 🔥 اضافه کردن select برای فیلدهای مخفی
      const settings = await Settings.findOne().select(
        '+notificationSettings.smsApiKey +notificationSettings.smsUsername +notificationSettings.smsPassword'
      );
      
      if (!settings) {
        throw new Error('تنظیمات سیستم یافت نشد');
      }

      // Email config
      if (settings.emailProvider === 'resend') {
        this.emailProvider = {
          type: 'resend',
          client: new Resend(settings.resendApiKey),
          from: settings.emailFrom
        };
      } else if (settings.emailProvider === 'smtp') {
        this.emailProvider = {
          type: 'smtp',
          client: nodemailer.createTransport({
            host: settings.smtpHost,
            port: settings.smtpPort,
            secure: settings.smtpSecure,
            auth: {
              user: settings.smtpUser,
              pass: settings.smtpPassword
            }
          }),
          from: settings.emailFrom
        };
      }

      // SMS config - کنسول جدید ملی پیامک (fail closed without hardcoded fallback)
      const bodyIdVal = Number(settings?.notificationSettings?.smsPatternId || process.env.MELIPAYAMAK_OTP_BODY_ID || process.env.MELIPAYAMAK_PATTERN_OTP || 434916);
      const pathToken = String(settings?.notificationSettings?.smsApiKey || process.env.MELIPAYAMAK_API_KEY || '').trim();
      this.smsConfig = {
        pathToken,
        bodyId: isNaN(bodyIdVal) ? 434916 : bodyIdVal,
        enabled: Boolean(pathToken)
      };

    } catch (error) {
      console.error('خطا در بارگذاری تنظیمات:', error);
      throw error;
    }
  }

  invalidateConfigCache() {
    this.smsConfig = null;
    this.emailProvider = null;
    this.resendClient = null;
    this.emailTransporter = null;
  }

  async sendEmail(to, subject, html) {
    if (!this.emailProvider) {
      await this.initialize();
    }

    try {
      if (this.emailProvider.type === 'resend') {
        const { data, error } = await this.emailProvider.client.emails.send({
          from: this.emailProvider.from,
          to: [to],
          subject: subject,
          html: html
        });

        if (error) {
          throw new Error(`خطا در ارسال ایمیل: ${error.message}`);
        }

        return { success: true, messageId: data.id };
      } else if (this.emailProvider.type === 'smtp') {
        const info = await this.emailProvider.client.sendMail({
          from: this.emailProvider.from,
          to: to,
          subject: subject,
          html: html
        });

        return { success: true, messageId: info.messageId };
      }
    } catch (error) {
      console.error('خطا در ارسال ایمیل:', error);
      throw error;
    }
  }

  async sendOtpSMS(phoneNumber, code) {
    if (process.env.OTP_SMS_DISABLED === 'true') {
      console.warn(`[EMERGENCY SMS TOGGLE] OTP_SMS_DISABLED=true. Suppressing SMS send to ${phoneNumber}`);
      return {
        success: true,
        recId: 'EMERGENCY_DISABLED_TRAP',
        status: 'SUPPRESSED',
        provider: 'emergency-toggle',
      };
    }

    if (!this.smsConfig) {
      await this.initialize();
    }

    if (!this.smsConfig?.enabled || !this.smsConfig?.pathToken) {
      throw new Error('تنظیمات کلید API پیامک (MELIPAYAMAK_API_KEY) پیکربندی نشده است');
    }

    // 🔒 Layer 0 Firewall: Global System SMS Circuit Breaker
    const globalCheck = checkGlobalSmsCircuitBreaker();
    if (!globalCheck.allowed) {
      console.warn(`[SMS CIRCUIT BREAKER TRIPPED] System limit reached (${globalCheck.reason}, count=${globalCheck.count}). Suppressing Melipayamak API call to ${phoneNumber}.`);
      return {
        success: true,
        recId: 'CIRCUIT_BREAKER_TRAP',
        status: 'SUPPRESSED',
        provider: 'circuit-breaker'
      };
    }

    try {
      const bodyId = this.smsConfig.bodyId || 434916;
      const response = await axios.post(
        `https://console.melipayamak.com/api/send/shared/${this.smsConfig.pathToken}`,
        { bodyId: bodyId, to: phoneNumber, args: [String(code)] },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      if (response.data && response.data.recId) {
        recordGlobalSms();
        return {
          success: true,
          recId: response.data.recId,
          status: response.data.status,
          provider: 'melipayamak-console'
        };
      }

      throw new Error(response.data?.status || 'پاسخ نامعتبر از سرویس پیامک');
    } catch (error) {
      // لاگ دقیق خطا
      console.error('[SMS] API Error:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });

      const err = new Error(
        error.response?.data?.message || 
        error.message || 
        'خطا در ارتباط با سرویس پیامک'
      );
      err.code = 'SMS_PROVIDER_ERROR';
      throw err;
    }
  }

  async getSmsSettings() {
    try {
      // 🔥 اضافه کردن select برای فیلدهای مخفی
      const settings = await Settings.findOne().select(
        '+notificationSettings.smsApiKey +notificationSettings.smsUsername +notificationSettings.smsPassword'
      );
      
      if (!settings || !settings.notificationSettings) {
        return { configured: false };
      }

      const ns = settings.notificationSettings;
      return {
        configured: !!(ns.smsApiKey || ns.smsUsername),
        hasApiKey: !!ns.smsApiKey,
        hasCredentials: !!(ns.smsUsername && ns.smsPassword)
      };
    } catch (error) {
      console.error('خطا در بررسی تنظیمات SMS:', error);
      return { configured: false };
    }
  }
}

const service = new NotificationService();

const escapeHtmlValue = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

async function sendVerificationEmail(email, tokenOrCode) {
  const raw = String(tokenOrCode ?? '').trim();
  const isOtpCode = /^\d{4,8}$/.test(raw);
  const safeValue = escapeHtmlValue(raw);
  const verificationUrl = `${process.env.FRONTEND_URL || ''}/verify-email?token=${encodeURIComponent(raw)}`;
  const html = isOtpCode
    ? `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif;">
      <h2>تأیید ایمیل</h2>
      <p>کد تأیید شما:</p>
      <div style="display: inline-block; padding: 12px 24px; background-color: #f3f4f6; font-size: 24px; font-weight: bold; letter-spacing: 6px; border-radius: 8px;">
        ${safeValue}
      </div>
      <p>این کد تا ۲ دقیقه معتبر است.</p>
    </div>
  `
    : `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif;">
      <h2>تأیید ایمیل</h2>
      <p>برای تأیید ایمیل خود روی لینک زیر کلیک کنید:</p>
      <a href="${escapeHtmlValue(verificationUrl)}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
        تأیید ایمیل
      </a>
      <p>این لینک تا 24 ساعت معتبر است.</p>
    </div>
  `;

  return service.sendEmail(email, 'تأیید ایمیل', html);
}

async function sendResetPasswordEmail(email, name, resetUrl) {
  if (typeof resetUrl !== 'string' || !/^https?:\/\//i.test(resetUrl.trim())) {
    throw new Error('آدرس بازنشانی رمز عبور نامعتبر است');
  }
  const safeName = escapeHtmlValue(name || 'کاربر گرامی');
  const safeUrl = escapeHtmlValue(resetUrl.trim());
  const html = `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; line-height: 1.8;">
      <h2>بازنشانی رمز عبور</h2>
      <p>سلام ${safeName}،</p>
      <p>درخواست بازنشانی رمز عبور برای حساب شما ثبت شده است. برای تعیین رمز جدید روی دکمه زیر کلیک کنید:</p>
      <a href="${safeUrl}" style="display: inline-block; padding: 10px 20px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px;">
        تغییر رمز عبور
      </a>
      <p>این لینک به مدت محدود معتبر است. در صورتی که این درخواست توسط شما ثبت نشده، این ایمیل را نادیده بگیرید.</p>
    </div>
  `;

  return service.sendEmail(email, 'بازنشانی رمز عبور - EkgKala', html);
}

async function sendOtpSMS(phoneNumber, code) {
  return service.sendOtpSMS(phoneNumber, code);
}

async function getSmsSettings() {
  return service.getSmsSettings();
}

function invalidateConfigCache() {
  service.invalidateConfigCache();
}

module.exports = {
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendOtpSMS,
  getSmsSettings,
  invalidateConfigCache,
  service
};
