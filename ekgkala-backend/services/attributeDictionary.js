/**
 * ============================================================
 * Curated Attribute Dictionary & Stable Key Resolver
 * (services/attributeDictionary.js)
 * ============================================================
 * مرجع واحد کلیدهای پایدار ASCII، برچسب‌های استاندارد و دوگانه‌ی (فنی + محاوره‌ای)،
 * واحدها، نوع داده‌ها (`enum | number | boolean | multi | text`) و مقادیر مجاز.
 *
 * منابع ترکیب‌شده:
 *  ۱) گروه‌های مترادف، واحدها و کلیدهای غیرفیلتر `specNormalization.js`
 *  ۲) واژگان دامنه تجهیزات امنیتی و اتوماسیون دکاشاپ (`filter-attributes-catalog.json`)
 *     با حذف ضداگوهای شلوغی سایدبار (مثل `pa_model` با ۳۲۳۳ مقدار)
 * ============================================================
 */

const { normCompareKey, normalizeDigits, normalizeBucketValue } = require('./specNormalization')

const TEMPLATE_GROUPS = Object.freeze({
  quick: { key: 'quick', title: 'فیلترهای اصلی', order: 1, openByDefault: true },
  image: { key: 'image', title: 'تصویر و دید در شب', order: 2, openByDefault: true },
  body: { key: 'body', title: 'بدنه، نصب و حفاظت', order: 3, openByDefault: true },
  network: { key: 'network', title: 'شبکه، ارتباط و ذخیره‌سازی', order: 4, openByDefault: false },
  audio: { key: 'audio', title: 'صدا و مکالمه', order: 5, openByDefault: false },
  smart: { key: 'smart', title: 'قابلیت‌های هوشمند', order: 6, openByDefault: false },
  display: { key: 'display', title: 'صفحه‌نمایش و کاربری', order: 7, openByDefault: true },
  mechanics: { key: 'mechanics', title: 'مشخصات مکانیکی و تردد', order: 8, openByDefault: true },
  access: { key: 'access', title: 'شناسایی و ظرفیت تردد', order: 9, openByDefault: true },
  power: { key: 'power', title: 'برق و تغذیه', order: 10, openByDefault: false },
  general: { key: 'general', title: 'مشخصات عمومی و گارانتی', order: 11, openByDefault: false },
  physical: { key: 'physical', title: 'ابعاد و شرایط محیطی', order: 20, openByDefault: false },
})

