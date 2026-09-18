const assert = require('node:assert/strict');
const axios = require('axios');
const AiProvider = require('../models/AiProvider');
const Settings = require('../models/Settings');
const ChatHistory = require('../models/ChatHistory');
const chatController = require('../controllers/chatController');
const { __private__: chat } = chatController;
const aiService = require('../utils/groqService');
const { __private__: ai } = aiService;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test('پیام خالی یا بسیار بلند را رد می‌کند', () => {
  assert.equal(chat.normalizeMessage('   '), null);
  assert.equal(chat.normalizeMessage('a'.repeat(2001)), null);
  assert.equal(chat.normalizeMessage('  سلام  '), 'سلام');
});

test('عبارت جست‌وجو را برای regex ایمن می‌کند', () => {
  assert.equal(chat.escapeRegex('a+b?(test)'), 'a\\+b\\?\\(test\\)');
});

test('تگ‌های تفکر <think> و استدلال‌های مدل را از متن نهایی پاک می‌کند', () => {
  const sampleWithThink = '<think>مشتری می‌خواهد بداند سفارشش کجاست. من به عنوان مشاور فروش این فروشگاه، به اطلاعات سفارشات مشتریان دسترسی ندارم.\n</think>سلام! برای پیگیری سفارش خود می‌توانید به صفحه پیگیری سفارش مراجعه کنید.';
  assert.equal(ai.stripThinkingTags(sampleWithThink), 'سلام! برای پیگیری سفارش خود می‌توانید به صفحه پیگیری سفارش مراجعه کنید.');

  const sampleUnclosed = '<think>این یک استدلال ناتمام است';
  assert.equal(ai.stripThinkingTags(sampleUnclosed), '');

  const sampleThoughtTag = '<thought>فکر مدل</thought>پاسخ واقعی';
  assert.equal(ai.stripThinkingTags(sampleThoughtTag), 'پاسخ واقعی');

  const sampleReasoningTag = '<reasoning>استدلال</reasoning>پاسخ نهایی';
  assert.equal(ai.stripThinkingTags(sampleReasoningTag), 'پاسخ نهایی');

  const sampleNormal = 'سلام، چطور می‌توانم به شما کمک کنم؟';
  assert.equal(ai.stripThinkingTags(sampleNormal), sampleNormal);
});

test('فیلتر استریم توکن‌های <think> را در زمان واقعی فیلتر می‌کند و مانع نشت فرآیند فکر می‌شود', () => {
  const filter = new ai.ThinkingFilter();
  let streamed = '';

  // شبیه‌سازی توکن‌های تکه‌تکه
  streamed += filter.process('<');
  streamed += filter.process('th');
  streamed += filter.process('ink>');
  streamed += filter.process('مشتری می‌خواهد بداند سفارشش کجاست...');
  streamed += filter.process('</');
  streamed += filter.process('think');
  streamed += filter.process('>\n\n');
  streamed += filter.process('سلام! ');
  streamed += filter.process('سفارش شما در حال پردازش است.');
  streamed += filter.flush();

  assert.equal(streamed, 'سلام! سفارش شما در حال پردازش است.');
  assert.equal(streamed.includes('مشتری می‌خواهد'), false);
  assert.equal(streamed.includes('<think>'), false);
  assert.equal(streamed.includes('</think>'), false);
});

test('فیلتر استریم متن‌های بدون تگ تفکر یا علامت کوچکتری را بدون تأخیر عبور می‌دهد', () => {
  const filter = new ai.ThinkingFilter();
  let streamed = '';
  streamed += filter.process('قیمت این کالا < 5000 تومان است.');
  streamed += filter.flush();
  assert.equal(streamed, 'قیمت این کالا < 5000 تومان است.');
});

test('parser رویداد SSE استاندارد را می‌خواند', () => {
  const event = ai.parseSseBlock('data: {"choices":[{"delta":{"content":"سلام"}}]}');
  assert.equal(event.choices[0].delta.content, 'سلام');
  assert.deepEqual(ai.parseSseBlock('data: [DONE]'), { done: true });
  assert.equal(ai.parseSseBlock('event: ping'), null);
});

test('تنها خطاهای موقت برای failover مناسب‌اند', () => {
  assert.equal(ai.isRetryableProviderError({ response: { status: 429 } }), true);
  assert.equal(ai.isRetryableProviderError({ response: { status: 401 } }), false);
  assert.equal(ai.isRetryableProviderError({ code: 'ETIMEDOUT' }), true);
  assert.equal(ai.isRetryableProviderError({ code: 'ERR_CANCELED' }), false);
});

test('آدرس پایه با پسوند chat/completions نرمال می‌شود', () => {
  assert.equal(ai.normalizeBaseUrl('https://api.groq.com/openai/v1/chat/completions'), 'https://api.groq.com/openai/v1');
  assert.equal(ai.normalizeBaseUrl('https://api.groq.com/openai/v1/'), 'https://api.groq.com/openai/v1');
  assert.equal(ai.normalizeBaseUrl('https://api.groq.com/openai/v1'), 'https://api.groq.com/openai/v1');
});

function mockAiStack(providers, axiosPostImpl) {
  const originals = {
    providerFind: AiProvider.find,
    settingsFindOne: Settings.findOne,
    axiosPost: axios.post,
  };
  const settingsDocument = { aiConfig: { enabled: true, maxTokens: 500, temperature: 0.5 } };
  ai.providerHealth.clear();
  AiProvider.find = () => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => providers,
  });
  Settings.findOne = () => ({
    select() { return { lean: async () => settingsDocument }; },
    lean: async () => settingsDocument,
  });
  axios.post = axiosPostImpl;
  return () => {
    AiProvider.find = originals.providerFind;
    Settings.findOne = originals.settingsFindOne;
    axios.post = originals.axiosPost;
    ai.providerHealth.clear();
  };
}

