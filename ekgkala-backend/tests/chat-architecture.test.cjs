const assert = require('node:assert/strict');
const axios = require('axios');
const AiProvider = require('../models/AiProvider');
const Settings = require('../models/Settings');
const { __private__: chat } = require('../controllers/chatController');
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
  console.log('آزمون‌های معماری چت‌بات با موفقیت انجام شد.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
