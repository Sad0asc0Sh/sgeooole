const axios = require('axios')
const { isValidNationalCode } = require('../utils/validators')
const Settings = require('../models/Settings')

/**
 * سرویس استعلام از ثبت احوال
 * تنظیمات از دیتابیس (مدل Settings) خوانده می‌شود.
 */
class SabtAhvalService {

    /**
     * دریافت تنظیمات فعال
     */
    async getConfig() {
        const settings = await Settings.findOne({ singletonKey: 'main_settings' })
            .select('+kycSettings.apiKey +kycSettings.clientId')
            .lean()

        const kyc = settings?.kycSettings || {}
        return {
            provider: kyc.provider || 'mock',
            apiKey: kyc.apiKey || process.env.KYC_API_KEY,
            clientId: kyc.clientId || process.env.FINNOTECH_CLIENT_ID,
            isActive: kyc.isActive !== false
        }
    }

    /**
     * استعلام هویت فرد
     * @param {string} nationalCode - کد ملی
     * @param {Date} birthDate - تاریخ تولد
     * @returns {Promise<{isValid: boolean, message: string, data?: any}>}
     */
    async inquiryIdentity(nationalCode, birthDate) {
        const config = await this.getConfig()

        console.log(`[SABT-AHVAL] Inquiry (${config.provider}): NationalCode=${nationalCode}, BirthDate=${birthDate}`)

        // 1. بررسی اولیه الگوریتمی
        if (!isValidNationalCode(nationalCode)) {
            return {
                isValid: false,
                message: 'کد ملی وارد شده نامعتبر است (خطای ساختاری)',
            }
        }

        // اگر سرویس غیرفعال شده باشد
        if (!config.isActive) {
            // تصمیم با شماست: آیا در صورت غیرفعال بودن، همه را تایید کنیم یا رد؟
            // معمولاً اگر احراز هویت اجباری است، باید رد کنیم یا به حالت Mock برگردیم.
            // اینجا فرض می‌کنیم به حالت Mock برمی‌گردد برای جلوگیری از قفل شدن سیستم.
            console.warn('[SABT-AHVAL] Service is disabled in settings, falling back to Mock.')
            return this.mockInquiry(nationalCode, birthDate)
        }

        // 2. انتخاب روش استعلام
        if (config.provider === 'finnotech') {
            return this.callFinnotech(nationalCode, birthDate, config)
        } else if (config.provider === 'jibit') {
            return this.callJibit(nationalCode, birthDate, config)
        } else {
            return this.mockInquiry(nationalCode, birthDate)
        }
    }

    /**
     * شبیه‌سازی استعلام
     */
    async mockInquiry(nationalCode, birthDate) {
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // برای تست: کدهای ملی که با 000 شروع می‌شوند را رد کن
        if (nationalCode.startsWith('000000000')) {
            return { isValid: false, message: 'کد ملی در سامانه ثبت احوال یافت نشد (تست)' }
        }

        return { isValid: true, message: 'هویت کاربر تایید شد (حالت تستی)' }
    }

    /**
     * استعلام واقعی از فینوتک
     * مستندات: https://devbeta.finnotech.ir/
     */
    async callFinnotech(nationalCode, birthDate, config) {
        try {
            if (!config.apiKey || !config.clientId) {
                return { isValid: false, message: 'تنظیمات فینوتک (API Key / Client ID) کامل نیست' }
            }

            // تبدیل تاریخ تولد به فرمت مورد نیاز سرویس (مثلاً YYYYMMDD شمسی یا میلادی)
            // نکته: اکثر سرویس‌ها تاریخ شمسی می‌گیرند. اینجا فرض بر تبدیل است.
            const birthDateStr = new Date(birthDate).toISOString().split('T')[0].replace(/-/g, '') // Example: 20230101

            // این یک نمونه فراخوانی است و باید طبق مستندات دقیق فینوتک تنظیم شود
            const response = await axios.get(
                `https://api.finnotech.ir/oak/v2/clients/${config.clientId}/nidVerification`,
                {
                    params: {
                        nid: nationalCode,
                        birthDate: birthDateStr,
                    },
                    headers: {
                        Authorization: `Bearer ${config.apiKey}`,
                    },
                }
            )

            if (response.data.status === 'DONE' && response.data.result.isValid) {
                return { isValid: true, message: 'هویت کاربر تایید شد' }
            } else {
                return { isValid: false, message: 'اطلاعات هویتی مطابقت ندارد' }
            }
        } catch (error) {
            console.error('[SABT-AHVAL] Finnotech Error:', error.message)
            // در صورت خطای سرویس، برای اینکه کاربر مسدود نشود، چه تصمیمی می‌گیرید؟
            // معمولاً باید خطا برگرداند.
            return { isValid: false, message: 'خطا در ارتباط با سرویس ثبت احوال' }
        }
    }

    /**
     * استعلام واقعی از جیبیت
     */
    async callJibit(nationalCode, birthDate, config) {
        // پیاده‌سازی مشابه برای جیبیت
        return { isValid: false, message: 'سرویس جیبیت هنوز پیکربندی نشده است' }
    }
}

module.exports = new SabtAhvalService()
