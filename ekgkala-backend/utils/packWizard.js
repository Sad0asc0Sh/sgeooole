/**
 * packWizard.js
 * ویزارد پک‌ساز مرحله‌به‌مرحله — دقت از سه‌راه:
 *  1. بخش‌ها از روی «اسم دسته‌بندی‌های» واقعی فروشگاه ساخته می‌شوند، نه حدس روی اسم محصولات.
 *  2. هر مرحله فقط گزینه‌های همان دسته را نشان می‌دهد، با «تازه‌ترین قیمت اول».
 *  3. کاربر هر قدم را تیک می‌زند (تأیید دوم) و بعد مرحله بعد باز می‌شود.
 *
 * وضعیت در ChatHistory.packWizard ذخیره می‌شود تا با رفتن به صفحه جزئیات و برگشتن گم نشود.
 */

const Product = require('../models/Product');
const Category = require('../models/Category');
const { WIZARD_DOMAINS } = require('./packDomains');
const {
  normalizeFa,
  extractKeywords,
  effectiveStock,
  toCardPayload,
} = require('./chatRetrieval');

const STEP_OPTION_LIMIT = 4;
const STEP_FETCH_LIMIT = 60;
const NEEDS_REQUIRED_DEFAULT = 2;

const STEP_SELECT_FIELDS = 'name slug productCode description productType price compareAtPrice discount '
  + 'priceUpdatedAt priceUpdateCount stock variants specifications properties images category brand '
  + 'rating numReviews guarantee salesCount updatedAt';

/** تازگی قیمت: priceUpdatedAt وگرنه updatedAt (برای کالاهای قدیمیِ بدون رهگیری) */
function freshnessOf(p) {
  const t = p.priceUpdatedAt || p.updatedAt;
  const ts = t ? new Date(t).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
}

function phraseHaystack(p) {
  return normalizeFa(JSON.stringify([
    p.name,
    p.description,
    p.category && p.category.name,
    p.brand && p.brand.name,
    p.properties,
    p.specifications,
  ]));
}

/**
 * مچ جزء‌ها به دسته‌بندی‌های واقعی فروشگاه.
 * - هر دسته فقط از روی اسمش به جزء‌ها می‌رسد.
 * - اگر یک دسته به چند جزء بخورد (مثلاً «دوربین و دستگاه ضبط»)، آن جزء‌ها sharedPool می‌شوند
 *   تا در سطح محصول با فیلتر عبارتی از هم جدا شوند.
 */
async function resolvePackSteps(domainId) {
  const domain = WIZARD_DOMAINS.find((d) => d.id === domainId);
  if (!domain) return null;

  const all = await Category.find({ isActive: true }).select('_id name slug').lean();
  const matched = domain.components.map(() => []);
  domain.components.forEach((comp, ci) => {
    const pats = (comp.categoryPatterns || []).map((x) => normalizeFa(x)).filter((x) => x.length >= 2);
    for (const c of all) {
      const nm = normalizeFa(c.name || '');
      if (pats.some((pat) => nm.includes(pat))) matched[ci].push(c._id);
    }
  });

  const counts = new Map(); // catId -> تعداد جزء‌هایی که این دسته را می‌خواهند
  matched.flat().forEach((id) => counts.set(String(id), (counts.get(String(id)) || 0) + 1));

  const steps = domain.components.map((comp, ci) => ({
    key: comp.key,
    title: comp.title,
    hint: comp.hint || '',
    optional: Boolean(comp.optional),
    categoryIds: matched[ci],
    phrases: (comp.keywords || []).map((k) => normalizeFa(k)).filter((k) => k.length >= 2),
    sharedPool: matched[ci].some((id) => (counts.get(String(id)) || 0) > 1),
    status: 'pending',
  }));

  return { domain, steps };
}

/** امتیاز ارتباط محصول با کلیدواژه‌های تاریخچه (بوست ملایم، نه فیلتر) */
function historyScore(p, keywords) {
  if (!keywords.length) return 0;
  const hay = phraseHaystack(p);
  let s = 0;
  for (const kw of keywords) {
    if (p.name && normalizeFa(p.name).includes(kw)) s += 2;
    else if (hay.includes(kw)) s += 1;
  }
  return s;
}

