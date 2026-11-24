const axios = require('axios')
const crypto = require('crypto')

/**
 * Sadad (Melli) Payment Strategy
 * Implements payment request and verification for Sadad gateway
 * API Documentation: https://sadad.shaparak.ir/vpg/api/v0
 */

/**
 * تولید امضای دیجیتال برای Sadad
 * @param {String} terminalId - شناسه ترمینال
 * @param {String} orderId - شماره سفارش
 * @param {Number} amount - مبلغ به ریال
 * @param {String} terminalKey - کلید ترمینال
 * @returns {String} امضای دیجیتال
 */
function generateSignData(terminalId, orderId, amount, terminalKey) {
  // ترکیب داده‌ها برای امضا
  const data = `${terminalId};${orderId};${amount}`

  // رمزنگاری با SHA256 و کلید ترمینال
  const hash = crypto
    .createHmac('sha256', terminalKey)
    .update(data)
    .digest('base64')

  return hash
}

/**
 * درخواست پرداخت به درگاه سداد
 * @param {Object} params - پارامترهای پرداخت
 * @param {Number} params.amount - مبلغ به تومان
 * @param {String} params.callbackUrl - آدرس بازگشت بعد از پرداخت
 * @param {String} params.description - توضیحات تراکنش
 * @param {String} params.orderId - شماره سفارش یکتا
 * @param {Object} params.config - تنظیمات درگاه (merchantId, terminalId, terminalKey, isSandbox)
 * @returns {Object} { url, token }
 */
exports.requestPayment = async ({ amount, callbackUrl, description, orderId, config }) => {
  try {
    const { merchantId, terminalId, terminalKey, isSandbox } = config

    // بررسی وجود تنظیمات الزامی
    if (!merchantId || !terminalId || !terminalKey) {
      throw new Error('تنظیمات درگاه سداد ناقص است. لطفاً اطلاعات کامل را وارد کنید.')
    }

    // تعیین URL بر اساس حالت Sandbox یا Production
    const baseUrl = isSandbox
      ? 'https://sadad.shaparak.ir/VPG/api/v0' // Sandbox URL (اگر موجود باشد)
      : 'https://sadad.shaparak.ir/VPG/api/v0'

    // تبدیل تومان به ریال
    const amountInRials = Math.round(Number(amount) * 10)
    if (!Number.isFinite(amountInRials) || amountInRials < 1000) {
      throw new Error('مبلغ تراکنش باید حداقل ۱۰۰ تومان (۱۰۰۰ ریال) باشد.')
    }

    // تولید امضای دیجیتال
    const signData = generateSignData(terminalId, orderId, amountInRials, terminalKey)

    // ارسال درخواست به سداد
    const requestData = {
      TerminalId: terminalId,
      MerchantId: merchantId,
      Amount: amountInRials,
      SignData: signData,
      ReturnUrl: callbackUrl,
      LocalDateTime: new Date().toISOString(),
      OrderId: orderId,
      AdditionalData: description || 'پرداخت سفارش',
    }

    console.log('🔵 Sadad Request:', {
      url: `${baseUrl}/Request/PaymentRequest`,
      merchantId: merchantId.substring(0, 4) + '***',
      terminalId: terminalId.substring(0, 4) + '***',
      amount: amountInRials,
      orderId,
    })

    const response = await axios.post(`${baseUrl}/Request/PaymentRequest`, requestData, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15 seconds timeout
    })

    console.log('🟢 Sadad Response:', response.data)

    // بررسی وضعیت پاسخ
    if (response.data.ResCode === 0) {
      const token = response.data.Token

      return {
        success: true,
        url: `https://sadad.shaparak.ir/VPG/Purchase?Token=${token}`,
        token: token,
        gateway: 'sadad',
        orderId: orderId,
      }
    } else {
      throw new Error(`خطای درگاه سداد: ${getSadadErrorMessage(response.data.ResCode)}`)
    }
  } catch (error) {
    console.error('❌ خطا در درخواست پرداخت سداد:', error.message)

    if (error.response) {
      console.error('Response data:', error.response.data)
      throw new Error(`خطای درگاه سداد: ${error.response.data.Description || error.message}`)
    }

    throw error
  }
}

/**
 * تایید پرداخت از درگاه سداد
 * @param {Object} params - پارامترهای تایید
 * @param {String} params.token - توکن دریافتی از مرحله request
 * @param {String} params.orderId - شماره سفارش
 * @param {Object} params.config - تنظیمات درگاه (terminalId, terminalKey)
 * @returns {Object} { success, refId, traceNumber, rrn }
 */
