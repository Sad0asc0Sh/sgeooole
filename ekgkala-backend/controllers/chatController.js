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
  normalizeFa,
  formatPackageContext,
} = require('../utils/chatRetrieval');
const {
  startWizard,
  enterStepsPhase,
  skipNeedsPhase,
  needsRequiredFor,
  getWizardView,
  selectOption,
  skipCurrent,
  goBack,
  restartWizard,
  deactivateWizard,
  buildFinalPackage,
  formatWizardContext,
} = require('../utils/packWizard');
const { parseCctvNeeds } = require('../utils/cctvEngine');
const {
  detectCctvIntent,
  createFlow,
  applyMessage,
  applyQuickReply,
  buildPrompt,
  toFlowView,
  toAssemblyParams,
  summarizeSlots,
  getNextStepKey,
} = require('../services/cctvChatFlow');
const { assembleCCTVPackage } = require('../services/cctvAssemblyEngine');

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

/** دستورهای متنی پک وقتی ویزارد فعال است: انصراف کامل یا شروع دوباره */
function detectPackTextCommand(message) {
  const norm = normalizeFa(message || '');
  if (!norm) return null;
  if (/(انصراف|لغو|کنسل|بیخیال)/.test(norm)) return 'cancel';
  if (/(از اول|از نو|شروع دوباره|ریست)/.test(norm)) return 'restart';
  return null;
}

/**
 * آماده‌سازی ویزارد پک برای این نوبت — ترتیب قطعی: اول نیازسنجی، بعد مرحله‌ها:
 * - ویزارد فعال در فاز needs: با رسیدن جواب‌های کافی، وارد فاز مرحله‌ها می‌شود
 * - بدون ویزارد + درخواست پک: ساخت ویزارد (نیازسنجی، مگر کردیت کافی برای شروع مستقیم)
 * - تغییرات وضعیت همین‌جا روی chatSession ذخیره می‌شود (saveCompletedTurn هم بعداً ذخیره می‌کند).
 */
async function preparePackWizard(message, chatSession, history = []) {
  const out = {
    view: null, wizardCreated: false, wizardStepsBegun: false,
    wizardRestarted: false, wizardCancelled: false, packNotViable: null,
  };
  if (!chatSession) return out;

  let wiz = chatSession.packWizard && chatSession.packWizard.active ? chatSession.packWizard : null;

  if (wiz) {
    const cmd = detectPackTextCommand(message);
    if (cmd === 'cancel') {
      deactivateWizard(wiz);
      await chatSession.save().catch(() => {});
      out.wizardCancelled = true;
      return out;
    }
    if (cmd === 'restart') {
      restartWizard(wiz);
      await chatSession.save().catch(() => {});
      out.wizardRestarted = true;
    }

    // فاز نیازسنجی: ثبت هوشمند پاسخ‌های کاربر و افزایش شمارنده
    if (wiz.active && wiz.phase === 'needs' && !out.wizardRestarted) {
      if (wiz.domainId === 'camera') {
        wiz.requirements = parseCctvNeeds(message, history, wiz.requirements || {});
      }
      wiz.needsAnswers = (Number(wiz.needsAnswers) || 0) + 1;
      const given = wiz.needsAnswers + (Number(wiz.needsCredit) || 0);
      if (given >= needsRequiredFor(wiz.domainId)) {
        const entered = await enterStepsPhase(wiz, history);
        if (entered.ok) {
          out.wizardStepsBegun = true;
        } else {
          deactivateWizard(wiz);
          out.packNotViable = { reason: 'not_viable', missing: entered.missing || [] };
          await chatSession.save().catch(() => {});
          return out;
        }
      }
    }
  }

  if (!wiz) {
    let domain = null;
    try {
      const detected = detectPackRequest(message, history);
      if (detected && detected.isPack) domain = detected.domain || null;
    } catch { domain = null; }

    if (domain) {
      try {
        const res = await startWizard(domain.id, message, history);
        if (res.started) {
          chatSession.packWizard = res.state;
          wiz = chatSession.packWizard;
          out.wizardCreated = true;
          out.wizardStepsBegun = Boolean(res.stepsBegun);
        } else {
          // دسته‌بندی/موجودی کافی نیست → LLM صادقانه راهنمایی می‌کند، نه بسته توهمی
          out.packNotViable = { reason: res.reason, missing: res.missing || [] };
        }
      } catch (err) {
        console.warn('[chat] wizard start failed:', err?.message);
      }
    }
  }

  if (wiz && wiz.active) {
    try {
      out.view = await getWizardView(wiz, history);
      // ذخیره وضعیت به‌روزشده (مثلاً unavailable شدن مرحله‌ای که موجودی‌اش تمام شد)
      await chatSession.save().catch(() => {});
    } catch (err) {
      console.warn('[chat] wizard view failed:', err?.message);
    }
  }
  return out;
}