const ATTRIBUTE_DEFINITIONS = [
  // ==================== فیلترهای لنگر (Pinned Anchors) ====================
  {
    key: 'product_type',
    label: 'نوع کاربری',
    aliases: ['نوع محصول', 'نوع دستگاه', 'رده‌ی محصول', 'مدل کاربری', 'product-type', 'pa_product-type'],
    type: 'enum',
    scope: 'product',
    group: 'quick',
    importance: 'pin',
    filterable: true,
    sourceCatalogSlug: 'product-type',
    values: [
      { key: 'dome_camera', label: 'دوربین مداربسته دام', aliases: ['دوربین دام', 'دام'] },
      { key: 'bullet_camera', label: 'دوربین مداربسته بولت', aliases: ['دوربین بولت', 'بولت'] },
      { key: 'turret_camera', label: 'دوربین مداربسته تورت', aliases: ['تورت', 'چشم تخم مرغی'] },
      { key: 'ptz_camera', label: 'دوربین مداربسته اسپید دام', aliases: ['اسپید دام', 'اسپیددام', 'PTZ'] },
      { key: 'cube_camera', label: 'دوربین مداربسته کیوب', aliases: ['دوربین مکعبی', 'کیوب'] },
      { key: 'fisheye_camera', label: 'دوربین مداربسته چشم‌ماهی', aliases: ['فیش آی', 'Fisheye'] },
      { key: 'nvr_recorder', label: 'دستگاه ضبط NVR', aliases: ['NVR', 'ضبط شبکه'] },
      { key: 'dvr_recorder', label: 'دستگاه ضبط DVR / XVR', aliases: ['DVR', 'XVR'] },
      { key: 'video_door_phone', label: 'آیفون تصویری', aliases: ['مانیتور آیفون تصویری', 'video-door-phone'] },
      { key: 'ip_video_door_phone', label: 'آیفون تصویری تحت شبکه', aliases: ['ip-vdp'] },
      { key: 'door_phone_panel', label: 'پنل آیفون تصویری', aliases: ['پنل دم دری', 'panel-vdp'] },
      { key: 'audio_door_phone', label: 'آیفون صوتی', aliases: ['گوشی صوتی'] },
      { key: 'alarm_panel', label: 'پنل مرکزی دزدگیر اماکن', aliases: ['دستگاه دزدگیر اماکن', 'پکیج دزدگیر اماکن'] },
      { key: 'motion_sensor', label: 'چشمی دزدگیر (سنسور حرکتی)', aliases: ['چشمی دزدگیر با سیم', 'چشمی دزدگیر بی سیم', 'سنسور حرکتی'] },
      { key: 'siren', label: 'آژیر و بلندگو دزدگیر', aliases: ['بلندگو دزدگیر', 'فلاشر دزدگیر'] },
      { key: 'swing_gate_opener', label: 'جک درب پارکینگی', aliases: ['جک پارکینگی', 'جک بازویی'] },
      { key: 'sliding_gate_opener', label: 'موتور درب ریلی', aliases: ['جک ریلی'] },
      { key: 'barrier_gate', label: 'راهبند پارکینگی', aliases: ['راهبند اتوماتیک'] },
      { key: 'rolling_shutter_motor', label: 'موتور کرکره برقی', aliases: ['موتور توبلار', 'موتور ساید'] },
      { key: 'electric_lock', label: 'قفل برقی', aliases: ['قفل حیاطی', 'مقابل برقی'] },
      { key: 'digital_door_lock', label: 'قفل دیجیتال و هوشمند', aliases: ['دستگیره دیجیتال'] },
      { key: 'door_closer', label: 'آرام‌بند درب', aliases: ['آرام بند'] },
      { key: 'access_controller', label: 'اکسس کنترل و حضور و غیاب', aliases: ['اکسس کنترل', 'دستگاه حضور و غیاب', 'access'] },
      { key: 'remote_control', label: 'ریموت کنترل', aliases: ['ریموت'] },
      { key: 'power_supply', label: 'منبع تغذیه و آداپتور', aliases: ['آداپتور', 'سوییچینگ'] },
      { key: 'ups_battery', label: 'برق اضطراری و باتری (UPS)', aliases: ['باتری دزدگیر', 'یو پی اس'] },
    ],
  },
  {
    key: 'brand',
    label: 'برند سازنده',
    aliases: ['برند', 'سازنده', 'تولیدکننده', 'مارک', 'manufacturer-brand', 'pa_manufacturer-brand'],
    type: 'enum',
    scope: 'product',
    group: 'quick',
    importance: 'pin',
    filterable: true,
    sourceCatalogSlug: 'manufacturer-brand',
    values: [],
  },

  // ==================== دوربین مداربسته و دستگاه ضبط ====================
  {
    key: 'resolution_mp',
    label: 'رزولوشن تصویر',
    aliases: ['رزولوشن', 'کیفیت تصویر', 'دقت تصویر', 'مگاپیکسل', 'وضوح تصویر', 'resolution', 'pa_resolution'],
    type: 'number',
    scope: 'product',
    group: 'image',
    importance: 'high',
    unit: { canonical: 'MP', label: 'مگاپیکسل', aliases: ['mp', 'megapixel', 'مگاپیکسل'] },
    numeric: { discrete: true, min: 0.5, max: 64 },
    filterable: true,
    sourceCatalogSlug: 'resolution',
    values: [
      { key: '1', label: '1 مگاپیکسل (HD 720p)', aliases: ['1 مگاپیکسل', '1MP', '720p', 'HD', 'HD (720p)'] },
      { key: '2', label: '2 مگاپیکسل (Full HD)', aliases: ['2 مگاپیکسل', '2MP', '1080p', 'Full HD', 'Full HD (1080p)', '2-مگاپیکسل'] },
      { key: '3', label: '3 مگاپیکسل', aliases: ['3MP', '3-مگاپیکسل'] },
      { key: '4', label: '4 مگاپیکسل (2K)', aliases: ['4 مگاپیکسل', '4MP', '2K', '1440p', '4-مگاپیکسل'] },
      { key: '5', label: '5 مگاپیکسل (3K)', aliases: ['5 مگاپیکسل', '5MP', '3K', '5-مگاپیکسل'] },
      { key: '6', label: '6 مگاپیکسل', aliases: ['6MP', '6-مگاپیکسل'] },
      { key: '8', label: '8 مگاپیکسل (4K)', aliases: ['8 مگاپیکسل', '8MP', '4K', 'UHD', '2160p', '8-مگاپیکسل'] },
      { key: '12', label: '12 مگاپیکسل', aliases: ['12MP', '12-مگاپیکسل'] },
    ],
  },
  {
    key: 'camera_tech',
    label: 'تکنولوژی دوربین',
    aliases: ['تکنولوژی تصویر برداری', 'تکنولوژی تصویربرداری', 'فناوری دوربین', 'نوع سیگنال', 'تکنولوژی ساخت', 'imaging-technology'],
    type: 'enum',
    scope: 'product',
    group: 'image',
    importance: 'high',
    filterable: true,
    sourceCatalogSlug: 'imaging-technology',
    values: [
      { key: 'ip', label: 'تحت شبکه (IP)', aliases: ['تحت شبکه IP', 'شبکه (IP)', 'IP', 'Network'] },
      { key: 'hdcvi', label: 'آنالوگ HD (HDCVI)', aliases: ['HDCVI', 'CVI'] },
      { key: 'hdtvi', label: 'آنالوگ HD (HDTVI)', aliases: ['HDTVI', 'TVI', 'Turbo HD'] },
      { key: 'ahd', label: 'آنالوگ HD (AHD)', aliases: ['AHD'] },
      { key: 'analog', label: 'آنالوگ (CVBS)', aliases: ['آنالوگ', 'CVBS'] },
    ],
  },
  {
    key: 'form',
    label: 'فرم بدنه دوربین',
    aliases: ['نوع دوربین مداربسته', 'فرم دوربین', 'نوع بدنه', 'شکل ظاهری', 'ساختار بدنه', 'type-cctv'],
    type: 'enum',
    scope: 'product',
    group: 'body',
    importance: 'high',
    filterable: true,
    sourceCatalogSlug: 'type-cctv',
    values: [
      { key: 'dome', label: 'دام (سقفی / Dome)', aliases: ['دام', 'Dome', 'سقفی'] },
      { key: 'bullet', label: 'بولت (دیواری / Bullet)', aliases: ['بولت', 'Bullet', 'لوله‌ای'] },
      { key: 'turret', label: 'تورت (چشم‌تخم‌مرغی / Turret)', aliases: ['تورت', 'Turret', 'Eyeball'] },
      { key: 'speed_dome', label: 'اسپید دام (گردان / PTZ)', aliases: ['اسپید دام', 'PTZ', 'Speed Dome'] },
      { key: 'cube', label: 'کیوب (مکعبی / Cube)', aliases: ['کیوب', 'Cube', 'مکعبی'] },
      { key: 'fisheye', label: 'فیش‌آی (چشم‌ماهی / 360)', aliases: ['فیش آی', 'Fisheye', 'چشم ماهی'] },
      { key: 'pinhole', label: 'پین‌هول (مخفی / Pinhole)', aliases: ['پین هول', 'Pinhole'] },
    ],
  },
  {
    key: 'lens_type',
    label: 'نوع لنز',
    aliases: ['لنز', 'ساختار لنز'],
    type: 'enum',
    scope: 'product',
    group: 'image',
    importance: 'normal',
    filterable: true,
    values: [
      { key: 'fixed', label: 'ثابت (Fixed)', aliases: ['ثابت', 'Fixed'] },
      { key: 'varifocal', label: 'وریفوکال دستی (Varifocal)', aliases: ['وریفوکال', 'Varifocal', 'متغیر دستی'] },
      { key: 'motorized', label: 'موتورایز (Motorized Zoom)', aliases: ['موتورایز', 'Motorized'] },
    ],
  },
  {
    key: 'lens_mm',
    label: 'فاصله کانونی لنز',
    aliases: ['فاصله کانونی', 'سایز لنز'],
    type: 'enum',
    scope: 'product',
    group: 'image',
    importance: 'normal',
    unit: { canonical: 'mm', label: 'میلی‌متر', aliases: ['mm', 'میلی‌متر', 'میلیمتر'] },
    filterable: true,
    values: [
      { key: '2.8', label: '2.8 میلی‌متر (واید)', aliases: ['2.8 میلی‌متر', '2.8mm'] },
      { key: '3.6', label: '3.6 میلی‌متر', aliases: ['3.6 میلی‌متر', '3.6mm'] },
      { key: '4', label: '4 میلی‌متر', aliases: ['4 میلی‌متر', '4mm'] },
      { key: '6', label: '6 میلی‌متر', aliases: ['6 میلی‌متر', '6mm'] },
      { key: '2.8-12', label: '2.8 تا 12 میلی‌متر (وریفوکال)', aliases: ['2.8-12mm', '2.8 تا 12 میلی‌متر'] },
    ],
  },
  {
    key: 'ir_range_m',
    label: 'برد دید در شب',
    aliases: ['دید در شب', 'برد مادون قرمز', 'فاصله دید در شب', 'شعاع دید در شب', 'برد IR', 'night-vision'],
    type: 'number',
    scope: 'product',
    group: 'image',
    importance: 'high',
    unit: { canonical: 'm', label: 'متر', aliases: ['m', 'meter', 'متر'] },
    numeric: { discrete: false, min: 5, max: 500 },
    filterable: true,
    sourceCatalogSlug: 'night-vision',
    values: [],
  },
  {
    key: 'color_night',
    label: 'نوع دید در شب',
    aliases: ['دید در شب رنگی', 'فناوری دید در شب', 'نورپردازی شب', 'illumination-type'],
    type: 'enum',
    scope: 'product',
    group: 'image',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'illumination-type',
    values: [
      { key: 'ir', label: 'مادون قرمز سیاه‌وسفید (IR)', aliases: ['سیاه و سفید', 'IR', 'مادون قرمز'] },
      { key: 'starlight', label: 'سیاه و سفید حساس به نور (Starlight)', aliases: ['سیاه و سفید (Starlight)', 'Starlight', 'استارلایت'] },
      { key: 'warmlight', label: 'رنگی ۲۴ ساعته (Warmlight / Full Color)', aliases: ['رنگی (Warmlight)', 'Warmlight', 'Full Color', 'ColorVu', 'دید در شب رنگی', 'دارد'] },
      { key: 'dual_light', label: 'دوگانه هوشمند (Smart Dual Light)', aliases: ['Smart Dual Light', 'دوگانه هوشمند'] },
    ],
  },
  {
    key: 'optical_zoom',
    label: 'بزرگنمایی اپتیکال',
    aliases: ['زوم اپتیکال', 'قابلیت زوم و بزرگنمایی', 'بزرگنمایی نوری', 'zoom-ability'],
    type: 'number',
    scope: 'product',
    group: 'image',
    importance: 'high',
    unit: { canonical: 'x', label: 'برابر', aliases: ['x', 'برابر'] },
    numeric: { discrete: true, min: 2, max: 60 },
    filterable: true,
    sourceCatalogSlug: 'zoom-ability',
    values: [
      { key: '4x', label: '4 برابر (4X)', aliases: ['4X', '4 برابر'] },
      { key: '15x', label: '15 برابر (15X)', aliases: ['15X', '15 برابر'] },
      { key: '25x', label: '25 برابر (25X)', aliases: ['25X', '25 برابر'] },
      { key: '32x', label: '32 برابر (32X)', aliases: ['32X', '32 برابر'] },
    ],
  },
  {
    key: 'ip_rating',
    label: 'استاندارد حفاظتی',
    aliases: ['درجه حفاظت', 'کلاس حفاظت', 'استاندارد ضد آب', 'گواهی IP', 'قابلیت ضد آب', 'protection-class', 'water-resistant'],
    type: 'enum',
    scope: 'product',
    group: 'body',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'protection-class',
    values: [
      { key: 'ip67', label: 'IP67 (ضد آب و گردوغبار کامل)', aliases: ['IP67'] },
      { key: 'ip66', label: 'IP66 (مقاوم در برابر باران شدید)', aliases: ['IP66'] },
      { key: 'ip65', label: 'IP65 (مقاوم در برابر پاشش آب)', aliases: ['IP65'] },
      { key: 'ik10', label: 'IK10 (ضد ضربه / Vandal Proof)', aliases: ['IK10'] },
      { key: 'indoor', label: 'داخلی (بدون گواهی ضد آب)', aliases: ['داخلی', 'Indoor', 'ندارد'] },
    ],
  },
  {
    key: 'poe',
    label: 'پشتیبانی از PoE',
    aliases: ['قابلیت PoE', 'قابلیت POE', 'تغذیه روی شبکه', 'PoE', 'pa_poe'],
    type: 'boolean',
    scope: 'product',
    group: 'power',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'poe',
    values: [
      { key: '1', label: 'دارد', aliases: ['بله', 'true', 'yes'] },
      { key: '0', label: 'ندارد', aliases: ['خیر', 'false', 'no'] },
    ],
  },
  {
    key: 'mic',
    label: 'میکروفون داخلی',
    aliases: ['میکروفون', 'میکروفن ضبط صدا', 'ضبط صدا', 'ورودی صدا', 'microphone'],
    type: 'boolean',
    scope: 'product',
    group: 'audio',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'microphone',
    values: [
      { key: '1', label: 'دارد', aliases: ['بله', 'true', 'yes'] },
      { key: '0', label: 'ندارد', aliases: ['خیر', 'false', 'no'] },
    ],
  },
  {
    key: 'two_way_audio',
    label: 'مکالمه دوطرفه',
    aliases: ['ارتباط دو طرفه صدا', 'صدای دوطرفه', 'اسپیکر و میکروفون', 'two-way-talk'],
    type: 'boolean',
    scope: 'product',
    group: 'audio',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'two-way-talk',
    values: [
      { key: '1', label: 'دارد', aliases: ['بله', 'true', 'yes'] },
      { key: '0', label: 'ندارد', aliases: ['خیر', 'false', 'no'] },
    ],
  },
  {
    key: 'sd_slot',
    label: 'پشتیبانی از کارت حافظه',
    aliases: ['شیار کارت حافظه', 'اسلات کارت حافظه', 'کارت حافظه', 'درگاه MicroSD', 'وضعیت حافظه', 'memory-card'],
    type: 'boolean',
    scope: 'product',
    group: 'network',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'memory-card',
    values: [
      { key: '1', label: 'دارد', aliases: ['بله', 'true', 'yes', 'پشتیبانی از کارت حافظه'] },
      { key: '0', label: 'ندارد', aliases: ['خیر', 'false', 'no'] },
    ],
  },
  {
    key: 'codec',
    label: 'فشرده‌سازی تصویر',
    aliases: ['کدک تصویر', 'فرمت فشرده‌سازی', 'فشرده سازی ویدیو'],
    type: 'enum',
    scope: 'product',
    group: 'network',
    importance: 'normal',
    filterable: true,
    values: [
      { key: 'h265_plus', label: 'H.265+', aliases: ['H265+', 'H.265 Plus', 'Smart H.265+'] },
      { key: 'h265', label: 'H.265 (HEVC)', aliases: ['H.265', 'H265', 'HEVC'] },
      { key: 'h264_plus', label: 'H.264+', aliases: ['H264+', 'H.264 Plus'] },
      { key: 'h264', label: 'H.264', aliases: ['H264'] },
    ],
  },
  {
    key: 'wdr',
    label: 'فناوری WDR',
    aliases: ['قابلیت WDR', 'محدوده دینامیکی تصویر', 'ضد نور'],
    type: 'enum',
    scope: 'product',
    group: 'image',
    importance: 'normal',
    filterable: true,
    values: [
      { key: 'true_wdr_120db', label: 'True WDR (120dB)', aliases: ['120dB', 'WDR 120dB', 'True WDR'] },
      { key: 'wdr_140db', label: 'True WDR (140dB)', aliases: ['140dB', 'WDR 140dB'] },
      { key: 'dwdr', label: 'دیجیتال (DWDR)', aliases: ['DWDR', 'Digital WDR'] },
      { key: 'none', label: 'ندارد', aliases: ['فاقد WDR'] },
    ],
  },
  {
    key: 'channels',
    label: 'تعداد کانال',
    aliases: ['کانال ورودی', 'ظرفیت کانال', 'تعداد کانال تصویر', 'number-of-channels'],
    type: 'number',
    scope: 'product',
    group: 'network',
    importance: 'high',
    unit: { canonical: 'ch', label: 'کانال', aliases: ['ch', 'channel', 'کانال'] },
    numeric: { discrete: true, min: 1, max: 256 },
    filterable: true,
    sourceCatalogSlug: 'number-of-channels',
    values: [
      { key: '4', label: '4 کانال', aliases: ['4ch', '۴ کانال'] },
      { key: '8', label: '8 کانال', aliases: ['8ch', '۸ کانال'] },
      { key: '16', label: '16 کانال', aliases: ['16ch', '۱۶ کانال'] },
      { key: '32', label: '32 کانال', aliases: ['32ch', '۳۲ کانال'] },
      { key: '64', label: '64 کانال', aliases: ['64ch', '۶۴ کانال'] },
    ],
  },
  {
    key: 'hdd_bays',
    label: 'تعداد درگاه هارد',
    aliases: ['تعداد هارد دیسک قابل اتصال', 'ظرفیت نصب هارد', 'تعداد SATA', 'number-hard'],
    type: 'number',
    scope: 'product',
    group: 'network',
    importance: 'normal',
    unit: { canonical: 'hdd', label: 'عدد', aliases: ['عدد', 'هارد'] },
    numeric: { discrete: true, min: 1, max: 24 },
    filterable: true,
    sourceCatalogSlug: 'number-hard',
    values: [
      { key: '1', label: '1 هارد', aliases: ['1 عدد'] },
      { key: '2', label: '2 هارد', aliases: ['2 عدد'] },
      { key: '4', label: '4 هارد', aliases: ['4 عدد'] },
      { key: '8', label: '8 هارد', aliases: ['8 عدد'] },
    ],
  },
  {
    key: 'smart_features',
    label: 'قابلیت‌های هوش مصنوعی',
    aliases: ['هوش مصنوعی', 'قابلیت‌های هوشمند', 'تحلیل هوشمند تصویر', 'ai', 'capabilities'],
    type: 'multi',
    scope: 'product',
    group: 'smart',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'ai',
    values: [
      { key: 'human_detect', label: 'تشخیص انسان (Human Detection)', aliases: ['تشخیص انسان'] },
      { key: 'vehicle_detect', label: 'تشخیص خودرو (Vehicle Detection)', aliases: ['تشخیص خودرو'] },
      { key: 'face_detect', label: 'تشخیص چهره (Face Detection)', aliases: ['تشخیص چهره'] },
      { key: 'line_crossing', label: 'عبور از خط فرضی (Line Crossing)', aliases: ['عبور از خط'] },
      { key: 'anpr', label: 'پلاک‌خوان (ANPR / LPR)', aliases: ['پلاک خوان', 'ANPR', 'LPR'] },
      { key: 'smd_plus', label: 'فیلتر هوشمند حرکت (SMD Plus / AcuSense)', aliases: ['SMD Plus', 'AcuSense'] },
      { key: 'none', label: 'ندارد', aliases: ['فاقد هوش مصنوعی'] },
    ],
  },

  // ==================== آیفون تصویری و ارتباط داخلی ====================
  {
    key: 'screen_inch',
    label: 'اندازه صفحه نمایش',
    aliases: ['صفحه نمایش', 'سایز مانیتور', 'سایز صفحه نمایش', 'ابعاد نمایشگر', 'screen'],
    type: 'number',
    scope: 'product',
    group: 'display',
    importance: 'high',
    unit: { canonical: 'inch', label: 'اینچ', aliases: ['inch', '"', 'اینچ'] },
    numeric: { discrete: true, min: 2, max: 15 },
    filterable: true,
    sourceCatalogSlug: 'screen',
    values: [
      { key: '4.3', label: '4.3 اینچ', aliases: ['4.3 اینچ', '4-3-inch', '۴.۳ اینچ'] },
      { key: '7', label: '7 اینچ', aliases: ['7 اینچ', '7-inch', '۷ اینچ'] },
      { key: '10', label: '10 اینچ', aliases: ['10 اینچ', '10-inch', '۱۰ اینچ'] },
    ],
  },
  {
    key: 'keypad_type',
    label: 'نوع صفحه‌کلید',
    aliases: ['نوع صفحه کلید', 'نوع دکمه‌ها', 'صفحه کلید', 'keyboard-type'],
    type: 'enum',
    scope: 'product',
    group: 'display',
    importance: 'high',
    filterable: true,
    sourceCatalogSlug: 'keyboard-type',
    values: [
      { key: 'touch', label: 'لمسی (Touch Keys)', aliases: ['لمسی', 'کلید لمسی'] },
      { key: 'touch_screen', label: 'تمام لمسی (Touch Screen)', aliases: ['تمام لمسی', 'صفحه لمسی'] },
      { key: 'mechanical', label: 'دکمه‌ای (مکانیکی)', aliases: ['دکمه‌ای', 'مکانیکی', 'شستی'] },
    ],
  },
  {
    key: 'vdp_memory',
    label: 'حافظه داخلی',
    aliases: ['حافظه آیفون تصویری', 'ضبط عکس و فیلم'],
    type: 'enum',
    scope: 'product',
    group: 'display',
    importance: 'high',
    filterable: true,
    values: [
      { key: 'with_memory', label: 'حافظه‌دار (ضبط عکس و فیلم)', aliases: ['حافظه دار', 'حافظه‌دار', 'دارد'] },
      { key: 'without_memory', label: 'بدون حافظه', aliases: ['ندارد', 'فاقد حافظه'] },
    ],
  },
  {
    key: 'intercom',
    label: 'ارتباط داخلی',
    aliases: ['اینترکام', 'مکالمه داخلی بین واحدها', 'intercom'],
    type: 'boolean',
    scope: 'product',
    group: 'display',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'intercom',
    values: [
      { key: '1', label: 'دارد', aliases: ['بله', 'true', 'yes'] },
      { key: '0', label: 'ندارد', aliases: ['خیر', 'false', 'no'] },
    ],
  },
  {
    key: 'second_panel',
    label: 'قابلیت اتصال به دو پنل',
    aliases: ['اتصال به پنل دوم', 'ورودی پنل دوم', 'دو درب', 'second-panel-connect'],
    type: 'boolean',
    scope: 'product',
    group: 'display',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'second-panel-connect',
    values: [
      { key: '1', label: 'دارد', aliases: ['بله', 'true', 'yes'] },
      { key: '0', label: 'ندارد', aliases: ['خیر', 'false', 'no'] },
    ],
  },
  {
    key: 'parking_opener',
    label: 'قابلیت باز کردن درب پارکینگ',
    aliases: ['باز کردن درب پارکینگ', 'فرمان جک پارکینگ', 'open-the-parking-door'],
    type: 'boolean',
    scope: 'product',
    group: 'display',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'open-the-parking-door',
    values: [
      { key: '1', label: 'دارد', aliases: ['بله', 'true', 'yes'] },
      { key: '0', label: 'ندارد', aliases: ['خیر', 'false', 'no'] },
    ],
  },
  {
    key: 'elevator_recall',
    label: 'فراخوان آسانسور',
    aliases: ['احضار آسانسور', 'elevator-recall'],
    type: 'boolean',
    scope: 'product',
    group: 'display',
    importance: 'low',
    filterable: true,
    sourceCatalogSlug: 'elevator-recall',
    values: [
      { key: '1', label: 'دارد', aliases: ['بله', 'true', 'yes'] },
      { key: '0', label: 'ندارد', aliases: ['خیر', 'false', 'no'] },
    ],
  },
  {
    key: 'unit_capacity',
    label: 'تعداد واحد پشتیبانی',
    aliases: ['انتخاب تعداد واحد', 'حداکثر اتصال واحد تا', 'تعداد واحد', 'تعداد زنگ پنل', 'unit-capacity', 'vahed'],
    type: 'number',
    scope: 'product',
    group: 'display',
    importance: 'high',
    unit: { canonical: 'unit', label: 'واحد', aliases: ['واحد', 'واحدی'] },
    numeric: { discrete: true, min: 1, max: 500 },
    filterable: true,
    sourceCatalogSlug: 'unit-capacity',
    values: [],
  },
  {
    key: 'wiring_type',
    label: 'نوع سیم‌کشی',
    aliases: ['سیم کشی', 'تعداد رشته سیم', 'wiring', 'number-of-wire'],
    type: 'enum',
    scope: 'product',
    group: 'network',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'wiring',
    values: [
      { key: '4_wire', label: '۴ سیمه استاندارد', aliases: ['4 سیم', '۴ سیمه', 'چهار سیم'] },
      { key: '2_wire_digital', label: '۲ سیم دیجیتال (کدینگ)', aliases: ['2 سیم', 'دو سیم'] },
      { key: '7_wire_coding', label: '۷ سیم کدینگ', aliases: ['7 سیم', 'کدینگ'] },
      { key: 'cat5_ip', label: 'کابل شبکه (تحت شبکه IP)', aliases: ['کابل شبکه', 'Cat5', 'Cat6'] },
    ],
  },

  // ==================== دزدگیر اماکن و ریموت ====================
  {
    key: 'zones',
    label: 'تعداد زون',
    aliases: ['تعداد زون (چشمی)', 'زون باسیم', 'ظرفیت زون', 'zones'],
    type: 'number',
    scope: 'product',
    group: 'mechanics',
    importance: 'high',
    unit: { canonical: 'zone', label: 'زون', aliases: ['زون', 'zone'] },
    numeric: { discrete: true, min: 1, max: 128 },
    filterable: true,
    sourceCatalogSlug: 'zones',
    values: [
      { key: '4', label: '4 زون', aliases: ['۴ زون'] },
      { key: '5', label: '5 زون', aliases: ['۵ زون'] },
      { key: '8', label: '8 زون', aliases: ['۸ زون'] },
    ],
  },
  {
    key: 'dialer_type',
    label: 'نوع تلفن‌کننده',
    aliases: ['نوع تلفن کننده دزدگیر', 'تلفن کننده', 'ارتباط تلفنی', 'type-alarm-system'],
    type: 'enum',
    scope: 'product',
    group: 'network',
    importance: 'high',
    filterable: true,
    sourceCatalogSlug: 'type-alarm-system',
    values: [
      { key: 'sim_pstn', label: 'سیم‌کارتی و خط ثابت (دوگانه)', aliases: ['سیم کارتی و خط ثابت', 'دوگانه'] },
      { key: 'sim', label: 'سیم‌کارتی (GSM)', aliases: ['سیم کارتی', 'سیم‌کارتی', 'GSM'] },
      { key: 'pstn', label: 'خط شهری (ثابت)', aliases: ['خط ثابت', 'تلفن ثابت'] },
      { key: 'wifi_sim', label: 'تحت شبکه و سیم‌کارتی', aliases: ['وای فای و سیم کارت'] },
    ],
  },
  {
    key: 'frequency_mhz',
    label: 'فرکانس کاری',
    aliases: ['فرکانس', 'فرکانس ریموت', 'frequency'],
    type: 'enum',
    scope: 'product',
    group: 'network',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'frequency',
    values: [
      { key: '433', label: '433 مگاهرتز (433MHz)', aliases: ['433MHz', '433 مگاهرتز'] },
      { key: '315', label: '315 مگاهرتز (315MHz)', aliases: ['315MHz', '315 مگاهرتز'] },
      { key: '868', label: '868 مگاهرتز (868MHz)', aliases: ['868MHz', '868 مگاهرتز'] },
    ],
  },
  {
    key: 'code_type',
    label: 'نوع کدینگ',
    aliases: ['نوع کد', 'کدینگ ریموت', 'code-type'],
    type: 'enum',
    scope: 'product',
    group: 'access',
    importance: 'high',
    filterable: true,
    sourceCatalogSlug: 'code-type',
    values: [
      { key: 'learning', label: 'لرنینگ (کد ثابت / Learning)', aliases: ['لرنینگ', 'کد ثابت', 'learn', 'Learning'] },
      { key: 'hopping', label: 'هاپینگ کد (Hopping / Rolling)', aliases: ['هاپینگ', 'کد متغیر', 'رولینگ کد', 'hop', 'Hopping'] },
      { key: 'dip_switch', label: 'دیپ سوییچ (DIP Switch)', aliases: ['دیپ سوییچ', 'DIP'] },
      { key: 'em_125khz', label: 'کارت و تگ EM (125kHz)', aliases: ['کد EM125HZ', 'em125hz', 'RO'] },
      { key: 'mifare_13_56mhz', label: 'کارت و تگ Mifare (13.56MHz)', aliases: ['کد Mifare 13.5 MHZ', 'mifare-13-5', 'Mifare'] },
      { key: 'bluetooth', label: 'بلوتوثی (Bluetooth)', aliases: ['بلوتوثی', 'blue'] },
    ],
  },

  // ==================== جک پارکینگی، راهبند و کرکره ====================
  {
    key: 'leaf_width_m',
    label: 'حداکثر عرض هر لنگه',
    aliases: ['عرض لنگه درب', 'حداکثر عرض درب', 'طول هر لنگه', 'width-of-jack'],
    type: 'number',
    scope: 'product',
    group: 'mechanics',
    importance: 'high',
    unit: { canonical: 'm', label: 'متر', aliases: ['m', 'meter', 'متر'] },
    numeric: { discrete: false, min: 1, max: 12 },
    filterable: true,
    sourceCatalogSlug: 'width-of-jack',
    values: [],
  },
  {
    key: 'leaf_weight_kg',
    label: 'حداکثر وزن هر لنگه',
    aliases: ['قدرت هر لنگه', 'وزن قابل تحمل هر لنگه', 'قدرت جک', 'power-of-each-jack'],
    type: 'number',
    scope: 'product',
    group: 'mechanics',
    importance: 'high',
    unit: { canonical: 'kg', label: 'کیلوگرم', aliases: ['kg', 'کیلوگرم', 'کیلو'] },
    numeric: { discrete: false, min: 50, max: 3000 },
    filterable: true,
    sourceCatalogSlug: 'power-of-each-jack',
    values: [],
  },
  {
    key: 'jack_mechanism',
    label: 'نوع عملکرد جک',
    aliases: ['نوع جک', 'مکانیزم کارکرد', 'سیستم محرکه', 'type-of-jack', 'action'],
    type: 'enum',
    scope: 'product',
    group: 'mechanics',
    importance: 'high',
    filterable: true,
    sourceCatalogSlug: 'type-of-jack',
    values: [
      { key: 'electromechanical', label: 'الکترومکانیکی', aliases: ['الکترومکانیک', 'electromechanic'] },
      { key: 'hydraulic', label: 'هیدرولیکی', aliases: ['هیدرولیک', 'hydraulic'] },
      { key: 'articulated', label: 'بازویی مفصلی', aliases: ['مفصلی'] },
      { key: 'sliding_rail', label: 'ریلی (کشویی)', aliases: ['ریلی'] },
    ],
  },
  {
    key: 'motor_voltage',
    label: 'ولتاژ موتور',
    aliases: ['ولتاژ جک یا موتور', 'ولتاژ کاری جک', 'jack-or-motor-voltage'],
    type: 'enum',
    scope: 'product',
    group: 'power',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'jack-or-motor-voltage',
    values: [
      { key: '220v', label: '220 ولت متناوب (AC)', aliases: ['220 ولت', '220V'] },
      { key: '24v', label: '24 ولت مستقیم (DC / تردد بالا)', aliases: ['24 ولت', '24V'] },
      { key: '12v', label: '12 ولت مستقیم (DC)', aliases: ['12 ولت', '12V'] },
    ],
  },
  {
    key: 'traffic_duty',
    label: 'میزان تردد مجاز',
    aliases: ['سیکل تردد', 'تردد روزانه', 'کاربری جک', 'traffic-capacity', 'use-of-jack'],
    type: 'enum',
    scope: 'product',
    group: 'mechanics',
    importance: 'high',
    filterable: true,
    sourceCatalogSlug: 'traffic-capacity',
    values: [
      { key: 'low', label: 'تردد کم (شخصی / ویلایی)', aliases: ['تردد کم', 'مسکونی کم‌واحد'] },
      { key: 'medium', label: 'تردد متوسط (مجتمع مسکونی)', aliases: ['تردد متوسط', 'مسکونی'] },
      { key: 'high', label: 'تردد بالا (مجتمع پرواحد / اداری)', aliases: ['تردد بالا', 'پرتردد'] },
      { key: 'unlimited', label: 'تردد نامحدود (صنعتی)', aliases: ['نامحدود', 'صنعتی'] },
    ],
  },
  {
    key: 'boom_length_m',
    label: 'طول بوم راهبند',
    aliases: ['حداکثر عرض بازشو (طول بوم)', 'طول بوم', 'عرض گذرگاه', 'opening-width'],
    type: 'number',
    scope: 'product',
    group: 'mechanics',
    importance: 'high',
    unit: { canonical: 'm', label: 'متر', aliases: ['m', 'متر'] },
    numeric: { discrete: false, min: 2, max: 12 },
    filterable: true,
    sourceCatalogSlug: 'opening-width',
    values: [],
  },

  // ==================== قفل برقی، آرام‌بند و کنترل تردد ====================
  {
    key: 'lock_type',
    label: 'نوع قفل برقی',
    aliases: ['مدل قفل برقی', 'ساختار قفل', 'نوع قفل و یراق', 'type-electric-lock', 'type-lock'],
    type: 'enum',
    scope: 'product',
    group: 'mechanics',
    importance: 'high',
    filterable: true,
    sourceCatalogSlug: 'type-electric-lock',
    values: [
      { key: 'kale_gavi', label: 'قفل کله‌گاوی (حیاطی)', aliases: ['کله گاوی', 'کله‌گاوی'] },
      { key: 'rim_lock', label: 'قفل لاک‌پشتی (پارکینگی / نفررو)', aliases: ['لاک پشتی', 'لاک‌پشتی', 'باکس‌دار'] },
      { key: 'electric_strike', label: 'مقابل برقی (زبانه‌دار)', aliases: ['مقابل برقی'] },
      { key: 'maglock', label: 'قفل مگنتی (الکترومغناطیسی)', aliases: ['مگنتی', 'مگنت'] },
      { key: 'bolt_lock', label: 'قفل بولت (سولنوئیدی)', aliases: ['بولت', 'سولنوئیدی'] },
      { key: 'digital_handle', label: 'قفل دیجیتال دستگیره‌دار', aliases: ['دستگیره دیجیتال'] },
    ],
  },
  {
    key: 'identification_type',
    label: 'روش شناسایی',
    aliases: ['نوع شناسایی', 'نحوه احراز هویت', 'دسترسی با', 'identification-type'],
    type: 'multi',
    scope: 'product',
    group: 'access',
    importance: 'high',
    filterable: true,
    sourceCatalogSlug: 'identification-type',
    values: [
      { key: 'fingerprint', label: 'اثر انگشت (Fingerprint)', aliases: ['اثر انگشت', 'fingerprint'] },
      { key: 'face', label: 'تشخیص چهره (Face ID)', aliases: ['تشخیص چهره', 'چهره'] },
      { key: 'card', label: 'کارت و تگ (RFID)', aliases: ['کارت', 'تگ', 'کارتخوان'] },
      { key: 'pin', label: 'رمز عبور (PIN)', aliases: ['رمز', 'رمز عبور', 'کد'] },
      { key: 'mobile_app', label: 'اپلیکیشن موبایل / بلوتوث', aliases: ['اپلیکیشن', 'موبایل', 'بلوتوث'] },
      { key: 'mechanical_key', label: 'کلید مکانیکی', aliases: ['کلید کامپیوتری', 'کلید ساده'] },
    ],
  },
  {
    key: 'user_capacity',
    label: 'ظرفیت کاربران',
    aliases: ['ظرفیت تعریف کاربر', 'تعداد کاربر', 'حافظه کاربر', 'user'],
    type: 'number',
    scope: 'product',
    group: 'access',
    importance: 'normal',
    unit: { canonical: 'user', label: 'نفر', aliases: ['نفر', 'کاربر'] },
    numeric: { discrete: false, min: 10, max: 200000 },
    filterable: true,
    sourceCatalogSlug: 'user',
    values: [],
  },
  {
    key: 'log_capacity',
    label: 'ظرفیت ثبت تردد',
    aliases: ['حافظه تردد', 'تعداد لاگ تردد', 'registration-capacity'],
    type: 'number',
    scope: 'product',
    group: 'access',
    importance: 'normal',
    unit: { canonical: 'record', label: 'رکورد', aliases: ['رکورد', 'تردد'] },
    numeric: { discrete: false, min: 100, max: 1000000 },
    filterable: true,
    sourceCatalogSlug: 'registration-capacity',
    values: [],
  },
  {
    key: 'door_weight_kg',
    label: 'مناسب وزن درب',
    aliases: ['حداکثر وزن درب', 'وزن درب قابل تحمل', 'door-weight'],
    type: 'number',
    scope: 'product',
    group: 'mechanics',
    importance: 'high',
    unit: { canonical: 'kg', label: 'کیلوگرم', aliases: ['kg', 'کیلوگرم'] },
    numeric: { discrete: false, min: 15, max: 300 },
    filterable: true,
    sourceCatalogSlug: 'door-weight',
    values: [],
  },

  // ==================== برق، ارتباطات، بدنه و مشخصات عمومی ====================
  {
    key: 'power',
    label: 'منبع تغذیه',
    aliases: ['ولتاژ تغذیه', 'ولتاژ ورودی', 'برق ورودی', 'تغذیه', 'power-supply-voltage'],
    type: 'enum',
    scope: 'product',
    group: 'power',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'power-supply-voltage',
    values: [
      { key: '12v', label: '12 ولت مستقیم (12V DC)', aliases: ['12 ولت', '12V', '12V DC'] },
      { key: '24v', label: '24 ولت مستقیم (24V DC)', aliases: ['24 ولت', '24V', '24V DC'] },
      { key: '220v', label: 'برق شهری 220 ولت (AC)', aliases: ['220 ولت', '220V', 'برق شهری'] },
      { key: 'poe', label: 'تغذیه روی شبکه (PoE)', aliases: ['PoE', '12V / PoE'] },
      { key: 'battery', label: 'باتری داخلی / قلمی', aliases: ['باتری', 'شارژی'] },
      { key: 'solar', label: 'پنل خورشیدی (Solar)', aliases: ['خورشیدی', 'سولار'] },
    ],
  },
  {
    key: 'power_watts',
    label: 'توان مصرفی',
    aliases: ['حداکثر توان مصرفی', 'مصرف برق', 'power-cons'],
    type: 'number',
    scope: 'product',
    group: 'power',
    importance: 'low',
    unit: { canonical: 'W', label: 'وات', aliases: ['w', 'watt', 'وات'] },
    numeric: { discrete: false, min: 1, max: 5000 },
    filterable: true,
    sourceCatalogSlug: 'power-cons',
    values: [],
  },
  {
    key: 'ups_support',
    label: 'قابلیت برق اضطراری',
    aliases: ['پشتیبانی از باتری پشتیبان', 'برق اضطراری', 'UPS', 'pa_ups'],
    type: 'boolean',
    scope: 'product',
    group: 'power',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'ups',
    values: [
      { key: '1', label: 'دارد', aliases: ['بله', 'true', 'yes'] },
      { key: '0', label: 'ندارد', aliases: ['خیر', 'false', 'no'] },
    ],
  },
  {
    key: 'connectivity',
    label: 'پروتکل و درگاه ارتباطی',
    aliases: ['نوع اتصال', 'پروتکل ارتباطی', 'درگاه های اتصال', 'protocol', 'connection-ports'],
    type: 'multi',
    scope: 'product',
    group: 'network',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'protocol',
    values: [
      { key: 'lan', label: 'شبکه باسیم (LAN / RJ45)', aliases: ['LAN', 'RJ45', 'پورت شبکه'] },
      { key: 'wifi', label: 'بی‌سیم (Wi-Fi)', aliases: ['Wi-Fi', 'WiFi', 'وای فای', 'وایرلس'] },
      { key: 'sim_4g', label: 'سیم‌کارتی (4G / LTE)', aliases: ['4G', 'LTE', 'سیم کارت خور'] },
      { key: 'rs485', label: 'پورت صنعتی RS485', aliases: ['RS485', 'RS-485'] },
      { key: 'wiegand', label: 'ویگند (Wiegand)', aliases: ['Wiegand', 'ویگند'] },
    ],
  },
  {
    key: 'body_material',
    label: 'جنس بدنه',
    aliases: ['متریال بدنه', 'جنس محفظه', 'material'],
    type: 'enum',
    scope: 'product',
    group: 'body',
    importance: 'low',
    filterable: true,
    sourceCatalogSlug: 'material',
    values: [
      { key: 'metal', label: 'فلزی (آلومینیوم / آلیاژ روی)', aliases: ['فلزی', 'فلز', 'آلومینیوم', 'Metal'] },
      { key: 'plastic', label: 'پلاستیک فشرده (ABS)', aliases: ['پلاستیکی', 'پلاستیک', 'ABS', 'Plastic'] },
      { key: 'metal_plastic', label: 'ترکیبی فلز و پلاستیک', aliases: ['فلز و پلاستیک', 'ترکیبی'] },
      { key: 'steel', label: 'استیل ضدزنگ', aliases: ['استیل'] },
    ],
  },
  {
    key: 'installation_type',
    label: 'نوع نصب',
    aliases: ['نحوه نصب', 'محل نصب', 'installation-type'],
    type: 'enum',
    scope: 'product',
    group: 'body',
    importance: 'low',
    filterable: true,
    sourceCatalogSlug: 'installation-type',
    values: [
      { key: 'surface', label: 'روکار', aliases: ['نصب روکار'] },
      { key: 'flush', label: 'توکار', aliases: ['نصب توکار'] },
      { key: 'wall_ceiling', label: 'سقفی / دیواری', aliases: ['دیواری', 'سقفی'] },
    ],
  },
  {
    key: 'color',
    label: 'رنگ',
    aliases: ['رنگ بدنه', 'فام', 'color'],
    type: 'enum',
    scope: 'variant',
    group: 'general',
    importance: 'normal',
    filterable: true,
    sourceCatalogSlug: 'color',
    values: [
      { key: 'white', label: 'سفید', aliases: ['White'] },
      { key: 'black', label: 'مشکی', aliases: ['سیاه', 'Black'] },
      { key: 'silver', label: 'نقره‌ای', aliases: ['Silver'] },
      { key: 'gray', label: 'خاکستری / نوک‌مدادی', aliases: ['نوک مدادی', 'طوسی'] },
      { key: 'gold', label: 'طلایی / شامپاینی', aliases: ['طلایی', 'شامپاینی'] },
    ],
  },
  {
    key: 'warranty_months',
    label: 'مدت گارانتی',
    aliases: ['گارانتی', 'مقدار گارانتی', 'ضمانت', 'warranty'],
    type: 'enum',
    scope: 'variant',
    group: 'general',
    importance: 'low',
    filterable: true,
    sourceCatalogSlug: 'warranty',
    values: [
      { key: '12', label: '12 ماه', aliases: ['12 ماهه', '۱ سال', 'یک ساله'] },
      { key: '18', label: '18 ماه', aliases: ['18 ماهه', '۱۸ ماهه'] },
      { key: '24', label: '24 ماه', aliases: ['24 ماهه', '۲ سال', 'دو ساله', '25 ماهه'] },
      { key: '36', label: '36 ماه', aliases: ['36 ماهه', '۳ سال', 'سه ساله'] },
    ],
  },
  {
    key: 'country_of_origin',
    label: 'کشور سازنده',
    aliases: ['ساخت کشور', 'کشور مبدأ', 'manufacturing-country'],
    type: 'enum',
    scope: 'product',
    group: 'general',
    importance: 'low',
    filterable: true,
    sourceCatalogSlug: 'manufacturing-country',
    values: [
      { key: 'iran', label: 'ایران', aliases: ['ساخت ایران'] },
      { key: 'china', label: 'چین', aliases: ['تحت لیسانس / چین'] },
      { key: 'taiwan', label: 'تایوان', aliases: [] },
      { key: 'korea', label: 'کره جنوبی', aliases: ['کره'] },
      { key: 'italy', label: 'ایتالیا', aliases: [] },
    ],
  },

  // ==================== ویژگی‌های «فقط جدول» (جلوگیری از آلودگی سایدبار) ====================
  // حذف ضداگوی دکاشاپ: pa_model با ۳۲۳۳ ترم هرگز نباید ویجت فیلتر سایدبار شود.
  {
    key: 'model_code',
    label: 'مدل',
    aliases: ['کد مدل', 'شناسه مدل', 'پارت نامبر', 'model', 'pa_model'],
    type: 'text',
    scope: 'product',
    group: 'physical',
    importance: 'hidden',
    filterable: false,
    allowNew: 'none',
    sourceCatalogSlug: 'model',
    values: [],
  },
  {
    key: 'dimensions_mm',
    label: 'ابعاد',
    aliases: ['ابعاد بدنه', 'اندازه فیزیکی', 'ارتفاع بدنه', 'body-height'],
    type: 'text',
    scope: 'product',
    group: 'physical',
    importance: 'hidden',
    filterable: false,
    allowNew: 'none',
    sourceCatalogSlug: 'body-height',
    values: [],
  },
  {
    key: 'weight_g',
    label: 'وزن',
    aliases: ['وزن خالص', 'وزن محصول'],
    type: 'number',
    scope: 'product',
    group: 'physical',
    importance: 'hidden',
    unit: { canonical: 'g', label: 'گرم', aliases: ['g', 'گرم', 'kg', 'کیلوگرم'] },
    filterable: false,
    allowNew: 'none',
    values: [],
  },
  {
    key: 'operating_temp_c',
    label: 'دمای کاری',
    aliases: ['دمای کارکرد', 'بازه دمای کاری', 'operating-temperature'],
    type: 'text',
    scope: 'product',
    group: 'physical',
    importance: 'hidden',
    filterable: false,
    allowNew: 'none',
    sourceCatalogSlug: 'operating-temperature',
    values: [],
  },
  {
    key: 'package_contents',
    label: 'اقلام همراه',
    aliases: ['تجهیزات همراه', 'متعلقات پکیچ', 'محتویات جعبه', 'along-equipment', 'package-accessories'],
    type: 'text',
    scope: 'product',
    group: 'physical',
    importance: 'hidden',
    filterable: false,
    allowNew: 'none',
    sourceCatalogSlug: 'along-equipment',
    values: [],
  },
  {
    key: 'sensor_chip',
    label: 'سنسور تصویر',
    aliases: ['نوع سنسور', 'چیپ تصویر'],
    type: 'text',
    scope: 'product',
    group: 'physical',
    importance: 'hidden',
    filterable: false,
    allowNew: 'none',
    values: [],
  },
  {
    key: 'frame_rate_fps',
    label: 'نرخ فریم',
    aliases: ['سرعت فریم', 'فریم بر ثانیه'],
    type: 'text',
    scope: 'product',
    group: 'physical',
    importance: 'hidden',
    filterable: false,
    allowNew: 'none',
    values: [],
  },
]

