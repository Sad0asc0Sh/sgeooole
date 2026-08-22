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
