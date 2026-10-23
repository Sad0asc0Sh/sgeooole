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
// مشخصات بنرها — هم‌راستا با Art Direction فرانت‌اند
// ============================================================
// منبع: مهندسی معکوس بنر اصلی Technolife
//   دسکتاپ: 1911×430 → 22.5013%  (4.444:1)
//   موبایل : 360 ×260 → 72.2222%  (1.385:1)
//   دو تصویر مستقل؛ نه برش تصویر دسکتاپ در موبایل.
// ============================================================

const buildSpec = (width, height, label) => ({
  width,
  height,
  label,
  sizeLabel: `${width} × ${height}`,
  ratioLabel: `${(width / height).toFixed(2)} : 1`,
  padding: `${((height / width) * 100).toFixed(2)}%`,
})

const BANNER_POSITIONS = {
  'main-slider': {
    label: 'اسلایدر اصلی',
    icon: '🖼️',
    description: 'بنر تمام‌عرض بالای صفحه اصلی — دو تصویر مستقل برای دسکتاپ و موبایل',
    responsive: true,
    desktop: buildSpec(1911, 430, 'دسکتاپ'),
    mobile: buildSpec(360, 260, 'موبایل'),
    size: '1911×430 دسکتاپ • 360×260 موبایل',
    aspectRatio: '4.44:1 دسکتاپ | 1.38:1 موبایل',
    minSize: 'دسکتاپ ۱۲۰۰×۲۷۰ • موبایل ۳۶۰×۲۶۰',
    previewAspect: '1911 / 430',
    color: 'blue',
    tips: [
      'برای موبایل یک تصویر جداگانه بسازید؛ نسخهٔ کوچک‌شدهٔ دسکتاپ کافی نیست.',
      'متن و CTA را در ۸۰٪ مرکزی کادر نگه دارید.',
      'اولین اسلاید، LCP صفحه است؛ سبک‌ترین تصویر را اول بگذارید.',
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
  // برای موبایل، عرض ۲ برابر (Retina) به‌عنوان سقف بهینه‌سازی
  return device === 'mobile' ? spec.width * 2 : spec.width
}

const getMinWidth = (position, device = 'desktop') => {
  if (device === 'mobile') return 360
  if (position === 'middle-banner') return 640
  return 900
}

const MAX_BANNER_UPLOAD_SIZE_MB = 10
const MAX_BANNER_UPLOAD_SIZE_BYTES = MAX_BANNER_UPLOAD_SIZE_MB * 1024 * 1024
const RECOMMENDED_BANNER_UPLOAD_SIZE_MB = 2
const RECOMMENDED_BANNER_UPLOAD_SIZE_BYTES = RECOMMENDED_BANNER_UPLOAD_SIZE_MB * 1024 * 1024

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
            ناحیهٔ امن و نسبت تصویر، دقیقاً مثل فروشگاه
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

      <div
        style={{
          width: '100%',
          maxWidth: activeDevice === 'mobile' ? 340 : '100%',
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
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>ارتفاع خودکار</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-800)', direction: 'ltr' }}>{spec.padding}</div>
        </div>
      </div>

      {meta ? (
        <div style={{ marginTop: 10, fontSize: 11.5, color: ratioWarning ? 'var(--warn)' : 'var(--ok)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {ratioWarning ? <WarningOutlined /> : <CheckCircleOutlined />}
          تصویر فعلی: <span dir="ltr">{meta.width} × {meta.height}</span>
          {ratioWarning ? ' — نسبت با کادر هم‌خوان نیست؛ برش/حاشیه دارد.' : ' — نسبت تصویر مناسب است.'}
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
          {spec.ratioLabel} • JPG/PNG/WEBP/GIF • حداکثر 10MB
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

  const blobUrlsRef = useRef([])

  const selectedConfig = getPositionConfig(selectedPosition)

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
                    height={48}
                    style={{ objectFit: 'cover', borderRadius: 5, display: 'block' }}
                    preview={{ mask: <EyeOutlined /> }}
                  />
                ) : (
                  <div style={{ width: 104, height: 48, background: 'var(--surface-inset)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-300)' }}>
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
                    width={46}
                    height={34}
                    style={{ objectFit: 'cover', borderRadius: 5, display: 'block' }}
                    preview={{ mask: <EyeOutlined /> }}
                  />
                ) : (
                  <div style={{ width: 46, height: 34, background: 'var(--surface-inset)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-300)', border: '1px dashed var(--line-strong)' }}>
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
        subtitle="بنر اصلی را با دو تصویر مستقل دسکتاپ و موبایل مدیریت کنید"
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

      {/* راهنمای مشخصات — خلاصه و کاربردی */}
      <Card
        size="small"
        style={{ marginBottom: 16, background: 'var(--surface-raised)', border: '1px solid var(--line)' }}
        title={
          <Space>
            <ExpandOutlined style={{ color: 'var(--brand-600)' }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>مشخصات بنر اصلی — Art Direction دسکتاپ و موبایل</span>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          {['desktop', 'mobile'].map((device) => {
            const spec = getSpec('main-slider', device)
            const isMobile = device === 'mobile'
            return (
              <Col xs={24} md={12} key={device}>
                <div
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-md)',
                    padding: 14,
                    background: 'var(--surface-sunken)',
                    height: '100%',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Tag color={isMobile ? 'purple' : 'blue'} style={{ marginInlineEnd: 0 }}>
                      {isMobile ? <MobileOutlined /> : <DesktopOutlined />} {spec.label}
                    </Tag>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', direction: 'ltr' }}>
                      {spec.padding} height
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: isMobile ? 220 : '100%',
                      margin: '0 auto',
                      aspectRatio: `${spec.width} / ${spec.height}`,
                      background: 'linear-gradient(135deg, #292524 0%, #0c0a09 100%)',
                      borderRadius: 8,
                      border: '1px solid var(--line-strong)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgba(255,255,255,.6)',
                      fontSize: 10,
                      direction: 'ltr',
                    }}
                  >
                    {spec.sizeLabel} px
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11.5 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>نسبت تصویر</span>
                    <strong style={{ color: 'var(--ink-800)', direction: 'ltr' }}>{spec.ratioLabel}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11.5 }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>حداقل پیشنهادی</span>
                    <span style={{ color: 'var(--ink-700)', direction: 'ltr' }}>
                      {isMobile ? '360 × 260' : '1200 × 270'}
                    </span>
                  </div>
                </div>
              </Col>
            )
          })}
        </Row>

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 14 }}
          message="قانون طلایی: تصویر موبایل، نسخهٔ جداگانه است"
          description={
            <div style={{ fontSize: 12, lineHeight: 1.9 }}>
              در فروشگاه، موبایل تصویر ۳۶۰×۲۶۰ خودش را می‌گیرد و دسکتاپ تصویر ۱۹۱۱×۴۳۰.
              این کار از برش شدن متن و CTA جلوگیری می‌کند. اگر تصویر موبایل خالی باشد،
              تصویر دسکتاپ با برش نمایش داده می‌شود و پنل هشدار می‌دهد.
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
                  description={`نسبت فعلی ${((previewDevice === 'mobile' ? mobileMeta : desktopMeta)?.width || 0)}×${((previewDevice === 'mobile' ? mobileMeta : desktopMeta)?.height || 0)} است؛ برای بهترین نتیجه از ${previewSpec.sizeLabel} استفاده کنید.`}
                />
              ) : null}

              <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                <BannerUploadCard
                  title="تصویر دسکتاپ"
                  subtitle="برای نمایشگرهای ۷۶۸ پیکسل به بالا"
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
                    subtitle="نسخهٔ مستقل با ترکیب‌بندی موبایل (نه برش دسکتاپ)"
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
    </div>
  )
}

export default BannersPage