// ساخت جداول جست‌وجوی سریع (در زمان بارگذاری ماژول)
const BY_KEY = new Map()
const BY_NORM_LABEL = new Map()
const BY_SLUG = new Map()

for (const def of ATTRIBUTE_DEFINITIONS) {
  BY_KEY.set(def.key, def)
  if (def.sourceCatalogSlug) {
    BY_SLUG.set(def.sourceCatalogSlug.toLowerCase(), def)
    BY_SLUG.set(def.sourceCatalogSlug.toLowerCase().replace(/-/g, '_'), def)
  }
  const allLabels = [def.label, ...(def.aliases || [])]
  for (const lbl of allLabels) {
    const nk = normCompareKey(lbl)
    if (nk && !BY_NORM_LABEL.has(nk)) {
      BY_NORM_LABEL.set(nk, def)
    }
  }
}

/**
 * یافتن تعریف ویژگی از روی کلید ASCII (`resolution_mp`)، اسلاگ کاتالوگ (`night-vision`)
 * یا برچسب فارسی (`رزولوشن تصویر` / `رزولوشن`).
 */
function resolveAttributeDef(keyOrLabel) {
  if (!keyOrLabel || typeof keyOrLabel !== 'string') return null
  const trimmed = keyOrLabel.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const normalizedAscii = lower.replace(/^pa_/, '').replace(/-/g, '_')
  if (BY_KEY.has(lower)) return BY_KEY.get(lower)
  if (BY_KEY.has(normalizedAscii)) return BY_KEY.get(normalizedAscii)
  if (BY_SLUG.has(lower)) return BY_SLUG.get(lower)
  if (BY_SLUG.has(normalizedAscii)) return BY_SLUG.get(normalizedAscii)
  const nk = normCompareKey(trimmed)
  return BY_NORM_LABEL.get(nk) || null
}

