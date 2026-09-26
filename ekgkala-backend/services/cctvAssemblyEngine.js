/**
 * cctvAssemblyEngine.js
 * موتور قطعی اسمبل پکیج دوربین مداربسته (Deterministic Assembly Engine)
 *
 * قاعده: تمام محاسبات فنی (کابل، هارد، برق، اتصالات، رکوردر) از فرمول‌های
 * ریاضی ثابت و انتخاب محصول از MongoDB انجام می‌شود. هیچ فراخوانی LLM
 * یا مقدار تصادفی/حدسی در این ماژول وجود ندارد.
 *
 * خروجی برای همان ورودی، همیشه یکسان است (deterministic).
 */

const Product = require('../models/Product');
const Category = require('../models/Category');
const { normalizeFa, effectiveStock, specList } = require('../utils/chatRetrieval');

/* ==========================================================================
 * ۱) ثابت‌های مهندسی — همه از استاندارد بازار / دیتاشیت دوربین
 * ========================================================================== */

/** بیت‌ریت مصرفی (Mbps) به ازای هر دوربین — H.265+ معمول بازار */
const BITRATE_MBPS = Object.freeze({
  '2mp': 1.5,
  '4mp': 3.0,
  '5mp': 4.0,
  '8mp': 6.0,
});

/** افزونه ذخیره‌سازی (فایل‌سیستم، ایندکس، نوسان موشن) */
const STORAGE_OVERHEAD = 1.1;

/** ضریب هدر کابل (حلقه، پیچ‌خوردگی، اتصال، احتیاط نصب) */
const CABLE_WASTE_RATIO = 0.1;

/** ضریب هدروم جریان راه‌اندازی IR / Warm-light */
const POWER_HEADROOM = 1.25;

/** جریان مصرفی هر دوربین آنالوگ (آمپر @ 12V) */
const AMPS_PER_CAM = Object.freeze({
  ir: 1.0,
  warm_light: 1.5,
});

/** توان مصرفی هر دوربین IP روی PoE (وات) */
const WATTS_PER_CAM = Object.freeze({
  ir: 9,
  warm_light: 13,
});

/** سایزهای استاندارد هارددیسک نظارتی (گیگابایت) — بازار ایران */
const HDD_SIZES_GB = Object.freeze([500, 1000, 2000, 3000, 4000, 6000, 8000, 10000]);

/** سایزهای استاندارد کانال رکوردر */
const RECORDER_CHANNELS = Object.freeze([4, 8, 16, 32, 64]);

/** آمپرهای استاندارد پاور صنعتی / آداپتور */
const POWER_SUPPLY_AMPS = Object.freeze([2, 3, 5, 10, 15, 20, 30]);

/** پورت‌های استاندارد سوئیچ شبکه */
const SWITCH_PORTS = Object.freeze([5, 8, 16, 24, 48]);

/** حداکثر متراژ مجاز از یک پاور مشترک (افت ولتاژ RG59 / Cat6) */
const MAX_SHARED_POWER_RUN_M = 50;

/** رزولوشن‌ها از کم به زیاد برای مقایسه */
const RESOLUTION_ORDER = Object.freeze(['2mp', '4mp', '5mp', '8mp']);
const RESOLUTION_MP = Object.freeze({ '2mp': 2, '4mp': 4, '5mp': 5, '8mp': 8 });

const VALID_ENVIRONMENTS = Object.freeze(['indoor', 'outdoor', 'mixed']);
const VALID_TECHS = Object.freeze(['ahd', 'ip']);
const VALID_RESOLUTIONS = Object.freeze(['2mp', '4mp', '5mp', '8mp']);
const VALID_NIGHT_VISION = Object.freeze(['warm_light', 'ir']);

const DEFAULTS = Object.freeze({
  environment: 'outdoor',
  camerasCount: 4,
  tech: 'ahd',
  resolution: '5mp',
  nightVision: 'ir',
  retentionDays: 20,
  cableMetersPerCam: 20,
});

