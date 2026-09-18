const Order = require('../models/Order');
const ChatHistory = require('../models/ChatHistory');
const Settings = require('../models/Settings');
const {
  generateExpertResponse,
  streamExpertResponse,
  AIServiceError,
  stripThinkingTags,
} = require('../utils/groqService');
const {
  searchProducts,
  formatProductContext,
  toCardPayload,
  isAdvisoryRequest,
  detectPackRequest,
  buildPackage,
  formatPackageContext,
} = require('../utils/chatRetrieval');

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_STORED_MESSAGES = 50;
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
      content: stripThinkingTags(item.content),
    })),
  };
}

async function buildChatContext(message, settings, userId = null, history = []) {
  const priorUserCount = (Array.isArray(history) ? history : []).filter((h) => h && h.role === 'user').length;
  const packInfo = detectPackRequest(message, history);
  // نوبت اول درخواست پک = فقط نیازسنجی؛ بسته بعد از جواب کاربر ساخته می‌شود
  const packAwaiting = packInfo.isPack && priorUserCount < 1;
  const shouldBuildPack = packInfo.isPack && packInfo.domain && !packAwaiting;

  // موتور بازیابی دقیق فارسی + ساخت بسته — موازی برای سرعت
  const [productResult, packResult] = await Promise.all([
    (async () => {
      try {
        return await searchProducts(message, history);
      } catch (err) {
        console.warn('[chat] product retrieval failed:', err?.message);
        return { products: [] };
      }
    })(),
    (async () => {
      if (!shouldBuildPack) return null;
      try {
        return await buildPackage(message, history);
      } catch (err) {
        console.warn('[chat] package build failed:', err?.message);
        return null;
      }
    })(),
  ]);

  const products = productResult.products || [];
  const pack = packResult || null;

  let productContext = formatProductContext(products);
  if (pack) {
    const packText = formatPackageContext(pack);
    if (packText) productContext = `${productContext}\n\n${packText}`;
  }
  const advisoryHint = isAdvisoryRequest(message);
  // در نوبت اول نیازسنجی (هنوز کاربر به سوال‌ها جواب نداده) کارت نشان نده —
  // اول سوال دوگزینه‌ای، بعداً در نوبت‌های بعدی معرفی نهایی با کارت/بسته.
  const firstNeedTurn = priorUserCount < 1 && (advisoryHint || packInfo.isPack);
  const productCards = firstNeedTurn ? [] : products.map(toCardPayload);

  const orderStatusMap = {
    Pending: 'در انتظار بررسی یا پرداخت',
    Processing: 'در حال پردازش و آماده‌سازی',
    Shipped: 'تحویل به شرکت حمل‌ونقل شده (ارسال شده)',
    Delivered: 'تحویل داده شده',
    Cancelled: 'لغو شده',
  };

  const ordersList = [];
  if (userId) {
    const userOrders = await Order.find({ user: userId })
      .select('orderCode orderStatus totalPrice createdAt trackingCode courierName preparedTrackingUrl')
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();
    ordersList.push(...userOrders);
  }

  const orderCodeMatches = message.match(/\b([A-Za-z]{2,4}-?\d{5,8})\b/gi);
  if (orderCodeMatches) {
    for (const rawCode of orderCodeMatches) {
      const normalizedCode = rawCode.toUpperCase();
      const codeWithoutDash = normalizedCode.replace('-', '');
      const foundOrder = await Order.findOne({
        $or: [{ orderCode: normalizedCode }, { orderCode: codeWithoutDash }],
      })
        .select('orderCode orderStatus totalPrice createdAt trackingCode courierName preparedTrackingUrl')
        .lean();
      if (foundOrder && !ordersList.some((o) => String(o._id) === String(foundOrder._id))) {
        ordersList.push(foundOrder);
      }
    }
  }

  let ordersContextText = '';
  if (ordersList.length > 0) {
    ordersContextText = ordersList.map((ord) => {
      const statusText = orderStatusMap[ord.orderStatus] || ord.orderStatus || 'نامشخص';
      const priceText = Number(ord.totalPrice || 0).toLocaleString('fa-IR');
      const dateText = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('fa-IR') : '—';
      const tracking = ord.trackingCode ? `کد رهگیری: ${ord.trackingCode}` : 'کد رهگیری پستی: هنوز صادر نشده';
      const courier = ord.courierName ? `ارسال از طریق: ${ord.courierName}` : '';
      const link = ord.preparedTrackingUrl ? `لینک رهگیری مستقیم: ${ord.preparedTrackingUrl}` : '';
      return `- کد سفارش: ${ord.orderCode || ord._id}\n  وضعیت: ${statusText}\n  مبلغ: ${priceText} تومان\n  تاریخ ثبت: ${dateText}\n  ${tracking}${courier ? `\n  ${courier}` : ''}${link ? `\n  ${link}` : ''}`;
    }).join('\n----------------\n');
  }

  const storeInfoParts = [
    settings?.storeName ? `نام فروشگاه: ${settings.storeName}` : 'نام فروشگاه: ای‌کا‌جی کالا',
    settings?.storePhone ? `تلفن پشتیبانی: ${settings.storePhone}` : '',
    settings?.storeEmail ? `ایمیل: ${settings.storeEmail}` : '',
    settings?.storeAddress ? `آدرس: ${settings.storeAddress}` : '',
    settings?.socialLinks?.telegram ? `تلگرام: ${settings.socialLinks.telegram}` : '',
    settings?.socialLinks?.instagram ? `اینستاگرام: ${settings.socialLinks.instagram}` : '',
    '',
    '### راهنمای پیگیری سفارشات:',
    '- کاربران وارد شده به سایت می‌توانند با مراجعه به بخش «پروفایل > سفارش‌های من» (/profile/orders) وضعیت تمام سفارش‌های خود را مشاهده کنند.',
    '- تمام مشتریان (از جمله کاربران مهمان) در صورتی که کد سفارش دارند، می‌توانند به صفحه «پیگیری سفارش» (/tracking) رفته و با وارد کردن کد سفارش وضعیت بسته را لحظه‌ای ببینند.',
    ordersContextText
      ? `### اطلاعات سفارش‌های مرتبط با این کاربر/پیام:\n${ordersContextText}`
      : (userId
        ? 'این کاربر فعلاً سفارش ثبت‌شده‌ای در سیستم ندارد.'
        : 'کاربر هنوز وارد حساب کاربری نشده است. اگر کد سفارش دارد، او را به صفحه پیگیری سفارش (/tracking) یا ورود به حساب راهنمایی کنید.')
  ];

  const storeInfo = storeInfoParts.filter((p) => p !== undefined && p !== null).join('\n');

  return {
    productContext,
    storeInfoContext: storeInfo,
    products: productCards,
    advisoryHint,
    package: pack,
    packReady: Boolean(pack),
    packAwaiting,
  };
}

