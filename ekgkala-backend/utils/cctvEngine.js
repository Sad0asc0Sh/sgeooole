/**
 * cctvEngine.js
 * موتور تخصصی قوانین مهندسی، اعتبارسنجی سازگاری، محاسبه مقیاس و رفع خطای پک دوربین مداربسته
 *
 * اصول فنی برای ریسک خطای نزدیک به صفر:
 * ۱. سازگاری تکنولوژی: دوربین آنالوگ (AHD/CVI/TVI) فقط با DVR/XVR | دوربین شبکه فقط با NVR
 * ۲. محاسبه ظرفیت کانال دستگاه: تعداد کانال رکوردر >= تعداد دوربین‌ها (۴، ۸، ۱۶، ۳۲)
 * ۳. محاسبه منبع تغذیه: پاور صنعتی ۱۲ ولت متناسب با بار کل (حداقل ۲ آمپر به ازای هر دوربین)
 * ۴. انتخاب هارددیسک نظارتی: سری نظارتی ۲۴/۷ (بنفش WD / SkyHawk) با ظرفیت مناسب تعداد دوربین
 * ۵. سازگاری کابل و فیش: آنالوگ → کابل ترکیبی RG59 + فیش BNC | شبکه → کابل Cat6 + سوکت RJ45
 * ۶. تناسب محیط: فضای داخلی منزل/مغازه → دوربین دام (سقفی) | فضای بیرونی/باغ/حیاط → دوربین بولت (ضدآب)
 */

const { normalizeFa, escapeRegex, effectiveStock } = require('./chatRetrieval');

const PERSIAN_DIGIT_MAP = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

const PERSIAN_WORD_NUMBERS = {
  'یک': 1, 'یه': 1, 'تک': 1,
  'دو': 2,
  'سه': 3,
  'چهار': 4, 'چار': 4,
  'پنج': 5,
  'شش': 6, 'شیش': 6,
  'هفت': 7,
  'هشت': 8,
  'نه': 9,
  'ده': 10,
  'شانزده': 16, 'شونزده': 16,
  'سی و دو': 32,
};

function toEnglishDigits(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[۰-۹٠-٩]/g, (w) => PERSIAN_DIGIT_MAP[w] || w);
}

/**
 * استخراج هوشمند نیازهای کاربر برای سیستم دوربین مداربسته
 */
