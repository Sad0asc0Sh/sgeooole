const Product = require('../models/Product');
const ChatHistory = require('../models/ChatHistory');
const Settings = require('../models/Settings');
const {
  generateExpertResponse,
  streamExpertResponse,
  AIServiceError,
} = require('../utils/groqService');

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_STORED_MESSAGES = 50;
const MAX_SEARCH_TERMS = 6;
const activeConversations = new Map();

function getLocalDayStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRequestId(req) {
  const raw = req.body?.requestId || req.headers['x-chat-request-id'];
  if (typeof raw === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(raw)) return raw;
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getIdentity(req) {
  const rawSessionId = req.headers['x-session-id'] || req.body?.sessionId || null;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const normalizedSessionId = typeof sessionId === 'string' ? sessionId.trim() : null;
  const userId = req.user?._id || null;

  if (userId) {
    return {
      key: `user:${userId.toString()}`,
      query: { userId },
      type: 'user',
    };
  }

  if (normalizedSessionId && /^[A-Za-z0-9_-]{8,160}$/.test(normalizedSessionId)) {
    return {
      key: `guest:${normalizedSessionId}`,
      query: { sessionId: normalizedSessionId },
      type: 'guest',
    };
  }

  return null;
}

function acquireConversation(identityKey, requestId) {
  const active = activeConversations.get(identityKey);
  if (active) return false;

  const watchdog = setTimeout(() => {
    const current = activeConversations.get(identityKey);
    if (current?.requestId === requestId) activeConversations.delete(identityKey);
  }, 130000);
  watchdog.unref?.();

  activeConversations.set(identityKey, { requestId, watchdog, startedAt: Date.now() });
  return true;
}

function releaseConversation(identityKey, requestId) {
  const current = activeConversations.get(identityKey);
  if (current?.requestId !== requestId) return;
  clearTimeout(current.watchdog);
  activeConversations.delete(identityKey);
}

function normalizeMessage(value) {
  if (typeof value !== 'string') return null;
  const message = value.trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH) return null;
  return message;
}

function getUsageInfo(chatSession, userLimit) {
  const current = Number(chatSession?.usage?.dailyCount) || 0;
  return {
    current,
    limit: userLimit,
    remaining: Math.max(0, userLimit - current),
  };
}

async function loadConversation(req) {
  const identity = getIdentity(req);
  if (!identity) {
    throw new AIServiceError('شناسه گفت‌وگو معتبر نیست. لطفاً صفحه را تازه‌سازی کنید.', 400);
  }

  const settings = await Settings.findOne({ singletonKey: 'main_settings' }).lean();
  const aiConfig = settings?.aiConfig || {};
  if (aiConfig.enabled !== true) {
    throw new AIServiceError('دستیار هوشمند فعلاً غیرفعال است.', 503);
  }

  const userLimit = Number(aiConfig.userDailyLimit) || 20;
  let chatSession = await ChatHistory.findOne(identity.query);
  if (!chatSession) {
    chatSession = new ChatHistory({ ...identity.query, messages: [] });
  }

  const today = getLocalDayStart();
  const lastReset = chatSession.usage?.lastReset ? new Date(chatSession.usage.lastReset) : new Date(0);
  if (lastReset < today) {
    chatSession.usage = { dailyCount: 0, lastReset: today };
  }

  const usage = getUsageInfo(chatSession, userLimit);
  if (usage.current >= userLimit) {
    throw new AIServiceError(
      `شما به سقف مجاز ${userLimit} پیام در روز رسیده‌اید. لطفاً فردا مجدداً تلاش کنید.`,
      429,
    );
  }

  return {
    identity,
    settings,
    chatSession,
    userLimit,
    history: (chatSession.messages || []).slice(-MAX_HISTORY_MESSAGES).map((item) => ({
      role: item.role,
      content: item.content,
    })),
  };
}

async function buildChatContext(message, settings) {
  const terms = [...new Set(
    message
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3 && term.length <= 48)
      .slice(0, MAX_SEARCH_TERMS),
  )];

  let productContext = '';
  if (terms.length > 0) {
    const products = await Product.find({
      isActive: true,
      $or: terms.flatMap((term) => {
        const safeTerm = escapeRegex(term);
        return [
          { name: { $regex: safeTerm, $options: 'i' } },
          { description: { $regex: safeTerm, $options: 'i' } },
        ];
      }),
    })
      .select('name price stock description')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    productContext = products.map((product) => {
      const price = Number(product.price || 0).toLocaleString('fa-IR');
      const stockState = Number(product.stock || 0) > 0 ? 'موجود' : 'ناموجود';
      const description = product.description ? String(product.description).slice(0, 180) : '—';
      return `- مدل: ${product.name}\n  قیمت: ${price} تومان\n  وضعیت: ${stockState}\n  توضیح: ${description}`;
    }).join('\n----------------\n');
  }

  const storeInfo = [
    settings?.storeName ? `نام فروشگاه: ${settings.storeName}` : 'نام فروشگاه: ای‌کا‌جی کالا',
    settings?.storePhone ? `تلفن: ${settings.storePhone}` : '',
    settings?.storeEmail ? `ایمیل: ${settings.storeEmail}` : '',
    settings?.storeAddress ? `آدرس: ${settings.storeAddress}` : '',
    settings?.socialLinks?.telegram ? `تلگرام: ${settings.socialLinks.telegram}` : '',
    settings?.socialLinks?.instagram ? `اینستاگرام: ${settings.socialLinks.instagram}` : '',
  ].filter(Boolean).join('\n');

  return { productContext, storeInfoContext: storeInfo };
}

