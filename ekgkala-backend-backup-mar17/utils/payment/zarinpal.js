const axios = require('axios')
const logger = require('../logger')

/**
 * ZarinPal Payment Strategy
 * Implements payment request and verification for ZarinPal gateway
 */

const isProduction = process.env.NODE_ENV === 'production'

/**
 * درخواست پرداخت به درگاه زرین‌پال
 * @param {Object} params - پارامترهای پرداخت
 * @param {Number} params.amount - مبلغ به تومان
 * @param {String} params.callbackUrl - آدرس بازگشت بعد از پرداخت
 * @param {String} params.description - توضیحات تراکنش
 * @param {String} params.email - ایمیل کاربر (اختیاری)
 * @param {String} params.mobile - شماره موبایل کاربر (اختیاری)
 * @param {Object} params.config - تنظیمات درگاه (merchantId, isSandbox)
 * @returns {Object} { url, authority }
 */
exports.requestPayment = async ({ amount, callbackUrl, description, email, mobile, config }) => {
  try {
    const { merchantId, isSandbox } = config

    // بررسی وجود Merchant ID
    if (!merchantId) {
      throw new Error('تنظیمات درگاه زرین‌پال ناقص است. Merchant ID وارد نشده است.')
    }

    // تعیین URL بر اساس حالت Sandbox یا Production
    const baseUrl = isSandbox
      ? 'https://sandbox.zarinpal.com/pg/v4/payment'
      : 'https://api.zarinpal.com/pg/v4/payment'

    const startPayUrl = isSandbox
      ? 'https://sandbox.zarinpal.com/pg/StartPay/'
      : 'https://www.zarinpal.com/pg/StartPay/'

    // تبدیل تومان به ریال (ZarinPal V4 معمولاً ریال می‌پذیرد)
    const amountInRials = amount * 10

    // ارسال درخواست به زرین‌پال
    const requestData = {
      merchant_id: merchantId,
      amount: amountInRials,
      callback_url: callbackUrl,
      description: description || 'پرداخت سفارش',
      metadata: {
        email: email || '',
        mobile: mobile || '',
      },
    }

    // SECURITY: Only log non-sensitive data
    logger.payment('ZarinPal payment request initiated', {
      amount: amountInRials,
      sandbox: isSandbox,
    })

    const response = await axios.post(`${baseUrl}/request.json`, requestData, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15 seconds timeout
    })

    const { data } = response.data

    // بررسی کد وضعیت (100 = موفق)
    if (data.code === 100) {
      logger.payment('ZarinPal payment request successful', {
        authority: data.authority.substring(0, 8) + '***',
      })

      return {
        success: true,
        url: `${startPayUrl}${data.authority}`,
        authority: data.authority,
        gateway: 'zarinpal',
      }
    } else {
      const errorMsg = `خطای درگاه زرین‌پال: کد ${data.code}`
      logger.error(errorMsg)
      throw new Error(errorMsg)
    }
  } catch (error) {
    logger.error('خطا در درخواست پرداخت زرین‌پال', { error: error.message })

    if (error.response) {
      logger.error('ZarinPal API error response', {
        status: error.response.status,
        // Don't log full response body - may contain sensitive data
      })
      throw new Error(`خطای درگاه زرین‌پال: ${error.response.data.errors || error.message}`)
    }

    throw error
  }
}

/**
 * تایید پرداخت از درگاه زرین‌پال
 * @param {Object} params - پارامترهای تایید
 * @param {Number} params.amount - مبلغ به تومان (باید با مبلغ اولیه یکسان باشد)
 * @param {String} params.authority - کد Authority دریافتی از مرحله request
 * @param {Object} params.config - تنظیمات درگاه (merchantId, isSandbox)
 * @returns {Object} { success, refId, cardPan, cardHash, feeType, fee }
 */
exports.verifyPayment = async ({ amount, authority, config }) => {
  try {
    const { merchantId, isSandbox } = config

    // تعیین URL بر اساس حالت Sandbox یا Production
    const baseUrl = isSandbox
      ? 'https://sandbox.zarinpal.com/pg/v4/payment'
      : 'https://api.zarinpal.com/pg/v4/payment'

    // تبدیل تومان به ریال
    const amountInRials = amount * 10

    const verifyData = {
      merchant_id: merchantId,
      amount: amountInRials,
      authority: authority,
    }

    // SECURITY: Only log non-sensitive verification data
    logger.payment('ZarinPal verify request', {
      amount: amountInRials,
      authority: authority.substring(0, 8) + '***',
    })

    const response = await axios.post(`${baseUrl}/verify.json`, verifyData, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    })

    const { data } = response.data

    // کدهای موفقیت: 100 = تراکنش موفق، 101 = تراکنش قبلاً تایید شده
    if (data.code === 100 || data.code === 101) {
      logger.payment('ZarinPal verification successful', {
        refId: data.ref_id,
        // SECURITY: Card info not logged
      })

      return {
        success: true,
        refId: data.ref_id,
        cardPan: data.card_pan || null,
        cardHash: data.card_hash || null,
        feeType: data.fee_type || null,
        fee: data.fee || null,
      }
    } else {
      logger.warn('ZarinPal verification failed', { code: data.code })
      return {
        success: false,
        code: data.code,
        message: getErrorMessage(data.code),
      }
    }
  } catch (error) {
    logger.error('خطا در تایید پرداخت زرین‌پال', { error: error.message })

    if (error.response) {
      logger.error('ZarinPal verify API error', { status: error.response.status })
    }

    return {
      success: false,
      message: error.message,
    }
  }
}

/**
 * دریافت پیام خطا بر اساس کد وضعیت زرین‌پال
 * @param {Number} code - کد خطا
 * @returns {String} پیام خطا
 */
function getErrorMessage(code) {
  const errors = {
    '-9': 'خطای اعتبارسنجی',
    '-10': 'ای پی و يا مرچنت كد پذيرنده صحيح نيست',
    '-11': 'مرچنت کد فعال نیست',
    '-12': 'تلاش بیش از حد در یک بازه زمانی کوتاه',
    '-15': 'ترمینال شما به حالت تعلیق در آمده',
    '-16': 'سطح تایید پذیرنده پایین تر از سطح نقره ای است',
    '-30': 'اجازه دسترسی به تسویه اشتراکی شناور ندارید',
    '-31': 'حساب بانکی تسویه را به پنل اضافه کنید',
    '-32': 'Wages is not valid',
    '-33': 'درصد کارمزد واریز شده باید بین 1 تا 100 باشد',
    '-34': 'مبلغ از کل مبلغ کمتر است',
    '-40': 'Invalid extra params',
    '-50': 'مبلغ پرداخت شده با مقدار مبلغ ارسالی در متد وریفای متفاوت است',
    '-51': 'پرداخت ناموفق',
    '-52': 'خطای غیر منتظره',
    '-53': 'اتوریتی برای این مرچنت کد نیست',
    '-54': 'اتوریتی نامعتبر است',
    100: 'پرداخت با موفقیت انجام شد',
    101: 'تراکنش قبلاً تایید شده است',
  }

  return errors[code] || `خطای ناشناخته: کد ${code}`
}
