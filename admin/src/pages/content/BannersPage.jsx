import PageHeader from '../../components/ui/PageHeader'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Card,
  Button,
  Space,
  Select,
  Modal,
  Form,
  Input,
  Tag,
  message,
  Popconfirm,
  Upload,
  Switch,
  InputNumber,
  Row,
  Col,
  Image,
  Empty,
  Tooltip,
  Divider,
  Alert,
  Progress,
  Segmented,
  Badge,
} from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
import {
  InboxOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  PictureOutlined,
  LinkOutlined,
  MobileOutlined,
  DesktopOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ExpandOutlined,
  BookOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'

// فعال‌سازی تقویم جلالی
dayjs.extend(jalaliday)
dayjs.calendar('jalali')

const persianMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

const formatPersianDate = (date, includeTime = false) => {
  if (!date) return '—'
  const jalaliDate = dayjs(date).calendar('jalali').locale('fa')
  const year = jalaliDate.format('YYYY')
  const month = persianMonths[parseInt(jalaliDate.format('M')) - 1]
  const day = jalaliDate.format('DD')

  if (includeTime) {
    return `${day} ${month} ${year} - ${jalaliDate.format('HH:mm')}`
  }
  return `${day} ${month} ${year}`
}

// ============================================================
// مشخصات بنرها — هم‌راستا با مکانیزم واقعی فروشگاه
// ============================================================
// بنر اصلی، دو تصویر مستقل دارد (Art Direction):
//   دسکتاپ: 1911 × 430  → نسبت 4.44:1
//   موبایل: 388  × 180  → در ویوپورت 428px، ارتفاع ثابت 180px
//           فایل پیشنهادی 780 × 360 (2x) — نسبت 2.16:1
//
// مکانیزم موبایل (عیناً مانند دیجی‌کالا):
//   اسلاید فعال وسط‌چین با عرض ۱.۱ اسلاید؛ ۲۰px از هر طرف بیرون می‌ماند
//   و ۲۰px از اسلایدهای کنار «پیک» می‌زند. فاصلهٔ ۸px، گوشهٔ ۸px،
//   ارتفاع ۱۸۰px، چرخش خودکار هر ۵ ثانیه (انیمیشن ۵۰۰ms)، لوپ بی‌نهایت،
//   swipe؛ بدون فلش و نقطه در موبایل.
// ============================================================

const HERO_MOBILE = {
  viewport: 428,
  slideWidth: 388,
  height: 180,
  sideInset: 20,
  gap: 8,
  radius: 8,
  intervalSeconds: 5,
  transitionMs: 500,
  recommendedUpload: '780 × 360',
  ratioLabel: '2.16 : 1',
}

const buildSpec = (width, height, label, recommendedLabel) => ({
  width,
  height,
  label,
  sizeLabel: `${width} × ${height}`,
  ratioLabel: `${(width / height).toFixed(2)} : 1`,
  padding: `${((height / width) * 100).toFixed(2)}%`,
  recommendedLabel: recommendedLabel || `${width} × ${height}`,
})

const BANNER_POSITIONS = {
  'main-slider': {
    label: 'اسلایدر اصلی',
    icon: '🖼️',
    description:
      'بنر تمام‌عرض بالای صفحه اصلی — موبایل با اسلاید ۳۸۸×۱۸۰، پیک اسلایدهای کنار و چرخش ۵ ثانیه‌ای؛ دسکتاپ ۱۹۱۱×۴۳۰',
    responsive: true,
    desktop: buildSpec(1911, 430, 'دسکتاپ'),
    mobile: buildSpec(388, 180, 'موبایل', HERO_MOBILE.recommendedUpload),
    size: '1911×430 دسکتاپ • 388×180 موبایل (فایل 780×360)',
    aspectRatio: '4.44:1 دسکتاپ | 2.16:1 موبایل',
    minSize: 'دسکتاپ ۱۲۰۰×۲۷۰ • موبایل ۳۸۸×۱۸۰',
    previewAspect: '1911 / 430',
    color: 'blue',
    tips: [
      'برای موبایل همیشه تصویر جدا بسازید؛ نسخهٔ دسکتاپ در موبایل برش می‌خورد.',
      'اسلاید موبایل ۳۸۸×۱۸۰ است (فایل ۷۸۰×۳۶۰)؛ گوشه‌ها ۸px و ۲۰px از هر طرف حاشیه دارد.',
      '۲۰px از اسلایدهای قبلی/بعدی در دو لبه دیده می‌شود؛ پیام اصلی را در ۸۰٪ مرکزی نگه دارید.',
      'اسلایدر هر ۵ ثانیه با انیمیشن ۵۰۰ms عوض می‌شود؛ هر اسلاید فقط یک پیام داشته باشد.',
      'در موبایل فلش و نقطه نمایش داده نمی‌شود؛ ناوبری با swipe و چرخش خودکار است.',
    ],
  },
  'middle-banner': {
    label: 'بنر تبلیغاتی میانی',
    icon: '📢',
    description: 'بنرهای تبلیغاتی زیر بنر اصلی — حداکثر ۳ عدد، چیده‌شده از مرکز',
    responsive: false,
    desktop: buildSpec(1280, 400, 'یک تصویر'),
    mobile: buildSpec(1280, 400, 'یک تصویر'),
    size: '1280×400 پیکسل (۱۶:۵)',
    aspectRatio: '3.20:1',
    minSize: '640×200 پیکسل',
    previewAspect: '16 / 5',
    color: 'orange',
    tips: [
      'یک تصویر برای هر سه حالت (موبایل/تبلت/دسکتاپ) استفاده می‌شود.',
      'متن مهم را در ناحیهٔ امن مرکزی قرار دهید.',
      'حداکثر ۳ بنر نمایش داده می‌شود.',
    ],
  },
  'campaign-banner': {
    label: 'بنر کمپین',
    icon: '🎯',
    description: 'بنر ویژهٔ کمپین و تخفیف‌ها',
    responsive: false,
    desktop: buildSpec(1200, 400, 'یک تصویر'),
    mobile: buildSpec(1200, 400, 'یک تصویر'),
    size: '1200×400 پیکسل',
    aspectRatio: '3.00:1',
    minSize: '600×200 پیکسل',
    previewAspect: '3 / 1',
    color: 'purple',
    tips: [
      'ترکیب‌بندی افقی و ساده بهتر دیده می‌شود.',
      'از قرار دادن متن در گوشه‌ها پرهیز کنید.',
    ],
  },
}

const getPositionConfig = (position) =>
  BANNER_POSITIONS[position] || {
    ...BANNER_POSITIONS['main-slider'],
    label: position || 'بنر',
    responsive: false,
  }

const getSpec = (position, device = 'desktop') => {
  const config = getPositionConfig(position)
  if (!config.responsive) return config.desktop
  return device === 'mobile' ? config.mobile : config.desktop
}

const getTargetWidth = (position, device = 'desktop') => {
  const spec = getSpec(position, device)
  // موبایل با عرض ۲x (Retina) ذخیره می‌شود؛ بنر اصلی ۳۸۸ → ۷۸۰
  return device === 'mobile' ? (position === 'main-slider' ? 780 : spec.width * 2) : spec.width
}

const getMinWidth = (position, device = 'desktop') => {
  if (device === 'mobile') return position === 'main-slider' ? HERO_MOBILE.slideWidth : 360
  if (position === 'middle-banner') return 640
  return 900
}

const MAX_BANNER_UPLOAD_SIZE_MB = 10
const MAX_BANNER_UPLOAD_SIZE_BYTES = MAX_BANNER_UPLOAD_SIZE_MB * 1024 * 1024
const RECOMMENDED_BANNER_UPLOAD_SIZE_MB = 2
const RECOMMENDED_BANNER_UPLOAD_SIZE_BYTES = RECOMMENDED_BANNER_UPLOAD_SIZE_MB * 1024 * 1024

// ============================================================
// دستورالعمل بنر اصلی — نسخهٔ موبایل‌محور (جایگزین نسخهٔ فقط‌دسکتاپ)
// ============================================================

const HERO_MECHANISM_STEPS = [
  {
    title: 'یک اسلاید کامل در وسط',
    desc: `در موبایل، اسلاید فعال ${HERO_MOBILE.slideWidth}px عرض دارد (در صفحهٔ ${HERO_MOBILE.viewport}px) و دقیقاً وسط صفحه می‌نشیند. ${HERO_MOBILE.sideInset}px از هر طرف بیرون می‌ماند.`,
  },
  {
    title: 'پیک‌زدن اسلایدهای کنار',
    desc: `حدود ${HERO_MOBILE.sideInset}px از اسلاید قبلی و بعدی در دو لبه دیده می‌شود. این «پیک» طبیعی و عمدی است و به کاربر می‌فهماند اسلایدر ادامه دارد.`,
  },
  {
    title: 'ارتفاع ثابت و گوشهٔ گرد',
    desc: `ارتفاع همهٔ اسلایدهای موبایل ثابت ${HERO_MOBILE.height}px است؛ فاصلهٔ بین اسلایدها ${HERO_MOBILE.gap}px و گوشه‌ها ${HERO_MOBILE.radius}px گرد است.`,
  },
  {
    title: 'چرخش خودکار ۵ ثانیه‌ای',
    desc: `هر ${HERO_MOBILE.intervalSeconds} ثانیه یک اسلاید جلو می‌رود، انیمیشن ${HERO_MOBILE.transitionMs}ms است، بینهایت لوپ می‌شود و با کشیدن انگشت هم جابه‌جا می‌شود.`,
  },
  {
    title: 'بدون فلش و نقطه در موبایل',
    desc: 'در موبایل فلش و نقطه (dot) نمایش داده نمی‌شود؛ ناوبری فقط با swipe و چرخش خودکار است. فلش و نقطه فقط در دسکتاپ دیده می‌شوند.',
  },
  {
    title: 'تصویر اول، سریع‌ترین',
    desc: 'اولین اسلاید با priority و eager بارگذاری می‌شود تا LCP صفحه سریع باشد؛ بقیهٔ اسلایدها lazy هستند.',
  },
]

const HERO_MOBILE_RULES = [
  'برای موبایل یک تصویر مستقل بسازید؛ نسخهٔ کوچک‌شده یا برش‌خوردهٔ دسکتاپ کافی نیست.',
  'متن، لوگو و CTA را در ۸۰٪ مرکزی تصویر نگه دارید؛ در گوشی‌های ۳۶۰px حدود ۹٪ از هر طرف برش می‌خورد.',
  'حداقل اندازهٔ متن در فایل ۷۸۰×۳۶۰ حدود ۲۸px باشد تا در موبایل خوانا بماند.',
  'یک پیام در هر اسلاید؛ تیتر کوتاه (۳ تا ۶ کلمه) و کنتراست بالا.',
  'پس‌زمینهٔ یکدست یا گرادیان ملایم انتخاب کنید؛ جزئیات ریز پشت متن شلوغی ایجاد می‌کند.',
  'حجم فایل را زیر ۲ مگابایت نگه دارید و در صورت امکان WebP بفرستید.',
  'برای GIF، حجم و تعداد فریم را کنترل کنید؛ GIF سنگین LCP موبایل را خراب می‌کند.',
  'ترتیب اسلایدها را با sortOrder تعیین کنید؛ عدد کمتر = نمایش زودتر.',
]

const HERO_DESKTOP_RULES = [
  'نسخهٔ دسکتاپ ۱۹۱۱×۴۳۰ است و تمام‌عرض نمایش داده می‌شود.',
  'در دسکتاپ فلش‌های قبلی/بعدی و نقطه‌های اسلاید نمایش داده می‌شوند.',
  'متن مهم را در ۸۰٪ مرکزی کادر و دور از گوشه‌ها قرار دهید.',
  'همان پیام و رنگ برند را با نسخهٔ موبایل هماهنگ نگه دارید؛ دو کریتیو مکمل باشند، نه دو کمپین جدا.',
]

const HERO_SPEC_ROWS = [
  { label: 'ابعاد نمایش (موبایل)', mobile: '388 × 180 px', desktop: '1911 × 430 px' },
  { label: 'فایل پیشنهادی', mobile: '780 × 360 px (2x)', desktop: '1911 × 430 px' },
  { label: 'نسبت تصویر', mobile: '2.16 : 1', desktop: '4.44 : 1' },
  { label: 'ارتفاع', mobile: 'ثابت 180 px', desktop: 'بر اساس عرض (نسبت)' },
  { label: 'فاصله از لبه‌ها', mobile: '20 px از هر طرف', desktop: 'تمام‌عرض' },
  { label: 'فاصلهٔ بین اسلایدها', mobile: '8 px', desktop: '0' },
  { label: 'گردی گوشه', mobile: '8 px', desktop: '0' },
  { label: 'حاشیهٔ امن محتوا', mobile: '10٪ از هر طرف', desktop: '8٪ از هر طرف' },
  { label: 'چرخش خودکار', mobile: 'هر 5 ثانیه / انیمیشن 500ms', desktop: 'هر 5 ثانیه / انیمیشن 500ms' },
  { label: 'کنترل‌ها', mobile: 'Swipe — بدون فلش و نقطه', desktop: 'فلش قبلی/بعدی + نقطه' },
  { label: 'حجم مجاز', mobile: 'حداکثر 10MB — پیشنهاد زیر 2MB', desktop: 'حداکثر 10MB — پیشنهاد زیر 2MB' },
  { label: 'فرمت', mobile: 'WebP / JPG / PNG / GIF', desktop: 'WebP / JPG / PNG / GIF' },
]

const HERO_CHECKLIST = [
  'تصویر موبایل جداگانه آپلود شده و با تصویر دسکتاپ فرق دارد.',
  'ابعاد فایل موبایل ۷۸۰×۳۶۰ (یا بزرگ‌تر با همین نسبت) است.',
  'متن و CTA داخل ۸۰٪ مرکزی تصویر قرار دارد.',
  'حجم فایل زیر ۲ مگابایت و فرمت WebP/JPG است.',
  'لینک مقصد درست است و در تب جدید یا همین تب مطابق نیاز باز می‌شود.',
  'متن جایگزین (Alt) فارسی و توصیفی برای هر دو تصویر نوشته شده.',
  'ترتیب اسلایدها (sortOrder) درست است و اولین اسلاید سبک‌ترین تصویر را دارد.',
  'پیش‌نمایش موبایل و دسکتاپ در همین پنل بررسی شده است.',
  'روی یک گوشی واقعی (۳۶۰px و ۴۲۸px) اسلاید را swipe کرده‌اید و متن بریده نمی‌شود.',
]

const HERO_TROUBLESHOOTING = [
  {
    problem: 'متن یا لوگو در موبایل بریده می‌شود',
    cause: 'محتوا در لبه‌های تصویر قرار دارد یا نسبت تصویر با کادر هم‌خوان نیست.',
    fix: 'محتوا را به ۸۰٪ مرکزی منتقل کنید و فایل را با نسبت ۲.۱۶:۱ (۷۸۰×۳۶۰) بسازید.',
  },
  {
    problem: 'تصویر موبایل نمایش داده نمی‌شود',
    cause: 'فیلد «تصویر موبایل» خالی است و فروشگاه از تصویر دسکتاپ با برش استفاده می‌کند.',
    fix: 'در فرم ویرایش، تصویر موبایل را آپلود کنید و پیش‌نمایش دستگاه را روی «موبایل» بگذارید.',
  },
  {
    problem: 'اسلایدر خودکار جابه‌جا نمی‌شود',
    cause: 'فقط یک بنر فعال در موقعیت «اسلایدر اصلی» وجود دارد.',
    fix: 'حداقل دو بنر فعال با ترتیب مشخص بسازید تا لوپ و چرخش فعال شود.',
  },
  {
    problem: 'تصویر کشیده یا خالی است',
    cause: 'فایل خراب است یا فرمت پشتیبانی نمی‌شود.',
    fix: 'فایل را با WebP/JPG سالم دوباره ذخیره و آپلود کنید؛ نسبت ۲.۱۶:۱ را رعایت کنید.',
  },
  {
    problem: 'سرعت بارگذاری صفحه پایین آمده است',
    cause: 'حجم تصاویر اسلایدر زیاد است یا GIF سنگین استفاده شده.',
    fix: 'فایل‌ها را زیر ۲ مگابایت بهینه کنید؛ اولین اسلاید را سبک‌ترین تصویر قرار دهید.',
  },
]

const HERO_UPLOAD_STEPS = [
  'تصویر دسکتاپ را در ابعاد ۱۹۱۱×۴۳۰ بسازید (یا حداقل ۱۲۰۰×۲۷۰).',
  'یک کریتیو مستقل برای موبایل در ابعاد ۷۸۰×۳۶۰ بسازید؛ فقط نسخهٔ دسکتاپ را کوچک نکنید.',
  'در فرم بنر، هر دو تصویر را آپلود کنید (یا آدرس تصویر را وارد کنید).',
  'پیش‌نمایش را روی «موبایل» بگذارید و ناحیهٔ امن، ارتفاع ۱۸۰px و پیک اسلایدهای کنار را بررسی کنید.',
  'متن جایگزین (Alt) فارسی و توصیفی برای هر دو تصویر بنویسید.',
  'ترتیب نمایش را با sortOrder تعیین کنید (عدد کمتر = زودتر).',
  'وضعیت را فعال کنید و ذخیره بزنید.',
  'صفحهٔ اصلی فروشگاه را روی موبایل و دسکتاپ باز کنید و نوبت اسلایدها، لینک و برش تصویر را بررسی کنید.',
]

const formatBytesAsMb = (bytes) => {
  const value = Number(bytes)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round((value / (1024 * 1024)) * 10) / 10
}

const getImageUrl = (image) => {
  if (!image) return ''
  if (typeof image === 'string') return image
  return image.url || ''
}

const getImageMeta = (image) => {
  if (!image || typeof image !== 'object') return null
  if (!image.width || !image.height) return null
  return { width: image.width, height: image.height }
}

const readImageDimensions = (source) =>
  new Promise((resolve) => {
    if (!source) return resolve(null)
    const isFile = typeof source !== 'string'
    const objectUrl = isFile ? URL.createObjectURL(source) : null
    const img = new window.Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    img.onerror = () => {
      resolve(null)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    img.src = objectUrl || source
  })

const calculateRatioDeviation = (meta, spec) => {
  if (!meta?.width || !meta?.height || !spec?.width || !spec?.height) return null
  const actual = meta.width / meta.height
  const expected = spec.width / spec.height
  return Math.abs(actual - expected) / expected
}

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => {
    if (!canvas?.toBlob) return resolve(null)
    canvas.toBlob(resolve, type, quality)
  })

const createImageBitmapSafe = async (file) => {
  if (typeof createImageBitmap !== 'function') return null
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (_) {
    try {
      return await createImageBitmap(file)
    } catch (err) {
      return null
    }
  }
}

const loadImageElementFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image'))
    }
    img.src = objectUrl
  })