function parseCctvNeeds(message, history = [], currentNeeds = {}) {
  const needs = {
    cameraCount: currentNeeds.cameraCount || 4,
    countSpecified: Boolean(currentNeeds.countSpecified),
    environment: currentNeeds.environment || 'outdoor', // outdoor (بولت) یا indoor (دام) یا mixed
    envSpecified: Boolean(currentNeeds.envSpecified),
    techType: currentNeeds.techType || 'ahd', // ahd (اقتصادی/آنالوگ) یا ip (تحت شبکه)
    techSpecified: Boolean(currentNeeds.techSpecified),
    budgetTier: currentNeeds.budgetTier || 'economic',
    storageDays: currentNeeds.storageDays || 15,
  };

  const fullText = [
    ...(Array.isArray(history) ? history : [])
      .filter((h) => h && h.role === 'user' && h.content)
      .slice(-4)
      .map((h) => String(h.content)),
    String(message || ''),
  ].join(' ');

  const norm = normalizeFa(fullText);
  const engText = toEnglishDigits(norm);

  // ۱. تشخیص تعداد دوربین
  const countWordRegex = /(یک|دو|سه|چهار|چار|پنج|شش|شیش|هفت|هشت|نه|ده|شانزده)\s*(?:عدد|تا|دستگاه|دوربین)/i;
  const countWordMatch = norm.match(countWordRegex);
  if (countWordMatch && PERSIAN_WORD_NUMBERS[countWordMatch[1]]) {
    needs.cameraCount = PERSIAN_WORD_NUMBERS[countWordMatch[1]];
    needs.countSpecified = true;
  } else {
    const digitMatch = engText.match(/(\d{1,2})\s*(?:عدد|تا|دستگاه|دوربین|کمرا)/i)
      || engText.match(/(?:پک|پکیج|سیستم|تعداد)\s*(\d{1,2})/i);
    if (digitMatch && Number(digitMatch[1]) > 0 && Number(digitMatch[1]) <= 64) {
      needs.cameraCount = Number(digitMatch[1]);
      needs.countSpecified = true;
    }
  }

  // ۲. تشخیص محیط نصب (داخلی / بیرونی / ترکیبی)
  const indoorPatterns = /(داخل|منزل|خانه|مغازه|دفتر|شرکت|فروشگاه|اتاق|سالن|راهرو|سقف|سقفی|دام|dome)/i;
  const outdoorPatterns = /(بیرون|فضای باز|حیاط|باغ|ویلا|کوچه|پارکینگ|خیابان|محوطه|سوله|کارخانه|دیوار|دیواری|ضدآب|ضد آب|بولت|bullet)/i;
  const mixedPatterns = /(هم داخل هم بیرون|ترکیبی|داخل و بیرون|هر دو)/i;

  if (mixedPatterns.test(norm)) {
    needs.environment = 'mixed';
    needs.envSpecified = true;
  } else if (outdoorPatterns.test(norm) && !indoorPatterns.test(norm)) {
    needs.environment = 'outdoor';
    needs.envSpecified = true;
  } else if (indoorPatterns.test(norm) && !outdoorPatterns.test(norm)) {
    needs.environment = 'indoor';
    needs.envSpecified = true;
  }

  // ۳. تشخیص تکنولوژی (AHD اقتصادی یا IP تحت شبکه)
  const ipPatterns = /(تحت شبکه|شبکه|آی پی|\bip\b|\bnvr\b|کیفیت بالا|فوق العاده|رزولوشن بالا|poe)/i;
  const ahdPatterns = /(آنالوگ|انالوگ|\bahd\b|\bdvr\b|\bxvr\b|اقتصادی|باصرفه|ارزان|معمولی|قیمت مناسب)/i;

  if (ipPatterns.test(norm) && !ahdPatterns.test(norm)) {
    needs.techType = 'ip';
    needs.techSpecified = true;
    needs.budgetTier = 'pro';
  } else if (ahdPatterns.test(norm)) {
    needs.techType = 'ahd';
    needs.techSpecified = true;
    needs.budgetTier = 'economic';
  }

  // ۴. مدت زمان ذخیره‌سازی
  if (/(یک ماه|1 ماه|30 روز|۳۰ روز|یکماه)/i.test(engText)) {
    needs.storageDays = 30;
  } else if (/(دو ماه|2 ماه|60 روز|۶۰ روز)/i.test(engText)) {
    needs.storageDays = 60;
  } else if (/(۱۰ روز|10 روز|۱۵ روز|15 روز|دو هفته)/i.test(engText)) {
    needs.storageDays = 15;
  }

  return needs;
}

/**
 * ساخت متن جستجوی محصول به صورت نرمال‌شده
 */
function productHaystack(p) {
  const catName = p.category && typeof p.category === 'object' ? p.category.name : '';
  const brandName = p.brand && typeof p.brand === 'object' ? p.brand.name : '';
  return normalizeFa(JSON.stringify([
    p.name,
    p.description,
    p.productCode,
    p.sku,
    catName,
    brandName,
    p.properties,
    p.specifications,
  ]));
}

/**
 * تحلیل ویژگی‌های فنی دوربین
 */
