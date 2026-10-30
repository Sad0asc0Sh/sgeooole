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
const {
  resolveProductDisplay,
  getActiveSalesCampaignContext,
  findActiveSaleForProduct,
} = require('../services/pricingService');

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
  // واژه‌های عادی (حذف اعداد تک‌رقمی، اما نگه‌داشتن کدهای مدل مثل 1200، 5104، 1080)
  const tokens = norm
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 40 && !FA_STOPWORDS.has(t) && !/^\d{1,2}$/.test(t));

  // استخراج کدهای مدل انگلیسی/اعداد مثل DH-HAC-HFW1200DP یا XVR5104
  const codeTokens = (String(message || '').match(/[a-zA-Z0-9_-]{3,30}/g) || [])
    .map((c) => c.trim().toLowerCase())
    .filter((c) => !FA_STOPWORDS.has(c));

  const unique = [...new Set([...codeTokens, ...tokens])];
  return unique.slice(0, 10);
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

/**
 * قیمت نهایی فروش — ۴.۱.۲: همان لایه‌ی نمایش صفحه‌ی محصول.
 * فقط تخفیف زنده (تایمر فعال / Sale فعال) اعمال می‌شود و پس از انقضا قیمت به
 * exactFloorPrice برمی‌گردد؛ نه سقف معیار. این تابع دیگر discount خام را کورکورانه
 * اعمال نمی‌کند (باگ چت‌بات پس از انقضا: ۹۹۰٬۴۷۶ به‌جای ۸۳۲٬۰۰۰).
 */
function finalPriceOf(p, now = new Date()) {
  return resolveProductDisplay(p, { now }).price;
}