/**
 * بهینه‌سازی سمت مرورگر: تغییر اندازه به عرض هدف + تبدیل به WebP/JPG
 * برای بنر اصلی، نسخهٔ موبایل با عرض ۲x (Retina) ذخیره می‌شود.
 */
const optimizeBannerImageFile = async (file, position, device = 'desktop') => {
  if (!file) return file
  if (!file?.type?.startsWith?.('image/')) return file
  if (file.type === 'image/gif') return file

  const shouldOptimize = file.size > RECOMMENDED_BANNER_UPLOAD_SIZE_BYTES
  if (!shouldOptimize) return file

  let bitmap = null
  try {
    bitmap = await createImageBitmapSafe(file)
    const source = bitmap || (await loadImageElementFromFile(file))
    const sourceWidth = source?.width || 0
    const sourceHeight = source?.height || 0
    if (!sourceWidth || !sourceHeight) return file

    const targetMaxWidth = getTargetWidth(position, device)
    const minWidth = Math.min(getMinWidth(position, device), sourceWidth)
    let currentWidth = Math.max(1, Math.round(Math.min(sourceWidth, targetMaxWidth)))

    const qualities = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46]
    const maxPasses = 6

    let bestBlob = null
    let bestType = null

    const tryEncode = async (canvas, type, fillBackground) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return false

      for (const quality of qualities) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (fillBackground) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

        const blob = await canvasToBlob(canvas, type, quality)
        if (!blob) continue

        if (!bestBlob || blob.size < bestBlob.size) {
          bestBlob = blob
          bestType = type
        }

        if (blob.size <= RECOMMENDED_BANNER_UPLOAD_SIZE_BYTES) {
          return true
        }
      }

      return false
    }

    for (let pass = 0; pass < maxPasses; pass += 1) {
      const scale = currentWidth / sourceWidth
      const outWidth = Math.max(1, Math.round(sourceWidth * scale))
      const outHeight = Math.max(1, Math.round(sourceHeight * scale))

      const canvas = document.createElement('canvas')
      canvas.width = outWidth
      canvas.height = outHeight

      const webpOk = await tryEncode(canvas, 'image/webp', false)
      const jpegOk = await tryEncode(canvas, 'image/jpeg', true)

      if ((webpOk || jpegOk) && bestBlob && bestBlob.size < file.size) break
      if (bestBlob && bestBlob.size <= RECOMMENDED_BANNER_UPLOAD_SIZE_BYTES && bestBlob.size < file.size) break
      if (currentWidth <= minWidth) break

      currentWidth = Math.max(minWidth, Math.round(currentWidth * 0.85))
    }

    if (!bestBlob || !bestType) return file
    if (bestBlob.size >= file.size) return file

    const baseName = (file.name || 'banner').replace(/\.[^/.]+$/, '')
    const ext = bestType === 'image/webp' ? 'webp' : 'jpg'
    return new File([bestBlob], `${baseName}.${ext}`, { type: bestType, lastModified: Date.now() })
  } catch (err) {
    console.warn('[BANNER] Image optimization failed; uploading original file instead.', err)
    return file
  } finally {
    if (bitmap?.close) {
      try {
        bitmap.close()
      } catch (_) { }
    }
  }
}