/* ==========================================================================
 * ۲) کمک‌تابع‌های خالص
 * ========================================================================== */

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(value, min, max, fallback) {
  const n = Math.floor(toNumber(value, fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampNumber(value, min, max, fallback) {
  const n = toNumber(value, fallback);
  return Math.min(max, Math.max(min, n));
}

/** انتخاب کوچک‌ترین مقدارِ ≥ target از لیست مرتب */
function snapUp(list, target) {
  for (const v of list) {
    if (v >= target) return v;
  }
  return list[list.length - 1];
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function ceilInt(n) {
  return Math.ceil(n - 1e-9);
}

/* ==========================================================================
 * ۳) نرمال‌سازی و اعتبارسنجی ورودی
 * ========================================================================== */

/**
 * نرمال‌سازی پارامترهای ورودی assembleCCTVPackage
 * @param {object} params
 * @returns {{ok: true, value: object} | {ok: false, errors: string[]}}
 */
function normalizeParams(params = {}) {
  const errors = [];
  const p = params && typeof params === 'object' ? params : {};

  const environment = VALID_ENVIRONMENTS.includes(p.environment) ? p.environment : DEFAULTS.environment;
  const tech = VALID_TECHS.includes(p.tech) ? p.tech : DEFAULTS.tech;
  const resolution = VALID_RESOLUTIONS.includes(p.resolution) ? p.resolution : DEFAULTS.resolution;
  const nightVision = VALID_NIGHT_VISION.includes(p.nightVision) ? p.nightVision : DEFAULTS.nightVision;

  const rawCount = p.camerasCount === undefined || p.camerasCount === null || p.camerasCount === ''
    ? DEFAULTS.camerasCount
    : toNumber(p.camerasCount, NaN);
  if (!Number.isFinite(rawCount) || rawCount < 1) {
    errors.push('camerasCount باید عدد ≥ ۱ باشد.');
  }
  const camerasCount = clampInt(p.camerasCount, 1, 128, DEFAULTS.camerasCount);

  const rawDays = p.retentionDays === undefined || p.retentionDays === null || p.retentionDays === ''
    ? DEFAULTS.retentionDays
    : toNumber(p.retentionDays, NaN);
  if (!Number.isFinite(rawDays) || rawDays < 1) {
    errors.push('retentionDays باید عدد ≥ ۱ باشد.');
  }
  const retentionDays = clampInt(p.retentionDays, 1, 365, DEFAULTS.retentionDays);

  const rawCable = p.cableMetersPerCam === undefined || p.cableMetersPerCam === null || p.cableMetersPerCam === ''
    ? DEFAULTS.cableMetersPerCam
    : toNumber(p.cableMetersPerCam, NaN);
  if (!Number.isFinite(rawCable) || rawCable < 1) {
    errors.push('cableMetersPerCam باید عدد ≥ ۱ باشد.');
  }
  const cableMetersPerCam = clampNumber(p.cableMetersPerCam, 1, 500, DEFAULTS.cableMetersPerCam);

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      environment,
      camerasCount,
      tech,
      resolution,
      nightVision,
      retentionDays,
      cableMetersPerCam,
    },
  };
}

/* ==========================================================================
 * ۴) فرمول‌های قطعی محاسبات
 * ========================================================================== */

/**
 * محاسبه ظرفیت هارد (GB)
 *
 * فرمول:
 *   gbPerDayPerCam = bitrateMbps × 3600 × 24 / 8 / 1024
 *   requiredGb     = gbPerDayPerCam × camerasCount × retentionDays × STORAGE_OVERHEAD
 *
 * همه واحدها: بیت‌ریت Mbps، خروجی GB (base-1024 برای هارد).
 */
function calcStorage(params) {
  const bitrateMbps = BITRATE_MBPS[params.resolution];
  // 1 Mbps × 1 day = 1e6 bit/s × 86400 s / 8 / 2^30 ≈ 10.07 GiB — از فرمول بایتی
  const bytesPerDayPerCam = (bitrateMbps * 1e6 * 86400) / 8;
  const gbPerDayPerCam = round2(bytesPerDayPerCam / (1024 ** 3));
  const gbPerDayTotal = round2(gbPerDayPerCam * params.camerasCount);

  const rawRequiredGb = gbPerDayTotal * params.retentionDays * STORAGE_OVERHEAD;
  const requiredGb = ceilInt(rawRequiredGb);

  const drive = pickHddPlan(requiredGb);

  return {
    bitrateMbps,
    codecAssumption: 'H.265+',
    gbPerDayPerCam,
    gbPerDayTotal,
    retentionDays: params.retentionDays,
    camerasCount: params.camerasCount,
    overheadFactor: STORAGE_OVERHEAD,
    requiredGb,
    requiredTb: round2(requiredGb / 1000),
    hddPlan: drive,
    formula:
      'requiredGb = ceil(bitrateMbps×1e6×86400/8/1024^3 × camerasCount × retentionDays × 1.1)',
  };
}

/**
 * انتخاب برنامه هارد: کوچک‌ترین ترکیب استاندارد که ظرفیت را پوشش دهد.
 * برای یک درایو کافی → ۱ عدد. برای ظرفیت بالا → چند درایو هم‌اندازه.
 */
function pickHddPlan(requiredGb) {
  const single = snapUp(HDD_SIZES_GB, requiredGb);
  if (requiredGb <= single) {
    return {
      drives: [{ capacityGb: single, qty: 1 }],
      totalGb: single,
      count: 1,
    };
  }
  // چند درایو یک‌اندازه — مثلاً ۲×۴TB برای نیاز ~۷TB
  const driveSize = snapUp(HDD_SIZES_GB, Math.ceil(requiredGb / 2));
  let count = ceilInt(requiredGb / driveSize);
  // اگر با ۳ یا ۴ درایو کوچک‌تر ارزان‌تر/متعارف‌تر است، همان را نگه می‌داریم
  if (count > 4) {
    const maxSize = HDD_SIZES_GB[HDD_SIZES_GB.length - 1];
    count = ceilInt(requiredGb / maxSize);
    return {
      drives: [{ capacityGb: maxSize, qty: count }],
      totalGb: maxSize * count,
      count,
    };
  }
  return {
    drives: [{ capacityGb: driveSize, qty: count }],
    totalGb: driveSize * count,
    count,
  };
}

/**
 * محاسبه متراژ کابل
 *
 * فرمول:
 *   baseMeters   = camerasCount × cableMetersPerCam
 *   wasteMeters  = ceil(baseMeters × CABLE_WASTE_RATIO)
 *   totalMeters  = baseMeters + wasteMeters
 */
function calcCable(params) {
  const baseMeters = params.camerasCount * params.cableMetersPerCam;
  const wasteMeters = ceilInt(baseMeters * CABLE_WASTE_RATIO);
  const totalMeters = baseMeters + wasteMeters;
  const cableKind = params.tech === 'ip' ? 'cat6' : 'rg59_combined';

  return {
    cableKind,
    metersPerCamera: params.cableMetersPerCam,
    camerasCount: params.camerasCount,
    baseMeters,
    wasteMeters,
    wasteRatio: CABLE_WASTE_RATIO,
    totalMeters,
    formula: 'totalMeters = camerasCount × cableMetersPerCam × (1 + 0.1)',
  };
}

/**
 * محاسبه منبع تغذیه / پاور
 *
 * آنالوگ (AHD):
 *   totalAmps  = camerasCount × ampsPerCam
 *   supplyAmps = snapUp(POWER_SUPPLY_AMPS, totalAmps × POWER_HEADROOM)
 *
 * IP:
 *   poeBudget  = camerasCount × wattsPerCam × POWER_HEADROOM
 *   switchPorts= snapUp(SWITCH_PORTS, camerasCount + 1)  // +1 uplink
 */
function calcPower(params) {
  const longRun = params.cableMetersPerCam > MAX_SHARED_POWER_RUN_M;

  if (params.tech === 'ip') {
    const wattsPerCam = WATTS_PER_CAM[params.nightVision];
    const totalWatts = round2(params.camerasCount * wattsPerCam);
    const poeBudgetWatts = round2(totalWatts * POWER_HEADROOM);
    // پورت سوئیچ: دوربین‌ها + یک پورت uplink به NVR/روتر
    const portsNeeded = params.camerasCount + 1;
    const switchPorts = snapUp(SWITCH_PORTS, portsNeeded);

    return {
      tech: 'ip',
      mode: 'poe',
      wattsPerCam,
      totalWatts,
      poeBudgetWatts,
      portsNeeded,
      switchPorts,
      // اگر کابل بلند باشد، PoE باز هم کار می‌کند ولی هشدار افت ولتاژ
      longRun,
      recommendedSupply: `سوئیچ PoE ${switchPorts} پورت با بودجه ≥ ${ceilInt(poeBudgetWatts)}W`,
      formula: 'poeBudgetWatts = camerasCount × wattsPerCam × 1.25; switchPorts = snapUp([5,8,16,24,48], camerasCount+1)',
    };
  }

  const ampsPerCam = AMPS_PER_CAM[params.nightVision];
  const totalAmps = round2(params.camerasCount * ampsPerCam);
  const requiredAmps = round2(totalAmps * POWER_HEADROOM);
  const supplyAmps = snapUp(POWER_SUPPLY_AMPS, requiredAmps);
  // برای اجراهای بلند: چند آداپتور مستقل یا پاور صنعتی با کابل ضخیم‌تر
  const useIndividualAdapters = longRun && params.camerasCount <= 8;

  return {
    tech: 'ahd',
    mode: useIndividualAdapters ? 'individual_adapters' : 'central_psu',
    ampsPerCam,
    totalAmps,
    requiredAmps,
    supplyAmps,
    longRun,
    useIndividualAdapters,
    recommendedSupply: useIndividualAdapters
      ? `${params.camerasCount} عدد آداپتور 12V 2A (اجرای بلند ≥ ${MAX_SHARED_POWER_RUN_M}m)`
      : `پاور صنعتی 12V ${supplyAmps}A`,
    formula: 'supplyAmps = snapUp([2,3,5,10,15,20,30], camerasCount × ampsPerCam × 1.25)',
  };
}

/**
 * محاسبه اتصالات (فیش / سوکت)
 *
 * آنالوگ: BNC مادگی/نری ۲ عدد به ازای هر دوربین + ۲ یدکی
 *          جک DC: ۲ عدد به ازای هر دوربین (یا ترمینال روی پاور صنعتی)
 * IP:      RJ45: ۲ عدد به ازای هر دوربین + ۴ یدکی
 *          برای outdoor: کاور ضدآب RJ45
 */
function calcConnectors(params) {
  const isOutdoor = params.environment === 'outdoor' || params.environment === 'mixed';

  if (params.tech === 'ip') {
    const rj45 = params.camerasCount * 2 + 4;
    const waterproofRj45 = isOutdoor ? params.camerasCount * 2 : 0;
    return {
      tech: 'ip',
      rj45,
      waterproofRj45,
      bnc: 0,
      dcJacks: 0,
      details: [
        `سوکت RJ45: ${rj45} عدد (${params.camerasCount}×۲ + ۴ یدکی)`,
        ...(waterproofRj45 ? [`کاور ضدآب RJ45: ${waterproofRj45} عدد`] : []),
      ],
    };
  }

  const bnc = params.camerasCount * 2 + 2;
  const dcJacks = params.useIndividualAdapters || params.power?.useIndividualAdapters
    ? params.camerasCount * 2
    : params.camerasCount + 1; // ترمینال پاور صنعتی در سمت تغذیه
  const waterproofBnc = isOutdoor ? params.camerasCount * 2 : 0;

  return {
    tech: 'ahd',
    bnc,
    waterproofBnc,
    dcJacks,
    rj45: 0,
    details: [
      `فیش BNC: ${bnc} عدد (${params.camerasCount}×۲ + ۲ یدکی)`,
      `جک DC: ${dcJacks} عدد`,
      ...(waterproofBnc ? [`کاور/نوار ضدآب BNC: ${waterproofBnc} عدد`] : []),
    ],
  };
}

/**
 * محاسبه مشخصات رکوردر (DVR / NVR)
 *
 *   channels = snapUp(RECORDER_CHANNELS, camerasCount)
 *   hddBays  = بر اساس ظرفیت هارد مورد نیاز
 */
function calcRecorder(params, storage) {
  const channelsNeeded = params.camerasCount;
  const channelsRecommended = snapUp(RECORDER_CHANNELS, channelsNeeded);
  const type = params.tech === 'ip' ? 'nvr' : 'dvr_xvr';

  const totalGb = storage?.hddPlan?.totalGb || storage?.requiredGb || 0;
  let hddBays;
  if (totalGb <= 4000) hddBays = 1;
  else if (totalGb <= 12000) hddBays = 2;
  else if (totalGb <= 24000) hddBays = 4;
  else hddBays = 4;

  return {
    type,
    channelsNeeded,
    channelsRecommended,
    minResolution: params.resolution,
    minResolutionMp: RESOLUTION_MP[params.resolution],
    hddBays,
    formula: 'channelsRecommended = snapUp([4,8,16,32,64], camerasCount)',
  };
}

/**
 * جمع‌بندی تمام نیازهای قطعی — تابع خالص، بدون DB
 */
function computeRequirements(paramsInput) {
  const norm = normalizeParams(paramsInput);
  if (!norm.ok) {
    return { ok: false, errors: norm.errors };
  }
  const params = norm.value;

  const storage = calcStorage(params);
  const cable = calcCable(params);
  const power = calcPower(params);
  const connectors = calcConnectors({ ...params, power });
  const recorder = calcRecorder(params, storage);

  const cameraForm =
    params.environment === 'indoor'
      ? 'dome'
      : params.environment === 'outdoor'
        ? 'bullet'
        : 'bullet_or_outdoor_dome';

  return {
    ok: true,
    params,
    calculations: {
      storage,
      cable,
      power,
      connectors,
      recorder,
      camera: {
        form: cameraForm,
        environment: params.environment,
        tech: params.tech,
        resolution: params.resolution,
        nightVision: params.nightVision,
        qty: params.camerasCount,
      },
    },
  };
}

/* ==========================================================================
 * ۵) تحلیل متن محصول (قطعی، regex ثابت — نه مدل زبانی)
 * ========================================================================== */

function productHaystack(p) {
  if (!p) return '';
  const catName = p.category && typeof p.category === 'object' ? p.category.name || '' : '';
  const brandName = p.brand && typeof p.brand === 'object' ? p.brand.name || '' : '';
  const specs = Array.isArray(p.properties)
    ? p.properties.map((x) => `${x.label || ''} ${x.value || ''}`).join(' ')
    : '';
  const specMixed = p.specifications
    ? typeof p.specifications === 'string'
      ? p.specifications
      : JSON.stringify(p.specifications)
    : '';
  return normalizeFa(
    [p.name, p.description, catName, brandName, specs, specMixed, p.productCode, p.sku]
      .filter(Boolean)
      .join(' '),
  );
}

function analyzeCameraProduct(p) {
  const hay = productHaystack(p);
  const isIp = /\bip\b|تحت شبکه|شبکه|\bnvr\b|\bpoe\b/i.test(hay);
  const isAhd = /\bahd\b|آنالوگ|انالوگ|\bhdcvi\b|\bhdtvi\b|\bcvi\b|\btvi\b|\bxvr\b|کواکسیال|\bbnc\b/i.test(hay);
  const isDome = /دام|\bdome\b|سقفی/i.test(hay);
  const isBullet = /بولت|\bbullet\b|دیواری|استوانه/i.test(hay);
  const isOutdoor = isBullet || /ip66|ip67|ip68|ضدآب|ضد آب|فلزی|outdoor/i.test(hay);
  const isIndoor = isDome && !isOutdoor;

  let resolution = null;
  if (/\b8\s*mp\b|8mp|4k|2160p/i.test(hay)) resolution = '8mp';
  else if (/\b5\s*mp\b|5mp|2592/i.test(hay)) resolution = '5mp';
  else if (/\b4\s*mp\b|4mp|2560/i.test(hay)) resolution = '4mp';
  else if (/\b2\s*mp\b|2mp|1080p|1920/i.test(hay)) resolution = '2mp';

  const warmLight = /وارم|warm\s*light|فول\s*کالر|full\s*color|colorvu|رنگی\s*شب|دید\s*در\s*شب\s*رنگی/i.test(hay);
  const ir = /مادون|\bir\b|اینفرارد|infrared/i.test(hay);

  return {
    tech: isIp && !isAhd ? 'ip' : isAhd && !isIp ? 'ahd' : isIp ? 'ip' : isAhd ? 'ahd' : null,
    form: isBullet && !isDome ? 'bullet' : isDome && !isBullet ? 'dome' : isBullet ? 'bullet' : isDome ? 'dome' : null,
    resolution,
    warmLight,
    ir,
    isOutdoor,
    isIndoor,
  };
}

function analyzeRecorderProduct(p) {
  const hay = productHaystack(p);
  const isNvr = /\bnvr\b|تحت شبکه/i.test(hay);
  const isXvr = /\bxvr\b/i.test(hay);
  const isDvr = /\bdvr\b|آنالوگ|انالوگ/i.test(hay);

  let channels = null;
  const chMatch = hay.match(/(\d{1,2})\s*(?:کانال|\bch\b|channel|\bch\b)/i)
    || hay.match(/(?:کانال|\bch\b|channel)\s*(\d{1,2})/i);
  if (chMatch) channels = parseInt(chMatch[1], 10);

  let maxRes = null;
  if (/\b8\s*mp\b|8mp|4k/i.test(hay)) maxRes = '8mp';
  else if (/\b5\s*mp\b|5mp/i.test(hay)) maxRes = '5mp';
  else if (/\b4\s*mp\b|4mp/i.test(hay)) maxRes = '4mp';
  else if (/\b2\s*mp\b|2mp|1080p/i.test(hay)) maxRes = '2mp';

  const hasPoe = /\bpoe\b/i.test(hay);

  let hddBays = null;
  const bayMatch = hay.match(/(\d)\s*(?:هارد|هارددیسک|bay|hdd)/i);
  if (bayMatch) hddBays = parseInt(bayMatch[1], 10);

  return {
    type: isNvr ? 'nvr' : isXvr ? 'xvr' : isDvr ? 'dvr' : null,
    channels,
    maxRes,
    hasPoe,
    hddBays,
  };
}

function analyzeHddProduct(p) {
  const hay = productHaystack(p);
  const isSurveillance = /بنفش|purple|skyhawk|نظارتی|surveillance|surveillance/i.test(hay);

  let capacityGb = null;
  const tbMatch = hay.match(/(\d+(?:\.\d+)?)\s*(?:\bTB\b|ترابایت|تیبی)/i);
  if (tbMatch) capacityGb = Math.round(parseFloat(tbMatch[1]) * 1000);
  else {
    const gbMatch = hay.match(/(\d{3,5})\s*(?:\bGB\b|گیگابایت|گیگ)/i);
    if (gbMatch) capacityGb = parseInt(gbMatch[1], 10);
  }

  return { isSurveillance, capacityGb };
}

function analyzePowerProduct(p) {
  const hay = productHaystack(p);
  const ampMatch = hay.match(/(\d{1,2}(?:\.\d)?)\s*(?:آمپر|\bA\b|amp)/i);
  const amperage = ampMatch ? parseFloat(ampMatch[1]) : null;
  const isIndustrial = /صنعتی|سوئیچینگ|فلزی|فن دار|فن‌دار|switching/i.test(hay);
  const isAdapter = /آداپتور|adapter|adaptor/i.test(hay);
  const isPoeSwitch = /poe|پی‌اوئی/i.test(hay);
  const isNetworkSwitch = /سوئیچ|switch/i.test(hay);

  let ports = null;
  const portMatch = hay.match(/(\d{1,2})\s*(?:پورت|port)/i);
  if (portMatch) ports = parseInt(portMatch[1], 10);

  return { amperage, isIndustrial, isAdapter, isPoeSwitch, isNetworkSwitch, ports };
}

function analyzeCableProduct(p) {
  const hay = productHaystack(p);
  const isCat6 = /cat6|cat\s*6|شبکه/i.test(hay) && !/rg59|کواکسیال/i.test(hay);
  const isRg59 = /rg59|rg\s*59|کواکسیال|ترکیبی/i.test(hay);
  const isMeter = /متر|meter|\bm\b/i.test(hay);
  const isBox = /باکس|box|قرقره|رول|roll|100\s*m|305/i.test(hay);

  let boxMeters = null;
  const boxMatch = hay.match(/(\d{2,4})\s*(?:متر|m)/i);
  if (boxMatch) {
    const v = parseInt(boxMatch[1], 10);
    if (v >= 50) boxMeters = v;
  }

  return {
    kind: isCat6 && !isRg59 ? 'cat6' : isRg59 ? 'rg59' : null,
    isMeter,
    isBox,
    boxMeters,
  };
}

function analyzeConnectorProduct(p) {
  const hay = productHaystack(p);
  return {
    isBnc: /bnc/i.test(hay),
    isRj45: /rj45|rj\s*45|سوکت شبکه/i.test(hay),
    isDcJack: /جک\s*dc|dc\s*jack|فیش\s*برق|سری\s*نری|سری\s*مادگی/i.test(hay),
    isWaterproof: /ضدآب|ضد آب|waterproof/i.test(hay),
  };
}

/* ==========================================================================
 * ۶) امتیازدهی قطعی محصولات (Deterministic scoring)
 * ========================================================================== */

function priceOf(p) {
  return Number(p?.price) || 0;
}

function stockOf(p) {
  return effectiveStock(p);
}

/**
 * امتیاز دوربین — هرچه بیشتر با نیاز فنی جور باشد، امتیاز بالاتر.
 * هیچ تصادفی وجود ندارد؛ برای امتیاز برابر، قیمت کمتر برنده است.
 */
function scoreCamera(p, params) {
  const a = analyzeCameraProduct(p);
  let score = 0;

  // تکنولوژی — سخت‌گیرانه
  if (a.tech === params.tech) score += 100;
  else if (a.tech == null) score += 10; // ناشناخته: ضعیف ولی رد نمی‌کنیم
  else return -1e6; // ناسازگار — حذف قطعی

  // رزولوشن — باید ≥ درخواستی باشد
  if (a.resolution) {
    const reqIdx = RESOLUTION_ORDER.indexOf(params.resolution);
    const gotIdx = RESOLUTION_ORDER.indexOf(a.resolution);
    if (gotIdx < 0) score += 5;
    else if (gotIdx === reqIdx) score += 80;
    else if (gotIdx > reqIdx) score += 50; // بالاتر قابل قبول
    else return -1e6; // پایین‌تر از نیاز
  } else {
    score += 5;
  }

  // محیط
  if (params.environment === 'outdoor') {
    if (a.isOutdoor || a.form === 'bullet') score += 60;
    else if (a.form === 'dome' && !a.isOutdoor) score += 5;
    else score += 20;
  } else if (params.environment === 'indoor') {
    if (a.form === 'dome' || a.isIndoor) score += 60;
    else if (a.isOutdoor) score += 25; // بیرونی داخل هم کار می‌کند
    else score += 20;
  } else {
    // mixed
    if (a.isOutdoor || a.form === 'bullet') score += 55;
    else score += 30;
  }

  // نایت‌ویژن
  if (params.nightVision === 'warm_light') {
    if (a.warmLight) score += 60;
    else if (a.ir) score += 5;
    else score += 15;
  } else {
    if (a.ir || (!a.warmLight && a.ir !== true)) score += 40;
    if (a.ir) score += 20;
    if (a.warmLight) score += 5; // اضافه‌ارزش
  }

  // موجودی
  const stock = stockOf(p);
  if (stock >= params.camerasCount) score += 50;
  else if (stock > 0) score += 10;
  else return -1e6;

  return score;
}

function scoreRecorder(p, params, recorderCalc) {
  const a = analyzeRecorderProduct(p);
  let score = 0;

  const needNvr = params.tech === 'ip';
  if (needNvr) {
    if (a.type === 'nvr') score += 100;
    else if (a.type === 'xvr' || a.type === 'dvr') return -1e6;
    else score += 5;
  } else {
    if (a.type === 'dvr' || a.type === 'xvr') score += 100;
    else if (a.type === 'nvr') return -1e6;
    else score += 5;
  }

  if (a.channels != null) {
    if (a.channels >= recorderCalc.channelsNeeded) {
      score += 70;
      // نزدیک‌ترین ظرفیت بهتر از اسراف است
      const waste = a.channels - recorderCalc.channelsNeeded;
      if (waste === 0) score += 30;
      else if (waste <= 4) score += 20;
      else if (waste <= 8) score += 10;
    } else {
      return -1e6;
    }
  } else {
    score += 10;
  }

  if (a.maxRes) {
    const reqIdx = RESOLUTION_ORDER.indexOf(params.resolution);
    const gotIdx = RESOLUTION_ORDER.indexOf(a.maxRes);
    if (gotIdx < 0 || gotIdx >= reqIdx) score += 50;
    else return -1e6;
  } else {
    score += 10;
  }

  if (needNvr && a.hasPoe) score += 15;

  if (a.hddBays != null) {
    if (a.hddBays >= (recorderCalc.hddBays || 1)) score += 20;
    else score -= 15;
  }

  const stock = stockOf(p);
  if (stock > 0) score += 50;
  else return -1e6;

  return score;
}

function scoreHdd(p, storageCalc) {
  const a = analyzeHddProduct(p);
  let score = 0;

  if (a.isSurveillance) score += 80;
  else score += 5;

  const target = storageCalc.hddPlan.drives[0].capacityGb;
  if (a.capacityGb == null) {
    score += 5;
    return score;
  }
  if (a.capacityGb === target) score += 100;
  else if (a.capacityGb > target) score += 40 - Math.min(30, (a.capacityGb - target) / 500);
  else score += 10; // کوچک‌تر — فقط اگر چاره نباشد

  const stock = stockOf(p);
  if (stock > 0) score += 40;
  else return -1e6;

  return score;
}

function scorePower(p, params, powerCalc) {
  const a = analyzePowerProduct(p);
  let score = 0;

  if (params.tech === 'ip') {
    if (a.isPoeSwitch) score += 100;
    else if (a.isNetworkSwitch) score += 40;
    else if (a.isAdapter || a.isIndustrial) score += 5;
    else score += 5;

    if (a.ports != null) {
      if (a.ports >= powerCalc.switchPorts) score += 60;
      else return -1e6;
    } else score += 10;
  } else {
    if (powerCalc.useIndividualAdapters) {
      if (a.isAdapter) score += 80;
      else if (a.isIndustrial) score += 20;
    } else {
      if (a.isIndustrial) score += 80;
      else if (a.isAdapter) score += 30;
    }
    if (a.amperage != null) {
      if (a.amperage >= powerCalc.supplyAmps) score += 60;
      else if (a.amperage >= powerCalc.supplyAmps * 0.7) score += 20;
      else score -= 40;
    }
  }

  const stock = stockOf(p);
  if (stock > 0) score += 40;
  else return -1e6;

  return score;
}

function scoreCable(p, params) {
  const a = analyzeCableProduct(p);
  let score = 0;

  if (params.tech === 'ip') {
    if (a.kind === 'cat6') score += 100;
    else if (a.kind === 'rg59') return -1e6;
    else score += 5;
  } else {
    if (a.kind === 'rg59') score += 100;
    else if (a.kind === 'cat6') return -1e6;
    else score += 5;
  }

  // فروش متری / باکسی — هر دو قابل قبول؛ متری دقیق‌تر است
  if (a.isMeter && !a.isBox) score += 30;
  else if (a.isBox) score += 20;

  const stock = stockOf(p);
  if (stock > 0) score += 30;
  else return -1e6;

  return score;
}

function scoreConnector(p, params, kind) {
  const a = analyzeConnectorProduct(p);
  let score = 0;

  if (kind === 'bnc') {
    if (a.isBnc) score += 100;
    else return -1e6;
  } else if (kind === 'rj45') {
    if (a.isRj45) score += 100;
    else return -1e6;
  } else if (kind === 'dc') {
    if (a.isDcJack) score += 100;
    else return -1e6;
  } else if (kind === 'waterproof') {
    if (a.isWaterproof && (a.isBnc || a.isRj45)) score += 100;
    else if (a.isWaterproof) score += 40;
    else return -1e6;
  }

  if (params.environment === 'outdoor' || params.environment === 'mixed') {
    if (a.isWaterproof) score += 20;
  }

  const stock = stockOf(p);
  if (stock > 0) score += 30;
  else return -1e6;

  return score;
}

/**
 * انتخاب قطعی: بیشترین امتیاز → کمترین قیمت → شناسه محصول (برای پایداری).
 * @returns {{product: object, score: number, runnersUp: object[]}}
 */
function pickBest(scored, needQty = 1) {
  const viable = scored
    .filter((s) => s.score > -1e5)
    .filter((s) => stockOf(s.product) >= needQty)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const pa = priceOf(a.product);
      const pb = priceOf(b.product);
      if (pa !== pb) return pa - pb;
      return String(a.product._id) < String(b.product._id) ? -1 : 1;
    });

  if (!viable.length) return null;
  return {
    product: viable[0].product,
    score: viable[0].score,
    runnersUp: viable.slice(1, 3),
  };
}

