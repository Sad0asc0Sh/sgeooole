const Settings = require('../models/Settings')
const zarinpal = require('./payment/zarinpal')
const sadad = require('./payment/sadad')

/**
 * Payment Service Factory
 * Dynamically selects and executes the appropriate payment gateway strategy
 */

// Available payment strategies
const strategies = {
  zarinpal,
  sadad,
}

/**
 * دریافت تنظیمات درگاه پرداخت فعال از دیتابیس
 * @returns {Object} { gateway, config, isActive }
 */
async function getActiveGatewayConfig() {
  try {
    // دریافت تنظیمات با فیلدهای select: false
    const settings = await Settings.findOne({ singletonKey: 'main_settings' })
      .select('+paymentConfig.zarinpal.merchantId +paymentConfig.sadad.merchantId +paymentConfig.sadad.terminalId +paymentConfig.sadad.terminalKey')
      .lean()

    if (!settings || !settings.paymentConfig) {
      throw new Error('تنظیمات درگاه پرداخت یافت نشد')
    }

    const paymentConfig = settings.paymentConfig
    const activeGateway = paymentConfig.activeGateway || 'zarinpal'

    // دریافت تنظیمات درگاه فعال
    const gatewayConfig = paymentConfig[activeGateway]

    if (!gatewayConfig) {
      throw new Error(`تنظیمات درگاه ${activeGateway} یافت نشد`)
    }

    // بررسی فعال بودن درگاه
    if (!gatewayConfig.isActive) {
      throw new Error(`درگاه ${activeGateway} غیرفعال است. لطفاً در تنظیمات آن را فعال کنید.`)
    }

    return {
      gateway: activeGateway,
      config: gatewayConfig,
      isActive: gatewayConfig.isActive,
    }
  } catch (error) {
    console.error('خطا در دریافت تنظیمات درگاه پرداخت:', error)
    throw error
  }
}

/**
 * درخواست پرداخت
 * به صورت خودکار درگاه فعال را انتخاب و درخواست پرداخت را ارسال می‌کند
 * @param {Object} params - پارامترهای پرداخت
 * @param {Number} params.amount - مبلغ به تومان
 * @param {String} params.callbackUrl - آدرس بازگشت بعد از پرداخت
 * @param {String} params.description - توضیحات تراکنش
 * @param {String} params.email - ایمیل کاربر (اختیاری)
 * @param {String} params.mobile - شماره موبایل کاربر (اختیاری)
 * @param {String} params.orderId - شماره سفارش (برای Sadad الزامی)
 * @returns {Object} { success, url, authority/token, gateway }
 */
exports.requestPayment = async (params) => {
  try {
    // دریافت درگاه فعال و تنظیمات آن
    // اگر gatewayName در پارامترها باشد، از آن استفاده می‌کنیم، در غیر این صورت از درگاه پیش‌فرض
    const { gatewayName } = params

    let gateway, config, isActive

    if (gatewayName) {
      // اگر نام درگاه مشخص شده باشد، وضعیت آن را چک می‌کنیم
      const settings = await Settings.findOne({ singletonKey: 'main_settings' })
        .select('+paymentConfig.zarinpal.merchantId +paymentConfig.sadad.merchantId +paymentConfig.sadad.terminalId +paymentConfig.sadad.terminalKey')
        .lean()

      if (!settings || !settings.paymentConfig) {
        throw new Error('تنظیمات درگاه پرداخت یافت نشد')
      }

      const gatewayConfig = settings.paymentConfig[gatewayName]
      if (!gatewayConfig) {
        throw new Error(`تنظیمات درگاه ${gatewayName} یافت نشد`)
      }

      if (!gatewayConfig.isActive) {
        throw new Error(`درگاه ${gatewayName} غیرفعال است`)
      }

      gateway = gatewayName
      config = gatewayConfig
      isActive = gatewayConfig.isActive
    } else {
      // استفاده از درگاه پیش‌فرض
      const defaultGateway = await getActiveGatewayConfig()
      gateway = defaultGateway.gateway
      config = defaultGateway.config
      isActive = defaultGateway.isActive
    }

    // انتخاب استراتژی مناسب
    const strategy = strategies[gateway]

    if (!strategy) {
      throw new Error(`درگاه ${gateway} پیاده‌سازی نشده است`)
    }

    console.log(`📝 Using payment gateway: ${gateway}`)

    // فراخوانی متد requestPayment استراتژی انتخاب شده
    const result = await strategy.requestPayment({
      ...params,
      config,
    })

    // اضافه کردن اطلاعات درگاه به نتیجه
    return {
      ...result,
      gateway,
    }
  } catch (error) {
    console.error('❌ خطا در درخواست پرداخت:', error.message)
    throw error
  }
}

/**
 * تایید پرداخت
 * بر اساس درگاه استفاده شده، تایید را انجام می‌دهد
 * @param {Object} params - پارامترهای تایید
 * @param {String} params.gateway - نام درگاه استفاده شده ('zarinpal' | 'sadad')
 * @param {Number} params.amount - مبلغ به تومان
 * @param {String} params.authority - کد Authority (برای ZarinPal)
 * @param {String} params.token - توکن (برای Sadad)
 * @param {String} params.orderId - شماره سفارش (برای Sadad)
 * @returns {Object} { success, refId, ... }
 */
exports.verifyPayment = async (params) => {
  try {
    const { gateway } = params

    if (!gateway) {
      throw new Error('نام درگاه پرداخت مشخص نشده است')
    }

    // دریافت تنظیمات درگاه مورد نظر
    const settings = await Settings.findOne({ singletonKey: 'main_settings' })
      .select('+paymentConfig.zarinpal.merchantId +paymentConfig.sadad.merchantId +paymentConfig.sadad.terminalId +paymentConfig.sadad.terminalKey')
      .lean()

    if (!settings || !settings.paymentConfig) {
      throw new Error('تنظیمات درگاه پرداخت یافت نشد')
    }

    const config = settings.paymentConfig[gateway]

    if (!config) {
      throw new Error(`تنظیمات درگاه ${gateway} یافت نشد`)
    }

    // انتخاب استراتژی مناسب
    const strategy = strategies[gateway]

    if (!strategy) {
      throw new Error(`درگاه ${gateway} پیاده‌سازی نشده است`)
    }

    console.log(`🔍 Verifying payment with gateway: ${gateway}`)

    // فراخوانی متد verifyPayment استراتژی انتخاب شده
    const result = await strategy.verifyPayment({
      ...params,
      config,
    })

    return result
  } catch (error) {
    console.error('❌ خطا در تایید پرداخت:', error.message)
    throw error
  }
}

/**
 * دریافت لیست درگاه‌های موجود
 * @returns {Array} لیست درگاه‌های پشتیبانی شده
 */
exports.getAvailableGateways = () => {
  return Object.keys(strategies)
}

/**
 * بررسی فعال بودن یک درگاه خاص
 * @param {String} gatewayName - نام درگاه
 * @returns {Boolean} وضعیت فعال/غیرفعال
 */
exports.isGatewayActive = async (gatewayName) => {
  try {
    const settings = await Settings.findOne({ singletonKey: 'main_settings' }).lean()

    if (!settings || !settings.paymentConfig) {
      return false
    }

    const gatewayConfig = settings.paymentConfig[gatewayName]
    return gatewayConfig ? gatewayConfig.isActive : false
  } catch (error) {
    console.error('خطا در بررسی وضعیت درگاه:', error)
    return false
  }
}
