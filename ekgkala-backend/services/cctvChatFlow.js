/**
 * cctvChatFlow.js
 * درخت سوالات ثابت + Slot-Filling قطعی برای پک دوربین مداربسته
 *
 * قواعد:
 * - سوالات و گزینه‌ها ثابت‌اند (Deterministic) — هیچ متنی توسط LLM ساخته نمی‌شود.
 * - استخراج نیت و پرکردن اسلات‌ها فقط با regex / لغت‌نامه فارسی انجام می‌شود.
 * - محاسبات فنی به cctvAssemblyEngine واگذار می‌شود؛ اینجا فقط گفت‌وگو است.
 */

/* ==========================================================================
 * ۱) درخت وضعیت و سوالات ثابت
 * ========================================================================== */

const CCTV_STEPS = Object.freeze({
  environment: Object.freeze({
    question: 'سیستم دوربین مداربسته رو برای چه محیطی در نظر دارید؟',
    quickReplies: Object.freeze([
      { label: 'فضای باز / باغ و حیاط (ضدآب)', value: 'outdoor' },
      { label: 'داخل ساختمان / مغازه و دفتر', value: 'indoor' },
      { label: 'ترکیب داخل و بیرون', value: 'mixed' },
    ]),
  }),
  camerasCount: Object.freeze({
    question: 'به پوشش چند نقطه یا زاویه دید نیاز دارید؟',
    quickReplies: Object.freeze([
      { label: '۲ دوربین (محیط کوچک)', value: 2 },
      { label: '۴ دوربین (استاندارد)', value: 4 },
      { label: '۸ دوربین (محیط متوسط/بزرگ)', value: 8 },
      { label: 'بیشتر از ۸ دوربین', value: 16 },
    ]),
  }),
  nightVision: Object.freeze({
    question: 'دید در شب دوربین‌ها چطور باشه؟',
    quickReplies: Object.freeze([
      { label: 'دید در شب رنگی وارم‌لایت (پیشنهادی)', value: 'warm_light' },
      { label: 'دید در شب مادون قرمز معمولی', value: 'ir' },
    ]),
  }),
  retentionDays: Object.freeze({
    question: 'تصاویر ضبط‌شده تا چند روز باید در حافظه بمونند؟',
    quickReplies: Object.freeze([
      { label: '۱۰ الی ۱۵ روز (اقتصادی)', value: 15 },
      { label: '۲۰ الی ۳۰ روز (استاندارد)', value: 25 },
      { label: 'بیشتر از یک ماه', value: 40 },
    ]),
  }),
  cableMetersPerCam: Object.freeze({
    question: 'فاصله تقریبی هر دوربین تا دستگاه ضبط چقدره؟',
    quickReplies: Object.freeze([
      { label: 'فاصله کم (حدود ۱۰ تا ۱۵ متر)', value: 15 },
      { label: 'فاصله متوسط (حدود ۲۵ متر)', value: 25 },
      { label: 'فاصله زیاد (بیش از ۴۰ متر)', value: 40 },
    ]),
  }),
});

/** ترتیب قطعی پرکردن اسلات‌ها */
const STEP_ORDER = Object.freeze([
  'environment',
  'camerasCount',
  'nightVision',
  'retentionDays',
  'cableMetersPerCam',
]);

/** اسلات‌های اختیاری که فقط از متن آزاد پر می‌شوند (پیش‌فرض دارند) */
const OPTIONAL_SLOTS = Object.freeze({
  tech: Object.freeze(['ahd', 'ip']),
  resolution: Object.freeze(['2mp', '4mp', '5mp', '8mp']),
});

const DEFAULT_ASSEMBLY = Object.freeze({
  tech: 'ahd',
  resolution: '5mp',
});

/* ==========================================================================
 * ۲) کمک‌متن فارسی / اعداد
 * ========================================================================== */

const FA_DIGITS = Object.freeze({
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
});

const FA_WORD_NUMBERS = Object.freeze({
  صفر: 0, یک: 1, یه: 1, دو: 2, سه: 3, چهار: 4, چار: 4,
  پنج: 5, شش: 6, شیش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10,
  یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15,
  شانزده: 16, هفده: 17, هجده: 18, نوزده: 19, بیست: 20,
  سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90,
  صد: 100, یکصد: 100, دویست: 200, سیصد: 300,
});