function analyzeCamera(p) {
  const hay = productHaystack(p);
  const eng = toEnglishDigits(hay);

  const isIp = /\bip\b|تحت شبکه|شبکه|\bnvr\b|\bpoe\b/i.test(hay);
  const isAhd = /\bahd\b|آنالوگ|انالوگ|\bhdcvi\b|\bhdtvi\b|\bcvi\b|\btvi\b|\bxvr\b|کواکسیال|\bbnc\b/i.test(hay);

  const isDome = /دام|\bdome\b|سقفی/i.test(hay);
  const isBullet = /بولت|\bbullet\b|دیواری|استوانه‌ای/i.test(hay);
  const isPtz = /اسپید دام|\bptz\b|چرخشی|گردان/i.test(hay);

  let resolution = 2; // مگاپیکسل پیش‌فرض
  if (/8\s*mp|8\s*مگاپیکسل|4k/i.test(eng)) resolution = 8;
  else if (/5\s*mp|5\s*مگاپیکسل/i.test(eng)) resolution = 5;
  else if (/4\s*mp|4\s*مگاپیکسل|2k/i.test(eng)) resolution = 4;
  else if (/2\s*mp|2\s*مگاپیکسل|1080p/i.test(eng)) resolution = 2;

  const isOutdoor = isBullet || /ip66|ip67|ضدآب|ضد آب|فلزی/i.test(hay);

  return {
    tech: isIp ? 'ip' : (isAhd ? 'ahd' : 'ahd'),
    form: isDome ? 'dome' : (isBullet ? 'bullet' : (isPtz ? 'ptz' : 'bullet')),
    resolution,
    isOutdoor,
  };
}

/**
 * تحلیل ویژگی‌های فنی دستگاه ضبط (DVR / NVR / XVR)
 */
function analyzeRecorder(p) {
  const hay = productHaystack(p);
  const eng = toEnglishDigits(hay);

  const isNvr = /\bnvr\b|تحت شبکه/i.test(hay);
  const isXvr = /\bxvr\b/i.test(hay);
  const isDvr = /\bdvr\b|آنالوگ|انالوگ/i.test(hay);

  let channels = 4;
  const chMatch = eng.match(/(\d{1,2})\s*(?:کانال|\bch\b|channel)/i);
  if (chMatch && Number(chMatch[1]) > 0) {
    channels = Number(chMatch[1]);
  } else if (/4\s*ch|۴\s*کانال/i.test(eng)) channels = 4;
  else if (/8\s*ch|۸\s*کانال/i.test(eng)) channels = 8;
  else if (/16\s*ch|۱۶\s*کانال/i.test(eng)) channels = 16;
  else if (/32\s*ch|۳۲\s*کانال/i.test(eng)) channels = 32;

  const hasPoe = /\bpoe\b|پورت poe/i.test(hay);

  return {
    type: isNvr ? 'nvr' : (isXvr ? 'xvr' : (isDvr ? 'dvr' : 'dvr')),
    supportsIp: isNvr || isXvr,
    supportsAhd: !isNvr || isXvr,
    channels,
    hasPoe,
  };
}

/**
 * تحلیل ویژگی‌های فنی هارددیسک
 */
function analyzeHdd(p) {
  const hay = productHaystack(p);
  const eng = toEnglishDigits(hay);

  const isSurveillance = /بنفش|purple|skyhawk|نظارتی|surveillance/i.test(hay);

  let capacityGb = 1000; // پیش‌فرض ۱ ترابایت
  if (/8\s*tb|8\s*ترابایت/i.test(eng)) capacityGb = 8000;
  else if (/6\s*tb|6\s*ترابایت/i.test(eng)) capacityGb = 6000;
  else if (/4\s*tb|4\s*ترابایت/i.test(eng)) capacityGb = 4000;
  else if (/2\s*tb|2\s*ترابایت/i.test(eng)) capacityGb = 2000;
  else if (/1\s*tb|1\s*ترابایت/i.test(eng)) capacityGb = 1000;
  else if (/500\s*gb|500\s*گیگ/i.test(eng)) capacityGb = 500;

  return { isSurveillance, capacityGb };
}

/**
 * تحلیل منبع تغذیه (پاور صنعتی / آداپتور)
 */