/* ==========================================================================
 * ۷) بارگذاری محصولات از MongoDB
 * ========================================================================== */

const ROLE_CATEGORY_PATTERNS = Object.freeze({
  camera: ['دوربین'],
  recorder: ['ضبط', 'dvr', 'nvr', 'xvr', 'رکوردر'],
  hdd: ['هارد', 'ذخیره'],
  power: ['آداپتور', 'تغذیه', 'پاور', 'منبع'],
  cable: ['کابل', 'اتصالات', 'فیش'],
  switch: ['سوئیچ'],
  connector: ['فیش', 'اتصالات', 'سوکت'],
});

async function resolveCategoryIds(patterns) {
  const all = await Category.find({ isActive: true }).select('_id name').lean();
  const pats = patterns.map((x) => normalizeFa(x)).filter((x) => x.length >= 2);
  return all
    .filter((c) => {
      const nm = normalizeFa(c.name || '');
      return pats.some((pat) => nm.includes(pat));
    })
    .map((c) => c._id);
}

const PRODUCT_SELECT =
  'name slug price compareAtPrice discount stock variants productCode sku description category brand properties specifications images isActive';

async function loadPool(categoryIds, extraQuery = {}) {
  const query = { isActive: true, ...extraQuery };
  if (Array.isArray(categoryIds) && categoryIds.length > 0) {
    query.category = { $in: categoryIds };
  }
  return Product.find(query).select(PRODUCT_SELECT).populate('category', 'name').populate('brand', 'name').lean();
}