const resolveBannerSaveErrorMessage = (err, context = {}) => {
  if (err?.userMessage) return err.userMessage

  const serverMessage = err?.response?.data?.message
  const fileSizeBytes = context?.fileSizeBytes

  if (err?.code === 'ECONNABORTED') {
    return 'زمان آپلود تصویر به پایان رسید. حجم تصویر را کمتر کنید یا اتصال سرور را بررسی کنید.'
  }

  const status = err?.response?.status
  if (status === 413) {
    if (serverMessage) return serverMessage
    const fileSizeMb = formatBytesAsMb(fileSizeBytes)
    if (Number.isFinite(fileSizeMb) && fileSizeBytes <= MAX_BANNER_UPLOAD_SIZE_BYTES) {
      return `خطای 413 دریافت شد، اما حجم فایل (${fileSizeMb}MB) کمتر از سقف است. محدودیت پراکسی/هاستینگ را بررسی کنید.`
    }
  }
  if (status === 401) return 'نشست شما منقضی شده است. دوباره وارد شوید.'
  if (status === 403) return 'دسترسی آپلود ندارید یا دامنهٔ فعلی در CORS بک‌اند مجاز نیست.'
  if (status === 413) return `حجم تصویر بیشتر از حد مجاز است (حداکثر ${MAX_BANNER_UPLOAD_SIZE_MB} مگابایت).`
  if (status === 415) return 'فرمت فایل پشتیبانی نمی‌شود. فقط JPG/PNG/WEBP/GIF مجاز هستند.'

  if (!err?.response && (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error')) {
    return 'اتصال به API برقرار نشد. CORS، SSL و آدرس API/Proxy را بررسی کنید.'
  }

  return serverMessage || 'خطا در ذخیره بنر'
}

const normalizeBaseUrl = (value) => {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/')) return trimmed.replace(/\/$/, '')
  try {
    return new URL(trimmed).toString().replace(/\/$/, '')
  } catch (_) {
    return null
  }
}

const buildUploadApiBaseCandidates = (currentBaseUrl) => {
  const candidates = []
  const push = (value) => {
    const normalized = normalizeBaseUrl(value)
    if (normalized && !candidates.includes(normalized)) candidates.push(normalized)
  }

  push(import.meta?.env?.VITE_API_BASE_URL)
  push(currentBaseUrl)

  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    push(`${origin}/api`)
    push(`${origin}/api-proxy`)
    push(`${origin}/.netlify/functions/api-proxy`)
  }

  push('/api')
  push('/api-proxy')
  push('/.netlify/functions/api-proxy')
  return candidates
}

const shouldRetryWithAnotherBase = (err) => {
  if (!err?.response) return true
  return [404, 413, 502, 503, 504].includes(err.response.status)
}

const uploadBannerImage = async (file, onProgress) => {
  const formData = new FormData()
  formData.append('image', file)
  const baseCandidates = buildUploadApiBaseCandidates(api?.defaults?.baseURL)
  let lastError = null

  for (const baseURL of baseCandidates) {
    try {
      const res = await api.post('/uploads/banner', formData, {
        baseURL,
        timeout: 180000,
        onUploadProgress: (event) => {
          const total = event?.total || file?.size || 0
          if (!total) return
          const percent = Math.min(100, Math.max(1, Math.round((event.loaded * 100) / total)))
          onProgress?.(percent)
        },
      })

      if (api?.defaults?.baseURL !== baseURL) api.defaults.baseURL = baseURL
      return res?.data?.data
    } catch (err) {
      lastError = err
      if (!shouldRetryWithAnotherBase(err)) throw err
    }
  }

  throw lastError || new Error('Upload request failed on all API base URLs')
}

const beforeUploadBanner = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
  const fileType = file?.type || ''
  const fileName = String(file?.name || '').toLowerCase()
  const hasAllowedExtension = allowedExtensions.some((ext) => fileName.endsWith(ext))

  if (!fileType.startsWith('image/')) {
    message.error('فقط فایل تصویری مجاز است')
    return Upload.LIST_IGNORE
  }
  if (fileType && !allowedTypes.includes(fileType)) {
    message.error('فرمت فایل پشتیبانی نمی‌شود. فقط JPG/PNG/WEBP/GIF مجاز هستند.')
    return Upload.LIST_IGNORE
  }
  if (!fileType && !hasAllowedExtension) {
    message.error('فرمت فایل پشتیبانی نمی‌شود. فقط JPG/PNG/WEBP/GIF مجاز هستند.')
    return Upload.LIST_IGNORE
  }
  if (file.size > MAX_BANNER_UPLOAD_SIZE_BYTES) {
    message.error(`حداکثر حجم فایل ${MAX_BANNER_UPLOAD_SIZE_MB} مگابایت است`)
    return Upload.LIST_IGNORE
  }
  return false
}