/**
 * گزینه‌های یک مرحله: فقط موجودها قابل انتخاب‌اند.
 * ترتیب: موجود اول، بعد تازه‌ترین قیمت، بعد امتیاز تاریخچه، بعد پرفروش‌ها.
 */
async function getStepOptions(step, history = [], limit = STEP_OPTION_LIMIT) {
  const query = { isActive: true };
  const usePool = Array.isArray(step.categoryIds) && step.categoryIds.length > 0 && !step.sharedPool;
  if (usePool) query.category = { $in: step.categoryIds };

  const raw = await Product.find(query)
    .populate('category', 'name slug')
    .populate('brand', 'name slug')
    .select(STEP_SELECT_FIELDS)
    .limit(STEP_FETCH_LIMIT)
    .lean();

  let list = raw;
  if (!usePool) {
    const phrases = Array.isArray(step.phrases) ? step.phrases : [];
    const poolEmpty = !Array.isArray(step.categoryIds) || step.categoryIds.length === 0;
    if (poolEmpty) {
      // بدون دسته‌بندی، فقط تطابق سخت‌گیرانه با «اسم» کالا — تا محصول خارج از حیطه نشان ندهد
      list = raw.filter((p) => phrases.some((ph) => ph && normalizeFa(p.name || '').includes(ph)));
    } else {
      list = raw.filter((p) => phrases.some((ph) => ph && phraseHaystack(p).includes(ph)));
    }
  }

  const keywords = extractKeywords('', history);
  const scored = list.map((p) => ({ p, stock: effectiveStock(p), kw: historyScore(p, keywords) }));
  const inStock = scored.filter((s) => s.stock > 0)
    .sort((a, b) => (freshnessOf(b.p) - freshnessOf(a.p)) || (b.kw - a.kw) || ((b.p.salesCount || 0) - (a.p.salesCount || 0)));
  const outStock = scored.filter((s) => s.stock <= 0)
    .sort((a, b) => (freshnessOf(b.p) - freshnessOf(a.p)) || (b.kw - a.kw) || ((b.p.salesCount || 0) - (a.p.salesCount || 0)));

  return [...inStock, ...outStock].slice(0, limit).map((s) => toCardPayload(s.p));
}

/** آیا این محصول متعلق به همین مرحله است؟ (اعتبارسنجی ضد خطا هنگام انتخاب) */
function productInStep(product, step) {
  if (!product || !step) return false;
  const usePool = Array.isArray(step.categoryIds) && step.categoryIds.length > 0 && !step.sharedPool;
  if (usePool) {
    const cid = product.category && product.category._id ? product.category._id : product.category;
    return (step.categoryIds || []).some((id) => String(id) === String(cid));
  }
  const phrases = Array.isArray(step.phrases) ? step.phrases : [];
  const poolEmpty = !Array.isArray(step.categoryIds) || step.categoryIds.length === 0;
  if (poolEmpty) {
    return phrases.some((ph) => ph && normalizeFa(product.name || '').includes(ph));
  }
  return phrases.some((ph) => ph && phraseHaystack(product).includes(ph));
}

async function fetchProductById(productId) {
  if (!productId) return null;
  try {
    return await Product.findById(productId)
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .select(STEP_SELECT_FIELDS)
      .lean();
  } catch {
    return null;
  }
}

function newWizardState(domain, steps) {
  return {
    active: true,
    domainId: domain.id,
    title: domain.title,
    phase: 'needs',
    createdAt: new Date(),
    needsCredit: 0,
    steps: steps.map((s) => ({ ...s, status: 'pending' })),
    currentIndex: 0,
    selections: [],
    updatedAt: new Date(),
  };
}