/**
 * اگر دسته‌بندی مچ نشد، با عبارت‌های نقش جست‌وجوی متنی قطعی می‌زنیم.
 */
async function loadPoolByPhrases(phrases) {
  if (!phrases.length) return [];
  const or = phrases.map((k) => ({
    $or: [
      { name: { $regex: escapeRegexSafe(k), $options: 'i' } },
      { description: { $regex: escapeRegexSafe(k), $options: 'i' } },
    ],
  }));
  return Product.find({ isActive: true, $or: or })
    .select(PRODUCT_SELECT)
    .populate('category', 'name')
    .populate('brand', 'name')
    .lean();
}

function escapeRegexSafe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ==========================================================================
 * ۸) توابع کمکی بسته / قیمت
 * ========================================================================== */

function lineItem(role, title, product, qty, extras = {}) {
  const unitPrice = priceOf(product);
  return {
    role,
    title,
    qty,
    productId: product._id,
    product: {
      _id: product._id,
      name: product.name,
      slug: product.slug,
      price: unitPrice,
      productCode: product.productCode || product.sku || null,
      stock: stockOf(product),
      category: product.category?.name || null,
      brand: product.brand?.name || null,
    },
    unitPrice,
    lineTotal: unitPrice * qty,
    ...extras,
  };
}

