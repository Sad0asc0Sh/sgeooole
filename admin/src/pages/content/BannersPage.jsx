import { useEffect, useState } from 'react'
import {
  Card,
  Table,
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
} from 'antd'
import {
  InboxOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  PictureOutlined,
  LinkOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'

// فعال‌سازی تقویم جلالی
dayjs.extend(jalaliday)
dayjs.calendar('jalali')

// نام ماه‌های شمسی
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
    const time = jalaliDate.format('HH:mm')
    return `${day} ${month} ${year} - ${time}`
  }
  return `${day} ${month} ${year}`
}

// ============================================
// تنظیمات موقعیت بنرها - ابعاد دقیقاً مطابق فرانت‌اند
// ============================================
//
// ⚠️  مهم: این ابعاد باید دقیقاً با aspect-ratio های فرانت‌اند مطابقت داشته باشد
//     اگر ابعاد فرانت تغییر کرد، اینجا هم باید آپدیت شود
//
const BANNER_POSITIONS = {
  'main-slider': {
    label: '🖼️ اسلایدر اصلی',
    description: 'بنرهای بزرگ بالای صفحه اصلی',
    size: '1200×500 پیکسل',
    aspectRatio: '12:5 (2.4:1)',
    width: 1200,
    height: 500,
    minSize: '600×250 پیکسل',
    mobileTip: '✅ محتوا و متن مهم را در 80% مرکزی تصویر قرار دهید تا در موبایل هم کامل نمایش داده شود',
    color: 'blue',
    previewAspect: '12 / 5',
  },
  'middle-banner': {
    label: '📢 بنرهای تبلیغاتی',
    description: 'بنرهای میانه صفحه اصلی (حداکثر ۳ عدد)',
    size: '800×250 پیکسل',
    aspectRatio: '16:5 (3.2:1)',
    width: 800,
    height: 250,
    minSize: '400×125 پیکسل',
    mobileTip: '✅ در موبایل تمام عرض، در تبلت ۲ تا کنار هم، در دسکتاپ ۳ تا کنار هم نمایش داده می‌شود',
    color: 'orange',
    previewAspect: '16 / 5',
  },
  'campaign-banner': {
    label: '🎯 بنر کمپین',
    description: 'بنر ویژه کمپین و تخفیفات',
    size: '1200×400 پیکسل',
    aspectRatio: '3:1',
    width: 1200,
    height: 400,
    minSize: '600×200 پیکسل',
    mobileTip: '✅ متن مهم را در ناحیه امن مرکز بگذارید',
    color: 'purple',
    previewAspect: '3 / 1',
  },
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

const getBannerTargetMaxWidth = (position) => {
  const config = BANNER_POSITIONS[position]
  return config?.width || 1200
}

const getBannerMinWidth = (position) => {
  if (position === 'middle-banner') return 400
  return 600
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
    const img = new Image()
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

const optimizeBannerImageFile = async (file, position) => {
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

    const targetMaxWidth = getBannerTargetMaxWidth(position)
    const minWidth = getBannerMinWidth(position)
    let currentWidth = Math.max(1, Math.round(Math.min(sourceWidth, targetMaxWidth)))

    const qualities = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46]
    const maxPasses = 6

    let bestBlob = null
    let bestType = null

    const tryEncode = async (canvas, type, fillBackground) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      for (const quality of qualities) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (fillBackground) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height)

        const blob = await canvasToBlob(canvas, type, quality)
        if (!blob) continue

        const isBetter = !bestBlob || blob.size < bestBlob.size
        if (isBetter) {
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

      if ((webpOk || jpegOk) && bestBlob && bestBlob.size < file.size) {
        break
      }

      if (bestBlob && bestBlob.size <= RECOMMENDED_BANNER_UPLOAD_SIZE_BYTES && bestBlob.size < file.size) {
        break
      }

      if (currentWidth <= minWidth) {
        break
      }

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
      return `خطای 413 (Payload Too Large) دریافت شد، اما حجم فایل شما (${fileSizeMb}MB) کمتر از ${MAX_BANNER_UPLOAD_SIZE_MB}MB است. این خطا معمولاً به‌خاطر محدودیت آپلود در پراکسی/هاستینگ مسیر آپلود رخ می‌دهد.`
    }
  }
  if (status === 401) {
    return 'نشست شما منقضی شده است. دوباره وارد شوید.'
  }
  if (status === 403) {
    return 'دسترسی آپلود ندارید یا دامنه فعلی در CORS بک‌اند مجاز نیست.'
  }
  if (status === 413) {
    return `حجم تصویر بیشتر از حد مجاز است (حداکثر ${MAX_BANNER_UPLOAD_SIZE_MB} مگابایت).`
  }
  if (status === 415) {
    return 'فرمت فایل پشتیبانی نمی‌شود. فقط JPG/PNG/WEBP/GIF مجاز هستند.'
  }

  if (!err?.response && (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error')) {
    return 'اتصال به API برقرار نشد. CORS، SSL و آدرس API/Proxy را بررسی کنید.'
  }

  return serverMessage || 'خطا در ذخیره بنر'
}