/** اگر پیام شروع خودش بخشی از نیازها را گفته (تعداد/محل/بودجه)، کمتر سوال می‌پرسیم */
function initialNeedsCredit(message, history = []) {
  const full = [
    ...(Array.isArray(history) ? history : [])
      .filter((h) => h && h.role === 'user' && h.content)
      .slice(-3)
      .map((h) => String(h.content)),
    String(message || ''),
  ].join(' ');
  const norm = normalizeFa(full);
  let credit = 0;
  if (/\d/.test(norm) || /(عدد|تعداد|چندتا)/.test(norm)) credit += 1;
  if (/(منزل|خانه|باغ|ویلا|ویلا|مغازه|دفتر|محل کار|داخل|بیرون|راه پله|پارکینگ)/.test(norm)) credit += 1;
  if (/(اقتصادی|ارزان|حرفه‌ای|حرفه ای|بودجه|میلیون|تومان|گران)/.test(norm)) credit += 1;
  return Math.min(credit, NEEDS_REQUIRED_DEFAULT);
}

/** تعداد پیام‌های کاربر بعد از شروع ویزارد (جواب‌های نیازسنجی) */
function countUserAnswersSince(messages, since) {
  const t = since ? new Date(since).getTime() : 0;
  return (Array.isArray(messages) ? messages : []).filter((m) => (
    m && m.role === 'user' && m.timestamp && new Date(m.timestamp).getTime() > t
  )).length;
}

function needsRequired(domain) {
  return Number(domain?.needsRequired) || NEEDS_REQUIRED_DEFAULT;
}

/** ورود به فاز مرحله‌ها: بررسی موجودی، علامت unavailable، رفتن به اولین مرحله قابل ارائه */
async function enterStepsPhase(state, history = []) {
  state.phase = 'steps';
  const checks = await Promise.all(state.steps.map(async (step) => {
    const options = await getStepOptions(step, history, 1);
    return options.some((o) => o.inStock);
  }));
  state.steps.forEach((step, i) => {
    if (!checks[i]) step.status = 'unavailable';
  });

  const primaryOk = state.steps.length > 0 && state.steps[0].status !== 'unavailable';
  const viableCount = state.steps.filter((s) => s.status !== 'unavailable').length;
  if (!primaryOk || viableCount < 2) {
    return { ok: false, missing: state.steps.filter((s) => s.status === 'unavailable').map((s) => s.title) };
  }
  state.currentIndex = state.steps.findIndex((s) => s.status === 'pending');
  markCurrent(state);
  state.updatedAt = new Date();
  return { ok: true };
}

function markCurrent(state) {
  state.steps.forEach((s, i) => {
    if (i === state.currentIndex && s.status === 'pending') s.status = 'current';
  });
}

function isComplete(state) {
  return !state || !state.active || (state.currentIndex || 0) >= (state.steps || []).length;
}

/** جلو رفتن به بعدی، با پرش از unavailable/skipped/done (نباید رخ دهد ولی محافظه‌کارانه) */
function advance(state) {
  let i = (state.currentIndex || 0) + 1;
  while (i < state.steps.length && ['done', 'skipped', 'unavailable'].includes(state.steps[i].status)) i += 1;
  state.currentIndex = i;
  markCurrent(state);
}

/**
 * شروع ویزارد: اول فاز نیازسنجی (بدون نمایش هیچ گزینه‌ای).
 * اگر پیام شروع خودش نیازها را گفته باشد (کردیت کافی)، مستقیم وارد مرحله‌ها می‌شود.
 */
async function startWizard(domainId, message = '', history = []) {
  const resolved = await resolvePackSteps(domainId);
  if (!resolved) return { started: false, reason: 'unknown_domain' };
  const { domain, steps } = resolved;
  if (!steps.length) return { started: false, reason: 'no_steps' };

  const state = newWizardState(domain, steps);
  state.needsCredit = initialNeedsCredit(message, history);

  if (state.needsCredit >= needsRequired(domain)) {
    const entered = await enterStepsPhase(state, history);
    if (!entered.ok) {
      return { started: false, reason: 'not_viable', missing: entered.missing || [] };
    }
    return { started: true, state, stepsBegun: true };
  }
  return { started: true, state, needsPhase: true };
}

