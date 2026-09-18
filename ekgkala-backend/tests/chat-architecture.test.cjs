const assert = require('node:assert/strict');
const axios = require('axios');
const AiProvider = require('../models/AiProvider');
const Settings = require('../models/Settings');
const ChatHistory = require('../models/ChatHistory');
const chatController = require('../controllers/chatController');
const chatRetrieval = require('../utils/chatRetrieval');
const packWizard = require('../utils/packWizard');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
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

test('درخواست پک دوربین تشخیص داده می‌شود و غیرپک نه', () => {
  const r1 = chatRetrieval.detectPackRequest('میخوام یه پک کامل دوربین مداربسته بخرم', []);
  assert.equal(r1.isPack, true);
  assert.equal(r1.domain && r1.domain.id, 'camera');

  const r2 = chatRetrieval.detectPackRequest('قیمت دوربین چقدره؟', []);
  assert.equal(r2.isPack, false);

  const r3 = chatRetrieval.detectPackRequest('یه پک تغذیه ورزشی میخوام', []);
  assert.equal(r3.isPack, true);
  assert.equal(r3.domain, null);
});

function mockPackCatalog(canned) {
  const originals = { productFind: Product.find, categoryFind: Category.find, brandFind: Brand.find };
  const norm = chatRetrieval.normalizeFa;
  Category.find = () => ({ select: () => ({ lean: async () => [] }) });
  Brand.find = () => ({ select: () => ({ lean: async () => [] }) });
  Product.find = (filter) => {
    const terms = [];
    for (const cond of ((filter && filter.$or) || [])) {
      for (const v of Object.values(cond)) {
        if (v && typeof v === 'object' && v.$regex) terms.push(norm(String(v.$regex)));
      }
    }
    const hits = canned.filter((p) => terms.some((t) => t.length >= 2 && norm(p.name).includes(t)));
    const chain = {
      populate: () => chain,
      select: () => chain,
      limit: () => chain,
      lean: async () => hits,
    };
    return chain;
  };
  return () => {
    Product.find = originals.productFind;
    Category.find = originals.categoryFind;
    Brand.find = originals.brandFind;
  };
}

const packCanned = [
  { _id: 'cam1', name: 'دوربین مداربسته تحت شبکه ۴ مگاپیکسل', productType: 'simple', price: 2500000, stock: 5, images: [], specifications: {}, properties: [], category: null, brand: null, rating: 4.5, numReviews: 10, guarantee: '۱۸ ماهه' },
  { _id: 'cam2', name: 'دوربین مداربسته آنالوگ ۲ مگاپیکسل', productType: 'simple', price: 1200000, stock: 3, images: [], specifications: {}, properties: [], category: null, brand: null, rating: 4, numReviews: 5, guarantee: '' },
  { _id: 'cam3', name: 'دوربین مداربسته قدیمی', productType: 'simple', price: 500000, stock: 0, images: [], specifications: {}, properties: [], category: null, brand: null, rating: 3, numReviews: 2, guarantee: '' },
  { _id: 'nvr1', name: 'دستگاه ضبط NVR چهار کانال', productType: 'simple', price: 3800000, stock: 2, images: [], specifications: {}, properties: [], category: null, brand: null, rating: 4.2, numReviews: 7, guarantee: '' },
  { _id: 'hdd1', name: 'هارددیسک یک ترابایت', productType: 'simple', price: 2900000, stock: 4, images: [], specifications: {}, properties: [], category: null, brand: null, rating: 4.8, numReviews: 20, guarantee: '' },
  { _id: 'psu1', name: 'آداپتور ۱۲ ولت ۲ آمپر', productType: 'simple', price: 180000, stock: 10, images: [], specifications: {}, properties: [], category: null, brand: null, rating: 4, numReviews: 3, guarantee: '' },
  { _id: 'cable1', name: 'کابل شبکه CAT6', productType: 'simple', price: 90000, stock: 20, images: [], specifications: {}, properties: [], category: null, brand: null, rating: 4.1, numReviews: 8, guarantee: '' },
];

