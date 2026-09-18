/**
 * chatRetrieval.js
 * موتور بازیابی دقیق محصولات برای چت‌بات — ضد هالوسینیشن
 *
 * اهداف:
 * 1. نرمال‌سازی فارسی (ی/ک عربی، نیم‌فاصله، اعراب) تا «دوربین مداربسته» واقعاً پیدا شود
 * 2. جست‌وجو در نام + توضیح + دسته + برند + مشخصات فنی (specifications/properties)
 * 3. محاسبه موجودی دقیق برای simple و variable (جمع موجودی وрианت‌ها)
 * 4. خروجی دوگانه: متن grounding برای LLM + آرایه ساخت‌یافته products برای کارت فرانت
 */

const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const { WIZARD_DOMAINS } = require('./packDomains');

// نام مستعار سازگاری (تعریف اصلی دامنه‌ها در packDomains.js است)
const PACK_DOMAINS = WIZARD_DOMAINS;

const MAX_PRODUCTS = 6;

// استاپ‌واژه‌های فارسی — این‌ها نباید وارد کوئری جست‌وجو شوند
const FA_STOPWORDS = new Set([
  'و', 'در', 'به', 'از', 'که', 'را', 'با', 'برای', 'این', 'آن', 'یک', 'یه',
  'های', 'هایی', 'است', 'هست', 'هستم', 'میخوام', 'می‌خوام', 'میخواهم', 'می‌خواهم',
  'دارم', 'داره', 'کنم', 'کنید', 'بکنم', 'بزارم', 'بذارم', 'بشه', 'بشود',
  'چی', 'چیه', 'چیست', 'کدام', 'کدوم', 'چطور', 'چگونه', 'آیا', 'مگر',
  'من', 'ما', 'تو', 'شما', 'او', 'خودم', 'خود', 'هم', 'نیز', 'خیلی',
  'توی', 'داخل', 'روی', 'زیر', 'بین', 'مثل', 'مانند', 'یا', 'اما', 'ولی',
  'اگر', 'چون', 'تا', 'همه', 'چند', 'چه', 'سلام', 'ممنون', 'مرسی', 'لطفا',
  'ببخشید', 'آقا', 'خانم', 'داداش', 'عزیز', 'جان', 'سایت', 'فروشگاه',
  'قیمت', 'خرید', 'موجود', 'موجوده', 'ناموجود', 'دارد', 'دارید', 'هستش',
  'بهم', 'بهترین', 'معرفی', 'پیشنهاد', 'راهنمایی', 'کمک', 'دنبال',
  'درباره', 'راجب', 'مورد', 'اطلاعات', 'توضیح', 'بده', 'بگید', 'بگو',
]);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** نرمال‌سازی متن فارسی برای جست‌وجوی قابل اعتماد */
function normalizeFa(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u0652\u0670]/g, '') // اعراب
    .replace(/\u200C/g, ' ') // نیم‌فاصله → فاصله (برای تطبیق بهتر)
    .replace(/[؟?!.،,;:()«»""'']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** استخراج کلیدواژه‌های معنادار از پیام + تاریخچه اخیر */
function extractKeywords(message, history = []) {
  const recentUser = (Array.isArray(history) ? history : [])
    .filter((h) => h && h.role === 'user' && h.content)
    .slice(-2)
    .map((h) => String(h.content))
    .join(' ');
  const full = `${recentUser} ${message || ''}`;
  const norm = normalizeFa(full);
  const tokens = norm
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 40 && !FA_STOPWORDS.has(t) && !/^\d+$/.test(t));
  const unique = [...new Set(tokens)];
  return unique.slice(0, 8);
}

/** موجودی واقعی: simple → stock ، variable → جمع وрианت‌ها */
function effectiveStock(p) {
  if (p.productType === 'variable' && Array.isArray(p.variants) && p.variants.length > 0) {
    return p.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  }
  return Number(p.stock) || 0;
}

/** قیمت پایه: simple → price ، variable → کمترین قیمت وariant موجود (وگرنه کمترین کل) */
function effectivePrice(p) {
  if (p.productType === 'variable' && Array.isArray(p.variants) && p.variants.length > 0) {
    const inStock = p.variants
      .filter((v) => (Number(v.stock) || 0) > 0)
      .map((v) => Number(v.price))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (inStock.length) return Math.min(...inStock);
    const all = p.variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n) && n > 0);
    if (all.length) return Math.min(...all);
  }
  return Number(p.price) || 0;
}

