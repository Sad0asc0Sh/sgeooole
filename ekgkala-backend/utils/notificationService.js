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

  // Max 20 SMS per 10 minutes across ENTIRE site
  if (recent10Min.length >= 20) {
    return { allowed: false, reason: 'global_10m_limit', count: recent10Min.length }
  }

  // Max 150 SMS per 24 hours across ENTIRE site
  if (recent24Hours.length >= 150) {
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

      // SMS config - کنسول جدید ملی پیامک
      const bodyIdVal = Number(settings?.notificationSettings?.smsPatternId || process.env.MELIPAYAMAK_OTP_BODY_ID || process.env.MELIPAYAMAK_PATTERN_OTP || 434916);
      this.smsConfig = {
        pathToken: (settings?.notificationSettings?.smsApiKey) || process.env.MELIPAYAMAK_API_KEY || 'f95527ef2fa7498dbad9a0d09f2bbad2',
        bodyId: isNaN(bodyIdVal) ? 434916 : bodyIdVal,
        enabled: true
      };

    } catch (error) {
      console.error('خطا در بارگذاری تنظیمات:', error);
      throw error;
    }
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
    if (!this.smsConfig) {
      await this.initialize();
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

async function sendVerificationEmail(email, token) {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  const html = `
    <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif;">
      <h2>تأیید ایمیل</h2>
      <p>برای تأیید ایمیل خود روی لینک زیر کلیک کنید:</p>
      <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
        تأیید ایمیل
      </a>
      <p>این لینک تا 24 ساعت معتبر است.</p>
    </div>
  `;

  return service.sendEmail(email, 'تأیید ایمیل', html);
}

async function sendOtpSMS(phoneNumber, code) {
  return service.sendOtpSMS(phoneNumber, code);
}

async function getSmsSettings() {
  return service.getSmsSettings();
}

module.exports = {
  sendVerificationEmail,
  sendOtpSMS,
  getSmsSettings,
  service
};