async function runBuildPackageTest() {
  const restore = mockPackCatalog(packCanned);
  try {
    const history = [{ role: 'user', content: 'میخوام یه پک کامل دوربین بخرم' }, { role: 'assistant', content: 'چند عدد؟' }];
    const pkg = await chatRetrieval.buildPackage('داخل منزل', history);
    assert.ok(pkg, 'بسته باید ساخته شود');
    assert.equal(pkg.domainId, 'camera');

    // جزء اصلی + حداقل ۲ بخش
    assert.ok(pkg.sections.some((s) => s.key === 'camera'), 'بخش دوربین الزامی است');
    assert.ok(pkg.sections.length >= 2, 'حداقل دو بخش لازم است');

    // همه گزینه‌ها موجودند و شناسه واقعی دارند (بدون توهم)
    const allIds = new Set(packCanned.filter((p) => p.stock > 0).map((p) => p._id));
    for (const s of pkg.sections) {
      assert.ok(s.options.length > 0 && s.options.length <= 3, `بخش ${s.key} باید ۱ تا ۳ گزینه داشته باشد`);
      for (const o of s.options) {
        assert.ok(allIds.has(o.id), `شناسه ${o.id} باید واقعی و موجود باشد`);
        assert.equal(o.inStock, true);
      }
      assert.ok(s.options.some((o) => o.id === s.defaultId), 'گزینه پیش‌فرض باید از گزینه‌ها باشد');
    }

    // دقت معنایی: دوربین نباید در بخش سوئیچ بیاید؛ سوئیچ/مانیتور بدون موجودی‌اند
    assert.ok(!pkg.sections.some((s) => s.key === 'switch'), 'بخش سوئیچ نباید با کالای نامرتبط پر شود');
    assert.ok(pkg.missing.includes('سوئیچ شبکه'), 'سوئیچ باید در missing اعلام شود');

    // متن grounding شامل بخش‌ها و هشدار missing است
    const ctx = chatRetrieval.formatPackageContext(pkg);
    assert.ok(ctx.includes('دوربین مداربسته'), 'متن باید بخش دوربین را داشته باشد');
    assert.ok(ctx.includes('بدون موجودی'), 'متن باید missing را اعلام کند');
  } finally {
    restore();
  }
}

/* ---------- ویزارد پک مرحله‌به‌مرحله ---------- */

const wizCats = [
  { _id: 'c1', name: 'دوربین مداربسته', parent: null, slug: 'c1' },
  { _id: 'c2', name: 'دوربین تحت شبکه', parent: 'c1', slug: 'c2' },
  { _id: 'c3', name: 'دستگاه ضبط', parent: 'c1', slug: 'c3' },
  { _id: 'c4', name: 'هارددیسک', parent: null, slug: 'c4' },
  { _id: 'c5', name: 'سوئیچ شبکه', parent: null, slug: 'c5' },
];