/**
 * بسط یک مقدار ورودی از پارامتر `f.<key>` به همه‌ی شکل‌های معادل برای تطبیق
 * هم‌زمان با داده‌ی تایپ‌دار جدید (`facetKeys` / `specs[]`) و داده‌ی قدیمی (`properties[]`).
 */
function expandAttributeQueryValues(attrKeyOrDef, rawValues = []) {
  const def = typeof attrKeyOrDef === 'string' ? resolveAttributeDef(attrKeyOrDef) : attrKeyOrDef
  const canonicalAttr = def ? def.key : String(attrKeyOrDef || '').trim().toLowerCase().replace(/-/g, '_')
  const displayLabel = def ? def.label : String(attrKeyOrDef || '').trim()

  const expandedStrings = new Set()
  const valueKeys = new Set()
  const facetKeys = new Set()

  for (const item of Array.isArray(rawValues) ? rawValues : [rawValues]) {
    if (item === undefined || item === null) continue
    const raw = normalizeDigits(String(item)).trim()
    if (!raw) continue
    expandedStrings.add(raw)
    const lowerRaw = raw.toLowerCase()

    if (def && def.type === 'boolean') {
      const isTrue = ['1', 'true', 'yes', 'دارد', 'بله', 'پشتیبانی می‌شود', 'پشتیبانی میشود'].includes(lowerRaw)
      const isFalse = ['0', 'false', 'no', 'ندارد', 'خیر'].includes(lowerRaw)
      if (isTrue) {
        valueKeys.add('1')
        facetKeys.add(`${canonicalAttr}:1`)
        expandedStrings.add('دارد')
      } else if (isFalse) {
        valueKeys.add('0')
        facetKeys.add(`${canonicalAttr}:0`)
        expandedStrings.add('ندارد')
      }
    }

    if (def && Array.isArray(def.values) && def.values.length) {
      const nkRaw = normCompareKey(raw)
      for (const vDef of def.values) {
        const candidates = [vDef.key, vDef.label, ...(vDef.aliases || [])]
        const matched = candidates.some((c) => c && (String(c).toLowerCase() === lowerRaw || normCompareKey(c) === nkRaw))
        if (matched) {
          valueKeys.add(vDef.key)
          facetKeys.add(`${canonicalAttr}:${vDef.key}`)
          expandedStrings.add(vDef.label)
          for (const alias of vDef.aliases || []) expandedStrings.add(alias)
        }
      }
    }

    if (def && def.unit && /^\d+(?:\.\d+)?$/.test(raw)) {
      if (def.unit.label) expandedStrings.add(`${raw} ${def.unit.label}`)
      if (def.unit.canonical) expandedStrings.add(`${raw}${def.unit.canonical}`)
      valueKeys.add(raw)
      facetKeys.add(`${canonicalAttr}:${raw}`)
    } else {
      valueKeys.add(lowerRaw)
      facetKeys.add(`${canonicalAttr}:${lowerRaw}`)
    }

    const bucket = normalizeBucketValue(displayLabel, raw)
    if (bucket) expandedStrings.add(bucket)
  }

  const labelCandidates = def
    ? [...new Set([def.label, ...(def.aliases || []), def.key])]
    : [displayLabel]

  return {
    attr: canonicalAttr,
    label: displayLabel,
    def,
    labelCandidates,
    expandedValues: [...expandedStrings],
    valueKeys: [...valueKeys],
    facetKeys: [...facetKeys],
  }
}