exports.verifyPayment = async ({ token, orderId, amount, config }) => {
  try {
    if (!token || typeof token !== 'string') {
      return {
        success: false,
        message: 'توکن تایید پرداخت سداد نامعتبر است',
      }
    }

    const { terminalId, terminalKey, isSandbox } = config

    // تعیین URL بر اساس حالت Sandbox یا Production
    const baseUrl = isSandbox
      ? 'https://sadad.shaparak.ir/VPG/api/v0'
      : 'https://sadad.shaparak.ir/VPG/api/v0'

    // تولید امضای دیجیتال برای تایید
    const signData = crypto
      .createHmac('sha256', terminalKey)
      .update(token)
      .digest('base64')

    const verifyData = {
      Token: token,
      SignData: signData,
    }

    console.log('🔵 Sadad Verify Request:', {
      url: `${baseUrl}/Advice/Verify`,
      token: token.substring(0, 10) + '***',
      orderId,
    })

    const response = await axios.post(`${baseUrl}/Advice/Verify`, verifyData, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    })

    console.log('🟢 Sadad Verify Response:', {
      ResCode: response.data?.ResCode,
      OrderId: response.data?.OrderId,
      SystemTraceNo: response.data?.SystemTraceNo,
    })

    // بررسی وضعیت پاسخ
    if (Number(response.data?.ResCode) === 0) {
      if (
        amount !== undefined &&
        amount !== null &&
        response.data?.Amount !== undefined &&
        response.data?.Amount !== null
      ) {
        const expectedAmountInRials = Math.round(Number(amount) * 10)
        if (Number(response.data.Amount) !== expectedAmountInRials) {
          return {
            success: false,
            message: 'مبلغ تراکنش با مبلغ سفارش مطابقت ندارد',
          }
        }
      }

      if (
        orderId !== undefined &&
        orderId !== null &&
        response.data?.OrderId !== undefined &&
        response.data?.OrderId !== null &&
        String(response.data.OrderId) !== String(orderId)
      ) {
        return {
          success: false,
          message: 'شناسه سفارش با تراکنش مطابقت ندارد',
        }
      }

      return {
        success: true,
        refId: response.data.SystemTraceNo || response.data.RetrivalRefNo,
        traceNumber: response.data.SystemTraceNo,
        rrn: response.data.RetrivalRefNo,
        orderId: response.data.OrderId,
      }
    } else {
      return {
        success: false,
        code: response.data?.ResCode,
        message: getSadadErrorMessage(response.data?.ResCode),
      }
    }
  } catch (error) {
    console.error('❌ خطا در تایید پرداخت سداد:', error.message)

    if (error.response) {
      console.error('Response data:', error.response.data)
    }

    return {
      success: false,
      message: error.message,
    }
  }
}

/**
 * دریافت پیام خطا بر اساس کد وضعیت سداد
 * @param {Number} code - کد خطا
 * @returns {String} پیام خطا
 */
function getSadadErrorMessage(code) {
  const errors = {
    0: 'تراکنش با موفقیت انجام شد',
    3: 'پذیرنده کارت فعال نیست',
    23: 'مبلغ تراکنش نامعتبر است',
    58: 'انجام تراکنش مجاز نمی‌باشد',
    61: 'مبلغ تراکنش بیش از حد مجاز است',
    1000: 'ترتیب پارامترهای ارسالی اشتباه می‌باشد',
    1001: 'لطفا مجدد تلاش نمایید',
    1002: 'مبلغ بیش از سقف مجاز می‌باشد',
    1003: 'شماره ترمینال ارسالی اشتباه است',
    1004: 'شماره پذیرنده ارسالی اشتباه است',
    1005: 'خطا در پردازش',
    1006: 'خطا در پردازش',
    1007: 'آدرس بازگشت اشتباه است',
    1008: 'تاریخ ارسالی اشتباه است',
    1009: 'خطا در ایجاد توکن',
    1010: 'امضا نامعتبر است',
    1011: 'شماره سفارش تکراری است',
    1012: 'اطلاعات ارسال شده مربوط به ادوات سازمانی نمی‌باشد',
    1015: 'پاسخ خطای نامشخص از بانک',
    1016: 'سقف مجاز استفاده از رمز ایستا',
    1017: 'کاربر از انجام تراکنش منصرف شده است',
    1018: 'تاریخ و زمان سرور نامعتبر است',
    1019: 'امکان انجام درخواست برای این تراکنش وجود ندارد',
    1020: 'پذیرنده غیر فعال شده است',
    1023: 'اطلاعات پرداخت یافت نشد',
    1024: 'امکان ارسال درخواست برای این تراکنش وجود ندارد',
    1025: 'امضای دیجیتال تاییدیه معتبر نیست',
  }

  return errors[code] || `خطای ناشناخته: کد ${code}`
}