/** قیمت نهایی فروش — آینه منطق resolvePricing فرانت (بدون промو زمانی): compare بالاتر یعنی price نهایی است */
function finalPriceOf(p) {
  const raw = effectivePrice(p);
  const cmp = Number(p.compareAtPrice) || 0;
  if (cmp > raw) return raw;
  const d = Number(p.discount) || 0;
  if (d > 0 && d < 100) return Math.round(raw * (1 - d / 100));
  return raw;
}

function oldPriceOf(p, fin) {
  const cmp = Number(p.compareAtPrice) || 0;
  if (cmp > fin) return cmp;
  const d = Number(p.discount) || 0;
  const raw = effectivePrice(p);
  if (d > 0 && raw > fin) return raw;
  return undefined;
}

/** ارزان‌ترین وariant موجود — برای افزودن دقیق محصول متغیر به سبد بدون حدس */
function defaultVariantOptions(p) {
  if (p.productType !== 'variable' || !Array.isArray(p.variants) || p.variants.length === 0) return null;
  const inStock = p.variants.filter((v) => (Number(v.stock) || 0) > 0 && Number(v.price) > 0);
  if (inStock.length === 0) return null;
  inStock.sort((a, b) => Number(a.price) - Number(b.price));
  const opts = inStock[0].options;
  if (!Array.isArray(opts) || opts.length === 0) return null;
  return opts
    .filter((o) => o && o.name && o.value)
    .map((o) => ({ name: String(o.name), value: String(o.value) }));
}

function firstImageUrl(p) {
  const imgs = p.images || [];
  for (const img of imgs) {
    if (typeof img === 'string' && img.trim()) return img.trim();
    if (img && typeof img.url === 'string' && img.url.trim()) return img.url.trim();
  }
  return '/placeholder.svg';
}

/** تبدیل specifications (Mixed) و properties به لیست خوانا */
function specList(p, max = 8) {
  const out = [];
  const push = (label, value) => {
    if (!label || value === undefined || value === null || value === '') return;
    const v = Array.isArray(value) ? value.join('، ') : String(value);
    if (!v.trim() || v === '[object Object]') return;
    out.push({ label: String(label).trim(), value: v.trim().slice(0, 120) });
  };
  if (Array.isArray(p.properties)) {
    for (const prop of p.properties) {
      push(prop.label, prop.value);
      if (out.length >= max) return out;
    }
  }
  const specs = p.specifications;
  if (specs && typeof specs === 'object' && !Array.isArray(specs)) {
    for (const [k, v] of Object.entries(specs)) {
      push(k, v);
      if (out.length >= max) return out;
    }
  } else if (Array.isArray(specs)) {
    for (const s of specs) {
      if (s && typeof s === 'object') push(s.label || s.name || s.key, s.value);
      else if (typeof s === 'string') push('ویژگی', s);
      if (out.length >= max) return out;
    }
  }
  return out;
}

function buildProductUrl(p) {
  const code = String(p.productCode || p._id || '').toLowerCase();
  const slug = p.slug || p._id;
  return `/product/${code}/${slug}`;
}

/**
 * جست‌وجوی اصلی محصولات.
 * @returns {Promise<Array>} لیست محصولات lean + populate شده
 */