const wizCanned = [
  { _id: 'p1', name: 'دوربین تحت شبکه ۴ مگاپیکسل', productType: 'simple', price: 2000000, stock: 5, images: [], specifications: {}, properties: [], category: 'c2', brand: null, rating: 4.5, numReviews: 10, guarantee: '', salesCount: 10, priceUpdatedAt: new Date('2026-09-10'), priceUpdateCount: 2, updatedAt: new Date('2026-09-10') },
  { _id: 'p2', name: 'دوربین آنالوگ ۲ مگاپیکسل', productType: 'simple', price: 1000000, stock: 3, images: [], specifications: {}, properties: [], category: 'c2', priceUpdatedAt: null, priceUpdateCount: 0, brand: null, rating: 4, numReviews: 5, guarantee: '', salesCount: 50, updatedAt: new Date('2026-01-05') },
  { _id: 'p3', name: 'DS-2CD1023', productType: 'simple', price: 1500000, stock: 4, images: [], specifications: {}, properties: [], category: 'c2', priceUpdatedAt: null, priceUpdateCount: 0, brand: null, rating: 4, numReviews: 2, guarantee: '', salesCount: 5, updatedAt: new Date('2026-02-01') },
  { _id: 'p4', name: 'دستگاه ضبط NVR چهار کانال', productType: 'simple', price: 3000000, stock: 2, images: [], specifications: {}, properties: [], category: 'c3', priceUpdatedAt: null, priceUpdateCount: 0, brand: null, rating: 4.2, numReviews: 7, guarantee: '', salesCount: 8, updatedAt: new Date('2026-03-01') },
  { _id: 'p5', name: 'هارددیسک یک ترابایت', productType: 'simple', price: 2900000, stock: 4, images: [], specifications: {}, properties: [], category: 'c4', priceUpdatedAt: null, priceUpdateCount: 0, brand: null, rating: 4.8, numReviews: 20, guarantee: '', salesCount: 30, updatedAt: new Date('2026-04-01') },
  { _id: 'p6', name: 'آداپتور ۱۲ ولت ۲ آمپر', productType: 'simple', price: 180000, stock: 10, images: [], specifications: {}, properties: [], category: null, priceUpdatedAt: null, priceUpdateCount: 0, brand: null, rating: 4, numReviews: 3, guarantee: '', salesCount: 12, updatedAt: new Date('2026-05-01') },
  { _id: 'p7', name: 'کابل شبکه CAT6', productType: 'simple', price: 90000, stock: 20, images: [], specifications: {}, properties: [], category: null, priceUpdatedAt: null, priceUpdateCount: 0, brand: null, rating: 4.1, numReviews: 8, guarantee: '', salesCount: 40, updatedAt: new Date('2026-06-01') },
  { _id: 'p8', name: 'سوئیچ ۸ پورت گیگ', productType: 'simple', price: 1200000, stock: 1, images: [], specifications: {}, properties: [], category: 'c5', priceUpdatedAt: null, priceUpdateCount: 0, brand: null, rating: 4.3, numReviews: 4, guarantee: '', salesCount: 6, updatedAt: new Date('2026-07-01') },
  { _id: 'p9', name: 'دوربین قدیمی بدون موجودی', productType: 'simple', price: 500000, stock: 0, images: [], specifications: {}, properties: [], category: 'c2', priceUpdatedAt: null, priceUpdateCount: 0, brand: null, rating: 3, numReviews: 1, guarantee: '', salesCount: 1, updatedAt: new Date('2026-08-01') },
];

function mockWizardCatalog() {
  const originals = { productFind: Product.find, productFindById: Product.findById, categoryFind: Category.find, brandFind: Brand.find };
  const withPop = (p) => ({
    ...p,
    category: wizCats.find((c) => String(c._id) === String(p.category)) || null,
    brand: null,
  });
  Category.find = () => ({ select: () => ({ lean: async () => wizCats }) });
  Brand.find = () => ({ select: () => ({ lean: async () => [] }) });
  Product.find = (filter) => {
    let hits = wizCanned;
    const inIds = filter && filter.category && filter.category.$in;
    if (inIds) {
      const set = new Set(inIds.map(String));
      hits = wizCanned.filter((p) => set.has(String(p.category)));
    } else if (filter && filter.$or) {
      const norm = chatRetrieval.normalizeFa;
      const terms = [];
      for (const cond of filter.$or) {
        for (const v of Object.values(cond)) {
          if (v && typeof v === 'object' && v.$regex) terms.push(norm(String(v.$regex)));
        }
      }
      hits = wizCanned.filter((p) => terms.some((t) => t.length >= 2 && norm(p.name).includes(t)));
    }
    const chain = {
      populate: () => chain,
      select: () => chain,
      limit: () => chain,
      lean: async () => hits.map(withPop),
    };
    return chain;
  };
  Product.findById = (id) => {
    const chain = {
      populate: () => chain,
      select: () => ({ lean: async () => {
        const p = wizCanned.find((x) => String(x._id) === String(id));
        return p ? withPop(p) : null;
      } }),
    };
    return chain;
  };
  return () => {
    Product.find = originals.productFind;
    Product.findById = originals.productFindById;
    Category.find = originals.categoryFind;
    Brand.find = originals.brandFind;
  };
}