function missingItem(role, title, reason) {
  return { role, title, reason };
}

/* ==========================================================================
 * ۹) تابع اصلی اسمبل
 * ========================================================================== */

/**
 * اسمبل قطعی پکیج دوربین مداربسته از MongoDB
 *
 * @param {object} params
 *   environment: 'indoor'|'outdoor'|'mixed'     (default: outdoor)
 *   camerasCount: Number                        (default: 4, min: 1)
 *   tech: 'ahd'|'ip'                            (default: ahd)
 *   resolution: '2mp'|'4mp'|'5mp'|'8mp'         (default: 5mp)
 *   nightVision: 'warm_light'|'ir'              (default: ir)
 *   retentionDays: Number                       (default: 20)
 *   cableMetersPerCam: Number                   (default: 20)
 *
 * @returns {Promise<object>} پکیج قطعی + محاسبات + هشدارها
 */
async function assembleCCTVPackage(params = {}) {
  const plan = computeRequirements(params);
  if (!plan.ok) {
    return {
      ok: false,
      errors: plan.errors,
      items: [],
      totalPrice: 0,
      calculations: null,
    };
  }

  const { params: p, calculations: calc } = plan;
  const items = [];
  const missing = [];
  const warnings = [];

  // --- دسته‌ها ---
  const [camCatIds, recCatIds, hddCatIds, powerCatIds, cableCatIds] = await Promise.all([
    resolveCategoryIds(ROLE_CATEGORY_PATTERNS.camera),
    resolveCategoryIds(ROLE_CATEGORY_PATTERNS.recorder),
    resolveCategoryIds(ROLE_CATEGORY_PATTERNS.hdd),
    resolveCategoryIds(ROLE_CATEGORY_PATTERNS.power),
    resolveCategoryIds(ROLE_CATEGORY_PATTERNS.cable),
  ]);

  // --- دوربین ---
  const camPool = camCatIds.length
    ? await loadPool(camCatIds)
    : await loadPoolByPhrases(['دوربین مداربسته', 'دوربین', 'دام', 'بولت', 'cctv']);

  const camScored = camPool.map((prod) => ({ product: prod, score: scoreCamera(prod, p) }));
  const camPick = pickBest(camScored, p.camerasCount);
  if (camPick) {
    items.push(
      lineItem('camera', 'دوربین مداربسته', camPick.product, p.camerasCount, {
        why: `سازگار با ${p.tech === 'ip' ? 'تحت شبکه' : 'آنالوگ'} · ${p.resolution.toUpperCase()} · ${p.environment === 'indoor' ? 'داخلی' : p.environment === 'outdoor' ? 'بیرونی' : 'ترکیبی'}`,
        form: calc.camera.form,
      }),
    );
  } else {
    missing.push(
      missingItem(
        'camera',
        'دوربین مداربسته',
        `دوربین ${p.tech === 'ip' ? 'IP' : 'AHD'} با رزولوشن ≥ ${p.resolution.toUpperCase()} و موجودی ≥ ${p.camerasCount} در دیتابیس یافت نشد.`,
      ),
    );
  }

  // --- رکوردر ---
  const recPool = recCatIds.length
    ? await loadPool(recCatIds)
    : await loadPoolByPhrases(['dvr', 'nvr', 'xvr', 'دستگاه ضبط', 'رکوردر']);

  const recScored = recPool.map((prod) => ({
    product: prod,
    score: scoreRecorder(prod, p, calc.recorder),
  }));
  const recPick = pickBest(recScored, 1);
  if (recPick) {
    items.push(
      lineItem('recorder', p.tech === 'ip' ? 'NVR (دستگاه ضبط شبکه)' : 'DVR/XVR (دستگاه ضبط)', recPick.product, 1, {
        why: `کانال ≥ ${calc.recorder.channelsNeeded} · پشتیبانی ≥ ${p.resolution.toUpperCase()}`,
      }),
    );
  } else {
    missing.push(
      missingItem(
        'recorder',
        p.tech === 'ip' ? 'NVR' : 'DVR/XVR',
        `دستگاه ضبط ${p.tech === 'ip' ? 'شبکه NVR' : 'آنالوگ DVR/XVR'} با ${calc.recorder.channelsNeeded} کانال و رزولوشن ≥ ${p.resolution.toUpperCase()} یافت نشد.`,
      ),
    );
  }

  // --- هارد ---
  const hddPool = hddCatIds.length
    ? await loadPool(hddCatIds)
    : await loadPoolByPhrases(['هارد', 'هارددیسک', 'purple', 'skyhawk', 'بنفش']);

  const hddScored = hddPool.map((prod) => ({ product: prod, score: scoreHdd(prod, calc.storage) }));
  const hddNeed = calc.storage.hddPlan.drives[0].qty;
  const hddPick = pickBest(hddScored, hddNeed);
  if (hddPick) {
    items.push(
      lineItem('hdd', 'هارددیسک نظارتی', hddPick.product, hddNeed, {
        why: `نیاز ضبط ${calc.storage.retentionDays} روز ≈ ${calc.storage.requiredTb}TB`,
      }),
    );
  } else {
    missing.push(
      missingItem(
        'hdd',
        'هارددیسک نظارتی',
        `هارد نظارتی با ظرفیت ≥ ${calc.storage.hddPlan.drives[0].capacityGb}GB یافت نشد.`,
      ),
    );
  }

  // --- برق ---
  let powerPool = powerCatIds.length
    ? await loadPool(powerCatIds)
    : await loadPoolByPhrases(['منبع تغذیه', 'آداپتور', 'پاور', 'پاور صنعتی']);

  // برای IP اگر در دسته برق سوئیچ پیدا نشد، دسته سوئیچ را هم امتحان می‌کنیم
  if (p.tech === 'ip') {
    const swCatIds = await resolveCategoryIds(ROLE_CATEGORY_PATTERNS.switch);
    if (swCatIds.length) {
      const swPool = await loadPool(swCatIds);
      powerPool = [...powerPool, ...swPool];
    }
  }

  // حذف محصولات تکراری
  const seen = new Set();
  powerPool = powerPool.filter((x) => {
    const id = String(x._id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const powScored = powerPool.map((prod) => ({ product: prod, score: scorePower(prod, p, calc.power) }));
  const powPick = pickBest(powScored, 1);
  if (powPick) {
    const powerQty = p.tech === 'ip' ? 1 : calc.power.useIndividualAdapters ? p.camerasCount : 1;
    items.push(
      lineItem('power', p.tech === 'ip' ? 'سوئیچ PoE / منبع شبکه' : 'منبع تغذیه', powPick.product, powerQty, {
        why: calc.power.recommendedSupply,
      }),
    );
  } else {
    missing.push(missingItem('power', 'منبع تغذیه', `تجهیز برق مناسب (${calc.power.recommendedSupply}) در دیتابیس یافت نشد.`));
  }

  // --- کابل ---
  const cablePool = cableCatIds.length
    ? await loadPool(cableCatIds)
    : await loadPoolByPhrases(['کابل', 'RG59', 'cat6', 'شبکه']);

  const cableScored = cablePool.map((prod) => ({ product: prod, score: scoreCable(prod, p) }));
  const cablePick = pickBest(cableScored, 1);
  if (cablePick) {
    const ca = analyzeCableProduct(cablePick.product);
    let qty;
    if (ca.boxMeters && ca.boxMeters >= 50) {
      qty = ceilInt(calc.cable.totalMeters / ca.boxMeters);
    } else {
      qty = calc.cable.totalMeters;
    }
    items.push(
      lineItem('cable', p.tech === 'ip' ? 'کابل شبکه Cat6' : 'کابل ترکیبی RG59', cablePick.product, qty, {
        why: `${calc.cable.totalMeters} متر (با ۱۰٪ هدر)`,
      }),
    );
  } else {
    missing.push(missingItem('cable', 'کابل', `کابل ${p.tech === 'ip' ? 'Cat6' : 'RG59'} در دیتابیس یافت نشد.`));
  }

  // --- اتصالات ---
  const connCatIds = await resolveCategoryIds(ROLE_CATEGORY_PATTERNS.connector);
  const connPool = connCatIds.length
    ? await loadPool(connCatIds)
    : await loadPoolByPhrases(['BNC', 'فیش', 'RJ45', 'سوکت']);

  const connectors = calc.connectors;

  if (p.tech === 'ahd' && connectors.bnc > 0) {
    const bncScored = connPool.map((prod) => ({ product: prod, score: scoreConnector(prod, p, 'bnc') }));
    const bncPick = pickBest(bncScored, 1);
    if (bncPick) {
      items.push(lineItem('connector_bnc', 'فیش BNC', bncPick.product, connectors.bnc, { why: connectors.details[0] }));
    } else {
      missing.push(missingItem('connector_bnc', 'فیش BNC', `به ${connectors.bnc} عدد فیش BNC نیاز است و در دیتابیس موجود نیست.`));
    }

    const dcScored = connPool.map((prod) => ({ product: prod, score: scoreConnector(prod, p, 'dc') }));
    const dcPick = pickBest(dcScored, 1);
    if (dcPick) {
      items.push(lineItem('connector_dc', 'جک / فیش برق DC', dcPick.product, connectors.dcJacks, { why: `تعداد: ${connectors.dcJacks}` }));
    }
    // اگر DC پیدا نشد، فقط هشدار می‌دهیم (اغلب روی پاور صنعتی ترمینال است)
    else {
      warnings.push(`جک DC (${connectors.dcJacks} عدد) جداگانه یافت نشد؛ در صورت استفاده از پاور صنعتی، ترمینال کافی است.`);
    }
  }

  if (p.tech === 'ip' && connectors.rj45 > 0) {
    const rjScored = connPool.map((prod) => ({ product: prod, score: scoreConnector(prod, p, 'rj45') }));
    const rjPick = pickBest(rjScored, 1);
    if (rjPick) {
      items.push(lineItem('connector_rj45', 'سوکت RJ45', rjPick.product, connectors.rj45, { why: connectors.details[0] }));
    } else {
      missing.push(missingItem('connector_rj45', 'سوکت RJ45', `به ${connectors.rj45} عدد سوکت RJ45 نیاز است.`));
    }
  }

  // --- هشدارهای قطعی ---
  if (calc.power.longRun) {
    warnings.push(
      `متراژ کابل هر دوربین (${p.cableMetersPerCam}m) بیشتر از ${MAX_SHARED_POWER_RUN_M}m است؛ افت ولتاژ را در نظر بگیرید (${calc.power.recommendedSupply}).`,
    );
  }
  if (p.tech === 'ip') {
    warnings.push('برای دوربین‌های IP، سوئیچ PoE یا NVR با PoE لازم است؛ در صورت عدم وجود PoE روی NVR، سوئیچ جداگانه الزامی است.');
  }
  if (p.nightVision === 'warm_light') {
    warnings.push('دوربین وارم‌لایت (دید در شب رنگی) مصرف برق بالاتری دارد؛ ظرفیت پاور با ضریب ۱٫۲۵ محاسبه شده است.');
  }

  const totalPrice = items.reduce((s, it) => s + (it.lineTotal || 0), 0);

  return {
    ok: missing.length === 0,
    params: p,
    calculations: calc,
    items,
    totalPrice,
    missing,
    warnings,
    meta: {
      engine: 'cctvAssemblyEngine',
      version: '1.0.0',
      deterministic: true,
      llmUsed: false,
      generatedAt: new Date().toISOString(),
    },
  };
}

/* ==========================================================================
 * ۱۰) خروجی ماژول
 * ========================================================================== */

module.exports = {
  // تابع اصلی
  assembleCCTVPackage,

  // توابع خالص (برای تست و استفاده مجدد)
  normalizeParams,
  computeRequirements,
  calcStorage,
  calcCable,
  calcPower,
  calcConnectors,
  calcRecorder,

  // تحلیل/امتیاز محصول
  productHaystack,
  analyzeCameraProduct,
  analyzeRecorderProduct,
  analyzeHddProduct,
  analyzePowerProduct,
  analyzeCableProduct,
  analyzeConnectorProduct,
  scoreCamera,
  scoreRecorder,
  scoreHdd,
  scorePower,
  scoreCable,
  pickBest,

  // ثابت‌ها (برای تست)
  BITRATE_MBPS,
  STORAGE_OVERHEAD,
  CABLE_WASTE_RATIO,
  POWER_HEADROOM,
  AMPS_PER_CAM,
  WATTS_PER_CAM,
  HDD_SIZES_GB,
  RECORDER_CHANNELS,
  POWER_SUPPLY_AMPS,
  SWITCH_PORTS,
  DEFAULTS,
};