/** رد شدن از سوالات و رفتن مستقیم به مرحله‌ها */
async function skipNeedsPhase(state, history = []) {
  if (!state || !state.active) return { ok: false, error: 'ویزاردی فعال نیست.' };
  if (state.phase !== 'needs') return { ok: false, error: 'نیازسنجی قبلاً انجام شده است.' };
  const entered = await enterStepsPhase(state, history);
  if (!entered.ok) {
    return { ok: false, error: `فعلاً برای این پک موجودی کافی نیست (${(entered.missing || []).join('، ') || 'نامشخص'}).` };
  }
  return { ok: true };
}

/** اگر مرحله فعلی موجودی‌اش تمام شده، ردش کن و برو بعدی (صداقت + عدم بن‌بست) */
async function ensureCurrentViable(state, history = []) {
  if (!state || !state.active) return false;
  while ((state.currentIndex || 0) < state.steps.length) {
    const step = state.steps[state.currentIndex];
    if (['done', 'skipped', 'unavailable'].includes(step.status)) {
      state.currentIndex += 1;
      continue;
    }
    const options = await getStepOptions(step, history, 1);
    if (options.some((o) => o.inStock)) {
      if (step.status === 'pending') step.status = 'current';
      return true;
    }
    step.status = 'unavailable';
    state.currentIndex += 1;
  }
  return false;
}

function findSelection(state, stepKey) {
  return (state.selections || []).find((s) => s.stepKey === stepKey) || null;
}

/**
 * انتخاب کاربر در مرحله فعلی — اعتبارسنجی سخت‌گیرانه:
 * کالا باید واقعی، فعال، موجود و متعلق به همین مرحله باشد.
 */
async function selectOption(state, productId, qty = 1) {
  if (!state || !state.active) return { ok: false, error: 'ویزاردی فعال نیست.' };
  if (state.phase !== 'steps') {
    return { ok: false, error: 'اول به سوالات نیازسنجی جواب بده (یا ردشان کن) تا گزینه‌ها نمایش داده شوند.' };
  }
  const step = state.steps[state.currentIndex];
  if (!step || step.status === 'unavailable') return { ok: false, error: 'مرحله فعالی برای انتخاب وجود ندارد.' };

  const product = await fetchProductById(productId);
  if (!product) return { ok: false, error: 'این کالا در فروشگاه یافت نشد. لطفاً یکی از گزینه‌های همین مرحله را انتخاب کنید.' };
  if (product.isActive === false) return { ok: false, error: `«${product.name}» غیرفعال شده است. گزینه دیگری انتخاب کنید.` };
  const stock = effectiveStock(product);
  if (stock <= 0) return { ok: false, error: `«${product.name}» ناموجود شد. گزینه دیگری انتخاب کنید.` };
  if (!productInStep(product, step)) {
    return { ok: false, error: `«${product.name}» مربوط به مرحله «${step.title}» نیست. لطفاً از گزینه‌های همین مرحله انتخاب کنید.` };
  }

  const safeQty = Math.min(Math.max(1, Number(qty) || 1), stock);
  state.selections = (state.selections || []).filter((s) => s.stepKey !== step.key);
  state.selections.push({ stepKey: step.key, productId: product._id, qty: safeQty, decidedAt: new Date() });
  step.status = 'done';
  advance(state);
  state.updatedAt = new Date();
  return { ok: true, product: toCardPayload(product), step, completed: isComplete(state) };
}

async function skipCurrent(state) {
  if (!state || !state.active) return { ok: false, error: 'ویزاردی فعال نیست.' };
  if (state.phase !== 'steps') return { ok: false, error: 'هنوز وارد مرحله‌ها نشده‌ایم.' };
  const step = state.steps[state.currentIndex];
  if (!step) return { ok: false, error: 'مرحله فعالی وجود ندارد.' };
  if (!step.optional) return { ok: false, error: `مرحله «${step.title}» الزامی است و نمی‌شود ردش کرد.` };
  step.status = 'skipped';
  state.selections = (state.selections || []).filter((s) => s.stepKey !== step.key);
  advance(state);
  state.updatedAt = new Date();
  return { ok: true, step };
}