async function saveCompletedTurn(chatSession, userMessage, reply) {
  const cleanReply = stripThinkingTags(reply);
  if (!cleanReply) return;
  chatSession.messages.push({ role: 'user', content: userMessage });
  chatSession.messages.push({ role: 'assistant', content: cleanReply });
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

    const context = await buildChatContext(
      message,
      conversation.settings,
      conversation.identity.query?.userId,
      conversation.history,
    );
    const result = await generateExpertResponse(
      message,
      context.productContext,
      conversation.history,
      context.storeInfoContext,
      { advisoryHint: context.advisoryHint, packReady: context.packReady, packAwaiting: context.packAwaiting },
    );
    await saveCompletedTurn(conversation.chatSession, message, result.message);

    return res.json({
      success: true,
      data: {
        message: result.message,
        products: context.products || [],
        package: context.package || null,
        timestamp: new Date(),
        usage: getUsageInfo(conversation.chatSession, conversation.userLimit),
        provider: result.provider,
      },
    });
  } catch (error) {
    const clientError = toClientError(error);
    console.error(
      `[chat] handleMessage failed | requestId=${requestId || '-'} status=${clientError.statusCode} `
      + `upstream=${clientError.originalError?.response?.status || clientError.originalError?.code || clientError.originalError?.message || error?.message}`,
    );
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

    const context = await buildChatContext(
      message,
      conversation.settings,
      conversation.identity.query?.userId,
      conversation.history,
    );

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Content-Encoding', 'identity');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ meta: { requestId } })}\n\n`);
    // ارسال فوری کارت محصولات تا فرانت بدون انتظار برای LLM رندر کند
    if (context.products && context.products.length > 0) {
      res.write(`data: ${JSON.stringify({ products: context.products })}\n\n`);
    }
    // بسته پیشنهادی هم ساخت‌یافته ارسال می‌شود (فرانت بعد از اتمام متن نمایشش می‌دهد)
    if (context.package) {
      res.write(`data: ${JSON.stringify({ package: context.package })}\n\n`);
    }

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
      { signal: abortController.signal, advisoryHint: context.advisoryHint, packReady: context.packReady, packAwaiting: context.packAwaiting },
    );

    if (streamResult.message) {
      await saveCompletedTurn(conversation.chatSession, message, streamResult.message);
    }

    if (!clientClosed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        usage: getUsageInfo(conversation.chatSession, conversation.userLimit),
        provider: streamResult.provider,
        partial: streamResult.partial || false,
        products: context.products || [],
        package: context.package || null,
      })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
    res.off?.('close', onClose);
  } catch (error) {
    const clientError = toClientError(error);
    console.error(
      `[chat] handleStreamMessage failed | requestId=${requestId || '-'} status=${clientError.statusCode} `
      + `upstream=${clientError.originalError?.response?.status || clientError.originalError?.code || clientError.originalError?.message || error?.message}`,
    );
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

/**
 * DELETE /api/chat/history
 * شروع گفتگوی تازه برای هویت فعلی (کاربر لاگین‌کرده یا مهمان با x-session-id).
 * برخلاف clearHistory قدیمی که فقط userId می‌گرفت، این مسیر کش مکالمه مهمان را هم واقعاً پاک می‌کند.
 */
exports.clearMyHistory = async (req, res) => {
  try {
    const identity = getIdentity(req);
    if (!identity) {
      return res.status(400).json({ success: false, message: 'شناسه گفت‌وگو معتبر نیست.' });
    }

    await ChatHistory.findOneAndUpdate(
      identity.query,
      { $set: { messages: [], lastUpdated: new Date() } },
    );
    return res.json({ success: true, message: 'گفتگوی جدید شروع شد. تاریخچه قبلی پاک شد.' });
  } catch (error) {
    console.error('[chat] clearMyHistory failed:', error?.message);
    return res.status(500).json({ success: false, message: 'خطا در پاک کردن تاریخچه گفتگو.' });
  }
};

exports.__private__ = {
  normalizeMessage,
  escapeRegex,
  getLocalDayStart,
  activeConversations,
  buildChatContext,
};