const singleOldProvider = [
  {
    _id: 'old-provider', name: 'قدیمی', baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'test-key',
    model: 'llama-3.3-70b-versatile', maxTokens: 500, temperature: 0.5, isActive: true, isDefault: true, priority: 1,
  },
];

async function runClearMyHistoryTest() {
  const original = ChatHistory.findOneAndUpdate;
  let captured = null;
  ChatHistory.findOneAndUpdate = async (query, update) => {
    captured = { query, update };
    return {};
  };
  const makeRes = () => {
    const res = { statusCode: 200, payload: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (p) => { res.payload = p; return res; };
    return res;
  };
  try {
    // مهمان با sessionId معتبر → باید با همان sessionId پاک شود
    let res = makeRes();
    await chatController.clearMyHistory({ headers: { 'x-session-id': 'sess_test123' }, body: {}, user: null }, res);
    assert.equal(res.payload?.success, true);
    assert.equal(captured.query.sessionId, 'sess_test123');
    assert.deepEqual(captured.update.$set.messages, []);

    // کاربر لاگین‌کرده → اولویت با userId است
    captured = null;
    res = makeRes();
    const fakeUserId = '507f1f77bcf86cd799439011';
    await chatController.clearMyHistory({
      headers: {}, body: {}, user: { _id: { toString: () => fakeUserId } },
    }, res);
    assert.equal(res.payload?.success, true);
    assert.equal(String(captured.query.userId), fakeUserId);

    // بدون هیچ شناسه‌ای → 400
    res = makeRes();
    await chatController.clearMyHistory({ headers: {}, body: {}, user: null }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload?.success, false);
  } finally {
    ChatHistory.findOneAndUpdate = original;
  }
}

async function runDecommissionedModelTest() {
  const restore = mockAiStack(singleOldProvider, async () => {
    const error = new Error('model decommissioned');
    error.response = {
      status: 400,
      data: { error: { code: 'model_decommissioned', message: 'llama-3.3-70b-versatile has been decommissioned' } },
    };
    throw error;
  });
  try {
    let thrown = null;
    try {
      await aiService.generateExpertResponse('سلام', '', [], '');
    } catch (e) { thrown = e; }
    assert.ok(thrown, 'باید خطا پرتاب شود');
    assert.match(thrown.message, /منسوخ/);
  } finally {
    restore();
  }
}

async function runUnknownModel404Test() {
  const restore = mockAiStack(singleOldProvider, async () => {
    const error = new Error('not found');
    error.response = { status: 404, data: '<html>Not Found</html>' };
    throw error;
  });
  try {
    let thrown = null;
    try {
      await aiService.generateExpertResponse('سلام', '', [], '');
    } catch (e) { thrown = e; }
    assert.ok(thrown, 'باید خطا پرتاب شود');
    assert.match(thrown.message, /نامعتبر/);
  } finally {
    restore();
  }
}

async function runFailoverTest() {
  const originals = {
    providerFind: AiProvider.find,
    settingsFindOne: Settings.findOne,
    axiosPost: axios.post,
  };

  const settingsDocument = { aiConfig: { enabled: true, maxTokens: 500, temperature: 0.5 } };
  const providers = [
    {
      _id: 'primary-provider', name: 'اصلی', baseUrl: 'https://primary.example/v1', apiKey: 'primary-key',
      model: 'primary-model', maxTokens: 500, temperature: 0.5, isActive: true, isDefault: true, priority: 1,
    },
    {
      _id: 'fallback-provider', name: 'جایگزین', baseUrl: 'https://fallback.example/v1', apiKey: 'fallback-key',
      model: 'fallback-model', maxTokens: 500, temperature: 0.5, isActive: true, isDefault: false, priority: 2,
    },
  ];

  try {
    ai.providerHealth.clear();
    AiProvider.find = () => ({
      select() { return this; },
      sort() { return this; },
      lean: async () => providers,
    });
    Settings.findOne = () => ({
      select() { return { lean: async () => settingsDocument }; },
      lean: async () => settingsDocument,
    });

    let callCount = 0;
    axios.post = async (url) => {
      callCount += 1;
      if (url.includes('primary.example')) {
        const error = new Error('temporary upstream failure');
        error.response = { status: 503 };
        throw error;
      }
      return { data: { choices: [{ message: { content: 'پاسخ از ارائه‌دهنده جایگزین' } }] } };
    };

    const result = await aiService.generateExpertResponse('سلام', '', [], '');
    assert.equal(callCount, 2);
    assert.equal(result.message, 'پاسخ از ارائه‌دهنده جایگزین');
    assert.equal(result.provider.name, 'جایگزین');
  } finally {
    AiProvider.find = originals.providerFind;
    Settings.findOne = originals.settingsFindOne;
    axios.post = originals.axiosPost;
    ai.providerHealth.clear();
  }
}

(async () => {
  await asyncTest('خطای موقت ارائه‌دهنده اصلی به جایگزین سالم failover می‌شود', runFailoverTest);
  await asyncTest('مدل منسوخ‌شده پیام دقیق «منسوخ» می‌دهد نه خطای generic', runDecommissionedModelTest);
  await asyncTest('مدل ناشناخته (404) پیام راهنمای تنظیمات می‌دهد', runUnknownModel404Test);
  await asyncTest('پاک‌سازی گفتگو برای مهمان و کاربر با هویت درست انجام می‌شود', runClearMyHistoryTest);
  console.log('آزمون‌های معماری چت‌بات با موفقیت انجام شد.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
