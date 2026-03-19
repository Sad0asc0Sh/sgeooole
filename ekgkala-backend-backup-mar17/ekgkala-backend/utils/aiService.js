const axios = require('axios');
const Settings = require('../models/Settings');

/**
 * AI Service for EkgKala Chat Assistant
 * Handles communication with OpenRouter/OpenAI compatible APIs
 * Prioritizes database configuration over .env settings
 */

/**
 * Get AI configuration from database with .env fallback
 * @returns {Promise<object>} - AI configuration object
 */
async function getAIConfig() {
  try {
    // Fetch settings from database
    const settings = await Settings.findOne({ singletonKey: 'main_settings' })
      .select('+aiConfig.apiKey'); // Explicitly include the apiKey field

    if (settings && settings.aiConfig && settings.aiConfig.enabled) {
      // Use database configuration
      const config = {
        enabled: true,
        apiKey: settings.aiConfig.apiKey || process.env.AI_API_KEY,
        baseUrl: settings.aiConfig.baseUrl || process.env.AI_BASE_URL,
        model: settings.aiConfig.model || process.env.AI_MODEL,
        maxTokens: settings.aiConfig.maxTokens || 500,
        temperature: settings.aiConfig.temperature || 0.7,
        maxDailyMessages: settings.aiConfig.maxDailyMessages || 1000,
        customSystemPrompt: settings.aiConfig.customSystemPrompt || '',
        usage: settings.aiConfig.usage || {},
        settingsId: settings._id
      };
      return config;
    }
  } catch (error) {
    console.warn('[AI Service] Could not fetch DB config, using .env:', error.message);
  }

  // Fallback to .env configuration
  return {
    enabled: true, // Assume enabled if using .env
    apiKey: process.env.AI_API_KEY,
    baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
    model: process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct',
    maxTokens: 500,
    temperature: 0.7,
    maxDailyMessages: null, // No limit for .env mode
    customSystemPrompt: '',
    usage: {},
    settingsId: null
  };
}

/**
 * Check and update daily message usage
 * @param {string} settingsId - Settings document ID
 * @param {object} usage - Current usage object
 * @param {number} maxDailyMessages - Maximum daily messages allowed
 * @returns {Promise<boolean>} - True if message is allowed, false if limit exceeded
 */
async function checkAndUpdateUsage(settingsId, usage, maxDailyMessages) {
  if (!settingsId || !maxDailyMessages) {
    return true; // No limit if using .env
  }

  try {
    const now = new Date();
    const lastReset = new Date(usage.lastResetDate || now);

    // Reset counter if it's a new day
    const isNewDay = now.toDateString() !== lastReset.toDateString();

    if (isNewDay) {
      // Reset daily counter
      await Settings.updateOne(
        { _id: settingsId },
        {
          $set: {
            'aiConfig.usage.dailyMessageCount': 1,
            'aiConfig.usage.lastResetDate': now
          },
          $inc: { 'aiConfig.usage.totalMessages': 1 }
        }
      );
      return true;
    }

    // Check if limit exceeded
    const currentCount = usage.dailyMessageCount || 0;
    if (currentCount >= maxDailyMessages) {
      console.warn('[AI Service] Daily message limit exceeded:', currentCount, '/', maxDailyMessages);
      return false;
    }

    // Increment counters
    await Settings.updateOne(
      { _id: settingsId },
      {
        $inc: {
          'aiConfig.usage.dailyMessageCount': 1,
          'aiConfig.usage.totalMessages': 1
        }
      }
    );

    return true;
  } catch (error) {
    console.error('[AI Service] Error updating usage:', error);
    return true; // Allow message on error to avoid blocking service
  }
}

/**
 * Generate AI response with context awareness
 * @param {string} userMessage - The user's question/message
 * @param {object} contextData - Context information (products, orders, etc.)
 * @returns {Promise<string>} - AI generated response
 */