function oldPriceOf(p, fin, now = new Date()) {
  const view = resolveProductDisplay(p, { now });
  // قیمت خط‌خورده فقط با تخفیف واقعی فعال نمایش داده می‌شود؛ compare کهنه‌ی منقضی/بدون تخفیف oldPrice نمی‌سازد
  if (view.compareAtPrice && view.compareAtPrice > fin) return view.compareAtPrice;
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

  // 3) کوئری مستقیم روی چند فیلد (اولویت قطعی با تطابق دقیق واژه‌ها و کد محصول)
  const fieldOr = [];
  for (const kw of keywords) {
    const rx = { $regex: escapeRegex(kw), $options: 'i' };
    fieldOr.push({ name: rx });
    fieldOr.push({ productCode: rx });
    fieldOr.push({ sku: rx });
    fieldOr.push({ description: rx });
    fieldOr.push({ 'properties.value': rx });
    fieldOr.push({ 'properties.label': rx });
  }

  const selectFields = 'name slug productCode sku description productType price compareAtPrice discount '
    + 'priceUpdatedAt priceUpdateCount stock variants specifications properties images category brand '
    + 'rating numReviews guarantee salesCount updatedAt pricingMeta campaignLabel';

  // مرحله الف: جستجوی هدفمند با تطابق مستقیم کلمات کلیدی
  let specificHits = [];
  if (fieldOr.length > 0) {
    specificHits = await Product.find({ isActive: true, $or: fieldOr })
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .select(selectFields)
      .limit(50)
      .lean();
  }

  // مرحله ب: اگر نتایج مستقیم کم بود، دسته‌بندی و برند را به صورت ثانویه اضافه کن (جلوگیری از خفه‌کردن نتایج دقیق توسط یک دسته بزرگ)
  let broadHits = [];
  if (specificHits.length < 15 && (matchedCategoryIds.length > 0 || matchedBrandIds.length > 0)) {
    const secondaryOr = [];
    if (matchedCategoryIds.length) secondaryOr.push({ category: { $in: matchedCategoryIds } });
    if (matchedBrandIds.length) secondaryOr.push({ brand: { $in: matchedBrandIds } });
    broadHits = await Product.find({ isActive: true, $or: secondaryOr })
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .select(selectFields)
      .limit(30)
      .lean();
  }

  // ادغام و یکتا کردن بدون تکرار
  const seenIds = new Set();
  const raw = [];
  for (const p of [...specificHits, ...broadHits]) {
    const idStr = String(p._id);
    if (!seenIds.has(idStr)) {
      seenIds.add(idStr);
      raw.push(p);
    }
  }

  // 4) امتیازدهی فارسی: تطبیق کد کالا ۵، نام ۴، دسته ۲، برند ۲، مشخصات ۱، توضیح ۱
  const normMsg = normalizeFa(message);
  const scored = raw.map((p) => {
    const normName = normalizeFa(p.name || '');
    const normCode = normalizeFa(String(p.productCode || p.sku || ''));
    const normDesc = normalizeFa(p.description || '');
    const catName = normalizeFa((p.category && p.category.name) || '');
    const brandName = normalizeFa((p.brand && p.brand.name) || '');
    const specsText = normalizeFa(specList(p, 20).map((s) => `${s.label} ${s.value}`).join(' '));
    let score = 0;
    for (const kw of keywords) {
      if (normCode.includes(kw)) score += 5; // تطابق کد کالا
      if (normName.includes(kw)) score += 4;
      if (catName.includes(kw)) score += 2;
      if (brandName.includes(kw)) score += 2;
      if (specsText.includes(kw)) score += 1;
      if (normDesc.includes(kw)) score += 1;
    }
    // عبارت کامل هم بیاید → امتیاز ویژه
    if (keywords.length >= 2 && normName.includes(normMsg.slice(0, 40))) score += 4;
    return { p, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      // اول کالاهای موجود
      const sb = effectiveStock(b.p);
      const sa = effectiveStock(a.p);
      if ((sb > 0) !== (sa > 0)) return sb > 0 ? 1 : -1;
      // سپس امتیاز تطابق
      if (b.score !== a.score) return b.score - a.score;
      // سپس پرفروش‌ها
      return (b.p.salesCount || 0) - (a.p.salesCount || 0);
    })
    .slice(0, MAX_PRODUCTS)
    .map((s) => s.p);

  // ۴.۱.۲: برای پاریتی کامل با صفحه‌ی محصول، Sale فعال هر کارت را هم وصل می‌کنیم
  // (غیرقابل‌شمارش تا در JSON خروجی/لاگ نشت نکند).
  try {
    const campaignContext = await getActiveSalesCampaignContext();
    for (const p of scored) {
      const activeSale = findActiveSaleForProduct(p, campaignContext);
      if (activeSale) Object.defineProperty(p, '__activeSale', { value: activeSale, enumerable: false });
    }
  } catch {
    // شکست در خواندن Sale نباید جست‌وجوی چت را بشکند؛ بدون Sale نمایش می‌دهیم.
  }

  return { keywords, products: scored };
}

/** متن grounding برای تزریق به system prompt — تنها منبع حقیقت LLM */
function formatProductContext(products, now = new Date()) {
  if (!products || products.length === 0) {
    return 'هیچ محصول مرتبطی در دیتابیس فروشگاه یافت نشد. باید صادقانه بگویی موجود نیست و پیشنهاد جایگزین کلی بدهی، بدون اختراع نام/قیمت/موجودی.';
  }
  return products.map((p, i) => {
    const stock = effectiveStock(p);
    // ۴.۱.۲: نمایش قیمت با همان قرارداد صفحه‌ی محصول (تایمر زنده + کف قطعی)
    // `now` از بیرون تزریق می‌شود تا همه‌ی مسیرها یک ساعت واحد داشته باشند.
    const view = resolveProductDisplay(p, { now, activeSale: p.__activeSale || null });
    const price = view.price;
    const priceFa = Number(price || 0).toLocaleString('fa-IR');
    const stockFa = stock > 0 ? `موجود (${Number(stock).toLocaleString('fa-IR')} عدد)` : 'ناموجود';
    const catName = (p.category && p.category.name) || '—';
    const brandName = (p.brand && p.brand.name) || '—';
    const specs = specList(p, 8);
    const specsText = specs.length
      ? specs.map((s) => `    - ${s.label}: ${s.value}`).join('\n')
      : '    - مشخصات فنی ثبت نشده';
    const desc = p.description ? String(p.description).replace(/\s+/g, ' ').slice(0, 220) : '—';
    const prevPrice = view.compareAtPrice && view.compareAtPrice > price ? view.compareAtPrice : undefined;
    const oldPrice = prevPrice
      ? `\n  قیمت قبل تخفیف: ${Number(prevPrice).toLocaleString('fa-IR')} تومان`
      : '';
    return `[محصول ${i + 1} | شناسه: ${p._id}]\n  نام دقیق: ${p.name}\n  دسته: ${catName}\n  برند: ${brandName}\n  قیمت فعلی: ${priceFa} تومان${oldPrice}\n  موجودی دقیق: ${stockFa}\n  لینک: ${buildProductUrl(p)}\n  گارانتی: ${p.guarantee || '—'}\n  امتیاز: ${p.rating || 0} از ۵ (${p.numReviews || 0} دیدگاه)\n  مشخصات فنی:\n${specsText}\n  توضیح کوتاه: ${desc}`;
  }).join('\n------------------\n');
}

/** پیلود کارت برای فرانت‌اند */
function toCardPayload(p, extra = {}) {
  const stock = effectiveStock(p);
  // ۴.۱.۲: کارت چت/پک هم نباید سقف منقضی یا discount بی‌پشتوانه را نشان دهد.
  // ساعت درخواست تزریق می‌شود (extra.now) تا «تازگی کف قطعی» با همان ساعتی
  // سنجیده شود که finalPriceOf استفاده می‌کند؛ وگرنه کارت و صفحه‌ی محصول
  // می‌توانند برای یک محصول دو قیمت متفاوت بدهند (باگ پاریتی).
  const now = extra.now instanceof Date ? extra.now : new Date();
  const view = resolveProductDisplay(p, { now, activeSale: extra.activeSale || p.__activeSale || null });
  const price = view.price;
  const catName = (p.category && p.category.name) || 'عمومی';
  const catSlug = (p.category && (p.category.slug || p.category._id)) || '';
  return {
    id: String(p._id),
    name: p.name,
    slug: p.slug,
    productCode: p.productCode,
    price,
    oldPrice: view.compareAtPrice && view.compareAtPrice > price ? view.compareAtPrice : undefined,
    discount: view.discount,
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
    campaignLabel: view.campaignLabel || undefined,
    compatibilityHint: extra.compatibilityHint || '',
    recommendedQty: extra.recommendedQty || 1,
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