async function runWizardFlowTest() {
  const restore = mockWizardCatalog();
  try {
    // ۰) شروع با پیام خالی از جزئیات → فاز نیازسنجی، بدون هیچ گزینه‌ای
    const started = await packWizard.startWizard('camera', 'میخوام پک دوربین ببندم', []);
    assert.equal(started.started, true, 'ویزارد باید شروع شود');
    assert.equal(started.state.phase, 'needs', 'اول فاز نیازسنجی است');
    const state = started.state;
    const viewNeeds = await packWizard.getWizardView(state, []);
    assert.equal(viewNeeds.phase, 'needs');
    assert.equal(viewNeeds.current, null, 'در فاز نیازسنجی گزینه‌ای نشان داده نمی‌شود');
    assert.ok(viewNeeds.needsQuestions.length >= 2, 'سوالات نیازسنجی باید باشد');

    // پیام شروعِ پرجزئیات → کردیت کافی و ورود مستقیم به مرحله‌ها
    const rich = await packWizard.startWizard('camera', '۴ تا دوربین اقتصادی برای باغ میخوام', []);
    assert.equal(rich.stepsBegun, true, 'با نیازهای گفته‌شده باید مستقیم وارد مرحله‌ها شود');

    // ۱) بخش‌ها از روی اسم دسته‌بندی‌ها
    const keys = state.steps.map((s) => s.key);
    assert.ok(keys.includes('camera'), 'بخش دوربین از دسته‌بندی‌ها آمده');
    assert.ok(keys.includes('recorder'), 'بخش ضبط از دسته‌بندی‌ها آمده');
    const camStep = state.steps.find((s) => s.key === 'camera');
    assert.ok(camStep.categoryIds.map(String).includes('c1'), 'دسته «دوربین مداربسته» به بخش دوربین رسیده');

    // ورود به فاز مرحله‌ها (مثل جواب به ۲ سوال)
    const entered = await packWizard.enterStepsPhase(state, []);
    assert.equal(entered.ok, true);
    // مانیتور دسته ندارد و کالایی هم ندارد → unavailable
    const monStep = state.steps.find((s) => s.key === 'monitor');
    assert.equal(monStep.status, 'unavailable');
    assert.equal(state.steps[state.currentIndex].key, 'camera', 'شروع از دوربین');

    // ۲) گزینه‌های دوربین: تازه‌ترین قیمت اول (p1 با priceUpdatedAt جدید، با وجود فروش کمتر از p2)
    const view0 = await packWizard.getWizardView(state, []);
    assert.ok(view0.current && view0.current.key === 'camera');
    const ids0 = view0.current.options.filter((o) => o.inStock).map((o) => o.id);
    assert.equal(ids0[0], 'p1', 'تازه‌ترین قیمت باید اول باشد');
    assert.ok(!ids0.includes('p9'), 'ناموجود نباید قابل انتخاب باشد');
    // کالای با اسم غیرمعمول (DS-2CD1023) چون دسته‌اش انحصاری دوربین است، نگه داشته می‌شود
    assert.ok(ids0.includes('p3'), 'کالای دسته انحصاری نباید حذف شود');

    // ۳) انتخاب اشتباه (هارد در مرحله دوربین) رد می‌شود
    const bad = await packWizard.selectOption(state, 'p5', 1);
    assert.equal(bad.ok, false, 'انتخاب کالای مرحله دیگر باید رد شود');

    // ۴) انتخاب درست → رفتن به مرحله بعد
    const good = await packWizard.selectOption(state, 'p1', 1);
    assert.equal(good.ok, true);
    assert.equal(state.steps[state.currentIndex].key, 'recorder', 'بعد از دوربین، دستگاه ضبط می‌آید');

    // ۵) برگشت: انتخاب پاک و مرحله برمی‌گردد
    const back = packWizard.goBack(state);
    assert.equal(back.ok, true);
    assert.equal(state.steps[state.currentIndex].key, 'camera');
    assert.equal(state.selections.length, 0, 'انتخاب برگشتی باید پاک شود');

    // ۶) تکمیل کل مسیر تا بسته نهایی
    await packWizard.selectOption(state, 'p2', 2);
    await packWizard.selectOption(state, 'p4', 1);
    await packWizard.selectOption(state, 'p5', 1);
    await packWizard.selectOption(state, 'p6', 1);
    await packWizard.selectOption(state, 'p7', 1);
    const skipSw = await packWizard.skipCurrent(state); // سوئیچ اختیاری
    assert.equal(skipSw.ok, true);
    assert.equal(packWizard.isComplete(state), true, 'ویزارد باید کامل شده باشد');

    const finalPkg = await packWizard.buildFinalPackage(state, []);
    assert.ok(finalPkg, 'بسته نهایی باید ساخته شود');
    assert.equal(finalPkg.sections.length, 5, 'پنج بخش تأییدشده');
    const camSec = finalPkg.sections.find((s) => s.key === 'camera');
    assert.equal(camSec.defaultId, 'p2', 'پیش‌فرض بخش دوربین همان انتخاب کاربر است');
    assert.ok(finalPkg.missing.includes('مانیتور'), 'مانیتور در missing اعلام می‌شود');

    // ۷) متن grounding شامل تأییدشده‌ها و مرحله‌هاست
    const viewDone = await packWizard.getWizardView(state, []);
    const ctx = packWizard.formatWizardContext(viewDone);
    assert.ok(ctx.includes('دوربین آنالوگ'), 'متن باید انتخاب کاربر را داشته باشد');
  } finally {
    restore();
  }
}