async function buildChatContext(message, settings, userId = null, history = [], wizardView = null) {
  const priorUserCount = (Array.isArray(history) ? history : []).filter((h) => h && h.role === 'user').length;
  // فاز نیازسنجی: هیچ محصولی — نه جست‌وجو، نه کانتکست، نه کارت — تا سوالات تمام شود
  const needsPhase = Boolean(wizardView && wizardView.phase === 'needs');
  const stepsPhase = Boolean(wizardView && wizardView.phase === 'steps');

  let products = [];
  if (!needsPhase) {
    try {
      const result = await searchProducts(message, history);
      products = result.products || [];
    } catch (err) {
      console.warn('[chat] product retrieval failed:', err?.message);
      products = [];
    }
  }

  // اگر ویزارد در فاز مرحله‌هاست و جست‌وجوی عمومی خالی بوده، متن متناقض «کالا در دیتابیس یافت نشد» را تزریق نکن
  let productContext = '';
  if (!needsPhase) {
    if (products.length > 0) {
      productContext = formatProductContext(products);
    } else if (!stepsPhase) {
      productContext = formatProductContext([]);
    }
  }

  if (wizardView) {
    const wizText = formatWizardContext(wizardView);
    if (wizText) productContext = productContext ? `${productContext}\n\n${wizText}` : wizText;
  }
  const advisoryHint = isAdvisoryRequest(message);
  // در نوبت اول نیازسنجی کارت نشان نده؛ وقتی ویزارد فعال است هم پنل مرحله کافی است (عدم تکرار).
  const firstNeedTurn = priorUserCount < 1 && advisoryHint;
  const productCards = (firstNeedTurn || wizardView) ? [] : products.map(toCardPayload);

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
    wizard: wizardView,
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

/* ==========================================================================
 * مسیر قطعی پک دوربین (cctvChatFlow + cctvAssemblyEngine) — بدون LLM
 * ========================================================================== */

/** تبدیل خروجی موتور اسمبل به ChatPackage سازگار فرانت */
async function engineToChatPackage(assembled) {
  // گیت یکپارچگی: پک بدون هسته (دوربین/رکوردر) هرگز کارت پیش‌فاکتور نمی‌گیرد
  if (!assembled || assembled.success === false || assembled.error === 'MISSING_CORE_ITEMS') {
    return null;
  }
  if (!Array.isArray(assembled.items) || !assembled.items.length) {
    return null;
  }
  const Product = require('../models/Product');
  const sections = [];
  for (const item of assembled.items) {
    if (!item || !item.productId) continue;
    const full = await Product.findById(item.productId)
      .select('name slug price compareAtPrice discount stock variants productCode sku description category brand properties specifications images guarantee')
      .populate('category', 'name slug')
      .populate('brand', 'name')
      .lean();
    if (!full) continue;
    const card = toCardPayload(full, {
      recommendedQty: item.qty || 1,
      compatibilityHint: item.why || '',
    });
    sections.push({
      key: item.role,
      title: item.title,
      hint: item.why || '',
      optional: false,
      options: [card],
      defaultId: card.id,
      recommendedQty: item.qty || 1,
    });
  }
  if (!sections.length) return null;

  return {
    domainId: 'cctv_deterministic',
    title: 'پک دوربین مداربسته',
    sections,
    missing: (assembled.missing || []).map((m) => m.title),
    incomplete: Boolean(assembled.incomplete),
    requirements: assembled.params || {},
    calculations: assembled.calculations || null,
    totalPrice: assembled.totalPrice || 0,
    warnings: assembled.warnings || [],
    notes: assembled.notes || [],
  };
}

function buildCctvCompletionMessage(assembled) {
  // شکست سخت — بدون کارت پیش‌فاکتور
  if (!assembled || assembled.success === false || assembled.error === 'MISSING_CORE_ITEMS') {
    return (
      assembled?.message ||
      'متأسفانه در حال حاضر دوربین یا دستگاه متناسب با این مشخصات در انبار موجود نیست.'
    );
  }

  const slots = assembled.params || {};
  const summary = summarizeSlots(slots);
  const lines = [
    `پک دوربین مداربسته آماده شد${summary ? ` (${summary})` : ''}.`,
  ];
  if (assembled.calculations?.storage) {
    lines.push(
      `حافظه: حدود ${assembled.calculations.storage.requiredTb} ترابایت برای ${assembled.calculations.storage.retentionDays} روز ضبط.`,
    );
  }
  if (assembled.calculations?.cable) {
    lines.push(`کابل: ${assembled.calculations.cable.totalMeters} متر.`);
  }
  if (assembled.notes?.length) {
    lines.push(`توجه: ${assembled.notes.join(' ')}`);
  }
  if (assembled.missing?.length) {
    lines.push(
      `⚠ اقلام ناموجود و حذف‌شده از پیش‌فاکتور: ${assembled.missing.map((m) => m.title).join('، ')}.`,
    );
    lines.push('این پک ناقص است؛ لطفاً پیش از پرداخت اقلام بالا را بررسی کنید.');
  } else {
    lines.push('اقلام و قیمت نهایی در پک زیر است.');
  }
  return lines.join(' ');
}

/**
 * نوبت گفت‌وگوی قطعی پک دوربین.
 * @returns {object|null} اگر این پیام مربوط به مسیر پک نباشد → null
 */
async function handleCctvTurn(message, chatSession, options = {}) {
  let flow =
    chatSession.cctvFlow && typeof chatSession.cctvFlow === 'object'
      ? JSON.parse(JSON.stringify(chatSession.cctvFlow))
      : null;

  const flowActive = Boolean(flow && flow.active && !flow.cancelled && !flow.complete);
  const isIntent = detectCctvIntent(message, flowActive || Boolean(flow && flow.complete && options.force));

  // اگر فلوی کامل داریم و پیام جدید نیت تازه است → فلوی نو
  if (!flowActive && isIntent) {
    flow = createFlow();
  } else if (!flowActive && !isIntent) {
    return null;
  }

  // پشتیبانی از quickReply ساخت‌یافته (body.slot / body.value)
  if (options.slot && options.value !== undefined && options.value !== null) {
    const qr = applyQuickReply(flow, options.slot, options.value);
    flow = qr.flow;
    if (!qr.ok) {
      const prompt = buildPrompt(flow);
      await saveCompletedTurn(chatSession, message, prompt.message);
      return {
        message: prompt.message,
        cctvFlow: toFlowView(flow),
        package: null,
        products: [],
      };
    }
  } else {
    const applied = applyMessage(flow, message);
    flow = applied.flow;

    if (applied.cancelled) {
      const msg = 'گفت‌وگوی پک دوربین لغو شد. هر وقت خواستید دوباره بگویید «پک دوربین».';
      chatSession.cctvFlow = flow;
      await saveCompletedTurn(chatSession, message, msg);
      return {
        message: msg,
        cctvFlow: toFlowView(flow),
        package: null,
        products: [],
      };
    }

    if (applied.restarted) {
      flow = applied.flow;
    }
  }

  let reply;
  let packagePayload = null;

  if (flow.complete || (flow.slots && Object.keys(flow.slots).length && !getNextStepKey(flow))) {
    // همه اسلات‌ها پر شد — اسمبل قطعی
    const params = toAssemblyParams(flow);
    const assembled = await assembleCCTVPackage(params);

    // گیت سخت: بدون دوربین/رکوردر کارت پیش‌فاکتور صادر نمی‌شود
    if (!assembled || assembled.success === false || assembled.error === 'MISSING_CORE_ITEMS') {
      reply = buildCctvCompletionMessage(assembled);
      packagePayload = null;
      flow.complete = true;
      flow.active = false;
      flow.error = assembled?.error || 'MISSING_CORE_ITEMS';
    } else {
      packagePayload = await engineToChatPackage(assembled);
      reply = buildCctvCompletionMessage(assembled);
      flow.complete = true;
      flow.active = false;
    }
  } else {
    const prompt = buildPrompt(flow);
    // اگر این نوبت چیزی پر شد، تأیید کوتاه + سوال بعدی
    const ack = Object.keys(flow.slots || {}).length
      ? `${summarizeSlots(flow.slots)}\n\n`
      : '';
    reply = `${ack}${prompt.message}`.trim();
  }

  chatSession.cctvFlow = flow;
  await saveCompletedTurn(chatSession, message, reply);

  return {
    message: reply,
    cctvFlow: toFlowView(flow),
    package: packagePayload,
    products: [],
  };
}

/**
 * POST /api/chat/message — مسیر اصلی مکالمه با کمترین توکن
 * اول مسیر قطعی پک دوربین، در غیر این صورت LLM (مسیر موجود).
 */
exports.handleChatMessage = async (req, res) => {
  const message = normalizeMessage(req.body?.message);
  const slot = req.body?.slot;
  const value = req.body?.value;

  // اجازه quickReply بدون متن طولانی
  if (!message && !(slot && value !== undefined && value !== null)) {
    return res.status(400).json({
      success: false,
      message: `پیام باید بین ۱ تا ${MAX_MESSAGE_LENGTH} نویسه باشد.`,
    });
  }
  const effectiveMessage = message || String(value);

  let conversation;
  let requestId;
  try {
    conversation = await loadConversation(req);
    requestId = getRequestId(req);
    if (!acquireConversation(conversation.identity.key, requestId)) {
      return res.status(409).json({ success: false, message: 'درخواست قبلی شما هنوز در حال پردازش است.' });
    }

    // ۱) مسیر قطعی پک دوربین — بدون LLM
    const cctvResult = await handleCctvTurn(effectiveMessage, conversation.chatSession, {
      slot,
      value,
    });
    if (cctvResult) {
      return res.json({
        success: true,
        data: {
          message: cctvResult.message,
          products: cctvResult.products || [],
          package: cctvResult.package || null,
          wizard: null,
          cctvFlow: cctvResult.cctvFlow || null,
          timestamp: new Date(),
          usage: getUsageInfo(conversation.chatSession, conversation.userLimit),
          provider: 'deterministic-cctv',
        },
      });
    }

    // ۲) مسیر عمومی (LLM) — همان handleMessage
    const pack = await preparePackWizard(effectiveMessage, conversation.chatSession, conversation.history);
    const context = await buildChatContext(
      effectiveMessage,
      conversation.settings,
      conversation.identity.query?.userId,
      conversation.history,
      pack.view,
    );
    const result = await generateExpertResponse(
      effectiveMessage,
      context.productContext,
      conversation.history,
      context.storeInfoContext,
      {
        advisoryHint: context.advisoryHint,
        wizardCreated: pack.wizardCreated,
        wizardStepsBegun: pack.wizardStepsBegun,
        wizardRestarted: pack.wizardRestarted,
        wizardCancelled: pack.wizardCancelled,
        packNotViable: pack.packNotViable,
      },
    );
    await saveCompletedTurn(conversation.chatSession, effectiveMessage, result.message);

    return res.json({
      success: true,
      data: {
        message: result.message,
        products: context.products || [],
        package: null,
        wizard: context.wizard || null,
        cctvFlow: null,
        timestamp: new Date(),
        usage: getUsageInfo(conversation.chatSession, conversation.userLimit),
        provider: result.provider,
      },
    });
  } catch (error) {
    const clientError = toClientError(error);
    console.error(
      `[chat] handleChatMessage failed | requestId=${requestId || '-'} status=${clientError.statusCode}`,
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

    // مسیر قطعی پک دوربین — بدون LLM و بدون انباشت توکن
    const cctvResult = await handleCctvTurn(message, conversation.chatSession, {
      slot: req.body?.slot,
      value: req.body?.value,
    });
    if (cctvResult) {
      return res.json({
        success: true,
        data: {
          message: cctvResult.message,
          products: cctvResult.products || [],
          package: cctvResult.package || null,
          wizard: null,
          cctvFlow: cctvResult.cctvFlow || null,
          timestamp: new Date(),
          usage: getUsageInfo(conversation.chatSession, conversation.userLimit),
          provider: 'deterministic-cctv',
        },
      });
    }

    const pack = await preparePackWizard(message, conversation.chatSession, conversation.history);
    const context = await buildChatContext(
      message,
      conversation.settings,
      conversation.identity.query?.userId,
      conversation.history,
      pack.view,
    );
    const result = await generateExpertResponse(
      message,
      context.productContext,
      conversation.history,
      context.storeInfoContext,
      {
        advisoryHint: context.advisoryHint,
        wizardCreated: pack.wizardCreated,
        wizardStepsBegun: pack.wizardStepsBegun,
        wizardRestarted: pack.wizardRestarted,
        wizardCancelled: pack.wizardCancelled,
        packNotViable: pack.packNotViable,
      },
    );
    await saveCompletedTurn(conversation.chatSession, message, result.message);

    return res.json({
      success: true,
      data: {
        message: result.message,
        products: context.products || [],
        package: null,
        wizard: context.wizard || null,
        cctvFlow: null,
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

    // مسیر قطعی پک دوربین — یک رویداد SSE کامل، بدون LLM
    const cctvResult = await handleCctvTurn(message, conversation.chatSession, {
      slot: req.body?.slot,
      value: req.body?.value,
    });
    if (cctvResult) {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Content-Encoding', 'identity');
      res.flushHeaders?.();
      res.write(`data: ${JSON.stringify({ meta: { requestId } })}\n\n`);
      res.write(`data: ${JSON.stringify({
        message: cctvResult.message,
        products: cctvResult.products || [],
        package: cctvResult.package || null,
        wizard: null,
        cctvFlow: cctvResult.cctvFlow || null,
        usage: getUsageInfo(conversation.chatSession, conversation.userLimit),
        provider: 'deterministic-cctv',
        partial: false,
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const pack = await preparePackWizard(message, conversation.chatSession, conversation.history);
    const context = await buildChatContext(
      message,
      conversation.settings,
      conversation.identity.query?.userId,
      conversation.history,
      pack.view,
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
    // نمای ویزارد هم ساخت‌یافته ارسال می‌شود (فرانت بعد از اتمام متن نمایشش می‌دهد)
    if (context.wizard) {
      res.write(`data: ${JSON.stringify({ wizard: context.wizard })}\n\n`);
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
      {
        signal: abortController.signal,
        advisoryHint: context.advisoryHint,
        wizardCreated: pack.wizardCreated,
        wizardStepsBegun: pack.wizardStepsBegun,
        wizardRestarted: pack.wizardRestarted,
        wizardCancelled: pack.wizardCancelled,
        packNotViable: pack.packNotViable,
      },
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
        package: null,
        wizard: context.wizard || null,
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

/**
 * POST /api/chat/pack/action
 * اکشن‌های ویزارد پک: select (با productId) | skip | back | restart
 * - اعتبارسنجی سخت‌گیرانه سمت سرور (کالا واقعی/فعال/موجود/متعلق به همین مرحله)
 * - وضعیت اول ذخیره می‌شود، بعد پیام کوتاه LLM ساخته می‌شود (با fallback متنی اگر LLM خطا داد)
 */
exports.handlePackAction = async (req, res) => {
  const action = String(req.body?.action || '').trim();
  if (!['select', 'skip', 'back', 'restart', 'skip-needs'].includes(action)) {
    return res.status(400).json({ success: false, message: 'اکشن نامعتبر است.' });
  }

  let conversation;
  let requestId;
  try {
    conversation = await loadConversation(req);
    requestId = getRequestId(req);
    if (!acquireConversation(conversation.identity.key, requestId)) {
      return res.status(409).json({ success: false, message: 'درخواست قبلی شما هنوز در حال پردازش است.' });
    }

    const wiz = conversation.chatSession.packWizard;
    if (!wiz || !wiz.active) {
      return res.status(400).json({ success: false, message: 'ویزارد پک فعالی وجود ندارد. اول در چت بگویید چه پکی می‌خواهید.' });
    }

    let userMessage = '';
    let completed = false;
    let finalPackage = null;

    if (action === 'select') {
      const productId = String(req.body?.productId || '').trim();
      if (!productId) {
        return res.status(400).json({ success: false, message: 'شناسه کالا مشخص نشده است.' });
      }
      const result = await selectOption(wiz, productId, Number(req.body?.qty) || 1);
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.error });
      }
      userMessage = `انتخاب ${result.step.title}: ${result.product.name}`;
      completed = result.completed;
      if (completed) {
        finalPackage = await buildFinalPackage(wiz, conversation.history);
        deactivateWizard(wiz);
      }
    } else if (action === 'skip') {
      const step = wiz.steps[wiz.currentIndex];
      const result = await skipCurrent(wiz);
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.error });
      }
      userMessage = `رد شدن از مرحله «${step ? step.title : ''}»`;
      completed = isCompleteWizard(wiz);
    } else if (action === 'back') {
      const result = goBack(wiz);
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.error });
      }
      userMessage = 'بازگشت به مرحله قبل';
    } else if (action === 'restart') {
      restartWizard(wiz);
      userMessage = 'شروع دوباره پک از مرحله اول';
    } else if (action === 'skip-needs') {
      const result = await skipNeedsPhase(wiz, conversation.history);
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.error });
      }
      userMessage = 'رد شدن از سوالات و نمایش گزینه‌ها';
    }

    const view = completed ? null : await getWizardView(wiz, conversation.history);

    // پیام کوتاه تأیید/گذار — grounding کامل از وضعیت واقعی
    let grounding = view ? formatWizardContext(view) : '';
    if (completed && finalPackage) {
      const packText = formatPackageContext(finalPackage);
      if (packText) grounding = `${grounding}\n\n${packText}`;
    }
    const transitionNote = action === 'select' && completed
      ? 'کاربر آخرین قلم پک را تأیید کرد و بسته نهایی آماده و جداگانه نمایش داده می‌شود. فقط در ۲ جمله تبریک بگو، اقلام نهایی را با نام دقیق خلاصه کن و بگو با دکمه «افزودن همه به سبد خرید» می‌تواند یکجا بخرد.'
      : action === 'select'
        ? 'کاربر یک قلم را از پنل تأیید کرد. فقط در ۱ تا ۲ جمله تأیید کن و مرحله بعد را با نام دقیق بخش معرفی کن. هیچ کالایی خارج از متن مرجع نام نبر.'
        : action === 'skip'
          ? 'کاربر یک مرحله اختیاری را رد کرد. فقط در ۱ جمله تأیید کن و مرحله بعد را معرفی کن.'
          : action === 'back'
            ? 'کاربر به مرحله قبل برگشت تا انتخابش را عوض کند. فقط در ۱ جمله همراهی کن.'
            : action === 'skip-needs'
              ? 'کاربر سوالات نیازسنجی را رد کرد و وارد مرحله‌ها شد. فقط در ۱ جمله تأیید کن و مرحله اول را با نام دقیق بخش معرفی کن.'
              : 'کاربر پک را از اول شروع کرد. فقط در ۱ جمله تأیید کن و مرحله اول را معرفی کن.';

    let reply = '';
    try {
      const llm = await generateExpertResponse(
        `${userMessage}. ${transitionNote}`,
        grounding,
        conversation.history,
        contextStoreInfoFallback(conversation.settings),
        { brief: true },
      );
      reply = llm.message;
    } catch (err) {
      console.warn('[chat] pack transition LLM failed, using template:', err?.message);
      reply = fallbackPackMessage(action, view, finalPackage);
    }
    if (!reply) reply = fallbackPackMessage(action, view, finalPackage);

    await saveCompletedTurn(conversation.chatSession, userMessage, reply);

    return res.json({
      success: true,
      data: {
        userMessage,
        message: reply,
        wizard: view,
        package: finalPackage,
        products: [],
        timestamp: new Date(),
        usage: getUsageInfo(conversation.chatSession, conversation.userLimit),
      },
    });
  } catch (error) {
    const clientError = toClientError(error);
    console.error(
      `[chat] handlePackAction failed | requestId=${requestId || '-'} action=${action} status=${clientError.statusCode}`,
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

function isCompleteWizard(wiz) {
  return Boolean(wiz) && (Number(wiz.currentIndex) || 0) >= ((wiz.steps || []).length);
}

function contextStoreInfoFallback(settings) {
  return settings?.storeName ? `نام فروشگاه: ${settings.storeName}` : 'نام فروشگاه: ای‌کا‌جی کالا';
}

function fallbackPackMessage(action, view, finalPackage) {
  if (action === 'select' && finalPackage) {
    return `تبریک! پک «${finalPackage.title}» کامل شد. همه اقلام تأییدشده‌ات را در پنل زیر می‌بینی؛ جمع کل مشخص است و با دکمه «افزودن همه به سبد خرید» می‌توانی یکجا بخری.`;
  }
  if (action === 'select' && view && view.current) {
    return `عالیه، ثبت شد! حالا بریم سراغ «${view.current.title}» — از گزینه‌های همین مرحله یکی را انتخاب کن.`;
  }
  if (action === 'skip' && view && view.current) {
    return `باشه، رد شد. مرحله بعد «${view.current.title}» است.`;
  }
  if (action === 'back' && view && view.current) {
    return `برگشتیم به «${view.current.title}»؛ انتخاب جدیدت را بزن.`;
  }
  if (action === 'restart') {
    return 'پک از اول شروع شد. اول به سوالات نیازسنجی جواب بده.';
  }
  if (action === 'skip-needs' && view && view.current) {
    return `باشه، میریم سراغ «${view.current.title}» — از گزینه‌های همین مرحله یکی را انتخاب کن.`;
  }
  return 'انجام شد.';
}

exports.__private__ = {
  normalizeMessage,
  escapeRegex,
  getLocalDayStart,
  activeConversations,
  buildChatContext,
  preparePackWizard,
  detectPackTextCommand,
};