function goBack(state) {
  if (!state || !state.active) return { ok: false, error: 'ویزاردی فعال نیست.' };
  if ((state.currentIndex || 0) <= 0) return { ok: false, error: 'در مرحله اول هستید.' };
  state.currentIndex -= 1;
  const affected = new Set(state.steps.slice(state.currentIndex).map((s) => s.key));
  state.selections = (state.selections || []).filter((s) => !affected.has(s.stepKey));
  state.steps.forEach((s, i) => {
    if (i >= state.currentIndex && (s.status === 'done' || s.status === 'skipped' || s.status === 'current')) {
      s.status = 'pending';
    }
  });
  markCurrent(state);
  state.updatedAt = new Date();
  return { ok: true, step: state.steps[state.currentIndex] };
}

function restartWizard(state) {
  if (!state) return null;
  state.selections = [];
  state.currentIndex = 0;
  // شروع دوباره یعنی نیازسنجی از نو
  state.phase = 'needs';
  state.createdAt = new Date();
  state.needsCredit = 0;
  state.steps.forEach((s) => { s.status = 'pending'; });
  state.updatedAt = new Date();
  return state;
}

function deactivateWizard(state) {
  if (!state) return null;
  state.active = false;
  state.updatedAt = new Date();
  return state;
}

/** نمای کامل برای فرانت + grounding — گزینه‌های مرحله فعلی همیشه تازه از دیتابیس */
async function getWizardView(state, history = []) {
  if (!state || !state.active) return null;
  const domain = WIZARD_DOMAINS.find((d) => d.id === state.domainId) || null;

  if (state.phase === 'needs' && domain) {
    const required = needsRequired(domain);
    const answered = (Number(state.needsCredit) || 0);
    return {
      active: true,
      complete: false,
      phase: 'needs',
      domainId: state.domainId,
      title: state.title,
      steps: state.steps.map((s) => ({ key: s.key, title: s.title, optional: Boolean(s.optional), status: s.status })),
      currentIndex: 0,
      current: null,
      selections: [],
      missing: [],
      needsQuestions: (domain.needs || []).map((n) => n.q),
      needsRemaining: Math.max(0, required - answered),
      progress: { done: 0, total: state.steps.length },
    };
  }

  const viable = await ensureCurrentViable(state, history);
  const steps = state.steps.map((s) => ({ key: s.key, title: s.title, optional: Boolean(s.optional), status: s.status }));

  const selections = [];
  for (const sel of (state.selections || [])) {
    const step = state.steps.find((s) => s.key === sel.stepKey);
    const product = await fetchProductById(sel.productId);
    if (!product || !step) continue;
    selections.push({
      stepKey: sel.stepKey,
      stepTitle: step.title,
      product: toCardPayload(product),
      qty: sel.qty,
    });
  }
  // ترتیب انتخاب‌ها طبق ترتیب مراحل دامنه
  const order = new Map(state.steps.map((s, i) => [s.key, i]));
  selections.sort((a, b) => (order.get(a.stepKey) ?? 99) - (order.get(b.stepKey) ?? 99));

  let current = null;
  if (viable) {
    const step = state.steps[state.currentIndex];
    current = {
      key: step.key,
      title: step.title,
      hint: step.hint || '',
      optional: Boolean(step.optional),
      status: step.status,
      options: await getStepOptions(step, history, STEP_OPTION_LIMIT),
    };
  }

  const missing = state.steps.filter((s) => s.status === 'unavailable').map((s) => s.title);
  const doneCount = state.steps.filter((s) => ['done', 'skipped', 'unavailable'].includes(s.status)).length;
  return {
    active: true,
    complete: isComplete(state),
    phase: 'steps',
    domainId: state.domainId,
    title: state.title,
    steps,
    currentIndex: state.currentIndex,
    current,
    selections,
    missing,
    needsQuestions: [],
    needsRemaining: 0,
    progress: { done: doneCount, total: state.steps.length },
  };
}