function analyzePower(p) {
  const hay = productHaystack(p);
  const eng = toEnglishDigits(hay);

  let amperage = 2; // پیش‌فرض ۲ آمپر
  const ampMatch = eng.match(/(\d{1,2})\s*(?:آمپر|\ba\b|amp)/i);
  if (ampMatch && Number(ampMatch[1]) > 0) {
    amperage = Number(ampMatch[1]);
  }

  const isIndustrial = /صنعتی|سوئیچینگ|فلزی|فن دار|فن‌دار/i.test(hay);

  return { amperage, isIndustrial };
}

/**
 * سیستم رتبه‌بندی مهندسی و اضافه کردن توضیحات سازگاری برای هر مرحله
 */
function rankAndAnnotateOptions(stepKey, options, context = {}) {
  const req = context.requirements || {};
  const cameraCount = req.cameraCount || 4;
  const selectedCamera = context.selectedCamera || null;

  return options.map((opt) => {
    let score = 0;
    let hint = '';
    let recQty = 1;

    // ۱. مرحله دوربین مداربسته
    if (stepKey === 'camera') {
      const cam = analyzeCamera(opt);
      recQty = cameraCount;

      // اولویت تطابق تکنولوژی
      if (req.techType === 'ip' && cam.tech === 'ip') score += 50;
      else if (req.techType === 'ahd' && cam.tech === 'ahd') score += 50;

      // اولویت تطابق محیط
      if (req.environment === 'outdoor') {
        if (cam.form === 'bullet' || cam.isOutdoor) {
          score += 40;
          hint = `مدل بولت با بدنه مقاوم و دید در شب، ایده‌آل برای محیط باز و حیاط (${cameraCount} عدد)`;
        } else {
          score += 10;
          hint = `مدل سقفی دام (مناسب فضای سرپوشیده و راهروها)`;
        }
      } else if (req.environment === 'indoor') {
        if (cam.form === 'dome') {
          score += 40;
          hint = `مدل دام سقفی با زاویه دید عریض و ظاهر ظریف مناسب منزل و مغازه (${cameraCount} عدد)`;
        } else {
          score += 10;
          hint = `مدل دیواری با پوشش مناسب`;
        }
      } else {
        hint = `${cameraCount} عدد دوربین با رزولوشن ${cam.resolution} مگاپیکسل`;
      }
    }

    // ۲. مرحله دستگاه ضبط (DVR / NVR)
    else if (stepKey === 'recorder') {
      const rec = analyzeRecorder(opt);
      recQty = 1;
      const camTech = selectedCamera ? analyzeCamera(selectedCamera).tech : (req.techType || 'ahd');

      // سازگاری قطعی ۱۰۰٪ تکنولوژی
      if (camTech === 'ip') {
        if (rec.supportsIp) {
          score += 70;
          hint = `دستگاه NVR تحت شبکه سازگار کامل با دوربین‌های IP (پشتیبانی تا ${rec.channels} کانال)`;
        } else {
          score -= 300; // عدم تطابق مهندسی: دوربین شبکه با DVR آنالوگ کار نمی‌کند!
          hint = 'توجه: این دستگاه برای دوربین‌های آنالوگ است و برای دوربین IP مناسب نیست';
        }
      } else {
        // دوربین آنالوگ (AHD)
        if (rec.supportsAhd) {
          score += 70;
          hint = `دستگاه ضبط ${rec.channels} کانال با ورودی BNC سازگار با دوربین‌های آنالوگ انتخابی`;
        } else {
          score -= 300; // عدم تطابق مهندسی: دوربین آنالوگ با NVR کار نمی‌کند!
          hint = 'توجه: این دستگاه فقط پورت شبکه دارد و با دوربین‌های BNC کار نمی‌کند';
        }
      }

      // محاسبه حداقل کانال مورد نیاز
      if (rec.channels >= cameraCount) {
        score += 40;
        if (rec.channels === 4 && cameraCount <= 4) score += 20;
        else if (rec.channels === 8 && cameraCount > 4 && cameraCount <= 8) score += 20;
        else if (rec.channels === 16 && cameraCount > 8 && cameraCount <= 16) score += 20;
      } else {
        score -= 200; // تعداد کانال کمتر از تعداد دوربین است!
        hint = `ناکافی برای ${cameraCount} دوربین (دستگاه فقط ${rec.channels} کانال دارد)`;
      }
    }

    // ۳. مرحله هارددیسک (HDD)
    else if (stepKey === 'hdd') {
      const hdd = analyzeHdd(opt);
      recQty = 1;

      if (hdd.isSurveillance) {
        score += 60; // اولویت قطعی هارد نظارتی (بنفش/SkyHawk)
      }

      // محاسبه ظرفیت بهینه بر اساس تعداد دوربین
      let targetCapacity = 1000;
      if (cameraCount <= 2) targetCapacity = 1000;
      else if (cameraCount <= 4) targetCapacity = req.storageDays >= 30 ? 2000 : 1000;
      else if (cameraCount <= 8) targetCapacity = req.storageDays >= 30 ? 4000 : 2000;
      else targetCapacity = 4000;

      if (hdd.capacityGb === targetCapacity) {
        score += 40;
        hint = `ظرفیت بهینه ${hdd.capacityGb / 1000}TB ویژه ضبط ۲۴/۷ (آرشیو حدود ${req.storageDays || 15} روز)`;
      } else if (hdd.capacityGb > targetCapacity) {
        score += 20;
        hint = `ظرفیت بالا (${hdd.capacityGb / 1000}TB) برای آرشیو طولانی‌مدت`;
      } else {
        score += 5;
        hint = `ظرفیت ${hdd.capacityGb}GB`;
      }
    }

    // ۴. مرحله منبع تغذیه (پاور / آداپتور)
    else if (stepKey === 'power') {
      const pwr = analyzePower(opt);
      recQty = 1;
      const neededAmps = Math.max(2, cameraCount * 2);

      if (cameraCount <= 2) {
        if (pwr.amperage >= 2 && pwr.amperage <= 5) {
          score += 50;
          hint = `آداپتور ${pwr.amperage} آمپر متناسب برای تغذیه پایدار ${cameraCount} دوربین`;
        }
      } else {
        // برای ۳ دوربین به بالا پاور صنعتی متمرکز سوئیچینگ بهترین انتخاب است
        if (pwr.isIndustrial) score += 30;
        if (pwr.amperage >= neededAmps) {
          score += 50;
          hint = `پاور صنعتی ${pwr.amperage} آمپر جهت تأمین برق پایدار ${cameraCount} دوربین و دید در شب`;
        } else if (pwr.amperage >= 10) {
          score += 20;
          hint = `منبع تغذیه ${pwr.amperage} آمپر`;
        }
      }
    }

    // ۵. مرحله کابل و اتصالات
    else if (stepKey === 'cable') {
      const hay = productHaystack(opt);
      const camTech = selectedCamera ? analyzeCamera(selectedCamera).tech : (req.techType || 'ahd');
      recQty = 1;

      if (camTech === 'ahd') {
        if (/rg59|ترکیبی|کواکسیال/i.test(hay)) {
          score += 60;
          hint = `کابل کواکسیال ترکیبی RG59 (برق + تصویر همزمان) استاندارد دوربین‌های AHD`;
        } else if (/bnc|فیش/i.test(hay)) {
          score += 40;
          hint = `فیش BNC با مغزی مسی جهت جلوگیری از افت سیگنال و نویز تصویر`;
        }
      } else {
        if (/cat6|cat5|شبکه/i.test(hay)) {
          score += 60;
          hint = `کابل شبکه تمام مس مناسب انتقال بدون افت پهنای باند تصویر دوربین‌های IP`;
        }
      }
    }

    // امتیاز نهایی با در نظر گرفتن موجودی و امتیاز مهندسی
    return {
      opt,
      score,
      hint: hint || opt.category || '',
      recQty,
    };
  });
}

module.exports = {
  parseCctvNeeds,
  analyzeCamera,
  analyzeRecorder,
  analyzeHdd,
  analyzePower,
  rankAndAnnotateOptions,
  toEnglishDigits,
};
