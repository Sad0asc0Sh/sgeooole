const Settings = require('../models/Settings')

// دریافت تنظیمات (سند تک‌مثالی). در صورت عدم وجود، ایجاد می‌شود.
// دریافت تنظیمات عمومی (بدون نیاز به احراز هویت)
exports.getPublicSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne({ singletonKey: 'main_settings' }).lean()

    if (!settings) {
      return res.json({
        success: true,
        data: {
          storeName: 'فروشگاه من',
          paymentConfig: { activeGateway: 'zarinpal' }
        }
      })
    }

    // فقط فیلدهای عمومی را برمی‌گردانیم
    const publicData = {
      storeName: settings.storeName,
      storeEmail: settings.storeEmail,
      storePhone: settings.storePhone,
      storeAddress: settings.storeAddress,
      paymentConfig: {
        activeGateway: settings.paymentConfig?.activeGateway || 'zarinpal',
        // می‌توانیم وضعیت فعال بودن درگاه‌ها را هم بفرستیم تا فرانت تصمیم بگیرد
        zarinpal: { isActive: settings.paymentConfig?.zarinpal?.isActive || false },
        sadad: { isActive: settings.paymentConfig?.sadad?.isActive || false },
      },
      cartSettings: {
        cartTTLHours: settings.cartSettings?.cartTTLHours || 1,
        expiryWarningEnabled: settings.cartSettings?.expiryWarningEnabled || false,
        expiryWarningMinutes: settings.cartSettings?.expiryWarningMinutes || 30,
      },
      searchSettings: {
        trackingEnabled: settings.searchSettings?.trackingEnabled !== false,
        trendingEnabled: settings.searchSettings?.trendingEnabled || false,
        trendingLimit: settings.searchSettings?.trendingLimit || 8,
        trendingPeriodDays: settings.searchSettings?.trendingPeriodDays || 30,
      },
      popularCategoriesSettings: {
        trackingEnabled: settings.popularCategoriesSettings?.trackingEnabled !== false,
        displayEnabled: settings.popularCategoriesSettings?.displayEnabled || false,
        displayLimit: settings.popularCategoriesSettings?.displayLimit || 8,
        useFallback: settings.popularCategoriesSettings?.useFallback !== false,
      },
      socialLinks: {
        telegram: settings.socialLinks?.telegram || '',
        instagram: settings.socialLinks?.instagram || '',
        aparat: settings.socialLinks?.aparat || '',
      }
    }

    res.json({
      success: true,
      settings: publicData,
    })
  } catch (error) {
    console.error('Error fetching public settings:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت تنظیمات عمومی',
    })
  }
}

// دریافت تنظیمات (سند تک‌مثالی). در صورت عدم وجود، ایجاد می‌شود.
exports.getSettings = async (req, res) => {
  try {
    // Select sensitive fields to check if they exist
    let settings = await Settings.findOne({ singletonKey: 'main_settings' })
      .select('+aiConfig.apiKey +paymentGatewayKeys.apiKey +paymentGatewayKeys.apiSecret +notificationSettings.smsUsername +notificationSettings.smsPassword +notificationSettings.smsApiKey +kycSettings.apiKey +kycSettings.clientId +paymentConfig.zarinpal.merchantId +paymentConfig.sadad.merchantId +paymentConfig.sadad.terminalId +paymentConfig.sadad.terminalKey')

    if (!settings) {
      settings = await Settings.create({})
    }

    // Convert to object to modify response without affecting DB document
    const settingsObj = settings.toObject();

    // Mask sensitive keys if they exist
    if (settingsObj.aiConfig?.apiKey) settingsObj.aiConfig.apiKey = '****';
    if (settingsObj.paymentGatewayKeys?.apiKey) settingsObj.paymentGatewayKeys.apiKey = '****';
    if (settingsObj.paymentGatewayKeys?.apiSecret) settingsObj.paymentGatewayKeys.apiSecret = '****';
    if (settingsObj.notificationSettings?.smsUsername) settingsObj.notificationSettings.smsUsername = '****';
    if (settingsObj.notificationSettings?.smsPassword) settingsObj.notificationSettings.smsPassword = '****';
    if (settingsObj.notificationSettings?.smsApiKey) settingsObj.notificationSettings.smsApiKey = '****';
    if (settingsObj.kycSettings?.apiKey) settingsObj.kycSettings.apiKey = '****';
    if (settingsObj.kycSettings?.clientId) settingsObj.kycSettings.clientId = '****';

    // Mask payment gateway credentials
    if (settingsObj.paymentConfig?.zarinpal?.merchantId) settingsObj.paymentConfig.zarinpal.merchantId = '****';
    if (settingsObj.paymentConfig?.sadad?.merchantId) settingsObj.paymentConfig.sadad.merchantId = '****';
    if (settingsObj.paymentConfig?.sadad?.terminalId) settingsObj.paymentConfig.sadad.terminalId = '****';
    if (settingsObj.paymentConfig?.sadad?.terminalKey) settingsObj.paymentConfig.sadad.terminalKey = '****';

    res.json({
      success: true,
      data: settingsObj,
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت تنظیمات سایت',
      error: error.message,
    })
  }
}