/** بسته نهایی از انتخاب‌های تأییدشده — ورودی مستقیم پنل ChatPackageBuilder */
async function buildFinalPackage(state, history = []) {
  if (!state) return null;
  const sections = [];
  const missing = [];
  for (const step of state.steps) {
    if (step.status === 'unavailable' || step.status === 'skipped') {
      missing.push(step.title);
      continue;
    }
    const sel = findSelection(state, step.key);
    if (step.status !== 'done' || !sel) {
      missing.push(step.title);
      continue;
    }
    const product = await fetchProductById(sel.productId);
    if (!product) {
      missing.push(step.title);
      continue;
    }
    const selectedCard = toCardPayload(product);
    const fresh = (await getStepOptions(step, history, STEP_OPTION_LIMIT + 1))
      .filter((o) => o.id !== selectedCard.id && o.inStock)
      .slice(0, STEP_OPTION_LIMIT - 1);
    sections.push({
      key: step.key,
      title: step.title,
      hint: step.hint || '',
      optional: Boolean(step.optional),
      options: [selectedCard, ...fresh].slice(0, STEP_OPTION_LIMIT),
      defaultId: selectedCard.id,
    });
  }
  if (!sections.length) return null;
  return { domainId: state.domainId, title: state.title, sections, missing };
}

/** متن grounding ویزارد برای LLM */
function formatWizardContext(view) {
  if (!view || !view.active) return '';
  if (view.phase === 'needs') {
    const qs = (view.needsQuestions || []).join(' / ');
    return `** ویزارد پک «${view.title}» در فاز نیازسنجی است — هنوز هیچ گزینه‌ای نشان داده نشده و نباید هیچ محصولی معرفی کنی. `
      + `فقط سوالات نیازسنجی را بپرس (در متن): ${qs || 'نیاز کاربر'}. `
      + `برای هر سوال از قالب [[CHOICE:گزینه اول|گزینه دوم]] استفاده کن.**`;
  }
  const lines = [`** وضعیت پک «${view.title}» (پیشرفت ${view.progress.done} از ${view.progress.total}) — پنل مرحله جداگانه نمایش داده می‌شود؛ انتخاب فقط با دکمه‌های پنل انجام می‌شود: **`];
  if (view.selections.length) {
    lines.push('تأییدشده توسط کاربر (قطعی، دوباره پیشنهاد نده):');
    view.selections.forEach((s) => {
      const priceFa = Number(s.product.price || 0).toLocaleString('fa-IR');
      const stockFa = s.product.inStock ? `موجود (${Number(s.product.countInStock || 0).toLocaleString('fa-IR')} عدد)` : 'ناموجود';
      lines.push(`  - [${s.stepTitle}] «${s.product.name}» | قیمت: ${priceFa} تومان | ${stockFa} | شناسه: ${s.product.id}`);
    });
  } else {
    lines.push('هنوز چیزی تأیید نشده است.');
  }
  if (view.current) {
    lines.push(`مرحله فعلی: «${view.current.title}» — گزینه‌های همین مرحله (فقط همین‌ها را معرفی کن):`);
    view.current.options.filter((o) => o.inStock).slice(0, 4).forEach((o, i) => {
      const priceFa = Number(o.price || 0).toLocaleString('fa-IR');
      lines.push(`  - ${i === 0 ? '(مرتب اول: تازه‌ترین قیمت) ' : ''}«${o.name}» | قیمت: ${priceFa} تومان | موجودی: ${Number(o.countInStock || 0).toLocaleString('fa-IR')} عدد`);
    });
  } else {
    lines.push('همه مرحله‌ها تمام شده‌اند؛ بسته نهایی جداگانه نمایش داده می‌شود. تبریک بگو و خلاصه کن.');
  }
  if (view.missing.length) {
    lines.push(`بدون موجودی/ردشده (صادقانه اعلام کن): ${view.missing.join('، ')}`);
  }
  return lines.join('\n');
}

module.exports = {
  STEP_OPTION_LIMIT,
  NEEDS_REQUIRED_DEFAULT,
  resolvePackSteps,
  getStepOptions,
  productInStep,
  newWizardState,
  startWizard,
  enterStepsPhase,
  skipNeedsPhase,
  initialNeedsCredit,
  countUserAnswersSince,
  ensureCurrentViable,
  selectOption,
  skipCurrent,
  goBack,
  restartWizard,
  deactivateWizard,
  isComplete,
  findSelection,
  getWizardView,
  buildFinalPackage,
  formatWizardContext,
  freshnessOf,
};