async function searchProducts(message, history = []) {
  const keywords = extractKeywords(message, history);
  if (keywords.length === 0) return { keywords, products: [] };

  // 1) دسته‌های منطبق (مثلاً «دوربین» → دسته دوربین مداربسته)
  let matchedCategoryIds = [];
  try {
    const catOr = keywords.map((k) => ({ name: { $regex: escapeRegex(k), $options: 'i' } }));
    const cats = await Category.find({ isActive: true, $or: catOr }).select('_id').lean();
    matchedCategoryIds = cats.map((c) => c._id);
  } catch { /* ignore */ }

  // 2) برندهای منطبق
  let matchedBrandIds = [];
  try {
    const brandOr = keywords.map((k) => ({ name: { $regex: escapeRegex(k), $options: 'i' } }));
    const brands = await Brand.find({ $or: brandOr }).select('_id').lean();
    matchedBrandIds = brands.map((b) => b._id);
  } catch { /* ignore */ }

  // 3) کوئری اصلی روی چند فیلد
  const fieldOr = [];
  for (const kw of keywords) {
    const rx = { $regex: escapeRegex(kw), $options: 'i' };
    fieldOr.push({ name: rx });
    fieldOr.push({ description: rx });
    fieldOr.push({ 'properties.value': rx });
    fieldOr.push({ 'properties.label': rx });
  }

  const orConditions = [...fieldOr];
  if (matchedCategoryIds.length) orConditions.push({ category: { $in: matchedCategoryIds } });
  if (matchedBrandIds.length) orConditions.push({ brand: { $in: matchedBrandIds } });

  const raw = await Product.find({ isActive: true, $or: orConditions })
    .populate('category', 'name slug')
    .populate('brand', 'name slug')
    .select('name slug productCode description productType price compareAtPrice discount priceUpdatedAt priceUpdateCount stock variants specifications properties images category brand rating numReviews guarantee salesCount updatedAt')
    .limit(30)
    .lean();

  // 4) امتیازدهی فارسی: تطبیق در نام ۳ امتیاز، دسته ۲، برند ۲، مشخصات ۱، توضیح ۱
  const normMsg = normalizeFa(message);
  const scored = raw.map((p) => {
    const normName = normalizeFa(p.name || '');
    const normDesc = normalizeFa(p.description || '');
    const catName = normalizeFa((p.category && p.category.name) || '');
    const brandName = normalizeFa((p.brand && p.brand.name) || '');
    const specsText = normalizeFa(specList(p, 20).map((s) => `${s.label} ${s.value}`).join(' '));
    let score = 0;
    for (const kw of keywords) {
      if (normName.includes(kw)) score += 3;
      if (catName.includes(kw)) score += 2;
      if (brandName.includes(kw)) score += 2;
      if (specsText.includes(kw)) score += 1;
      if (normDesc.includes(kw)) score += 1;
    }
    // عبارت کامل هم بیاید → امتیاز ویژه
    if (keywords.length >= 2 && normName.includes(normMsg.slice(0, 40))) score += 2;
    return { p, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      // اول امتیاز، بعد موجودی، بعد پرفروش‌ها
      if (b.score !== a.score) return b.score - a.score;
      const sb = effectiveStock(b.p);
      const sa = effectiveStock(a.p);
      if ((sb > 0) !== (sa > 0)) return sb > 0 ? 1 : -1;
      return (b.p.salesCount || 0) - (a.p.salesCount || 0);
    })
    .slice(0, MAX_PRODUCTS)
    .map((s) => s.p);

  return { keywords, products: scored };
}

/** متن grounding برای تزریق به system prompt — تنها منبع حقیقت LLM */
function formatProductContext(products) {
  if (!products || products.length === 0) {
    return 'هیچ محصول مرتبطی در دیتابیس فروشگاه یافت نشد. باید صادقانه بگویی موجود نیست و پیشنهاد جایگزین کلی بدهی، بدون اختراع نام/قیمت/موجودی.';
  }
  return products.map((p, i) => {
    const stock = effectiveStock(p);
    const price = finalPriceOf(p);
    const priceFa = Number(price || 0).toLocaleString('fa-IR');
    const stockFa = stock > 0 ? `موجود (${Number(stock).toLocaleString('fa-IR')} عدد)` : 'ناموجود';
    const catName = (p.category && p.category.name) || '—';
    const brandName = (p.brand && p.brand.name) || '—';
    const specs = specList(p, 8);
    const specsText = specs.length
      ? specs.map((s) => `    - ${s.label}: ${s.value}`).join('\n')
      : '    - مشخصات فنی ثبت نشده';
    const desc = p.description ? String(p.description).replace(/\s+/g, ' ').slice(0, 220) : '—';
    const prevPrice = oldPriceOf(p, price);
    const oldPrice = prevPrice
      ? `\n  قیمت قبل تخفیف: ${Number(prevPrice).toLocaleString('fa-IR')} تومان`
      : '';
    return `[محصول ${i + 1} | شناسه: ${p._id}]\n  نام دقیق: ${p.name}\n  دسته: ${catName}\n  برند: ${brandName}\n  قیمت فعلی: ${priceFa} تومان${oldPrice}\n  موجودی دقیق: ${stockFa}\n  لینک: ${buildProductUrl(p)}\n  گارانتی: ${p.guarantee || '—'}\n  امتیاز: ${p.rating || 0} از ۵ (${p.numReviews || 0} دیدگاه)\n  مشخصات فنی:\n${specsText}\n  توضیح کوتاه: ${desc}`;
  }).join('\n------------------\n');
}

/** پیلود کارت برای فرانت‌اند */
function toCardPayload(p) {
  const stock = effectiveStock(p);
  const price = finalPriceOf(p);
  const catName = (p.category && p.category.name) || 'عمومی';
  const catSlug = (p.category && (p.category.slug || p.category._id)) || '';
  return {
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    productCode: p.productCode,
    price,
    oldPrice: oldPriceOf(p, price),
    discount: Number(p.discount) || 0,
    image: firstImageUrl(p),
    category: catName,
    categorySlug: String(catSlug),
    brand: (p.brand && p.brand.name) || undefined,
    rating: Number(p.rating) || 0,
    reviewCount: Number(p.numReviews) || 0,
    countInStock: stock,
    inStock: stock > 0,
    url: buildProductUrl(p),
    specs: specList(p, 6),
    guarantee: p.guarantee || '',
    productType: p.productType || 'simple',
    defaultVariantOptions: defaultVariantOptions(p),
    priceUpdatedAt: p.priceUpdatedAt || null,
    priceUpdateCount: Number(p.priceUpdateCount) || 0,
  };
}

/** تشخیص نیاز به مشاوره (سناریوی «می‌خوام دوربین توی منزلم بزارم») */
function isAdvisoryRequest(message) {
  const norm = normalizeFa(message);
  const needWords = ['پیشنهاد', 'راهنمایی', 'کدام', 'کدوم', 'بهترین', 'انتخاب', 'کمک', 'مشاوره', 'میخوام', 'می خوام', 'دنبال', 'نیاز', 'مناسب'];
  const broadWords = ['منزل', 'خانه', 'مغازه', 'محل کار', 'دفتر', 'ویل', 'باغ', 'راه پله', 'پارکینگ', 'کامل', 'پکیج', 'سیستم'];
  const hasNeed = needWords.some((w) => norm.includes(normalizeFa(w)));
  const hasBroad = broadWords.some((w) => norm.includes(normalizeFa(w)));
  const isShort = norm.split(' ').length <= 12;
  return (hasNeed && isShort) || (hasBroad && isShort) || /کدام.*(بهتر|خوب|مناسب)/.test(norm);
}

/* ============================================================
 * موتور پک‌ساز یکجای قدیمی (buildPackage) نگه داشته شده، ولی مسیر اصلی
 * حالا ویزارد مرحله‌به‌مرحله packWizard.js است که بخش‌ها را از روی
 * «اسم دسته‌بندی‌ها» می‌سازد. تعریف دامنه‌ها در packDomains.js است.
 * ============================================================ */

const MAX_PACK_OPTIONS = 3;

const PACK_WORDS = [
  'پک', 'پکیج', 'کیت', 'ست کامل', 'سیستم کامل', 'بسته کامل', 'پکیج کامل',
  'پک کامل', 'ست بخرم', 'پک بخرم', 'کامل بخرم', 'همه لوازم', 'لوازم کامل',
];

/** تشخیص درخواست پک + دامنه آن (با در نظر گرفتن تاریخچه) */
function detectPackRequest(message, history = []) {
  const full = [
    ...(Array.isArray(history) ? history : [])
      .filter((h) => h && h.role === 'user' && h.content)
      .slice(-4)
      .map((h) => String(h.content)),
    String(message || ''),
  ].join(' ');
  const norm = normalizeFa(full);
  const hasPack = PACK_WORDS.some((w) => norm.includes(normalizeFa(w)));
  if (!hasPack) return { isPack: false, domain: null };
  const domain = PACK_DOMAINS.find((d) => d.match.some((m) => norm.includes(normalizeFa(m)))) || null;
  return { isPack: true, domain };
}

/**
 * ساخت بسته از کالاهای واقعی دیتابیس.
 * @returns {Promise<null|{domainId,title,sections,missing}>}
 * هر section: {key,title,hint,optional,options:[card],defaultId}
 */
async function buildPackage(message, history = []) {
  const { isPack, domain } = detectPackRequest(message, history);
  if (!isPack || !domain) return null;

  const results = await Promise.all(domain.components.map(async (component) => {
    try {
      const { products } = await searchProducts(component.keywords.join(' '), history);
      // فیلتر ارتباط معنایی: حداقل یکی از عبارت‌های جزء باید در نام/توضیح/دسته/مشخصات باشد
      // (جلوگیری از قاطی‌شدن، مثلاً دوربینِ «تحت شبکه» نباید در بخش «سوئیچ شبکه» بیاید)
      const phrases = component.keywords.map((k) => normalizeFa(k)).filter((k) => k.length >= 2);
      const hayOf = (p) => normalizeFa(JSON.stringify([
        p.name, p.description,
        p.category && p.category.name, p.brand && p.brand.name,
        p.properties, p.specifications,
      ]));
      const relevant = products.filter((p) => phrases.some((ph) => ph && hayOf(p).includes(ph)));
      const available = relevant
        .filter((p) => effectiveStock(p) > 0)
        // کالای ساده اول (بدون ابهام وariant)، بعد پرفروش‌ترها — searchProducts همین ترتیب را داده
        .sort((a, b) => ((a.productType === 'variable') ? 1 : 0) - ((b.productType === 'variable') ? 1 : 0));
      return { component, options: available.slice(0, MAX_PACK_OPTIONS) };
    } catch {
      return { component, options: [] };
    }
  }));

  const sections = results
    .filter((r) => r.options.length > 0)
    .map((r) => ({
      key: r.component.key,
      title: r.component.title,
      hint: r.component.hint,
      optional: Boolean(r.component.optional),
      options: r.options.map(toCardPayload),
      defaultId: String(r.options[0]._id),
    }));
  const missing = results.filter((r) => r.options.length === 0).map((r) => r.component.title);

  // پک ناقص نساز: جزء اصلی + حداقل ۲ بخش لازم است
  const hasPrimary = sections.some((s) => s.key === domain.components[0].key);
  if (!hasPrimary || sections.length < 2) return null;

  return { domainId: domain.id, title: domain.title, sections, missing };
}

/** متن grounding بسته برای LLM — تنها مرجع مجاز برای توصیف پک */
function formatPackageContext(pkg) {
  if (!pkg || !Array.isArray(pkg.sections) || pkg.sections.length === 0) return '';
  const lines = [`** بسته پیشنهادی «${pkg.title}» — فقط همین اقلام واقعی را معرفی کن؛ بخش یا کالا اختراع نکن: **`];
  pkg.sections.forEach((s) => {
    lines.push(`[بخش: ${s.title}]${s.optional ? ' (اختیاری)' : ''}`);
    s.options.forEach((o, i) => {
      const priceFa = Number(o.price || 0).toLocaleString('fa-IR');
      const stockFa = Number(o.countInStock || 0).toLocaleString('fa-IR');
      lines.push(`  - ${i === 0 ? '(پیشنهاد پیش‌فرض) ' : ''}«${o.name}» | قیمت: ${priceFa} تومان | موجودی: ${stockFa} عدد | شناسه: ${o.id}`);
    });
  });
  if (Array.isArray(pkg.missing) && pkg.missing.length > 0) {
    lines.push(`اجزای بدون موجودی فعلاً (صادقانه اعلام کن، جایگزین اختراع نکن): ${pkg.missing.join('، ')}`);
  }
  return lines.join('\n');
}

module.exports = {
  normalizeFa,
  extractKeywords,
  searchProducts,
  formatProductContext,
  toCardPayload,
  effectiveStock,
  effectivePrice,
  finalPriceOf,
  oldPriceOf,
  defaultVariantOptions,
  isAdvisoryRequest,
  detectPackRequest,
  buildPackage,
  formatPackageContext,
  PACK_DOMAINS,
  escapeRegex,
  FA_STOPWORDS,
};