async function runWizardNeedsGatingTest() {
  const restore = mockWizardCatalog();
  try {
    const chat = require('../controllers/chatController').__private__;
    const session = { packWizard: { active: false }, messages: [], save: async () => {} };

    // نوبت ۱: درخواست پک → فقط فاز نیازسنجی، بدون هیچ گزینه‌ای
    let prep = await chat.preparePackWizard('میخوام پک دوربین ببندم', session, []);
    assert.equal(prep.wizardCreated, true);
    assert.equal(prep.view.phase, 'needs', 'نوبت اول فقط نیازسنجی است');
    assert.equal(prep.view.current, null, 'در نیازسنجی گزینه‌ای نشان داده نمی‌شود');

    // نوبت ۲: جواب اول → هنوز نیازسنجی
    session.messages.push({ role: 'user', content: 'میخوام پک دوربین ببندم', timestamp: new Date(Date.now() - 60000) });
    prep = await chat.preparePackWizard('دو تا', session, []);
    assert.equal(prep.view.phase, 'needs', 'با یک جواب هنوز محصولی نشان داده نمی‌شود');
    assert.equal(prep.view.current, null);

    // نوبت ۳: جواب دوم → ورود به مرحله‌ها از دوربین
    session.messages.push({ role: 'user', content: 'دو تا', timestamp: new Date() });
    prep = await chat.preparePackWizard('داخل منزل', session, []);
    assert.equal(prep.wizardStepsBegun, true, 'با دو جواب وارد مرحله‌ها می‌شود');
    assert.equal(prep.view.phase, 'steps');
    assert.ok(prep.view.current && prep.view.current.key === 'camera', 'اولین قدم دوربین است');
    assert.ok(prep.view.current.options.length > 0, 'حالا گزینه‌های قدم اول نمایش داده می‌شود');
  } finally {
    restore();
  }
}

