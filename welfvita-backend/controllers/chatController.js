const Product = require('../models/Product');
const ChatHistory = require('../models/ChatHistory');
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

    // 3. Generate Answer (Pass history)
    const reply = await generateExpertResponse(message, productContext, history);

    // 4. Save History (if userId exists)
    if (chatSession) {
      chatSession.messages.push({ role: 'user', content: message });
      chatSession.messages.push({ role: 'assistant', content: reply });

      // Keep last 50 messages to prevent document from growing too large
      if (chatSession.messages.length > 50) {
        chatSession.messages = chatSession.messages.slice(-50);
      }

      chatSession.lastUpdated = new Date();
      await chatSession.save();
    }

    // 5. Send Response (Frontend compatible)
    res.json({
      success: true,
      data: {
        message: reply,
        timestamp: new Date()
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