const normalizeBaseUrl = (value) => {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('/')) {
    return trimmed.replace(/\/$/, '')
  }

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
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized)
    }
  }

  // 0) Build-time configured base (Vite env), in case runtime baseURL has been changed.
  push(import.meta?.env?.VITE_API_BASE_URL)

  // 1) Current configured base
  push(currentBaseUrl)

  // 2) Runtime same-origin fallbacks
  if (typeof window !== 'undefined') {
    const origin = window.location.origin
    push(`${origin}/api`)
    push(`${origin}/api-proxy`)
    push(`${origin}/.netlify/functions/api-proxy`)
  }

  // 3) Relative fallbacks (works for same-origin deployment)
  push('/api')
  push('/api-proxy')
  push('/.netlify/functions/api-proxy')

  return candidates
}

const shouldRetryWithAnotherBase = (err) => {
  if (!err?.response) return true
  const status = err.response.status
  return status === 404 || status === 413 || status === 502 || status === 503 || status === 504
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
  const [fileList, setFileList] = useState([])
  const [previewImage, setPreviewImage] = useState(null)
  const [selectedPosition, setSelectedPosition] = useState('main-slider')

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
        setPagination({
          current: pg.currentPage || page,
          pageSize,
          total: pg.totalItems || list.length,
        })
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
  // ستون‌های جدول با طراحی بهتر
  // ============================================
  const columns = [
    {
      title: '📷 تصویر',
      dataIndex: ['image', 'url'],
      key: 'image',
      width: 120,
      render: (url) =>
        url ? (
          <Image
            src={url}
            alt="بنر"
            width={100}
            height={50}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            preview={{ mask: <EyeOutlined /> }}
          />
        ) : (
          <div
            style={{
              width: 100,
              height: 50,
              background: '#f5f5f5',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
            }}
          >
            <PictureOutlined style={{ fontSize: 20 }} />
          </div>
        ),
    },
    {
      title: '📝 عنوان',
      dataIndex: 'title',
      key: 'title',
      render: (title) => <strong>{title || '—'}</strong>,
    },
    {
      title: '📍 موقعیت',
      dataIndex: 'position',
      key: 'position',
      width: 180,
      render: (pos) => {
        const config = BANNER_POSITIONS[pos] || { label: pos, color: 'default' }
        return (
          <Tooltip title={config.description}>
            <Tag color={config.color}>{config.label}</Tag>
          </Tooltip>
        )
      },
    },
    {
      title: '🔢 ترتیب',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
      align: 'center',
      render: (order) => (
        <Tag color="geekblue" style={{ fontWeight: 'bold' }}>
          {order ?? 0}
        </Tag>
      ),
    },
    {
      title: '🔗 لینک',
      dataIndex: 'link',
      key: 'link',
      width: 100,
      align: 'center',
      render: (link) =>
        link ? (
          <Tooltip title={link}>
            <a href={link} target="_blank" rel="noreferrer">
              <LinkOutlined style={{ fontSize: 18 }} />
            </a>
          </Tooltip>
        ) : (
          <span style={{ color: '#ccc' }}>—</span>
        ),
    },
    {
      title: '✅ وضعیت',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      align: 'center',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'error'} style={{ fontWeight: 'bold' }}>
          {isActive ? '✓ فعال' : '✗ غیرفعال'}
        </Tag>
      ),
    },
    {
      title: '📅 تاریخ',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => (
        <span style={{ fontSize: 12, color: '#666' }}>
          {formatPersianDate(date, false)}
        </span>
      ),
    },
    {
      title: '⚙️ عملیات',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title="ویرایش">
            <Button
              type="primary"
              ghost
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
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
  // عملیات‌ها
  // ============================================
  const handleTableChange = (pag) => {
    setPagination((prev) => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))
    fetchBanners(pag.current, pag.pageSize)
  }

  const handleNew = () => {
    setEditing(null)
    form.resetFields()
    setUploadingImage(false)
    setUploadProgress(0)
    setFileList([])
    setPreviewImage(null)
    setSelectedPosition('main-slider')
    form.setFieldsValue({
      position: 'main-slider',
      isActive: true,
      sortOrder: 0,
    })
    setModalOpen(true)
  }

  const handleEdit = (banner) => {
    setEditing(banner)
    setUploadingImage(false)
    setUploadProgress(0)
    setFileList([])
    setPreviewImage(banner.image?.url || null)
    setSelectedPosition(banner.position || 'main-slider')
    form.setFieldsValue({
      title: banner.title,
      link: banner.link,
      position: banner.position,
      isActive: banner.isActive,
      sortOrder: banner.sortOrder ?? 0,
      imageUrl: banner.image?.url,
    })
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

  const uploadBannerImage = async (file) => {
    const formData = new FormData()
    formData.append('image', file)
    const baseCandidates = buildUploadApiBaseCandidates(api?.defaults?.baseURL)
    let lastError = null

    for (const baseURL of baseCandidates) {
      try {
        const res = await api.post('/uploads/banner', formData, {
          baseURL,
          timeout: 180000, // 3 minutes for slow uploads
          onUploadProgress: (event) => {
            const total = event?.total || file?.size || 0
            if (!total) return
            const percent = Math.min(100, Math.max(1, Math.round((event.loaded * 100) / total)))
            setUploadProgress(percent)
          },
        })

        // Keep the successful base URL for subsequent requests in this session
        if (api?.defaults?.baseURL !== baseURL) {
          api.defaults.baseURL = baseURL
        }

        return res?.data?.data
      } catch (err) {
        err._uploadBaseURL = baseURL
        if (err?.response?.status === 413) {
          const headers = err?.response?.headers || {}
          const contentType = headers['content-type'] || headers['Content-Type'] || ''
          const server = headers.server || headers.Server || ''
          const data = err?.response?.data
          const snippet = typeof data === 'string' ? data.slice(0, 200) : data
          console.warn('[BANNER] Upload rejected with 413', { baseURL, server, contentType, snippet })
        }
        lastError = err
        if (!shouldRetryWithAnotherBase(err)) {
          throw err
        }
      }
    }

    throw lastError || new Error('Upload request failed on all API base URLs')
  }

  const handleSave = async () => {
    let uploadedImage = null
    let uploadFile = null

    try {
      const values = await form.validateFields()
      setSaving(true)
      setUploadingImage(false)
      setUploadProgress(0)

      const hasNewImageFile = fileList.length > 0 && fileList[0].originFileObj

      if (hasNewImageFile) {
        setUploadingImage(true)
        setUploadProgress(1)
        const originalFile = fileList[0].originFileObj
        uploadFile = await optimizeBannerImageFile(originalFile, selectedPosition)
        if (originalFile?.size && uploadFile?.size && originalFile.size !== uploadFile.size) {
          const beforeMb = formatBytesAsMb(originalFile.size)
          const afterMb = formatBytesAsMb(uploadFile.size)
          console.info('[BANNER] Image optimized before upload', {
            beforeMb,
            afterMb,
            beforeType: originalFile.type,
            afterType: uploadFile.type,
          })
        }
        uploadedImage = await uploadBannerImage(uploadFile)
        setUploadProgress(100)
      }

      const payload = {
        title: values.title,
        link: values.link || '',
        position: values.position,
        isActive: values.isActive !== undefined ? values.isActive : true,
        sortOrder: values.sortOrder ?? 0,
      }

      if (uploadedImage) {
        payload.image = uploadedImage
      } else if (values.imageUrl) {
        payload.image = { url: values.imageUrl }
      }

      if (editing) {
        await api.put(`/banners/${editing._id}`, payload)
        message.success('بنر با موفقیت ویرایش شد')
      } else {
        await api.post('/banners', payload)
        message.success('بنر جدید با موفقیت ایجاد شد')
      }

      setModalOpen(false)
      setEditing(null)
      setUploadingImage(false)
      setUploadProgress(0)
      fetchBanners()
    } catch (err) {
      if (!err?.errorFields) {
        if (uploadedImage?.public_id) {
          const encodedPublicId = encodeURIComponent(uploadedImage.public_id)
          api.delete(`/uploads/image/${encodedPublicId}`).catch(() => { })
        }

        message.error(resolveBannerSaveErrorMessage(err, { fileSizeBytes: uploadFile?.size || fileList?.[0]?.originFileObj?.size }))
      }
    } finally {
      setUploadingImage(false)
      setSaving(false)
    }
  }

  const handleUploadChange = ({ fileList: newFileList }) => {
    setFileList(newFileList)
    // Instant blob preview (replaces FileReader for zero-latency UX)
    if (newFileList.length > 0 && newFileList[0].originFileObj) {
      const blobUrl = URL.createObjectURL(newFileList[0].originFileObj)
      setPreviewImage(blobUrl)
    }
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

  // ============================================
  // UI اصلی
  // ============================================
  return (
    <div>
      {/* ============================================ */}
      {/* هدر صفحه */}
      {/* ============================================ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>🖼️ مدیریت بنرها</h1>
          <p style={{ margin: '4px 0 0', color: '#666' }}>
            بنرهای تبلیغاتی صفحه اصلی فروشگاه را از اینجا مدیریت کنید
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchBanners()}>
            بروزرسانی
          </Button>
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={handleNew}>
            افزودن بنر جدید
          </Button>
        </Space>
      </div>

      {/* ============================================ */}
      {/* راهنمای کامل ابعاد بنرها */}
      {/* ============================================ */}
      <Card
        size="small"
        style={{ marginBottom: 16, background: 'linear-gradient(135deg, #f0f5ff 0%, #e6f4ff 100%)', border: '1px solid #91caff' }}
        title={
          <Space>
            <PictureOutlined style={{ color: '#1677ff' }} />
            <span style={{ fontWeight: 'bold', fontSize: 14 }}>📐 راهنمای ابعاد بنرها — سازگار با موبایل و دسکتاپ</span>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          {Object.entries(BANNER_POSITIONS).map(([key, config]) => {
            const borderColor = config.color === 'blue' ? '#1677ff' : config.color === 'orange' ? '#fa8c16' : '#722ed1'
            const bgGradient = config.color === 'blue'
              ? 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)'
              : config.color === 'orange'
                ? 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 100%)'
                : 'linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%)'
            return (
              <Col xs={24} md={8} key={key}>
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: 16,
                    border: `2px solid ${borderColor}`,
                    height: '100%',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  <div style={{ marginBottom: 10 }}>
                    <Tag color={config.color} style={{ fontSize: 14, padding: '4px 12px', fontWeight: 'bold' }}>
                      {config.label}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
                    {config.description}
                  </div>

                  {/* پیش‌نمایش بصری نسبت تصویر */}
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: config.previewAspect,
                      background: bgGradient,
                      border: `2px dashed ${borderColor}`,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* ناحیه امن مرکزی */}
                    <div
                      style={{
                        width: '80%',
                        height: '80%',
                        border: '1px dashed rgba(0,0,0,0.15)',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <PictureOutlined style={{ fontSize: 20, color: borderColor, opacity: 0.6 }} />
                      <span style={{ fontSize: 10, color: '#999' }}>ناحیه امن محتوا</span>
                    </div>
                    <span style={{
                      position: 'absolute',
                      bottom: 4,
                      left: 4,
                      fontSize: 9,
                      color: '#aaa',
                      background: 'rgba(255,255,255,0.7)',
                      padding: '1px 4px',
                      borderRadius: 3,
                    }}>
                      {config.size}
                    </span>
                  </div>

                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', fontSize: 11 }}>🎯 سایز ایده‌آل:</span>
                      <strong style={{ fontSize: 13, color: '#1677ff' }}>{config.size}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', fontSize: 11 }}>📏 نسبت تصویر:</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#333' }}>{config.aspectRatio}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#888', fontSize: 11 }}>📉 حداقل سایز:</span>
                      <span style={{ fontSize: 12, color: '#fa541c', fontWeight: 500 }}>{config.minSize}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, padding: '8px 10px', background: '#f6ffed', borderRadius: 6, fontSize: 11, color: '#389e0d', border: '1px solid #b7eb8f' }}>
                    {config.mobileTip}
                  </div>
                </div>
              </Col>
            )
          })}
        </Row>

        {/* راهنمای سازگاری پلتفرم‌ها */}
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #d9d9d9',
          }}
        >
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 'bold' }}>📱💻 راهنمای سازگاری موبایل و دسکتاپ</h4>
          <Row gutter={[16, 12]}>
            <Col xs={24} md={12}>
              <div style={{ padding: 12, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f', height: '100%' }}>
                <div style={{ fontWeight: 'bold', color: '#389e0d', marginBottom: 8, fontSize: 13 }}>✅ بایدها</div>
                <ul style={{ margin: 0, paddingRight: 18, fontSize: 12, lineHeight: 2.2, color: '#333' }}>
                  <li>تصویر را <strong>دقیقاً با ابعاد ایده‌آل</strong> بالا طراحی کنید</li>
                  <li>فرمت <strong>WebP</strong> یا <strong>JPG</strong> با کیفیت 80% استفاده کنید</li>
                  <li>حجم فایل <strong>زیر 500KB</strong> ایده‌آل است (حداکثر 2MB)</li>
                  <li>متن و لوگو را در <strong>80% مرکزی</strong> تصویر قرار دهید</li>
                  <li>از <strong>پس‌زمینه ساده</strong> در حاشیه‌ها استفاده کنید</li>
                  <li>قبل از آپلود، تصویر را در <strong>موبایل تست</strong> کنید</li>
                </ul>
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div style={{ padding: 12, background: '#fff2f0', borderRadius: 8, border: '1px solid #ffccc7', height: '100%' }}>
                <div style={{ fontWeight: 'bold', color: '#cf1322', marginBottom: 8, fontSize: 13 }}>❌ نبایدها</div>
                <ul style={{ margin: 0, paddingRight: 18, fontSize: 12, lineHeight: 2.2, color: '#333' }}>
                  <li>از تصاویر <strong>با نسبت ابعاد نادرست</strong> استفاده نکنید</li>
                  <li>متن مهم را <strong>در گوشه‌ها</strong> قرار ندهید (در موبایل بریده می‌شود)</li>
                  <li>از تصاویر <strong>خیلی سنگین</strong> (بالای 2MB) استفاده نکنید</li>
                  <li>از فرمت <strong>BMP یا TIFF</strong> استفاده نکنید</li>
                  <li>تصاویر <strong>خیلی باریک یا خیلی بلند</strong> آپلود نکنید</li>
                  <li>از تصاویر با <strong>DPI بالا (300+)</strong> استفاده نکنید</li>
                </ul>
              </div>
            </Col>
          </Row>
        </div>

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          message="💡 نکته سریع: ابعاد بنر را چگونه تنظیم کنیم؟"
          description={
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <p style={{ margin: 0 }}>
                <strong>ویندوز:</strong> تصویر را در Paint باز کنید → Resize → به پیکسل تغییر دهید → ابعاد ایده‌آل را وارد کنید
              </p>
              <p style={{ margin: 0 }}>
                <strong>مک / لینوکس:</strong> تصویر را در Preview باز کنید → Tools → Adjust Size → ابعاد را وارد کنید
              </p>
              <p style={{ margin: 0 }}>
                <strong>آنلاین (رایگان):</strong>{' '}
                <a href="https://www.iloveimg.com/resize-image" target="_blank" rel="noreferrer">iloveimg.com</a> یا{' '}
                <a href="https://squoosh.app" target="_blank" rel="noreferrer">squoosh.app</a> (برای فشرده‌سازی + تغییر سایز)
              </p>
              <p style={{ margin: '4px 0 0', color: '#666' }}>
                فرمت‌های مجاز: <Tag>JPG</Tag> <Tag>PNG</Tag> <Tag color="green">WEBP ⭐</Tag>
              </p>
            </div>
          }
        />
      </Card>

      {/* ============================================ */}
      {/* فیلتر و جدول */}
      {/* ============================================ */}
      <Card
        title={
          <Space>
            <span>📋 لیست بنرها</span>
            <Tag color="blue">{pagination.total} بنر</Tag>
          </Space>
        }
        extra={
          <Select
            placeholder="فیلتر بر اساس موقعیت"
            allowClear
            style={{ width: 220 }}
            value={positionFilter}
            onChange={setPositionFilter}
          >
            {Object.entries(BANNER_POSITIONS).map(([key, config]) => (
              <Select.Option key={key} value={key}>
                {config.label}
              </Select.Option>
            ))}
          </Select>
        }
      >
        <Table
          columns={columns}
          dataSource={banners}
          loading={loading}
          rowKey="_id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `مجموع: ${total} بنر`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="هیچ بنری یافت نشد"
              />
            ),
          }}
        />
      </Card>

      {/* ============================================ */}
      {/* مودال ایجاد/ویرایش */}
      {/* ============================================ */}
      <Modal
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setUploadingImage(false)
          setUploadProgress(0)
        }}
        onOk={handleSave}
        okText={editing ? '💾 ذخیره تغییرات' : '✅ ایجاد بنر'}
        cancelText="انصراف"
        confirmLoading={saving}
        title={
          <span style={{ fontSize: 18 }}>
            {editing ? '✏️ ویرایش بنر' : '➕ افزودن بنر جدید'}
          </span>
        }
        width={800}
        centered
      >
        <Divider style={{ margin: '12px 0' }} />

        <Form layout="vertical" form={form} requiredMark="optional">
          <Row gutter={16}>
            {/* ستون چپ - اطلاعات */}
            <Col span={14}>
              <Form.Item
                name="title"
                label="📝 عنوان بنر"
                rules={[{ required: true, message: 'لطفاً عنوان را وارد کنید' }]}
                tooltip="عنوان داخلی برای شناسایی بنر"
              >
                <Input placeholder="مثال: بنر تخفیف نوروزی" size="large" />
              </Form.Item>

              <Form.Item
                name="link"
                label="🔗 لینک (اختیاری)"
                tooltip="آدرسی که کاربر با کلیک روی بنر به آن منتقل می‌شود"
              >
                <Input placeholder="https://example.com/products" size="large" dir="ltr" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="position"
                    label="📍 موقعیت نمایش"
                    rules={[{ required: true, message: 'موقعیت را انتخاب کنید' }]}
                  >
                    <Select
                      size="large"
                      onChange={(val) => setSelectedPosition(val)}
                    >
                      {Object.entries(BANNER_POSITIONS).map(([key, config]) => (
                        <Select.Option key={key} value={key}>
                          <div>
                            <div>{config.label}</div>
                            <div style={{ fontSize: 11, color: '#999' }}>
                              {config.size} • {config.aspectRatio}
                            </div>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="sortOrder"
                    label="🔢 ترتیب نمایش"
                    tooltip="عدد کمتر = نمایش زودتر"
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      size="large"
                      style={{ width: '100%' }}
                      placeholder="0"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="isActive"
                label="✅ وضعیت فعال"
                valuePropName="checked"
              >
                <Switch
                  checkedChildren="فعال"
                  unCheckedChildren="غیرفعال"
                  defaultChecked
                />
              </Form.Item>
            </Col>

            {/* ستون راست - تصویر + پیش‌نمایش هوشمند */}
            <Col span={10}>
              {/* پیش‌نمایش بصری نسبت تصویر موقعیت انتخابی */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
                  border: '1px solid #91d5ff',
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: 10, color: '#0050b3', fontSize: 13 }}>
                  📐 پیش‌نمایش ابعاد «{BANNER_POSITIONS[selectedPosition]?.label}»
                </div>

                {/* شبیه‌سازی بصری نسبت ابعاد */}
                <div
                  style={{
                    width: '100%',
                    aspectRatio: BANNER_POSITIONS[selectedPosition]?.previewAspect || '12 / 5',
                    background: previewImage
                      ? `url(${previewImage}) center/cover no-repeat`
                      : 'linear-gradient(135deg, #f0f0f0 25%, #e8e8e8 25%, #e8e8e8 50%, #f0f0f0 50%, #f0f0f0 75%, #e8e8e8 75%)',
                    backgroundSize: previewImage ? 'cover' : '20px 20px',
                    borderRadius: 8,
                    border: '2px dashed #91d5ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    marginBottom: 10,
                  }}
                >
                  {!previewImage && (
                    <div style={{ textAlign: 'center', color: '#999' }}>
                      <PictureOutlined style={{ fontSize: 28, opacity: 0.4 }} />
                      <div style={{ fontSize: 10, marginTop: 4 }}>تصویر را آپلود کنید</div>
                    </div>
                  )}
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      right: 4,
                      fontSize: 10,
                      background: 'rgba(0,0,0,0.5)',
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {BANNER_POSITIONS[selectedPosition]?.size}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>🎯 سایز ایده‌آل:</span>
                    <strong style={{ color: '#1677ff' }}>
                      {BANNER_POSITIONS[selectedPosition]?.size}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>📏 نسبت:</span>
                    <span style={{ fontWeight: 500 }}>{BANNER_POSITIONS[selectedPosition]?.aspectRatio}</span>
                  </div>
                </div>
              </div>

              <Form.Item label="📷 تصویر بنر">
                <Upload.Dragger
                  beforeUpload={beforeUploadBanner}
                  fileList={fileList}
                  onChange={handleUploadChange}
                  maxCount={1}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={saving}
                  style={{
                    borderRadius: 10,
                    border: '2px dashed #1890ff',
                    background: '#fafafa',
                  }}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ fontSize: 36, color: '#1890ff' }} />
                  </p>
                  <p className="ant-upload-text" style={{ fontWeight: 'bold', fontSize: 13 }}>
                    تصویر بنر را اینجا رها کنید یا کلیک کنید
                  </p>
                  <p className="ant-upload-hint" style={{ fontSize: 11, color: '#666' }}>
                    ابعاد ایده‌آل: <strong style={{ color: '#1677ff' }}>{BANNER_POSITIONS[selectedPosition]?.size}</strong>
                  </p>
                  <p className="ant-upload-hint" style={{ fontSize: 10, color: '#999' }}>
                    JPG, PNG, WEBP • حداکثر 10MB (پیشنهادی: زیر 2MB)
                  </p>
                </Upload.Dragger>

                {uploadingImage && (
                  <div style={{ marginTop: 12 }}>
                    <Progress
                      percent={uploadProgress}
                      size="small"
                      status={uploadProgress < 100 ? 'active' : 'success'}
                    />
                    <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                      {uploadProgress < 100
                        ? `در حال ارسال فایل به سرور: ${uploadProgress}%`
                        : 'فایل ارسال شد، در حال پردازش روی سرور...'}
                    </div>
                  </div>
                )}
              </Form.Item>

              <Form.Item
                name="imageUrl"
                label="🌐 یا آدرس تصویر"
                tooltip="اگر تصویر آپلود نکردید، آدرس را وارد کنید"
              >
                <Input placeholder="https://..." size="large" dir="ltr" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default BannersPage