async function runWizardNeedsTest() {
  const restore = mockWizardCatalog();
  try {
    // شمارش جواب‌ها از روی timestamp پیام‌ها
    const base = Date.now();
    const msgs = [
      { role: 'user', content: 'میخوام پک دوربین ببندم', timestamp: new Date(base - 10000) },
      { role: 'user', content: 'دو تا', timestamp: new Date(base + 1000) },
    ];
    const since = new Date(base);
    assert.equal(packWizard.countUserAnswersSince(msgs, since), 1, 'فقط پیام بعد از شروع شمرده می‌شود');

    // کردیت پیام شروع
    assert.ok(packWizard.initialNeedsCredit('۴ تا برای باغ اقتصادی', []) >= 2, 'جزئیات کامل کردیت کامل می‌دهد');
    assert.equal(packWizard.initialNeedsCredit('میخوام پک ببندم', []), 0, 'پیام خالی کردیت ندارد');

    // رد سوالات → ورود مستقیم به مرحله‌ها
    const started = await packWizard.startWizard('camera', 'پک میخوام', []);
    assert.equal(started.state.phase, 'needs');
    const skipped = await packWizard.skipNeedsPhase(started.state, []);
    assert.equal(skipped.ok, true, 'رد سوالات باید وارد مرحله‌ها شود');
    assert.equal(started.state.phase, 'steps');
    assert.equal(started.state.steps[started.state.currentIndex].key, 'camera');

    // سخت‌گیری fallback: بخش بدون دسته (power) فقط تطابق اسمی می‌پذیرد
    const powerStep = started.state.steps.find((s) => s.key === 'power');
    assert.deepEqual(powerStep.categoryIds, [], 'بخش آداپتور دسته ندارد');
    const powerOpts = await packWizard.getStepOptions(powerStep, [], 4);
    assert.ok(powerOpts.length > 0, 'گزینه آداپتور باید باشد');
    assert.ok(powerOpts.every((o) => o.name.includes('آداپتور')), 'فقط تطابق اسمی، بدون محصول خارج از حیطه');
  } finally {
    restore();
  }
}