exports.generateResponse = async (userMessage, contextData = {}) => {
  const { products = [], orders = [], generalInfo = '' } = contextData;

  // Get AI configuration from database (with .env fallback)
  const config = await getAIConfig();

  // Check if AI is enabled
  if (!config.enabled) {
    console.warn('[AI Service] AI is disabled in settings. Returning fallback response.');
    return getFallbackResponse(userMessage, contextData);
  }

  // Check if API key is configured
  if (!config.apiKey || config.apiKey === 'your-openrouter-api-key-here') {
    console.warn('[AI Service] API Key not configured. Returning fallback response.');
    return getFallbackResponse(userMessage, contextData);
  }

  // Check daily message limit
  const usageAllowed = await checkAndUpdateUsage(
    config.settingsId,
    config.usage,
    config.maxDailyMessages
  );

  if (!usageAllowed) {
    console.warn('[AI Service] Daily message limit exceeded');
    return 'متأسفانه به حد مجاز پیام‌های روزانه رسیده‌ایم. لطفاً فردا دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.';
  }

  // Build context string
  let contextString = '';

  if (products.length > 0) {
    contextString += '\n**محصولات مرتبط:**\n';
    products.forEach((product, index) => {
      contextString += `${index + 1}. ${product.name}\n`;
      contextString += `   - قیمت: ${product.price?.toLocaleString('fa-IR')} تومان\n`;
      contextString += `   - موجودی: ${product.stock > 0 ? 'موجود' : 'ناموجود'}\n`;
      if (product.discount) {
        contextString += `   - تخفیف: ${product.discount}%\n`;
      }
      if (product.description) {
        contextString += `   - توضیحات: ${product.description.substring(0, 100)}...\n`;
      }
      contextString += '\n';
    });
  }

  if (orders.length > 0) {
    contextString += '\n**سفارشات کاربر:**\n';
    orders.forEach((order, index) => {
      contextString += `${index + 1}. سفارش #${order.orderNumber || order._id}\n`;
      contextString += `   - وضعیت: ${getOrderStatusPersian(order.status)}\n`;
      contextString += `   - مبلغ کل: ${order.totalAmount?.toLocaleString('fa-IR')} تومان\n`;
      contextString += `   - تاریخ: ${new Date(order.createdAt).toLocaleDateString('fa-IR')}\n`;
      if (order.trackingCode) {
        contextString += `   - کد پیگیری: ${order.trackingCode}\n`;
      }
      contextString += '\n';
    });
  }

  if (generalInfo) {
    contextString += `\n**اطلاعات اضافی:**\n${generalInfo}\n`;
  }

  // System prompt - Define AI persona
  // Use custom prompt if provided, otherwise use default
  const defaultSystemPrompt = `
شما "دستیار هوشمند ای‌کا‌جی کالا" هستید، یک فروشنده و مشاور خرید حرفه‌ای برای فروشگاه الکترونیک ای‌کا‌جی کالا.

**قوانین پاسخ‌دهی:**
1. **زبان:** تمام پاسخ‌ها باید به فارسی و با لحنی دوستانه و حرفه‌ای باشد
2. **دقت:** فقط بر اساس اطلاعات Context پاسخ دهید. اگر اطلاعاتی در Context نیست، صادقانه بگویید که "اطلاعات دقیقی در دسترس نیست"
3. **مختصر و مفید:** پاسخ‌ها کوتاه (حداکثر 3-4 جمله) و مستقیم باشند
4. **فروش هوشمند:** در صورت امکان، محصولات مرتبط را پیشنهاد دهید
5. **راهنمایی:** اگر کاربر سوالی درباره نحوه خرید یا پیگیری دارد، قدم به قدم راهنمایی کنید

**اطلاعات موجود در Context:**
${contextString || 'هیچ اطلاعات خاصی در دسترس نیست.'}

**توجه مهم:**
- اگر کاربر درخواست محصولی کرد که در Context نیست، بگویید "این محصول در حال حاضر یافت نشد، اما می‌توانید در سایت جستجو کنید"
- برای سوالات عمومی (سلام، خداحافظ)، به صورت دوستانه پاسخ دهید
- اگر سوال مربوط به پشتیبانی فنی یا شکایت است، کاربر را به بخش پشتیبانی هدایت کنید
`;

  const systemPrompt = config.customSystemPrompt
    ? `${config.customSystemPrompt}\n\n**اطلاعات موجود در Context:**\n${contextString || 'هیچ اطلاعات خاصی در دسترس نیست.'}`
    : defaultSystemPrompt;

  try {
    console.log('[AI Service] Generating response for:', userMessage.substring(0, 50) + '...');
    console.log('[AI Service] Using model:', config.model);
    console.log('[AI Service] Config source:', config.settingsId ? 'Database' : '.env');

    const response = await axios.post(
      `${config.baseUrl}/chat/completions`,
      {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.API_URL || 'http://localhost:5000',
          'X-Title': 'EkgKala Chat Assistant'
        },
        timeout: 30000 // 30 seconds timeout
      }
    );

    const aiReply = response.data.choices[0].message.content;
    console.log('[AI Service] Response generated successfully');

    return aiReply;

  } catch (error) {
    console.error('[AI Service] Error:', error.response?.data || error.message);

    // If API fails, return intelligent fallback
    return getFallbackResponse(userMessage, contextData);
  }
};