// ============================================================
// پیش‌نمایش زندهٔ بنر (دسکتاپ/موبایل)
// ============================================================
// ============================================================
// دموی زندهٔ مکانیزم موبایل — سه اسلاید کنار هم (پیک ۲۰px)
// ============================================================
function HeroMobileStrip({ banners = [] }) {
  const list = (banners || []).filter(Boolean)
  const active = list[0] || null
  const prev = list.length > 1 ? list[list.length - 1] : active
  const next = list.length > 1 ? list[1] : active
  const sourceOf = (banner) => getImageUrl(banner?.mobileImage) || getImageUrl(banner?.image)
  const activeSrc = sourceOf(active)
  const prevSrc = sourceOf(prev)
  const nextSrc = sourceOf(next)
  const peekStyle = {
    flex: '0 0 18px',
    width: 18,
    borderRadius: 8,
    overflow: 'hidden',
    opacity: 0.55,
    background: 'linear-gradient(135deg, #fb923c 0%, #c2410c 100%)',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06)',
  }

  return (
    <div
      style={{
        background: '#f2f3f5',
        borderRadius: 14,
        padding: '12px 0 9px',
        overflow: 'hidden',
        border: '1px solid var(--line)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 8 }}>
        <div style={peekStyle} aria-hidden="true">
          {prevSrc ? (
            <img src={prevSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : null}
        </div>

        <div
          style={{
            position: 'relative',
            flex: '1 1 auto',
            maxWidth: 322,
            aspectRatio: '388 / 180',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #f97316 0%, #9a3412 100%)',
            boxShadow: '0 6px 18px rgba(28,25,23,.16)',
          }}
        >
          {activeSrc ? (
            <img
              src={activeSrc}
              alt={active?.mobileAlt || active?.alt || 'پیش‌نمایش اسلاید موبایل'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <PictureOutlined style={{ fontSize: 22, opacity: 0.85 }} />
              <span>اسلاید فعال ۳۸۸ × ۱۸۰</span>
              <span style={{ fontSize: 10.5, opacity: 0.75, fontWeight: 400 }}>
                اولین بنر فعال، اینجا نمایش داده می‌شود
              </span>
            </div>
          )}

          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: '10%',
              border: '1px dashed rgba(255,255,255,.55)',
              borderRadius: 4,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 7,
              right: 7,
              background: 'rgba(12,10,9,.66)',
              color: '#fff',
              fontSize: 9.5,
              padding: '2px 7px',
              borderRadius: 999,
              backdropFilter: 'blur(6px)',
            }}
          >
            اسلاید فعال • ۸px گردی
          </div>
        </div>

        <div style={peekStyle} aria-hidden="true">
          {nextSrc ? (
            <img src={nextSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: 8,
          padding: '0 12px',
          fontSize: 10.5,
          color: 'var(--text-tertiary)',
        }}
      >
        <span>۲۰px پیک از هر طرف</span>
        <span style={{ color: 'var(--ink-700)', fontWeight: 600 }}>ارتفاع ثابت ۱۸۰px • فاصلهٔ ۸px</span>
        <span>۴۲۸px viewport</span>
      </div>
    </div>
  )
}

// ============================================================
// پیش‌نمایش موبایل داخل فرم (همان نسبتی که در فروشگاه اجرا می‌شود)
// ============================================================
function MobileHeroPreview({ source, fit, usingDesktopFallback, spec }) {
  const objectFit = fit === 'contain' ? 'contain' : 'cover'
  const peekStyle = {
    flex: '0 0 16px',
    width: 16,
    borderRadius: 7,
    overflow: 'hidden',
    opacity: 0.45,
    background: '#d6d3d1',
  }

  return (
    <div
      style={{
        background: '#f2f3f5',
        borderRadius: 12,
        padding: '12px 0 9px',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 7 }}>
        {['prev', 'active', 'next'].map((slot) => {
          if (slot !== 'active') {
            return (
              <div key={slot} style={peekStyle} aria-hidden="true">
                {source ? (
                  <img src={source} alt="" style={{ width: '100%', height: '100%', objectFit, display: 'block' }} />
                ) : null}
              </div>
            )
          }

          return (
            <div
              key={slot}
              style={{
                position: 'relative',
                flex: '1 1 auto',
                maxWidth: 318,
                aspectRatio: '388 / 180',
                borderRadius: 8,
                overflow: 'hidden',
                background: 'linear-gradient(135deg, #292524 0%, #0c0a09 100%)',
                boxShadow: '0 5px 16px rgba(28,25,23,.14)',
              }}
            >
              {source ? (
                <img
                  src={source}
                  alt="پیش‌نمایش بنر موبایل"
                  style={{ width: '100%', height: '100%', objectFit, objectPosition: 'center', display: 'block' }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    color: 'rgba(255,255,255,.65)',
                  }}
                >
                  <PictureOutlined style={{ fontSize: 26 }} />
                  <span style={{ fontSize: 11 }}>تصویر موبایل را آپلود کنید</span>
                </div>
              )}

              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: '10%',
                  border: '1px dashed rgba(255,255,255,.42)',
                  borderRadius: 4,
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 7,
                  right: 7,
                  background: 'rgba(0,0,0,.55)',
                  color: '#fff',
                  fontSize: 9.5,
                  padding: '2px 7px',
                  borderRadius: 999,
                  backdropFilter: 'blur(6px)',
                }}
              >
                {spec.label} • <span dir="ltr">{spec.sizeLabel}</span>
              </div>

              {usingDesktopFallback ? (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 6,
                    left: 6,
                    right: 6,
                    background: 'rgba(180, 83, 9, .94)',
                    color: '#fff',
                    fontSize: 9.5,
                    padding: '4px 6px',
                    borderRadius: 5,
                    textAlign: 'center',
                  }}
                >
                  تصویر موبایل تنظیم نشده؛ نسخهٔ دسکتاپ برش می‌خورد.
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: 8,
          padding: '0 10px',
          fontSize: 10,
          color: 'var(--text-tertiary)',
        }}
      >
        <span>پیک اسلایدهای کنار</span>
        <span>ارتفاع ثابت ۱۸۰px • فاصلهٔ ۸px</span>
        <span>عرض ۳۸۸px</span>
      </div>
    </div>
  )
}

// ============================================================
// دستورالعمل کامل — مودال مرجع پنل ادمین
// ============================================================
function BannerGuideModal({ open, onClose }) {
  const sectionTitle = {
    fontSize: 15,
    fontWeight: 800,
    color: 'var(--ink-900)',
    margin: '0 0 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }
  const paragraph = {
    fontSize: 12.5,
    lineHeight: 2,
    color: 'var(--ink-700)',
    margin: '0 0 10px',
  }
  const cell = {
    borderBottom: '1px solid var(--line)',
    padding: '8px 10px',
    fontSize: 11.5,
    color: 'var(--ink-700)',
    verticalAlign: 'top',
  }
  const headCell = {
    ...cell,
    background: 'var(--surface-sunken)',
    fontWeight: 700,
    color: 'var(--ink-900)',
    fontSize: 11,
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button type="primary" onClick={onClose}>
            متوجه شدم
          </Button>
        </Space>
      }
      width={1000}
      centered
      destroyOnHidden
      title={
        <Space>
          <BookOutlined style={{ color: 'var(--brand-600)' }} />
          <span>دستورالعمل کامل بنر اصلی — نسخهٔ موبایل (اندروید)</span>
        </Space>
      }
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingInlineEnd: 6, paddingTop: 4 }}>
        <Alert
          type="success"
          showIcon
          message="این نسخه جایگزین دستورالعمل قبلی شده است"
          description="نسخهٔ قبلی فقط دسکتاپ را توضیح می‌داد. از این پس مرجع رسمی، همین دستورالعمل موبایل‌محور است؛ مشخصات دسکتاپ در بخش جداگانه و برای هماهنگی دو کریتیو آمده است."
        />

        <Divider orientation="right" style={{ margin: '18px 0 12px', fontSize: 13 }}>
          ۱. مکانیزم دقیق در موبایل
        </Divider>
        <p style={paragraph}>
          بنر اصلی موبایل با همان الگوی دیجی‌کالا اجرا می‌شود: یک اسلاید کامل در وسط، پیک‌زدن اسلایدهای
          کنار، چرخش خودکار و بدون فلش/نقطه. این رفتار در فروشگاه به‌صورت زیر پیاده شده است:
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {HERO_MECHANISM_STEPS.map((item, index) => (
            <div
              key={item.title}
              style={{
                display: 'flex',
                gap: 10,
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: '9px 11px',
                background: 'var(--surface-raised)',
              }}
            >
              <span
                style={{
                  flex: '0 0 22px',
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: 'var(--brand-600)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {index + 1}
              </span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-900)' }}>{item.title}</div>
                <div style={{ fontSize: 11.5, lineHeight: 1.95, color: 'var(--ink-600)', marginTop: 2 }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          message="نکتهٔ فنی برای توسعه‌دهنده"
          description={
            <div>
              <div style={{ fontSize: 11.5, lineHeight: 1.9, marginBottom: 8 }}>
                پیکربندی اسلایدر موبایل در فروشگاه دقیقاً این مقادیر است؛ در دسکتاپ همان
                کامپوننت با <span dir="ltr">slidesPerView: 1</span> و نسبت{' '}
                <span dir="ltr">1911/430</span> اجرا می‌شود.
              </div>
              <pre
                dir="ltr"
                style={{
                  margin: 0,
                  padding: '9px 11px',
                  borderRadius: 8,
                  background: 'rgba(12, 10, 9, .06)',
                  fontSize: 10.5,
                  lineHeight: 1.9,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  overflowX: 'hidden',
                }}
              >{`mobile: {
  slidesPerView: 1.1,
  centeredSlides: true,
  spaceBetween: 8,
  loop: false,             // حلقهٔ دستی: [last, ...slides, first]
  autoplay: { delay: 5000, waitForTransition: true },
  speed: 500,
  height: '180px',
  borderRadius: '8px',
  pagination: false,
  navigation: false,
}
initialSlide: 1
ring: [lastSlide, ...slides, firstSlide]
desktop: {
  slidesPerView: 1,
  centeredSlides: false,
  loop: false,             // همان رینگ دستی
  autoplay: { delay: 5000, waitForTransition: true },
  speed: 500,
  pagination: true,
  navigation: true,
}`}</pre>
            </div>
          }
        />

        <Divider orientation="right" style={{ margin: '18px 0 12px', fontSize: 13 }}>
          ۲. مشخصات فنی — موبایل و دسکتاپ
        </Divider>
        <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr>
                <th style={{ ...headCell, textAlign: 'right' }}>مورد</th>
                <th style={{ ...headCell, textAlign: 'right' }}>
                  <MobileOutlined /> موبایل (زیر ۷۶۸px)
                </th>
                <th style={{ ...headCell, textAlign: 'right' }}>
                  <DesktopOutlined /> دسکتاپ (۷۶۸px به بالا)
                </th>
              </tr>
            </thead>
            <tbody>
              {HERO_SPEC_ROWS.map((row) => (
                <tr key={row.label}>
                  <td style={{ ...cell, fontWeight: 600, color: 'var(--ink-800)' }}>{row.label}</td>
                  <td style={cell}>
                    <bdi>{row.mobile}</bdi>
                  </td>
                  <td style={cell}>
                    <bdi>{row.desktop}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Divider orientation="right" style={{ margin: '18px 0 12px', fontSize: 13 }}>
          ۳. Art Direction — دو تصویر مستقل، نه یک برش
        </Divider>
        <p style={paragraph}>
          موبایل و دسکتاپ دو کریتیو جداگانه هستند. فروشگاه در موبایل تصویر{' '}
          <strong dir="ltr">780 × 360</strong> را در کادر <strong dir="ltr">388 × 180</strong> نمایش
          می‌دهد و در دسکتاپ تصویر <strong dir="ltr">1911 × 430</strong> را. اگر تصویر موبایل خالی
          باشد، تصویر دسکتاپ با برش نمایش داده می‌شود و پنل هشدار می‌دهد؛ این حالت فقط برای اضطرار است.
        </p>
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 10 }}
          message="دارایی‌های قدیمی ۳۶۰×۲۶۰ بازنشسته شدند"
          description="فایل‌های ۳۶۰×۲۶۰ (نسبت ۱.۳۸:۱) در کادر جدید ۳۸۸×۱۸۰ به‌شدت برش می‌خورند. برای همهٔ بنرهای فعال، نسخهٔ ۷۸۰×۳۶۰ بسازید و جایگزین کنید."
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--surface-raised)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Tag color="purple" style={{ marginInlineEnd: 0 }}>
                <MobileOutlined /> قوانین موبایل
              </Tag>
            </div>
            <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 11.5, lineHeight: 2, color: 'var(--ink-700)' }}>
              {HERO_MOBILE_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--surface-raised)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                <DesktopOutlined /> هماهنگی با دسکتاپ
              </Tag>
            </div>
            <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 11.5, lineHeight: 2, color: 'var(--ink-700)' }}>
              {HERO_DESKTOP_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </div>

        <Divider orientation="right" style={{ margin: '18px 0 12px', fontSize: 13 }}>
          ۴. مراحل ساخت و انتشار
        </Divider>
        <ol style={{ margin: 0, paddingInlineStart: 20, fontSize: 12, lineHeight: 2.1, color: 'var(--ink-700)' }}>
          {HERO_UPLOAD_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <Divider orientation="right" style={{ margin: '18px 0 12px', fontSize: 13 }}>
          ۵. چک‌لیست قبل از انتشار
        </Divider>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
          {HERO_CHECKLIST.map((item) => (
            <div
              key={item}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 7,
                fontSize: 11.5,
                lineHeight: 1.9,
                color: 'var(--ink-700)',
                background: 'var(--surface-sunken)',
                borderRadius: 8,
                padding: '7px 9px',
              }}
            >
              <CheckCircleOutlined style={{ color: 'var(--ok)', marginTop: 2 }} />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <Divider orientation="right" style={{ margin: '18px 0 12px', fontSize: 13 }}>
          ۶. عیب‌یابی
        </Divider>
        <div style={{ display: 'grid', gap: 8 }}>
          {HERO_TROUBLESHOOTING.map((item) => (
            <div
              key={item.problem}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: '9px 11px',
                background: 'var(--surface-raised)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--ink-900)' }}>
                <InfoCircleOutlined style={{ color: 'var(--warn)' }} />
                {item.problem}
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.9, color: 'var(--ink-600)', marginTop: 3 }}>
                <strong style={{ color: 'var(--ink-800)' }}>علت:</strong> {item.cause}
                <br />
                <strong style={{ color: 'var(--ink-800)' }}>راه‌حل:</strong> {item.fix}
              </div>
            </div>
          ))}
        </div>

        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 14 }}
          message="یادآوری"
          description="پنل ادمین فقط تصویر و لینک را ذخیره می‌کند؛ برش، گردی گوشه و مکانیزم اسلایدر توسط فروشگاه اعمال می‌شود. بنابراین تصویر را دقیقاً با همان نسبت و ناحیهٔ امن بسازید تا نتیجهٔ نهایی همان چیزی باشد که در پیش‌نمایش می‌بینید."
        />
      </div>
    </Modal>
  )
}