// به‌روزرسانی تنظیمات (سند تک‌مثالی)
exports.updateSettings = async (req, res) => {
  try {
    const updates = { ...req.body }

    // جلوگیری از تغییر singletonKey از سمت کلاینت
    if ('singletonKey' in updates) {
      delete updates.singletonKey
    }

    // Fetch existing settings to merge nested objects safely
    let settings = await Settings.findOne({ singletonKey: 'main_settings' })
    if (!settings) {
      settings = new Settings({ singletonKey: 'main_settings' })
    }

    // Merge logic
    // For simple fields
    if (updates.storeName) settings.storeName = updates.storeName
    if (updates.storeEmail) settings.storeEmail = updates.storeEmail
    if (updates.storePhone) settings.storePhone = updates.storePhone
    if (updates.storeAddress) settings.storeAddress = updates.storeAddress

    // For nested objects (Social Links)
    if (updates.socialLinks) {
      if (!settings.socialLinks) settings.socialLinks = {}
      if (updates.socialLinks.telegram !== undefined) settings.socialLinks.telegram = updates.socialLinks.telegram
      if (updates.socialLinks.instagram !== undefined) settings.socialLinks.instagram = updates.socialLinks.instagram
      if (updates.socialLinks.aparat !== undefined) settings.socialLinks.aparat = updates.socialLinks.aparat
    }

    // For nested objects (Cart Settings)
    if (updates.cartSettings) {
      settings.cartSettings = { ...settings.cartSettings.toObject(), ...updates.cartSettings }
    }

    // For nested objects (Notification Settings)
    if (updates.notificationSettings) {
      // We need to be careful not to overwrite hidden fields like smsApiKey if they are not in the update
      // But since we didn't fetch smsApiKey, we can't merge it from 'settings'.
      // Best approach is to update fields individually or use Mongoose's set() if possible, 
      // but here we will just update what we know.

      const ns = updates.notificationSettings
      if (ns.emailFrom) settings.notificationSettings.emailFrom = ns.emailFrom
      if (ns.smsSenderNumber) settings.notificationSettings.smsSenderNumber = ns.smsSenderNumber

      // Only update credentials if provided and not masked
      if (ns.smsUsername && ns.smsUsername !== '****') {
        settings.notificationSettings.smsUsername = ns.smsUsername
      }
      if (ns.smsPassword && ns.smsPassword !== '****') {
        settings.notificationSettings.smsPassword = ns.smsPassword
      }
      if (ns.smsApiKey && ns.smsApiKey !== '****') {
        settings.notificationSettings.smsApiKey = ns.smsApiKey
      }
    }

    // For nested objects (Payment Gateway Keys)
    if (updates.paymentGatewayKeys) {
      // Only update keys if provided (non-empty)
      const keys = updates.paymentGatewayKeys
      if (keys.apiKey) settings.paymentGatewayKeys.apiKey = keys.apiKey
      if (keys.apiSecret) settings.paymentGatewayKeys.apiSecret = keys.apiSecret
    }

    // For nested objects (KYC Settings)
    if (updates.kycSettings) {
      const kyc = updates.kycSettings
      if (kyc.provider) settings.kycSettings.provider = kyc.provider
      if (kyc.isActive !== undefined) settings.kycSettings.isActive = kyc.isActive
      // Only update secrets if provided and not empty/masked
      if (kyc.apiKey && kyc.apiKey !== '****') settings.kycSettings.apiKey = kyc.apiKey
      if (kyc.clientId && kyc.clientId !== '****') settings.kycSettings.clientId = kyc.clientId
    }

    // For nested objects (AI Config)
    if (updates.aiConfig) {
      const ai = updates.aiConfig
      if (ai.enabled !== undefined) settings.aiConfig.enabled = ai.enabled
      if (ai.baseUrl) settings.aiConfig.baseUrl = ai.baseUrl
      if (ai.model) settings.aiConfig.model = ai.model
      if (ai.maxDailyMessages !== undefined) settings.aiConfig.maxDailyMessages = ai.maxDailyMessages
      if (ai.userDailyLimit !== undefined) settings.aiConfig.userDailyLimit = ai.userDailyLimit
      if (ai.maxTokens !== undefined) settings.aiConfig.maxTokens = ai.maxTokens
      if (ai.temperature !== undefined) settings.aiConfig.temperature = ai.temperature
      if (ai.customSystemPrompt !== undefined) settings.aiConfig.customSystemPrompt = ai.customSystemPrompt
      // Only update apiKey if provided and not masked
      if (ai.apiKey && ai.apiKey !== '****') settings.aiConfig.apiKey = ai.apiKey
    }

    // For nested objects (Payment Config - Multi-Gateway)
    if (updates.paymentConfig) {
      const payment = updates.paymentConfig

      // Update active gateway
      if (payment.activeGateway) {
        settings.paymentConfig.activeGateway = payment.activeGateway
      }

      // Update ZarinPal config
      if (payment.zarinpal) {
        const zarinpal = payment.zarinpal
        if (zarinpal.merchantId && zarinpal.merchantId !== '****') {
          settings.paymentConfig.zarinpal.merchantId = zarinpal.merchantId
        }
        if (zarinpal.isSandbox !== undefined) {
          settings.paymentConfig.zarinpal.isSandbox = zarinpal.isSandbox
        }
        if (zarinpal.isActive !== undefined) {
          settings.paymentConfig.zarinpal.isActive = zarinpal.isActive
        }
      }

      // Update Sadad config
      if (payment.sadad) {
        const sadad = payment.sadad
        if (sadad.merchantId && sadad.merchantId !== '****') {
          settings.paymentConfig.sadad.merchantId = sadad.merchantId
        }
        if (sadad.terminalId && sadad.terminalId !== '****') {
          settings.paymentConfig.sadad.terminalId = sadad.terminalId
        }
        if (sadad.terminalKey && sadad.terminalKey !== '****') {
          settings.paymentConfig.sadad.terminalKey = sadad.terminalKey
        }
        if (sadad.isSandbox !== undefined) {
          settings.paymentConfig.sadad.isSandbox = sadad.isSandbox
        }
        if (sadad.isActive !== undefined) {
          settings.paymentConfig.sadad.isActive = sadad.isActive
        }
      }
    }

    // For nested objects (Search Settings)
    if (updates.searchSettings) {
      settings.searchSettings = { ...settings.searchSettings.toObject(), ...updates.searchSettings }
    }

    // For nested objects (Popular Categories Settings)
    if (updates.popularCategoriesSettings) {
      settings.popularCategoriesSettings = {
        ...settings.popularCategoriesSettings?.toObject?.() || {},
        ...updates.popularCategoriesSettings
      }
    }

    await settings.save()

    res.json({
      success: true,
      message: 'تنظیمات سایت با موفقیت به‌روزرسانی شد',
      data: settings,
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    res.status(500).json({
      success: false,
      message: 'خطا در به‌روزرسانی تنظیمات سایت',
      error: error.message,
    })
  }
}