/**
 * تجزیه‌ی بازه‌ی عددی از پارامتر `r.<key>` (مثل `30-60`، `30..60`، `30:`، `:60` یا ارقام فارسی `۳۰-۶۰`)
 */
function parseNumericRangeParam(rawInput) {
  if (rawInput === undefined || rawInput === null) return null
  if (typeof rawInput === 'object' && !Array.isArray(rawInput)) {
    const min = rawInput.min !== undefined && rawInput.min !== '' ? Number(normalizeDigits(String(rawInput.min))) : undefined
    const max = rawInput.max !== undefined && rawInput.max !== '' ? Number(normalizeDigits(String(rawInput.max))) : undefined
    if (min !== undefined && (!Number.isFinite(min) || min < 0)) return null
    if (max !== undefined && (!Number.isFinite(max) || max < 0)) return null
    if (min === undefined && max === undefined) return null
    if (min !== undefined && max !== undefined && min > max) return { invalidOrder: true, min, max }
    return { min, max }
  }

  const raw = normalizeDigits(String(Array.isArray(rawInput) ? rawInput[0] : rawInput))
    .replace(/[,٬\s]+/g, '')
    .trim()
  if (!raw) return null

  let min
  let max
  const rangeMatch = raw.match(/^(\d+(?:\.\d+)?)?(?:\.\.|-|:|~)(\d+(?:\.\d+)?)?$/)
  if (rangeMatch) {
    if (rangeMatch[1] === undefined && rangeMatch[2] === undefined) return null
    min = rangeMatch[1] !== undefined ? Number(rangeMatch[1]) : undefined
    max = rangeMatch[2] !== undefined ? Number(rangeMatch[2]) : undefined
  } else if (/^\d+(?:\.\d+)?$/.test(raw)) {
    min = Number(raw)
    max = min
  } else {
    return null
  }

  if (min !== undefined && (!Number.isFinite(min) || min < 0)) return null
  if (max !== undefined && (!Number.isFinite(max) || max < 0)) return null
  if (min !== undefined && max !== undefined && min > max) {
    return { invalidOrder: true, min, max }
  }
  return { min, max }
}

module.exports = {
  TEMPLATE_GROUPS,
  ATTRIBUTE_DEFINITIONS,
  resolveAttributeDef,
  expandAttributeQueryValues,
  parseNumericRangeParam,
}
