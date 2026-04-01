const axios = require('axios');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const Settings = require('../models/Settings');

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
      this.smsConfig = {
        pathToken: (settings.notificationSettings && settings.notificationSettings.smsApiKey) || 'f95527ef2fa7498dbad9a0d09f2bbad2',
        enabled: !!(settings.notificationSettings && (settings.notificationSettings.smsApiKey || settings.notificationSettings.smsUsername))
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

  async sendOtpSMS(phoneNumber) {
    if (!this.smsConfig) {
      await this.initialize();
    }

    if (!this.smsConfig.enabled) {
      const err = new Error('سرویس پیامک فعال نیست');
      err.code = 'SMS_NOT_CONFIGURED';
      throw err;
    }

    try {
      const response = await axios.post(
        `https://console.melipayamak.com/api/send/otp/${this.smsConfig.pathToken}`,
        { to: phoneNumber },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      if (response.data && response.data.code) {
        return {
          success: true,
          code: response.data.code,
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

async function sendOtpSMS(phoneNumber) {
  return service.sendOtpSMS(phoneNumber);
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