async function runCctvEngineeringRulesTest() {
  const cctvEngine = require('../utils/cctvEngine');

  // ۱. تست استخراج هوشمند نیازها
  const needsOutdoor = cctvEngine.parseCctvNeeds('۴ عدد دوربین برای فضای بیرونی باغ میخوام با قیمت اقتصادی');
  assert.equal(needsOutdoor.cameraCount, 4, 'تعداد ۴ دوربین باید استخراج شود');
  assert.equal(needsOutdoor.environment, 'outdoor', 'محیط باید outdoor باشد');
  assert.equal(needsOutdoor.techType, 'ahd', 'تکنولوژی اقتصادی باید ahd باشد');

  const needsIndoorIp = cctvEngine.parseCctvNeeds('داخل مغازه ۲ تا دوربین تحت شبکه میخوام');
  assert.equal(needsIndoorIp.cameraCount, 2, 'تعداد ۲ دوربین باید استخراج شود');
  assert.equal(needsIndoorIp.environment, 'indoor', 'محیط باید indoor باشد');
  assert.equal(needsIndoorIp.techType, 'ip', 'تکنولوژی تحت شبکه باید ip باشد');

  // ۲. تست سازگاری مهندسی در ویزارد
  const restore = mockWizardCatalog();
  try {
    const started = await packWizard.startWizard('camera', '۴ تا دوربین بولت برای باغ میخوام به صورت اقتصادی', []);
    assert.equal(started.started, true);
    assert.equal(started.stepsBegun, true, 'با جزئیات کامل مستقیم وارد مرحله‌ها می‌شود');
    assert.equal(started.state.requirements.cameraCount, 4);
    assert.equal(started.state.requirements.environment, 'outdoor');

    // مرحله دوربین: گزینه‌ها باید دارای تعداد پیشنهادی ۴ و تایید فنی باشند
    const viewCam = await packWizard.getWizardView(started.state, []);
    assert.ok(viewCam.current);
    assert.equal(viewCam.current.key, 'camera');
    const camOption = viewCam.current.options[0];
    assert.equal(camOption.recommendedQty, 4, 'تعداد پیشنهادی دوربین باید ۴ باشد');
    assert.ok(camOption.compatibilityHint, 'باید دارای توضیح سازگاری مهندسی باشد');

    // انتخاب دوربین
    const selCam = await packWizard.selectOption(started.state, camOption.id, camOption.recommendedQty);
    assert.equal(selCam.ok, true);
    assert.equal(started.state.selections[0].qty, 4, 'تعداد انتخابی دوربین باید ۴ عدد ثبت شود');

    // مرحله دستگاه ضبط
    const viewRec = await packWizard.getWizardView(started.state, []);
    assert.ok(viewRec.current);
    assert.equal(viewRec.current.key, 'recorder');

    // انتخاب دستگاه ضبط و رفتن تا آخر
    const recOpt = viewRec.current.options[0];
    await packWizard.selectOption(started.state, recOpt.id, 1);

    // هارد
    const viewHdd = await packWizard.getWizardView(started.state, []);
    assert.equal(viewHdd.current.key, 'hdd');
    await packWizard.selectOption(started.state, viewHdd.current.options[0].id, 1);

    // پاور
    const viewPwr = await packWizard.getWizardView(started.state, []);
    assert.equal(viewPwr.current.key, 'power');
    await packWizard.selectOption(started.state, viewPwr.current.options[0].id, 1);

    // کابل
    const viewCable = await packWizard.getWizardView(started.state, []);
    assert.equal(viewCable.current.key, 'cable');
    await packWizard.selectOption(started.state, viewCable.current.options[0].id, 1);

    // بسته نهایی
    const finalPkg = await packWizard.buildFinalPackage(started.state, []);
    assert.ok(finalPkg, 'بسته نهایی باید ساخته شود');
    const camSec = finalPkg.sections.find((s) => s.key === 'camera');
    assert.equal(camSec.recommendedQty, 4, 'تعداد دوربین در بسته نهایی باید ۴ باشد نه ۱');
  } finally {
    restore();
  }
}

(async () => {
  await asyncTest('خطای موقت ارائه‌دهنده اصلی به جایگزین سالم failover می‌شود', runFailoverTest);
  await asyncTest('مدل منسوخ‌شده پیام دقیق «منسوخ» می‌دهد نه خطای generic', runDecommissionedModelTest);
  await asyncTest('مدل ناشناخته (404) پیام راهنمای تنظیمات می‌دهد', runUnknownModel404Test);
  await asyncTest('پاک‌سازی گفتگو برای مهمان و کاربر با هویت درست انجام می‌شود', runClearMyHistoryTest);
  await asyncTest('بسته پک فقط از کالاهای واقعی موجود و مرتبط ساخته می‌شود', runBuildPackageTest);
  await asyncTest('ویزارد پک: شروع از دسته‌بندی‌ها، ترتیب تازگی قیمت، انتخاب/برگشت/بسته نهایی', runWizardFlowTest);
  await asyncTest('ویزارد پک: فاز نیازسنجی، کردیت، رد سوالات و تطابق اسمی سخت‌گیرانه', runWizardNeedsTest);
  await asyncTest('ویزارد پک: گیتینگ نوبت‌ها — حین نیازسنجی محصولی نیست، بعدش قدم اول', runWizardNeedsGatingTest);
  await asyncTest('قوانین مهندسی مداربسته: محاسبه مقادیر، سازگاری قطعی اقلام و پکیج نهایی', runCctvEngineeringRulesTest);
  console.log('آزمون‌های معماری چت‌بات با موفقیت انجام شد.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
