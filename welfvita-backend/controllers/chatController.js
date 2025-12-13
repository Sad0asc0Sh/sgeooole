const Product = require('../models/Product');
const ChatHistory = require('../models/ChatHistory');
const Settings = require('../models/Settings');
const { generateExpertResponse } = require('../utils/groqService');

/**
 * Handle incoming chat message
 * POST /api/chat
 */
exports.handleMessage = async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'پیام نمی‌تواند خالی باشد' });
    }

    // 1. Fetch History (if userId exists)
    let history = [];
    let chatSession = null;

    if (userId) {
      chatSession = await ChatHistory.findOne({ userId });
      if (!chatSession) {
        chatSession = new ChatHistory({ userId, messages: [] });
      }

      // --- Rate Limiting Logic ---
      const settings = await Settings.findOne({ singletonKey: 'main_settings' });
      const userLimit = settings?.aiConfig?.userDailyLimit || 20;

      // Check for daily reset
      const now = new Date();
      const lastReset = chatSession.usage?.lastReset ? new Date(chatSession.usage.lastReset) : new Date(0);

      // Reset if it's a different day (simple check)
      if (now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        chatSession.usage = { dailyCount: 0, lastReset: now };
      }

      if (chatSession.usage.dailyCount >= userLimit) {
        return res.status(429).json({
          success: false,
          message: `شما به سقف مجاز ${userLimit} پیام در روز رسیده‌اید. لطفاً فردا مجدداً تلاش کنید.`
        });
      }
      // ---------------------------

      // Pass plain objects to service
      history = chatSession.messages.map(m => ({ role: m.role, content: m.content }));
    }

    // 2. Find Context (Smart Search)
    // Extract keywords > 3 chars to filter noise
    const keywords = message.split(" ").filter(w => w.length > 3);

    let productContext = "";

    if (keywords.length > 0) {
      // Find top 5 relevant products
      const products = await Product.find({
        $or: keywords.map(k => ({
          $or: [
            { name: { $regex: k, $options: 'i' } },
            { description: { $regex: k, $options: 'i' } }
          ]
        })),
        isActive: true
      }).select('name price stock description').limit(5);

      // Format for AI
      if (products.length > 0) {
        productContext = products.map(p =>
          `- مدل: ${p.name}\n  قیمت: ${p.price.toLocaleString()} تومان\n  وضعیت: ${p.stock > 0 ? 'موجود' : 'ناموجود'}\n  توضیح: ${p.description ? p.description.substring(0, 100) : ''}...`
        ).join("\n----------------\n");
      }
    }

    // 2.5 Load store info context - Static data from frontend pages
    let storeInfoContext = "";
    try {
      // Also fetch store settings for additional contact info
      const storeSettings = await Settings.findOne({ singletonKey: 'main_settings' })
        .select('storeName storeEmail storePhone storeAddress socialLinks').lean();

      // Build store info context
      const storeInfoParts = [];

      // ===== ABOUT US PAGE CONTENT (Static from frontend) =====
      storeInfoParts.push(`📄 درباره ما:
شرکت Welfvita (گروه مهندسی کیان سابق) از سال ۱۳۹۶ در شهر مشهد فعالیت خود را در زمینه ارائه و نصب سیستم‌های دوربین مداربسته و حفاظتی-امنیتی آغاز نموده است.
تخصص ما: دوربین مداربسته، دزدگیر و خانه هوشمند
این مجموعه دارای سه شعبه فعال در سراسر کلان‌شهر مشهد می‌باشد.
نمایندگی‌های رسمی: Dahua (با گارانتی ماد طلایی)، Sailgis، Suzuki، Vekra & Mover (جک‌های پارکینگی)، HSB (ریموت‌های کنترل تردد)
خدمات: فروش، نصب، و تعمیرات تخصصی انواع سیستم‌های حفاظتی و امنیتی`);

      // ===== CONTACT US PAGE CONTENT (Static from frontend) =====
      storeInfoParts.push(`\n📞 اطلاعات تماس و شعب:

🏢 شعبه ۱:
   آدرس: بلوار پیروزی نبش پیروزی ۷۸ (کنار املاک) پلاک 78
   تلفن: 05135021720

🏢 شعبه ۲:
   آدرس: میدان صاحب الزمان پاساژ سبحان طبقه +۱ واحد ۱۶
   تلفن: 05137136355 و 05137136356

🏢 شعبه ۳:
   آدرس: خین عرب طرح چی6 - پ63
   تلفن: 09154191788

⏰ ساعات کاری:
   شنبه تا چهارشنبه: ۹ صبح - ۹ شب
   پنج‌شنبه: ۹ صبح - ۲ عصر

📱 واتساپ: 09154191788`);

      // Add additional settings if available
      if (storeSettings) {
        if (storeSettings.storeEmail) storeInfoParts.push(`\n📧 ایمیل: ${storeSettings.storeEmail}`);
        if (storeSettings.socialLinks) {
          if (storeSettings.socialLinks.telegram) storeInfoParts.push(`📨 تلگرام: ${storeSettings.socialLinks.telegram}`);
          if (storeSettings.socialLinks.instagram) storeInfoParts.push(`📸 اینستاگرام: ${storeSettings.socialLinks.instagram}`);
        }
      }

      storeInfoContext = storeInfoParts.join('\n');
    } catch (pageError) {
      console.warn('[Chat] Could not load store info:', pageError.message);
    }

    // 3. Generate Answer (Pass history and store info)
    const reply = await generateExpertResponse(message, productContext, history, storeInfoContext);

    // 4. Save History (if userId exists)
    if (chatSession) {
      chatSession.messages.push({ role: 'user', content: message });
      chatSession.messages.push({ role: 'assistant', content: reply });

      // Keep last 50 messages to prevent document from growing too large
      if (chatSession.messages.length > 50) {
        chatSession.messages = chatSession.messages.slice(-50);
      }

      chatSession.lastUpdated = new Date();

      // Increment usage
      if (!chatSession.usage) chatSession.usage = { dailyCount: 0, lastReset: new Date() };
      chatSession.usage.dailyCount += 1;

      await chatSession.save();
    }

    // 5. Send Response (Frontend compatible)
    let usageInfo = null;
    if (chatSession && chatSession.usage) {
      const settings = await Settings.findOne({ singletonKey: 'main_settings' });
      const userLimit = settings?.aiConfig?.userDailyLimit || 20;
      usageInfo = {
        current: chatSession.usage.dailyCount,
        limit: userLimit,
        remaining: Math.max(0, userLimit - chatSession.usage.dailyCount)
      };
    }

    res.json({
      success: true,
      data: {
        message: reply,
        timestamp: new Date(),
        usage: usageInfo
      }
    });

  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({
      success: false,
      message: 'خطایی در پردازش پیام شما رخ داد.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get chat suggestions
 * GET /api/chat/suggestions
 */
exports.getSuggestions = async (req, res) => {
  try {
    const suggestions = [
      {
        text: 'محصولات تخفیف‌دار',
        icon: '🏷️',
        category: 'discount'
      },
      {
        text: 'گوشی موبایل دارید؟',
        icon: '📱',
        category: 'product'
      },
      {
        text: 'سفارش من کجاست؟',
        icon: '📦',
        category: 'order'
      },
      {
        text: 'محصولات پرفروش',
        icon: '⭐',
        category: 'product'
      },
      {
        text: 'لپ‌تاپ ارزان قیمت',
        icon: '💻',
        category: 'product'
      }
    ];

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('[Chat] Error getting suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت پیشنهادات'
    });
  }
};

/**
 * Clear chat history (optional)
 * DELETE /api/chat/history/:userId
 */
exports.clearHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'شناسه کاربر الزامی است'
      });
    }

    // Security check: User can only clear their own history
    if (req.user && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'شما مجاز به پاک کردن تاریخچه این کاربر نیستید'
      });
    }

    // Find and clear only the messages array, keep the usage stats
    const chatSession = await ChatHistory.findOne({ userId });

    if (chatSession) {
      chatSession.messages = [];
      chatSession.lastUpdated = new Date();
      await chatSession.save();
    }

    res.json({
      success: true,
      message: 'تاریخچه گفتگو پاک شد'
    });
  } catch (error) {
    console.error('[Chat] Error clearing history:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در پاک کردن تاریخچه'
    });
  }
};