function BannerPreview({
  position,
  device,
  onDeviceChange,
  desktopPreview,
  mobilePreview,
  desktopMeta,
  mobileMeta,
  fit,
}) {
  const config = getPositionConfig(position)
  const responsive = !!config.responsive
  const activeDevice = responsive ? device : 'desktop'
  const spec = getSpec(position, activeDevice)
  const usingDesktopFallback = responsive && activeDevice === 'mobile' && !mobilePreview && !!desktopPreview
  const source = activeDevice === 'mobile' ? mobilePreview || desktopPreview : desktopPreview
  const meta = activeDevice === 'mobile' ? (mobilePreview ? mobileMeta : desktopMeta) : desktopMeta
  const deviation = calculateRatioDeviation(meta, spec)
  const ratioWarning = deviation !== null && deviation > 0.02

  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        padding: 16,
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--ink-900)', fontSize: 14 }}>پیش‌نمایش زنده</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
            مکانیزم موبایل: اسلاید وسط‌چین با پیک ۲۰px، ارتفاع ۱۸۰px و چرخش ۵ ثانیه‌ای
          </div>
        </div>
        {responsive ? (
          <Segmented
            size="small"
            value={activeDevice}
            onChange={onDeviceChange}
            options={[
              { value: 'desktop', label: <span><DesktopOutlined /> دسکتاپ</span> },
              { value: 'mobile', label: <span><MobileOutlined /> موبایل</span> },
            ]}
          />
        ) : (
          <Tag color="default">یک تصویر</Tag>
        )}
      </div>

      {activeDevice === 'mobile' && responsive ? (
        <MobileHeroPreview
          source={source}
          fit={fit}
          usingDesktopFallback={usingDesktopFallback}
          spec={spec}
        />
      ) : (
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          margin: '0 auto',
          aspectRatio: `${spec.width} / ${spec.height}`,
          background: 'var(--ink-900)',
          borderRadius: 10,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {source ? (
          <img
            src={source}
            alt="پیش‌نمایش بنر"
            style={{
              width: '100%',
              height: '100%',
              objectFit: fit === 'contain' ? 'contain' : 'cover',
              objectPosition: 'center',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              color: 'rgba(255,255,255,.65)',
              background: 'linear-gradient(135deg, #292524 0%, #0c0a09 100%)',
            }}
          >
            <PictureOutlined style={{ fontSize: 28 }} />
            <span style={{ fontSize: 11 }}>تصویر را آپلود کنید</span>
          </div>
        )}

        {/* ناحیهٔ امن ۸۰٪ مرکزی */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: '10%',
            border: '1px dashed rgba(255,255,255,.42)',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 14,
            height: 14,
            marginLeft: -7,
            marginTop: -7,
            borderLeft: '1px solid rgba(255,255,255,.5)',
            borderTop: '1px solid rgba(255,255,255,.5)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,.55)',
            color: '#fff',
            fontSize: 10,
            padding: '3px 7px',
            borderRadius: 999,
            backdropFilter: 'blur(6px)',
          }}
        >
          {spec.label} • <span dir="ltr">{spec.sizeLabel}</span>
        </div>

        {usingDesktopFallback ? (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              right: 8,
              background: 'rgba(180, 83, 9, .92)',
              color: '#fff',
              fontSize: 10.5,
              padding: '5px 8px',
              borderRadius: 6,
              textAlign: 'center',
            }}
          >
            تصویر موبایل تنظیم نشده؛ نسخهٔ دسکتاپ برش می‌خورد.
          </div>
        ) : null}
      </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
        <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>ابعاد هدف</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-800)', direction: 'ltr' }}>{spec.sizeLabel}</div>
        </div>
        <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>نسبت</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-800)', direction: 'ltr' }}>{spec.ratioLabel}</div>
        </div>
        <div style={{ background: 'var(--surface-sunken)', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
            {activeDevice === 'mobile' && responsive ? 'ارتفاع ثابت' : 'ارتفاع خودکار'}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-800)', direction: 'ltr' }}>
            {activeDevice === 'mobile' && responsive ? '180px' : spec.padding}
          </div>
        </div>
      </div>

      {meta ? (
        <div style={{ marginTop: 10, fontSize: 11.5, color: ratioWarning ? 'var(--warn)' : 'var(--ok)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {ratioWarning ? <WarningOutlined /> : <CheckCircleOutlined />}
          تصویر فعلی: <span dir="ltr">{meta.width} × {meta.height}</span>
          {ratioWarning ? ' — نسبت با کادر هم‌خوان نیست؛ برش/حاشیه دارد.' : ' — نسبت تصویر مناسب است.'}
          {activeDevice === 'mobile' && responsive ? (
            <span style={{ color: 'var(--text-tertiary)' }}>
              {' '}— فایل پیشنهادی: <span dir="ltr">780 × 360</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ============================================================
// کارت آپلود یک تصویر
// ============================================================
function BannerUploadCard({
  title,
  subtitle,
  spec,
  fileList,
  onChange,
  preview,
  meta,
  onClear,
  urlField,
  urlLabel,
  disabled,
  required,
  onUrlBlur,
}) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink-900)' }}>
            {title} {required ? <span style={{ color: 'var(--err)' }}>*</span> : <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> (اختیاری)</span>}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitle}</div>
        </div>
        <Tag color="default" dir="ltr" style={{ marginInlineEnd: 0 }}>{spec.sizeLabel}</Tag>
      </div>

      <Upload.Dragger
        beforeUpload={beforeUploadBanner}
        fileList={fileList}
        onChange={onChange}
        maxCount={1}
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={disabled}
        style={{ borderRadius: 8, border: '1.5px dashed var(--brand-600)', background: 'var(--surface-sunken)', padding: '6px 0' }}
      >
        <p className="ant-upload-drag-icon" style={{ marginBottom: 2 }}>
          <InboxOutlined style={{ fontSize: 26, color: 'var(--brand-600)' }} />
        </p>
        <p className="ant-upload-text" style={{ fontWeight: 600, fontSize: 11.5, margin: 0 }}>
          رها کنید یا کلیک کنید
        </p>
        <p className="ant-upload-hint" style={{ fontSize: 10, margin: 0, color: 'var(--text-tertiary)' }}>
          <bdi>{spec.ratioLabel}</bdi> • پیشنهاد <bdi>{spec.recommendedLabel}</bdi> • JPG/PNG/WEBP/GIF • حداکثر 10MB
        </p>
      </Upload.Dragger>

      {preview ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <img
            src={preview}
            alt=""
            style={{ width: 74, height: 46, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface-inset)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {meta?.name || 'تصویر انتخاب‌شده'}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', direction: 'ltr', textAlign: 'right' }}>
              {meta?.width ? `${meta.width} × ${meta.height}` : 'ابعاد نامشخص'}
              {meta?.bytes ? ` • ${formatBytesAsMb(meta.bytes)}MB` : ''}
            </div>
          </div>
          <Button size="small" type="text" danger icon={<CloseCircleOutlined />} onClick={onClear} aria-label="حذف تصویر" />
        </div>
      ) : null}

      <Form.Item name={urlField} label={urlLabel} style={{ marginBottom: 0, marginTop: 10 }}>
        <Input
          placeholder="https://... یا /path/to/image"
          size="small"
          dir="ltr"
          disabled={disabled}
          onBlur={onUrlBlur}
          allowClear
        />
      </Form.Item>
    </div>
  )
}

function BannersPage() {
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [positionFilter, setPositionFilter] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadLabel, setUploadLabel] = useState('')

  const [desktopFileList, setDesktopFileList] = useState([])
  const [mobileFileList, setMobileFileList] = useState([])
  const [desktopPreview, setDesktopPreview] = useState(null)
  const [mobilePreview, setMobilePreview] = useState(null)
  const [desktopMeta, setDesktopMeta] = useState(null)
  const [mobileMeta, setMobileMeta] = useState(null)
  const [originalDesktopUrl, setOriginalDesktopUrl] = useState('')
  const [originalMobileUrl, setOriginalMobileUrl] = useState('')
  const [mobileCleared, setMobileCleared] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState('main-slider')
  const [previewDevice, setPreviewDevice] = useState('desktop')
  const [fit, setFit] = useState('cover')
  const [guideOpen, setGuideOpen] = useState(false)

  const blobUrlsRef = useRef([])

  const selectedConfig = getPositionConfig(selectedPosition)

  const mainSliderPreview = useMemo(
    () =>
      banners
        .filter((banner) => banner.position === 'main-slider')
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .slice(0, 3),
    [banners]
  )

  const makeBlobUrl = (file) => {
    const url = URL.createObjectURL(file)
    blobUrlsRef.current.push(url)
    return url
  }

  const clearBlobUrls = () => {
    blobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url)
      } catch (_) { }
    })
    blobUrlsRef.current = []
  }

  useEffect(() => () => clearBlobUrls(), [])

  // ============================================
  // دریافت لیست بنرها
  // ============================================
  const fetchBanners = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = { page, limit: pageSize, sort: 'sortOrder -createdAt' }
      if (positionFilter) params.position = positionFilter
      const res = await api.get('/banners', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination
      setBanners(list)
      if (pg) {
        setPagination({ current: pg.currentPage || page, pageSize, total: pg.totalItems || list.length })
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'خطا در دریافت بنرها')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBanners(1, pagination.pageSize)
  }, [positionFilter])

  // ============================================
  // ستون‌های جدول
  // ============================================
  const columns = [
    {
      title: 'تصاویر',
      key: 'images',
      width: 168,
      render: (_, record) => {
        const desktop = getImageUrl(record.image)
        const mobile = getImageUrl(record.mobileImage)
        return (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <Tooltip title="تصویر دسکتاپ">
              <div>
                {desktop ? (
                  <Image
                    src={desktop}
                    alt="بنر دسکتاپ"
                    width={104}
                    height={24}
                    style={{ objectFit: 'cover', borderRadius: 5, display: 'block' }}
                    preview={{ mask: <EyeOutlined /> }}
                  />
                ) : (
                  <div style={{ width: 104, height: 24, background: 'var(--surface-inset)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-300)' }}>
                    <PictureOutlined />
                  </div>
                )}
                <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 3 }}>دسکتاپ</div>
              </div>
            </Tooltip>
            <Tooltip title={mobile ? 'تصویر موبایل' : 'تصویر موبایل تنظیم نشده'}>
              <div>
                {mobile ? (
                  <Image
                    src={mobile}
                    alt="بنر موبایل"
                    width={56}
                    height={26}
                    style={{ objectFit: 'cover', borderRadius: 5, display: 'block' }}
                    preview={{ mask: <EyeOutlined /> }}
                  />
                ) : (
                  <div style={{ width: 56, height: 26, background: 'var(--surface-inset)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-300)', border: '1px dashed var(--line-strong)' }}>
                    <MobileOutlined />
                  </div>
                )}
                <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 3 }}>موبایل</div>
              </div>
            </Tooltip>
          </div>
        )
      },
    },
    {
      title: 'عنوان',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <div>
          <strong style={{ color: 'var(--ink-900)' }}>{title || '—'}</strong>
          <div style={{ marginTop: 3 }}>
            {record.position === 'main-slider' ? (
              record.mobileImage ? (
                <Tag color="green" style={{ fontSize: 10 }}>ریسپانسیو کامل</Tag>
              ) : (
                <Tag color="orange" style={{ fontSize: 10 }}>بدون تصویر موبایل</Tag>
              )
            ) : null}
          </div>
        </div>
      ),
    },
    {
      title: 'موقعیت',
      dataIndex: 'position',
      key: 'position',
      width: 170,
      render: (pos) => {
        const config = getPositionConfig(pos)
        return (
          <Tooltip title={config.description}>
            <Tag color={config.color}>{config.icon} {config.label}</Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'ترتیب',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 72,
      align: 'center',
      render: (order) => (
        <Tag color="geekblue" style={{ fontWeight: 700 }}>
          {order ?? 0}
        </Tag>
      ),
    },
    {
      title: 'لینک',
      dataIndex: 'link',
      key: 'link',
      width: 72,
      align: 'center',
      render: (link) =>
        link ? (
          <Tooltip title={link}>
            <a href={link} target="_blank" rel="noreferrer" aria-label="باز کردن لینک">
              <LinkOutlined style={{ fontSize: 17 }} />
            </a>
          </Tooltip>
        ) : (
          <span style={{ color: 'var(--ink-300)' }}>—</span>
        ),
    },
    {
      title: 'وضعیت',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 92,
      align: 'center',
      render: (isActive) => (
        <Badge status={isActive ? 'success' : 'error'} text={isActive ? 'فعال' : 'غیرفعال'} />
      ),
    },
    {
      title: 'تاریخ',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (date) => (
        <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{formatPersianDate(date, false)}</span>
      ),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 130,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="ویرایش">
            <Button type="primary" ghost icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="حذف بنر"
            description="آیا از حذف این بنر مطمئن هستید؟"
            onConfirm={() => handleDelete(record._id)}
            okText="حذف"
            cancelText="انصراف"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="حذف">
              <Button danger icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ============================================
  // عملیات
  // ============================================
  const handleTableChange = (pag) => {
    setPagination((prev) => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))
    fetchBanners(pag.current, pag.pageSize)
  }

  const resetEditorState = () => {
    clearBlobUrls()
    setDesktopFileList([])
    setMobileFileList([])
    setDesktopPreview(null)
    setMobilePreview(null)
    setDesktopMeta(null)
    setMobileMeta(null)
    setOriginalDesktopUrl('')
    setOriginalMobileUrl('')
    setMobileCleared(false)
    setPreviewDevice('desktop')
    setFit('cover')
    setUploadingImage(false)
    setUploadProgress(0)
    setUploadLabel('')
  }

  const handleNew = () => {
    setEditing(null)
    form.resetFields()
    resetEditorState()
    setSelectedPosition('main-slider')
    form.setFieldsValue({
      position: 'main-slider',
      isActive: true,
      openInNewTab: false,
      fit: 'cover',
      sortOrder: 0,
    })
    setModalOpen(true)
  }

  const handleEdit = (banner) => {
    setEditing(banner)
    form.resetFields()
    resetEditorState()
    setSelectedPosition(banner.position || 'main-slider')

    const desktop = getImageUrl(banner.image)
    const mobile = getImageUrl(banner.mobileImage)

    setDesktopPreview(desktop || null)
    setMobilePreview(mobile || null)
    setOriginalDesktopUrl(desktop || '')
    setOriginalMobileUrl(mobile || '')
    setDesktopMeta(getImageMeta(banner.image))
    setMobileMeta(getImageMeta(banner.mobileImage))

    form.setFieldsValue({
      title: banner.title,
      link: banner.link,
      position: banner.position,
      isActive: banner.isActive,
      openInNewTab: banner.openInNewTab ?? false,
      fit: banner.fit || 'cover',
      sortOrder: banner.sortOrder ?? 0,
      alt: banner.alt || '',
      mobileAlt: banner.mobileAlt || '',
      imageUrl: desktop || '',
      mobileImageUrl: mobile || '',
    })
    setFit(banner.fit || 'cover')

    if (desktop && !getImageMeta(banner.image)) {
      readImageDimensions(desktop).then((meta) => {
        if (meta) setDesktopMeta((prev) => ({ ...(prev || {}), ...meta }))
      })
    }
    if (mobile && !getImageMeta(banner.mobileImage)) {
      readImageDimensions(mobile).then((meta) => {
        if (meta) setMobileMeta((prev) => ({ ...(prev || {}), ...meta }))
      })
    }

    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/banners/${id}`)
      message.success('بنر با موفقیت حذف شد')
      fetchBanners()
    } catch (err) {
      message.error(err?.response?.data?.message || 'خطا در حذف بنر')
    }
  }

  const handleDesktopFileChange = async ({ fileList }) => {
    setDesktopFileList(fileList)
    const file = fileList?.[0]?.originFileObj
    if (!file) {
      setDesktopPreview(null)
      setDesktopMeta(null)
      return
    }
    const preview = makeBlobUrl(file)
    setDesktopPreview(preview)
    form.setFieldValue('imageUrl', '')
    const dimensions = await readImageDimensions(file)
    setDesktopMeta({
      ...(dimensions || {}),
      bytes: file.size,
      type: file.type,
      name: file.name,
    })
  }

  const handleMobileFileChange = async ({ fileList }) => {
    setMobileFileList(fileList)
    const file = fileList?.[0]?.originFileObj
    if (!file) {
      setMobilePreview(null)
      setMobileMeta(null)
      setMobileCleared(true)
      return
    }
    const preview = makeBlobUrl(file)
    setMobilePreview(preview)
    form.setFieldValue('mobileImageUrl', '')
    setMobileCleared(false)
    const dimensions = await readImageDimensions(file)
    setMobileMeta({
      ...(dimensions || {}),
      bytes: file.size,
      type: file.type,
      name: file.name,
    })
  }

  const handleClearDesktop = () => {
    setDesktopFileList([])
    setDesktopPreview(null)
    setDesktopMeta(null)
    form.setFieldValue('imageUrl', '')
  }

  const handleClearMobile = () => {
    setMobileFileList([])
    setMobilePreview(null)
    setMobileMeta(null)
    setMobileCleared(true)
    form.setFieldValue('mobileImageUrl', '')
  }

  const handleDesktopUrlBlur = async () => {
    const value = String(form.getFieldValue('imageUrl') || '').trim()
    if (!value) {
      if (!desktopFileList.length) {
        setDesktopPreview(null)
        setDesktopMeta(null)
      }
      return
    }
    setDesktopPreview(value)
    const dimensions = await readImageDimensions(value)
    setDesktopMeta(dimensions ? { ...dimensions } : null)
  }

  const handleMobileUrlBlur = async () => {
    const value = String(form.getFieldValue('mobileImageUrl') || '').trim()
    if (!value) {
      if (!mobileFileList.length) {
        setMobilePreview(null)
        setMobileMeta(null)
      }
      return
    }
    setMobilePreview(value)
    setMobileCleared(false)
    const dimensions = await readImageDimensions(value)
    setMobileMeta(dimensions ? { ...dimensions } : null)
  }

  const handleSave = async () => {
    let uploadedDesktop = null
    let uploadedMobile = null

    try {
      const values = await form.validateFields()
      const position = values.position || 'main-slider'
      const config = getPositionConfig(position)

      if (!desktopPreview) {
        message.error('تصویر دسکتاپ بنر را انتخاب کنید')
        return
      }

      if (!editing && config.responsive && !mobilePreview) {
        message.error('برای بنر اصلی، تصویر موبایل هم لازم است تا در موبایل برش نخورد')
        return
      }

      setSaving(true)
      setUploadingImage(false)
      setUploadProgress(0)
      setUploadLabel('')

      const desktopFile = desktopFileList?.[0]?.originFileObj
      const mobileFile = config.responsive ? mobileFileList?.[0]?.originFileObj : null
      const totalSteps = (desktopFile ? 1 : 0) + (mobileFile ? 1 : 0)
      let completedSteps = 0

      const reportProgress = (percent) => {
        if (!totalSteps) return
        const overall = Math.round(((completedSteps + percent / 100) / totalSteps) * 100)
        setUploadProgress(Math.min(99, overall))
      }

      if (desktopFile) {
        setUploadingImage(true)
        setUploadLabel('در حال آماده‌سازی و آپلود تصویر دسکتاپ...')
        setUploadProgress(1)
        const optimized = await optimizeBannerImageFile(desktopFile, position, 'desktop')
        uploadedDesktop = await uploadBannerImage(optimized, reportProgress)
        completedSteps += 1
        setUploadProgress(Math.round((completedSteps / totalSteps) * 100))
      }

      if (mobileFile) {
        setUploadingImage(true)
        setUploadLabel('در حال آماده‌سازی و آپلود تصویر موبایل...')
        const optimized = await optimizeBannerImageFile(mobileFile, position, 'mobile')
        uploadedMobile = await uploadBannerImage(optimized, reportProgress)
        completedSteps += 1
        setUploadProgress(100)
      }

      const payload = {
        title: values.title,
        link: values.link || '',
        position,
        isActive: values.isActive !== undefined ? values.isActive : true,
        openInNewTab: values.openInNewTab ?? false,
        fit: values.fit || 'cover',
        sortOrder: values.sortOrder ?? 0,
        alt: values.alt || values.title || '',
        mobileAlt: values.mobileAlt || values.alt || values.title || '',
      }

      if (uploadedDesktop) {
        payload.image = uploadedDesktop
        if (desktopMeta?.width) {
          payload.imageWidth = desktopMeta.width
          payload.imageHeight = desktopMeta.height
        }
      } else if (values.imageUrl && values.imageUrl !== originalDesktopUrl) {
        payload.image = {
          url: values.imageUrl,
          ...(desktopMeta?.width ? { width: desktopMeta.width, height: desktopMeta.height } : {}),
        }
        if (desktopMeta?.width) {
          payload.imageWidth = desktopMeta.width
          payload.imageHeight = desktopMeta.height
        }
      }

      if (config.responsive) {
        if (uploadedMobile) {
          payload.mobileImage = uploadedMobile
          if (mobileMeta?.width) {
            payload.mobileImageWidth = mobileMeta.width
            payload.mobileImageHeight = mobileMeta.height
          }
        } else if (mobileCleared) {
          payload.mobileImage = null
        } else if (values.mobileImageUrl && values.mobileImageUrl !== originalMobileUrl) {
          payload.mobileImage = {
            url: values.mobileImageUrl,
            ...(mobileMeta?.width ? { width: mobileMeta.width, height: mobileMeta.height } : {}),
          }
          if (mobileMeta?.width) {
            payload.mobileImageWidth = mobileMeta.width
            payload.mobileImageHeight = mobileMeta.height
          }
        }
      }

      if (editing) {
        await api.put(`/banners/${editing._id}`, payload)
        message.success('بنر با موفقیت به‌روزرسانی شد')
      } else {
        await api.post('/banners', payload)
        message.success('بنر جدید با موفقیت ایجاد شد')
      }

      setModalOpen(false)
      setEditing(null)
      resetEditorState()
      fetchBanners()
    } catch (err) {
      if (!err?.errorFields) {
        const cleanupUploaded = (image) => {
          const key = image?.public_id || image?.filename
          if (!key) return
          api.delete(`/uploads/banner/${encodeURIComponent(key)}`).catch(() => { })
        }
        cleanupUploaded(uploadedDesktop)
        cleanupUploaded(uploadedMobile)

        message.error(
          resolveBannerSaveErrorMessage(err, {
            fileSizeBytes:
              desktopFileList?.[0]?.originFileObj?.size || mobileFileList?.[0]?.originFileObj?.size,
          })
        )
      }
    } finally {
      setUploadingImage(false)
      setSaving(false)
    }
  }

  const handleModalCancel = () => {
    setModalOpen(false)
    setEditing(null)
    resetEditorState()
  }

  const previewSpec = getSpec(selectedPosition, previewDevice)
  const ratioDeviation = useMemo(
    () => calculateRatioDeviation(previewDevice === 'mobile' ? mobileMeta : desktopMeta, previewSpec),
    [previewDevice, mobileMeta, desktopMeta, previewSpec]
  )

  // ============================================
  // UI
  // ============================================
  return (
    <div>
      <PageHeader
        title="مدیریت بنرها"
        subtitle="بنر اصلی را موبایل‌محور مدیریت کنید؛ دو تصویر مستقل، مکانیزم اسلایدر دیجی‌کالا و پیش‌نمایش زنده"
        actions={
          <>
            <Button icon={<ReloadOutlined />} onClick={() => fetchBanners()}>
              بروزرسانی
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleNew} data-testid="banner-add">
              افزودن بنر جدید
            </Button>
          </>
        }
      />

      {/* راهنمای بنر اصلی — نسخهٔ اندروید (جایگزین راهنمای قبلی) */}
      <Card
        size="small"
        style={{ marginBottom: 16, background: 'var(--surface-raised)', border: '1px solid var(--line)' }}
        title={
          <Space wrap size={6} style={{ minWidth: 0 }}>
            <ExpandOutlined style={{ color: 'var(--brand-600)' }} />
            <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'normal', lineHeight: 1.6 }}>
              راهنمای بنر اصلی — نسخهٔ اندروید (موبایل اول)
            </span>
            <Tag color="green" style={{ marginInlineEnd: 0, fontSize: 10 }}>
              مکانیزم دیجی‌کالا
            </Tag>
          </Space>
        }
        extra={
          <Button size="small" type="primary" ghost icon={<BookOutlined />} onClick={() => setGuideOpen(true)}>
            دستورالعمل کامل
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Tag color="purple" style={{ marginInlineEnd: 0 }}>
                <MobileOutlined /> موبایل / اندروید
              </Tag>
              <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', direction: 'ltr' }}>
                viewport 428px
              </span>
            </div>

            <HeroMobileStrip banners={mainSliderPreview} />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
                gap: 8,
                marginTop: 12,
              }}
            >
              {[
                { label: 'اسلاید موبایل', value: '388 × 180' },
                { label: 'فایل پیشنهادی', value: '780 × 360' },
                { label: 'حاشیه / فاصله', value: '20 / 8 px' },
                { label: 'چرخش خودکار', value: '5s · 500ms' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: 'var(--surface-sunken)',
                    border: '1px solid var(--line)',
                    borderRadius: 9,
                    padding: '8px 9px',
                  }}
                >
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{item.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-900)', direction: 'ltr', textAlign: 'right' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <ul
              style={{
                margin: '12px 0 0',
                paddingInlineStart: 18,
                fontSize: 11.5,
                lineHeight: 2,
                color: 'var(--ink-700)',
              }}
            >
              {HERO_MOBILE_RULES.slice(0, 3).map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </Col>

          <Col xs={24} lg={10}>
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: 12,
                background: 'var(--surface-sunken)',
                height: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                  <DesktopOutlined /> دسکتاپ
                </Tag>
                <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', direction: 'ltr' }}>1911 × 430</span>
              </div>

              <div
                style={{
                  width: '100%',
                  aspectRatio: '1911 / 430',
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid var(--line-strong)',
                  background: 'linear-gradient(135deg, #292524 0%, #0c0a09 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,.62)',
                  fontSize: 10.5,
                }}
              >
                {getImageUrl(mainSliderPreview[0]?.image) ? (
                  <img
                    src={getImageUrl(mainSliderPreview[0]?.image)}
                    alt="پیش‌نمایش بنر دسکتاپ"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <span dir="ltr">1911 × 430 desktop creative</span>
                )}
              </div>

              <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                {[
                  'فلش قبلی/بعدی و نقطه‌های اسلاید در دسکتاپ',
                  'همان چرخش ۵ ثانیه‌ای و لوپ بینهایت',
                  'تصویر مستقل از موبایل؛ نه برش نسخهٔ موبایل',
                  'لوپ، swipe و توقف روی hover',
                ].map((item) => (
                  <div
                    key={item}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--ink-700)', lineHeight: 1.8 }}
                  >
                    <CheckCircleOutlined style={{ color: 'var(--ok)', marginTop: 2 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </Col>
        </Row>

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 14 }}
          message="قانون طلایی موبایل: تصویر جدا، ناحیهٔ امن ۸۰٪ و ارتفاع ثابت ۱۸۰px"
          description={
            <div style={{ fontSize: 12, lineHeight: 1.95 }}>
              در فروشگاه، موبایل تصویر ۷۸۰×۳۶۰ خودش را در کادر ۳۸۸×۱۸۰ می‌گیرد و دسکتاپ تصویر
              ۱۹۱۱×۴۳۰. ۲۰px از اسلایدهای کنار دیده می‌شود و اسلایدر هر ۵ ثانیه جابه‌جا می‌شود؛
              پیام اصلی را در ۸۰٪ مرکزی نگه دارید. اگر تصویر موبایل خالی باشد، تصویر دسکتاپ با
              برش نمایش داده می‌شود و پنل هشدار می‌دهد.
            </div>
          }
        />
      </Card>

      {/* فیلتر و جدول */}
      <Card
        title={
          <Space>
            <span>لیست بنرها</span>
            <Tag color="blue">{pagination.total} بنر</Tag>
          </Space>
        }
        extra={
          <Select
            placeholder="فیلتر موقعیت"
            allowClear
            style={{ width: 220, maxWidth: '100%' }}
            value={positionFilter}
            onChange={setPositionFilter}
          >
            {Object.entries(BANNER_POSITIONS).map(([key, config]) => (
              <Select.Option key={key} value={key}>
                {config.icon} {config.label}
              </Select.Option>
            ))}
          </Select>
        }
      >
        <ResponsiveTable
          columns={columns}
          dataSource={banners}
          loading={loading}
          rowKey="_id"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `مجموع: ${total} بنر`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="هیچ بنری یافت نشد" />,
          }}
        />
      </Card>

      {/* مودال ایجاد/ویرایش */}
      <Modal
        open={modalOpen}
        onCancel={handleModalCancel}
        onOk={handleSave}
        okText={editing ? 'ذخیره تغییرات' : 'ایجاد بنر'}
        cancelText="انصراف"
        confirmLoading={saving}
        title={
          <Space>
            {editing ? <EditOutlined /> : <PlusOutlined />}
            <span>{editing ? 'ویرایش بنر' : 'افزودن بنر جدید'}</span>
            <Tag color="default">{selectedConfig.label}</Tag>
          </Space>
        }
        width={1080}
        centered
        destroyOnHidden
      >
        <Divider style={{ margin: '8px 0 16px' }} />

        <Form layout="vertical" form={form} requiredMark="optional">
          <Row gutter={20}>
            {/* ستون فرم */}
            <Col xs={24} lg={9}>
              <Form.Item
                name="title"
                label="عنوان بنر"
                rules={[{ required: true, message: 'عنوان را وارد کنید' }]}
                tooltip="عنوان داخلی برای شناسایی بنر"
              >
                <Input placeholder="مثال: کمپین پاییزه" size="large" maxLength={120} />
              </Form.Item>

              <Form.Item
                name="link"
                label="لینک مقصد"
                tooltip="آدرس داخلی مثل /products یا آدرس کامل https://..."
              >
                <Input placeholder="/products یا https://..." size="large" dir="ltr" />
              </Form.Item>

              <Row gutter={12}>
                <Col span={14}>
                  <Form.Item
                    name="position"
                    label="موقعیت نمایش"
                    rules={[{ required: true, message: 'موقعیت را انتخاب کنید' }]}
                  >
                    <Select
                      size="large"
                      onChange={(val) => {
                        setSelectedPosition(val)
                        setPreviewDevice('desktop')
                      }}
                      options={Object.entries(BANNER_POSITIONS).map(([key, config]) => ({
                        value: key,
                        label: `${config.icon} ${config.label}`,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  <Form.Item name="sortOrder" label="ترتیب" tooltip="عدد کمتر = نمایش زودتر">
                    <InputNumber min={0} max={999} size="large" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="fit"
                label="نحوهٔ جاگیری تصویر"
                tooltip="cover کادر را پر می‌کند؛ contain کل تصویر را نشان می‌دهد."
              >
                <Segmented
                  block
                  onChange={(value) => setFit(value)}
                  options={[
                    { value: 'cover', label: 'پر کردن کادر' },
                    { value: 'contain', label: 'نمایش کامل' },
                  ]}
                />
              </Form.Item>

              <Form.Item name="alt" label="متن جایگزین (Alt)" tooltip="برای دسترسی‌پذیری و SEO">
                <Input placeholder="مثال: بنر کمپین پاییزه ای‌کا‌جی کالا" maxLength={200} />
              </Form.Item>

              {selectedConfig.responsive ? (
                <Form.Item
                  name="mobileAlt"
                  label="Alt تصویر موبایل"
                  tooltip="اگر خالی باشد از Alt اصلی استفاده می‌شود"
                >
                  <Input placeholder="اختیاری" maxLength={200} />
                </Form.Item>
              ) : null}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Form.Item name="isActive" label="وضعیت" valuePropName="checked" style={{ marginBottom: 8 }}>
                  <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
                </Form.Item>
                <Form.Item name="openInNewTab" label="باز شدن لینک" valuePropName="checked" style={{ marginBottom: 8 }}>
                  <Switch checkedChildren="تب جدید" unCheckedChildren="همین تب" />
                </Form.Item>
              </div>

              <Alert
                type="info"
                showIcon
                style={{ marginTop: 8 }}
                message="راهنمای سریع"
                description={
                  <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 11.5, lineHeight: 2 }}>
                    {selectedConfig.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                }
              />
            </Col>

            {/* ستون پیش‌نمایش و آپلود */}
            <Col xs={24} lg={15}>
              <BannerPreview
                position={selectedPosition}
                device={previewDevice}
                onDeviceChange={setPreviewDevice}
                desktopPreview={desktopPreview}
                mobilePreview={mobilePreview}
                desktopMeta={desktopMeta}
                mobileMeta={mobileMeta}
                fit={fit}
              />

              {ratioDeviation !== null && ratioDeviation > 0.02 ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginTop: 12 }}
                  message="نسبت تصویر با کادر هم‌خوان نیست"
                  description={`نسبت فعلی ${((previewDevice === 'mobile' ? mobileMeta : desktopMeta)?.width || 0)}×${((previewDevice === 'mobile' ? mobileMeta : desktopMeta)?.height || 0)} است؛ برای بهترین نتیجه از ${previewDevice === 'mobile' ? HERO_MOBILE.recommendedUpload : previewSpec.sizeLabel} استفاده کنید.`}
                />
              ) : null}

              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                <BannerUploadCard
                  title="تصویر دسکتاپ"
                  subtitle="تمام‌عرض برای نمایشگرهای ۷۶۸ پیکسل به بالا"
                  spec={getSpec(selectedPosition, 'desktop')}
                  fileList={desktopFileList}
                  onChange={handleDesktopFileChange}
                  preview={desktopPreview}
                  meta={desktopMeta}
                  onClear={handleClearDesktop}
                  urlField="imageUrl"
                  urlLabel="یا آدرس تصویر دسکتاپ"
                  disabled={saving}
                  required
                  onUrlBlur={handleDesktopUrlBlur}
                />

                {selectedConfig.responsive ? (
                  <BannerUploadCard
                    title="تصویر موبایل"
                    subtitle="کریتیو مستقل موبایل (۳۸۸×۱۸۰ نمایش، فایل ۷۸۰×۳۶۰) — نه برش دسکتاپ"
                    spec={getSpec(selectedPosition, 'mobile')}
                    fileList={mobileFileList}
                    onChange={handleMobileFileChange}
                    preview={mobilePreview}
                    meta={mobileMeta}
                    onClear={handleClearMobile}
                    urlField="mobileImageUrl"
                    urlLabel="یا آدرس تصویر موبایل"
                    disabled={saving}
                    required={!editing}
                    onUrlBlur={handleMobileUrlBlur}
                  />
                ) : null}
              </div>

              {uploadingImage || (saving && uploadProgress > 0) ? (
                <div style={{ marginTop: 12 }}>
                  <Progress
                    percent={uploadProgress}
                    size="small"
                    status={uploadProgress < 100 ? 'active' : 'success'}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {uploadLabel || 'در حال ذخیره...'}
                  </div>
                </div>
              ) : null}
            </Col>
          </Row>
        </Form>
      </Modal>

      <BannerGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}

export default BannersPage