function toEnglishDigits(str) {
  if (str == null) return '';
  return String(str).replace(/[۰-۹٠-٩]/g, (d) => FA_DIGITS[d] || d);
}

function normalizeText(text) {
  if (text == null) return '';
  let s = String(text);
  s = toEnglishDigits(s);
  s = s
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/‌/g, ' ') // نیم‌فاصله
    .replace(/[ـًٌٍَُِّْ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.toLowerCase();
}

function extractNumber(text) {
  const norm = normalizeText(text);
  // عدد فارسی/انگلیسی
  const digitMatch = norm.match(/(\d{1,4})/);
  if (digitMatch) return parseInt(digitMatch[1], 10);

  // عدد واژه‌ای
  for (const [word, val] of Object.entries(FA_WORD_NUMBERS)) {
    const re = new RegExp(`(^|\\s)${word}($|\\s)`);
    if (re.test(norm)) return val;
  }
  return null;
}

/* ==========================================================================
 * ۳) تشخیص نیت (Deterministic Intent Detection)
 * ========================================================================== */

const INTENT_PACK_WORDS = Object.freeze([
  'پک', 'پکیج', 'کیت', 'ست کامل', 'سیستم کامل', 'بسته کامل',
  'پک کامل', 'همه لوازم', 'لوازم کامل', 'اسمبل', 'مونتاژ',
]);

const INTENT_CCTV_WORDS = Object.freeze([
  'دوربین', 'مداربسته', 'cctv', 'camera', 'نظارتی',
  'dvr', 'nvr', 'ahd', 'بولت', 'دام',
]);

const CANCEL_WORDS = Object.freeze([
  'انصراف', 'لغو', 'کنسل', 'بیخیال', 'دیگه نمیخوام', 'دیگه نمی‌خوام', 'cancel', 'stop',
]);

const RESTART_WORDS = Object.freeze([
  'از اول', 'دوباره', 'شروع دوباره', 'شروع مجدد', 'ریست', 'restart', 'از نو',
]);

/** سوالات تک‌محصول / موجودی / قیمت — نباید وارد درخت پک شوند */
const PRODUCT_QUERY_BLOCKERS = Object.freeze([
  /قیمت[^.؟?]{0,40}چند/i,
  /چند\s*تومان/i,
  /چنده/i,
  /چی\s*موجو/i,
  /چی\s*دار/i,
  /موجو[دذ]?\s*(ه|ی|است|دار|ندار|می|دید)/i,
  /موجودی/,
  /دارید\s*[?؟]/,
  /داره\s*[?؟]/,
  /هست\s*[?؟]/,
]);

/**
 * آیا این پیام درخواست پک دوربین است؟
 * قاعده: فقط درخواست «پک/سیستم کامل» وارد فلو می‌شود؛
 * سوالات قیمت/موجودی تک‌محصول → مسیر RAG (chatRetrieval).
 */
function detectCctvIntent(message, flowActive = false) {
  if (flowActive) return true;
  const norm = normalizeText(message);
  if (!norm) return false;

  const hasCctv = INTENT_CCTV_WORDS.some((w) => norm.includes(w.toLowerCase()));
  const hasPack = INTENT_PACK_WORDS.some((w) => norm.includes(normalizeText(w)));

  // سوال تک‌محصول (قیمت/موجودی) بدون کلمه پک → قطعاً RAG
  const looksLikeProductQuery = PRODUCT_QUERY_BLOCKERS.some((re) => re.test(norm));
  if (looksLikeProductQuery && !hasPack) return false;

  // «پک دوربین» / «پکیج مداربسته» / «سیستم کامل دوربین»
  if (hasCctv && hasPack) return true;

  // عبارت‌های صریح پک (نه صرفاً «دوربین مداربسته دارید؟»)
  const explicit = /(پک\s*دوربین|پکیج\s*دوربین|دوربین\s*مداربسته.{0,20}(پک|پکیج|کامل|سیستم)|cctv\s*package|cctv\s*pack)/;
  if (explicit.test(norm)) return true;

  // نیت خرید/مشاوره پک — بدون قیمت‌پرسی تک‌محصول
  const buyIntent = /(میخوام|می‌خوام|میخواستم|می‌خواستم|بخرم|بگیرم|نیاز|مشورت|راهنمایی|پیشنهاد|اسمبل|مونتاژ)/;
  if (hasCctv && hasPack && buyIntent.test(norm)) return true;
  if (hasCctv && !looksLikeProductQuery && buyIntent.test(norm) && hasPack) return true;

  return false;
}

function isCancelCommand(message) {
  const norm = normalizeText(message);
  return CANCEL_WORDS.some((w) => norm.includes(normalizeText(w)));
}

function isRestartCommand(message) {
  const norm = normalizeText(message);
  return RESTART_WORDS.some((w) => norm.includes(normalizeText(w)));
}

/* ==========================================================================
 * ۴) اعتبارسنجی و استخراج اسلات‌ها
 * ========================================================================== */

const ENV_PATTERNS = Object.freeze([
  { value: 'outdoor', re: /(بیرون|فضای باز|حیاط|باغ|ویلا|کوچه|پارکینگ|محوطه|سوله|کارخانه|دیوار|ضدآب|ضد آب|بولت|outdoor|yard|garden)/i },
  { value: 'indoor', re: /(داخل|منزل|خانه|مغازه|دفتر|شرکت|فروشگاه|اتاق|سالن|راهرو|سقف|سقفی|دام|indoor|office|shop|home)/i },
  // «هر دو» نباید با «هر دوربین» اشتباه گرفته شود — نگاهِ منفی به ادامه حروف فارسی
  { value: 'mixed', re: /(هم داخل هم بیرون|ترکیبی|داخل و بیرون|هر دو(?![\u0600-\u06FF])|mixed)/i },
]);

const NIGHT_PATTERNS = Object.freeze([
  { value: 'warm_light', re: /(وارم|warm|رنگی|فول\s*کالر|full\s*color|colorvu|دید\s*در\s*شب\s*رنگی)/i },
  { value: 'ir', re: /(مادون|اینفرارد|infrared|\bir\b|مادون\s*قرمز|معمولی)/i },
]);

const TECH_PATTERNS = Object.freeze([
  { value: 'ip', re: /(تحت\s*شبکه|شبکه|آی\s*پی|\bip\b|\bnvr\b|\bpoe\b)/i },
  { value: 'ahd', re: /(آنالوگ|انالوگ|\bahd\b|\bdvr\b|\bxvr\b|کواکسیال)/i },
]);

const RES_PATTERNS = Object.freeze([
  { value: '8mp', re: /(8\s*mp|8mp|4k|2160)/i },
  { value: '5mp', re: /(5\s*mp|5mp)/i },
  { value: '4mp', re: /(4\s*mp|4mp)/i },
  { value: '2mp', re: /(2\s*mp|2mp|1080|فول\s*اچدی|fhd)/i },
]);

function isValidSlotValue(key, value) {
  if (key === 'environment') return ['outdoor', 'indoor', 'mixed'].includes(value);
  if (key === 'nightVision') return ['warm_light', 'ir'].includes(value);
  if (key === 'camerasCount') {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 && n <= 128 && Number.isInteger(n);
  }
  if (key === 'retentionDays') {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 && n <= 365;
  }
  if (key === 'cableMetersPerCam') {
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 && n <= 500;
  }
  if (key === 'tech') return OPTIONAL_SLOTS.tech.includes(value);
  if (key === 'resolution') return OPTIONAL_SLOTS.resolution.includes(value);
  return false;
}

/**
 * نزدیک‌ترین گزینه quickReply به عدد آزاد (برای نمایش/هم‌گرایی)
 */
function snapToQuickReply(key, value) {
  const step = CCTV_STEPS[key];
  if (!step) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return value;

  let best = step.quickReplies[0].value;
  let bestDist = Infinity;
  for (const qr of step.quickReplies) {
    const d = Math.abs(Number(qr.value) - n);
    if (d < bestDist) {
      bestDist = d;
      best = qr.value;
    }
  }
  return best;
}

/**
 * استخراج اسلات‌ها از متن آزاد — چند اسلات در یک پیام
 * @param {string} message
 * @param {string|null} focusSlot - اسلات جاری (اولویت تفسیر عددی با اوست)
 * @returns {object} map از slotKey → value
 */
function extractSlots(message, focusSlot = null) {
  const norm = normalizeText(message);
  const found = {};

  if (!norm) return found;

  // --- محیط ---
  if (!focusSlot || focusSlot === 'environment') {
    // mixed باید قبل از indoor/outdoor چک شود (عبارت «داخل و بیرون»)
    const mixed = ENV_PATTERNS.find((p) => p.value === 'mixed');
    if (mixed.re.test(norm)) {
      found.environment = 'mixed';
    } else {
      for (const p of ENV_PATTERNS) {
        if (p.value === 'mixed') continue;
        if (p.re.test(norm)) {
          found.environment = p.value;
          break;
        }
      }
    }
  }

  // --- نایت‌ویژن ---
  {
    const warm = NIGHT_PATTERNS[0];
    const ir = NIGHT_PATTERNS[1];
    if (warm.re.test(norm)) found.nightVision = 'warm_light';
    else if (ir.re.test(norm)) found.nightVision = 'ir';
  }

  // --- تکنولوژی / رزولوشن (اختیاری) ---
  for (const p of TECH_PATTERNS) {
    if (p.re.test(norm)) {
      found.tech = p.value;
      break;
    }
  }
  for (const p of RES_PATTERNS) {
    if (p.re.test(norm)) {
      found.resolution = p.value;
      break;
    }
  }

  // --- تعداد دوربین ---
  // الگوی صریح: «۴ دوربین» / «۴ عدد» / «چهار تا دوربین»
  const camExplicit =
    norm.match(/(\d{1,3})\s*(?:عدد|تا|دستگاه)?\s*(?:دوربین|کمرا|camera|cam)/i) ||
    norm.match(/(\d{1,3})\s*(?:عدد|تا|دستگاه)\s*(?:دوربین)?/i) ||
    norm.match(/(?:دوربین|camera)\s*(\d{1,3})/i);
  let camNum = camExplicit ? parseInt(camExplicit[1], 10) : null;
  if (camNum == null && /دوربین|camera|cam|پوشش|زاویه/.test(norm)) {
    camNum = extractNumber(norm);
  }
  // اگر focus اسلات دوربین است و عددی هست
  if (camNum == null && focusSlot === 'camerasCount') {
    camNum = extractNumber(norm);
  }
  if (camNum != null && camNum >= 1 && camNum <= 128) {
    found.camerasCount = camNum;
  }

  // --- روزهای ضبط ---
  let days = null;
  const dayMatch =
    norm.match(/(\d{1,3})\s*(?:روز|روزه|day|days)/i) ||
    norm.match(/(\d{1,3})\s*(?:هفته)/i) ||
    norm.match(/(\d{1,2})\s*(?:ماه|month)/i);
  if (dayMatch) {
    days = parseInt(dayMatch[1], 10);
    if (/هفته/.test(norm) && dayMatch[0].includes('هفته')) days *= 7;
    if (/ماه/.test(dayMatch[0])) days *= 30;
  } else if (/(یک\s*ماه|۱\s*ماه|1\s*ماه|یکماه)/.test(norm)) {
    days = 30;
  } else if (/(دو\s*ماه|۲\s*ماه|2\s*ماه)/.test(norm)) {
    days = 60;
  } else if (focusSlot === 'retentionDays') {
    const n = extractNumber(norm);
    if (n != null) days = n;
  }
  if (days != null && days >= 1 && days <= 365) {
    found.retentionDays = days;
  }

  // --- متراژ کابل ---
  let meters = null;
  const meterMatch =
    norm.match(/(\d{1,4})\s*(?:متر|m\b|meter)/i) ||
    norm.match(/(\d{1,4})\s*(?:تا)\s*(\d{1,4})\s*(?:متر|m)/i);
  if (meterMatch) {
    // اگر بازه بود (۱۰ تا ۱۵) میانگین می‌گیریم
    if (meterMatch[2]) {
      meters = Math.round((parseInt(meterMatch[1], 10) + parseInt(meterMatch[2], 10)) / 2);
    } else {
      meters = parseInt(meterMatch[1], 10);
    }
  } else if (focusSlot === 'cableMetersPerCam') {
    const n = extractNumber(norm);
    if (n != null) meters = n;
  }
  if (meters != null && meters >= 1 && meters <= 500) {
    found.cableMetersPerCam = meters;
  }

  return found;
}

/**
 * تطبیق متن با یک quickReply خاص (وقتی کاربر دکمه را نزده ولی متن جواب داده)
 */
function matchQuickReplyValue(key, message) {
  const step = CCTV_STEPS[key];
  if (!step) return undefined;
  const norm = normalizeText(message);

  // مقدار خام quickReply (مثل outdoor یا 4)
  for (const qr of step.quickReplies) {
    if (typeof qr.value === 'string' && normalizeText(qr.value) === norm) return qr.value;
  }

  if (key === 'environment') {
    // اول mixed
    if (ENV_PATTERNS[2].re.test(norm)) return 'mixed';
    for (const p of ENV_PATTERNS) {
      if (p.value === 'mixed') continue;
      if (p.re.test(norm)) return p.value;
    }
    // لیبل دکمه
    for (const qr of step.quickReplies) {
      if (norm.includes(normalizeText(qr.label).slice(0, 8))) return qr.value;
    }
    return undefined;
  }

  if (key === 'nightVision') {
    if (NIGHT_PATTERNS[0].re.test(norm)) return 'warm_light';
    if (NIGHT_PATTERNS[1].re.test(norm)) return 'ir';
    return undefined;
  }

  if (key === 'camerasCount' || key === 'retentionDays' || key === 'cableMetersPerCam') {
    // عدد مستقیم
    const n = extractNumber(norm);
    if (n != null && isValidSlotValue(key, n)) return n;

    // اشاره به بازه لیبل: «اقتصادی» → 15، «استاندارد» → 25
    if (key === 'retentionDays') {
      if (/اقتصادی|کم|کوتاه/.test(norm)) return 15;
      if (/استاندارد|معمولی|نرمال/.test(norm)) return 25;
      if (/زیاد|بیشتر|طولانی|ماه/.test(norm)) return 40;
    }
    if (key === 'cableMetersPerCam') {
      if (/کم|کوتاه|نزدیک/.test(norm)) return 15;
      if (/متوسط|وسط/.test(norm)) return 25;
      if (/زیاد|بلند|دور|بیش/.test(norm)) return 40;
    }
    if (key === 'camerasCount') {
      if (/کوچک|کم/.test(norm)) return 2;
      if (/استاندارد|معمولی|متوسط|چهار|4/.test(norm)) return 4;
      if (/بزرگ|زیاد|هشت|هشت تا/.test(norm) || /بیشتر/.test(norm)) return 8;
    }

    // snap به نزدیک‌ترین گزینه اگر عدد آزاد داد
    if (n != null) return snapToQuickReply(key, n);
  }

  return undefined;
}

/* ==========================================================================
 * ۵) ماشین حالت فلو (Flow State Machine)
 * ========================================================================== */

function createFlow() {
  return {
    active: true,
    complete: false,
    cancelled: false,
    slots: {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getNextStepKey(flow) {
  if (!flow || flow.complete) return null;
  for (const key of STEP_ORDER) {
    if (flow.slots[key] === undefined || flow.slots[key] === null) return key;
  }
  return null;
}

function isComplete(flow) {
  if (!flow) return false;
  return STEP_ORDER.every((k) => flow.slots[k] !== undefined && flow.slots[k] !== null);
}

function fillSlot(flow, key, value) {
  if (!isValidSlotValue(key, value)) return false;
  flow.slots[key] = value;
  flow.updatedAt = new Date().toISOString();
  return true;
}

/**
 * اعمال یک پیام کاربر روی فلو
 * - لغو / شروع دوباره
 * - استخراج چند اسلات از یک پیام
 * - اگر اسلات جاری هنوز خالی است، تطبیق با quickReply
 *
 * @returns {{flow, filled: string[], nextStep: string|null, completed: boolean, cancelled: boolean, restarted: boolean, needReask: boolean}}
 */
function applyMessage(flow, message) {
  const result = {
    flow,
    filled: [],
    nextStep: null,
    completed: false,
    cancelled: false,
    restarted: false,
    needReask: false,
  };

  if (!flow || !flow.active) {
    return result;
  }

  if (isCancelCommand(message)) {
    flow.active = false;
    flow.cancelled = true;
    flow.complete = false;
    flow.updatedAt = new Date().toISOString();
    result.cancelled = true;
    return result;
  }

  if (isRestartCommand(message)) {
    const fresh = createFlow();
    result.flow = fresh;
    result.restarted = true;
    result.nextStep = getNextStepKey(fresh);
    return result;
  }

  const current = getNextStepKey(flow);

  // ۱) استخراج چنداسلاتی از کل پیام
  const extracted = extractSlots(message, current);
  for (const [k, v] of Object.entries(extracted)) {
    if (!STEP_ORDER.includes(k) && !OPTIONAL_SLOTS[k] && k !== 'tech' && k !== 'resolution') continue;
    if (flow.slots[k] === undefined || flow.slots[k] === null) {
      if (fillSlot(flow, k, v) || (k === 'tech' || k === 'resolution') && isValidSlotValue(k, v)) {
        if (k === 'tech' || k === 'resolution') {
          flow.slots[k] = v;
          flow.updatedAt = new Date().toISOString();
        }
        if (STEP_ORDER.includes(k)) result.filled.push(k);
      }
    }
  }

  // tech/resolution حتی اگر از قبل ست بودند با اشاره صریح بازنویسی می‌شوند
  if (extracted.tech && isValidSlotValue('tech', extracted.tech)) {
    flow.slots.tech = extracted.tech;
  }
  if (extracted.resolution && isValidSlotValue('resolution', extracted.resolution)) {
    flow.slots.resolution = extracted.resolution;
  }

  // ۲) اگر اسلات جاری هنوز خالی است، تطبیق با گزینه/متن همان سوال
  //    نکته: اگر همین پیام قبلاً اسلات دیگری را پر کرده، عددِ باقی‌مانده
  //    نباید به اسلات بعدی نشت کند (مثلاً «۳۰ روز» ≠ ۳۰ متر کابل).
  const stillCurrent = getNextStepKey(flow);
  if (stillCurrent && (flow.slots[stillCurrent] === undefined || flow.slots[stillCurrent] === null)) {
    const matched = matchQuickReplyValue(stillCurrent, message);
    const numericSlot = ['camerasCount', 'retentionDays', 'cableMetersPerCam'].includes(stillCurrent);
    const alreadyFilled = result.filled.length > 0;
    const leakRisk = numericSlot && alreadyFilled;

    if (matched !== undefined && isValidSlotValue(stillCurrent, matched) && !leakRisk) {
      fillSlot(flow, stillCurrent, matched);
      result.filled.push(stillCurrent);
    } else if (result.filled.length === 0) {
      result.needReask = true;
    }
  }

  flow.updatedAt = new Date().toISOString();
  result.flow = flow;
  result.nextStep = getNextStepKey(flow);
  result.completed = isComplete(flow);
  if (result.completed) {
    flow.complete = true;
  }
  return result;
}

/**
 * اعمال مقدار یک quickReply (کلیک دکمه)
 */
function applyQuickReply(flow, key, value) {
  const out = {
    flow,
    ok: false,
    filled: [],
    nextStep: null,
    completed: false,
    error: null,
  };

  if (!flow || !flow.active) {
    out.error = 'گفت‌وگوی پک فعال نیست.';
    return out;
  }
  if (!CCTV_STEPS[key] && !OPTIONAL_SLOTS[key]) {
    out.error = 'اسلات نامعتبر است.';
    return out;
  }

  let v = value;
  if (typeof v === 'string' && STEP_ORDER.includes(key)) {
    // اجازه value خام quickReply (مثل "outdoor") یا عدد
    const asNum = Number(v);
    if (Number.isFinite(asNum) && isValidSlotValue(key, asNum)) v = asNum;
    else if (isValidSlotValue(key, v)) {
      // ok string enum
    } else {
      const matched = matchQuickReplyValue(key, v);
      if (matched !== undefined) v = matched;
    }
  }

  if (!isValidSlotValue(key, v)) {
    out.error = 'مقدار نامعتبر است.';
    return out;
  }

  if (STEP_ORDER.includes(key)) {
    fillSlot(flow, key, v);
    out.filled.push(key);
  } else {
    flow.slots[key] = v;
    flow.updatedAt = new Date().toISOString();
  }

  out.ok = true;
  out.nextStep = getNextStepKey(flow);
  out.completed = isComplete(flow);
  if (out.completed) flow.complete = true;
  return out;
}

/* ==========================================================================
 * ۶) نمایش / payload برای کلاینت
 * ========================================================================== */

function buildPrompt(flow) {
  const nextKey = getNextStepKey(flow);
  if (!nextKey) {
    return {
      done: true,
      message: 'همه اطلاعات جمع شد؛ دارم پک رو آماده می‌کنم…',
      stepKey: null,
      quickReplies: [],
    };
  }
  const step = CCTV_STEPS[nextKey];
  return {
    done: false,
    message: step.question,
    stepKey: nextKey,
    quickReplies: step.quickReplies.map((qr) => ({ label: qr.label, value: qr.value })),
  };
}

/**
 * payload فلو برای پاسخ API (سازگار با نیاز UI دکمه‌ای)
 */
function toFlowView(flow) {
  const nextKey = getNextStepKey(flow);
  const answered = STEP_ORDER.filter((k) => flow.slots[k] !== undefined && flow.slots[k] !== null);
  return {
    active: Boolean(flow && flow.active && !flow.cancelled),
    complete: Boolean(flow && flow.complete),
    cancelled: Boolean(flow && flow.cancelled),
    slots: { ...(flow?.slots || {}) },
    step: nextKey,
    stepIndex: nextKey ? STEP_ORDER.indexOf(nextKey) : STEP_ORDER.length,
    totalSteps: STEP_ORDER.length,
    answered,
    question: nextKey ? CCTV_STEPS[nextKey].question : null,
    quickReplies: nextKey
      ? CCTV_STEPS[nextKey].quickReplies.map((qr) => ({ label: qr.label, value: qr.value }))
      : [],
  };
}

/**
 * تبدیل اسلات‌ها به ورودی assembleCCTVPackage
 */
function toAssemblyParams(flow) {
  const s = flow?.slots || {};
  return {
    environment: s.environment || 'outdoor',
    camerasCount: Number(s.camerasCount) || 4,
    tech: s.tech || DEFAULT_ASSEMBLY.tech,
    resolution: s.resolution || DEFAULT_ASSEMBLY.resolution,
    nightVision: s.nightVision || 'ir',
    retentionDays: Number(s.retentionDays) || 20,
    cableMetersPerCam: Number(s.cableMetersPerCam) || 20,
  };
}

/**
 * متن کوتاه تأیید اسلات (برای لاگ/پیام) — بدون LLM
 */
function summarizeSlots(slots) {
  const envFa = { outdoor: 'فضای باز', indoor: 'داخل ساختمان', mixed: 'ترکیبی' };
  const nvFa = { warm_light: 'دید در شب رنگی', ir: 'مادون قرمز' };
  const parts = [];
  if (slots.environment) parts.push(envFa[slots.environment] || slots.environment);
  if (slots.camerasCount) parts.push(`${slots.camerasCount} دوربین`);
  if (slots.nightVision) parts.push(nvFa[slots.nightVision] || slots.nightVision);
  if (slots.retentionDays) parts.push(`ضبط ${slots.retentionDays} روزه`);
  if (slots.cableMetersPerCam) parts.push(`کابل ${slots.cableMetersPerCam} متری هر دوربین`);
  return parts.join(' · ');
}

/* ==========================================================================
 * ۷) خروجی ماژول
 * ========================================================================== */

module.exports = {
  // ساختار سوالات
  CCTV_STEPS,
  STEP_ORDER,
  OPTIONAL_SLOTS,
  DEFAULT_ASSEMBLY,

  // نیت / فرمان
  detectCctvIntent,
  isCancelCommand,
  isRestartCommand,

  // اسلات
  extractSlots,
  matchQuickReplyValue,
  isValidSlotValue,
  snapToQuickReply,
  toEnglishDigits,
  normalizeText,

  // فلو
  createFlow,
  applyMessage,
  applyQuickReply,
  getNextStepKey,
  isComplete,
  fillSlot,

  // نمایش
  buildPrompt,
  toFlowView,
  toAssemblyParams,
  summarizeSlots,
};