async function saveCompletedTurn(chatSession, userMessage, reply) {
  if (!reply || !reply.trim()) return;
  chatSession.messages.push({ role: 'user', content: userMessage });
  chatSession.messages.push({ role: 'assistant', content: reply.trim() });
  if (chatSession.messages.length > MAX_STORED_MESSAGES) {
    chatSession.messages = chatSession.messages.slice(-MAX_STORED_MESSAGES);
  }
  chatSession.lastUpdated = new Date();
  chatSession.usage = chatSession.usage || { dailyCount: 0, lastReset: getLocalDayStart() };
  chatSession.usage.dailyCount = (Number(chatSession.usage.dailyCount) || 0) + 1;
  await chatSession.save();
}

function toClientError(error) {
  if (error instanceof AIServiceError) return error;
  return new AIServiceError('خطایی در پردازش پیام رخ داد. لطفاً دوباره تلاش کنید.', 500, error);
}

/**
 * POST /api/chat
 * مسیر fallback غیر-stream برای کلاینت‌های ناسازگار با SSE.
 */
exports.handleMessage = async (req, res) => {
  const message = normalizeMessage(req.body?.message);
  if (!message) {
    return res.status(400).json({ success: false, message: `پیام باید بین ۱ تا ${MAX_MESSAGE_LENGTH} نویسه باشد.` });
  }

  let conversation;
  let requestId;
  try {
    conversation = await loadConversation(req);
    requestId = getRequestId(req);
    if (!acquireConversation(conversation.identity.key, requestId)) {
      return res.status(409).json({ success: false, message: 'درخواست قبلی شما هنوز در حال پردازش است.' });
    }

    const context = await buildChatContext(message, conversation.settings);
    const result = await generateExpertResponse(message, context.productContext, conversation.history, context.storeInfoContext);
    await saveCompletedTurn(conversation.chatSession, message, result.message);

    return res.json({
      success: true,
      data: {
        message: result.message,
        timestamp: new Date(),
        usage: getUsageInfo(conversation.chatSession, conversation.userLimit),
        provider: result.provider,
      },
    });
  } catch (error) {
    const clientError = toClientError(error);
    return res.status(clientError.statusCode).json({
      success: false,
      message: clientError.message,
      requestId,
    });
  } finally {
    if (conversation && requestId) releaseConversation(conversation.identity.key, requestId);
  }
};

/**
 * POST /api/chat/stream
 * Streaming SSE با heartbeat و رویدادهای سازگار با رابط موجود.
 */
exports.handleStreamMessage = async (req, res) => {
  const message = normalizeMessage(req.body?.message);
  if (!message) {
    return res.status(400).json({ success: false, message: `پیام باید بین ۱ تا ${MAX_MESSAGE_LENGTH} نویسه باشد.` });
  }

  let conversation;
  let requestId;
  let heartbeat;
  let clientClosed = false;

  try {
    conversation = await loadConversation(req);
    requestId = getRequestId(req);
    if (!acquireConversation(conversation.identity.key, requestId)) {
      return res.status(409).json({ success: false, message: 'درخواست قبلی شما هنوز در حال پردازش است.' });
    }

    const context = await buildChatContext(message, conversation.settings);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Content-Encoding', 'identity');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ meta: { requestId } })}\n\n`);

    const abortController = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) {
        clientClosed = true;
        abortController.abort();
      }
    };
    res.on('close', onClose);
    heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': ping\n\n');
    }, 15000);
    heartbeat.unref?.();

    const streamResult = await streamExpertResponse(
      res,
      message,
      context.productContext,
      conversation.history,
      context.storeInfoContext,
      { signal: abortController.signal },
    );

    if (streamResult.message) {
      await saveCompletedTurn(conversation.chatSession, message, streamResult.message);
    }

    if (!clientClosed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        usage: getUsageInfo(conversation.chatSession, conversation.userLimit),
        provider: streamResult.provider,
        partial: streamResult.partial || false,
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
    res.off?.('close', onClose);
  } catch (error) {
    const clientError = toClientError(error);
    if (!res.headersSent) {
      return res.status(clientError.statusCode).json({ success: false, message: clientError.message, requestId });
    }
    if (!clientClosed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: clientError.message, status: clientError.statusCode })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (conversation && requestId) releaseConversation(conversation.identity.key, requestId);
  }
};

exports.getSuggestions = async (req, res) => {
  res.json({
    success: true,
    data: [
      { text: 'محصولات تخفیف‌دار', icon: '🏷️', category: 'discount' },
      { text: 'راهنمای انتخاب دوربین برای منزل', icon: '📷', category: 'product' },
      { text: 'شرایط نصب در محل چیست؟', icon: '🛠️', category: 'service' },
      { text: 'سفارش من کجاست؟', icon: '📦', category: 'order' },
    ],
  });
};

exports.clearHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'شناسه کاربر الزامی است.' });
    }
    if (req.user?._id?.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'شما مجاز به پاک کردن این گفتگو نیستید.' });
    }

    await ChatHistory.findOneAndUpdate(
      { userId },
      { $set: { messages: [], lastUpdated: new Date() } },
    );
    return res.json({ success: true, message: 'تاریخچه گفتگو پاک شد.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'خطا در پاک کردن تاریخچه گفتگو.' });
  }
};

exports.__private__ = {
  normalizeMessage,
  escapeRegex,
  getLocalDayStart,
  activeConversations,
};