/**
 * Get fallback response when AI API is not available
 * @param {string} userMessage
 * @param {object} contextData
 * @returns {string}
 */
function getFallbackResponse(userMessage, contextData) {
  const { products = [], orders = [] } = contextData;

  // Simple keyword-based responses
  const msg = userMessage.toLowerCase();

  // Greeting
  if (msg.includes('سلام') || msg.includes('درود') || msg.includes('hello')) {
    return 'سلام! 👋 من دستیار هوشمند ای‌کا‌جی کالا هستم. چطور می‌توانم کمکتان کنم؟';
  }

  // Products found
  if (products.length > 0) {
    let response = `${products.length} محصول مرتبط با جستجوی شما پیدا شد:\n\n`;
    products.slice(0, 3).forEach((product, index) => {
      response += `${index + 1}. ${product.name} - ${product.price?.toLocaleString('fa-IR')} تومان\n`;
    });
    response += '\nبرای مشاهده جزئیات بیشتر، روی محصولات کلیک کنید.';
    return response;
  }

  // Orders found
  if (orders.length > 0) {
    const lastOrder = orders[0];
    return `آخرین سفارش شما:\n• وضعیت: ${getOrderStatusPersian(lastOrder.status)}\n• مبلغ: ${lastOrder.totalAmount?.toLocaleString('fa-IR')} تومان\n\nبرای جزئیات بیشتر به بخش "سفارشات من" مراجعه کنید.`;
  }

  // Price inquiry
  if (msg.includes('قیمت') || msg.includes('چنده') || msg.includes('چقدر')) {
    return 'لطفاً نام محصول مورد نظرتان را بگویید تا قیمت دقیق را برایتان بیابم.';
  }

  // Order tracking
  if (msg.includes('سفارش') || msg.includes('پیگیری') || msg.includes('تحویل')) {
    return 'برای پیگیری سفارش، لطفاً وارد حساب کاربری خود شوید و به بخش "سفارشات من" بروید.';
  }

  // Stock inquiry
  if (msg.includes('موجود') || msg.includes('موجودی') || msg.includes('دارید')) {
    return 'لطفاً نام محصول را مشخص کنید تا موجودی آن را بررسی کنم.';
  }

  // Discount/offer
  if (msg.includes('تخفیف') || msg.includes('پیشنهاد') || msg.includes('ارزان')) {
    return 'برای مشاهده محصولات تخفیف‌دار، به بخش "پیشنهادات ویژه" سر بزنید! 🎁';
  }

  // Thank you
  if (msg.includes('ممنون') || msg.includes('متشکر') || msg.includes('مرسی')) {
    return 'خواهش می‌کنم! 😊 همیشه در خدمت شما هستم.';
  }

  // Goodbye
  if (msg.includes('خداحافظ') || msg.includes('بای') || msg.includes('bye')) {
    return 'خداحافظ! موفق و پیروز باشید. 👋';
  }

  // Default response
  return 'متوجه سوال شما نشدم. می‌توانید درباره محصولات، قیمت‌ها، موجودی یا سفارشاتتان بپرسید.';
}

/**
 * Convert order status to Persian
 * @param {string} status
 * @returns {string}
 */
function getOrderStatusPersian(status) {
  const statusMap = {
    'pending': 'در انتظار پرداخت',
    'paid': 'پرداخت شده',
    'processing': 'در حال پردازش',
    'shipped': 'ارسال شده',
    'delivered': 'تحویل داده شده',
    'cancelled': 'لغو شده',
    'refunded': 'بازگشت وجه',
    'failed': 'ناموفق'
  };
  return statusMap[status] || status;
}

/**
 * Extract search keywords from user message
 * @param {string} message
 * @returns {string}
 */
exports.extractSearchKeywords = (message) => {
  // Remove common Persian stop words
  const stopWords = ['برای', 'یک', 'من', 'این', 'از', 'به', 'در', 'با', 'که', 'را', 'و', 'می', 'است', 'بر', 'تا', 'کن', 'چه'];

  let keywords = message
    .toLowerCase()
    .replace(/[؟!،.]/g, ' ')
    .split(' ')
    .filter(word => word.length > 2 && !stopWords.includes(word))
    .join(' ');

  return keywords;
};
