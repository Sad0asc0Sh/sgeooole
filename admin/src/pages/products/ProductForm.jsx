import PageHeader from '../../components/ui/PageHeader'
import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  Card,
  Form,
  Input,
  InputNumber,
  TreeSelect,
  Select,
  Button,
  Upload,
  Tabs,
  message,
  Spin,
  Space,
  Table,
  Popconfirm,
  Tag,
  Divider,
  Alert,
  Checkbox,
  Tooltip,
  Switch,
  Row,
  Col,
} from 'antd'
import {
  InboxOutlined,
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  TagOutlined,
  ClockCircleOutlined,
  FireOutlined,
  PercentageOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import RichTextEditor from '../../components/RichTextEditor'
import { sanitizeAdminHtml } from '../../utils/htmlSanitizer'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCategoryStore, useBrandStore } from '../../stores'
import api from '../../api'
import { createBlobPreview, createProductImageVariants } from '../../utils/imageOptimizer'
import { parseNumericInput, formatCurrency, formatNumber } from '../../utils/formatters'
import { formatPersianDate } from '../../utils/dateUtils'
import {
  calculateDiscountPricing,
  calculatePercentFromFinalPrice,
  FIXED_PROMOTION_THEMES,
} from '../../utils/promotionPricing'
import PromotionBadgePreview from '../../components/promotions/PromotionBadgePreview'
import { normSpecKey } from '../../utils/specKey'
import JalaliDateTimePicker from '../../components/JalaliDateTimePicker'

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'], // toggled buttons
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }], // outdent/indent
    [{ direction: 'rtl' }], // text direction
    [{ color: [] }, { background: [] }], // dropdown with defaults from theme
    ['link', 'image', 'video'],
    ['clean'], // remove formatting button
  ],
}

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'align', 'list', 'indent',
  'direction',
  'color', 'background',
  'link', 'image', 'video',
]

function ProductForm() {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState([])
  const [uploadingCount, setUploadingCount] = useState(0) // Track uploading images

  // ============================================
  // State جدید برای محصولات متغیر
  // ============================================
  const [productType, setProductType] = useState('simple')
  const [attributes, setAttributes] = useState([]) // [{name, values: []}]
  const [variants, setVariants] = useState([]) // [{sku, price, stock, options: [{name, value}]}]

  // برای افزودن ویژگی جدید
  const [newAttributeName, setNewAttributeName] = useState('')
  const [newAttributeValues, setNewAttributeValues] = useState('')

  // قیمت پایه‌ی متغیرها: یک‌بار وارد می‌شود و فقط تفاوت‌ها اصلاح می‌شوند
  const [basePrice, setBasePrice] = useState(0)

  // ============================================
  // State برای فروش ویژه و تایمر
  // ============================================
  const [discount, setDiscount] = useState(0)
  const [isFlashDeal, setIsFlashDeal] = useState(false)
  const [flashDealEndTime, setFlashDealEndTime] = useState('')
  const [isSpecialOffer, setIsSpecialOffer] = useState(false)
  const [specialOfferEndTime, setSpecialOfferEndTime] = useState('')
  const [campaignLabel, setCampaignLabel] = useState('')
  const [campaignTheme, setCampaignTheme] = useState('')
  const [isFromActiveSale, setIsFromActiveSale] = useState(false)
  const [removedImages, setRemovedImages] = useState([])

  // ============================================
  // State برای مشخصات فنی پویا (Dynamic Specifications)
  // ============================================
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [specs, setSpecs] = useState({}) // { propertyName: value }
  // فیلدهای «افزودن مشخصه دلخواه»
  const [newSpecLabel, setNewSpecLabel] = useState('')
  const [newSpecValue, setNewSpecValue] = useState('')

  // ============================================
  // استخراج خودکار جدول «مشخصات فنی» از متن توضیحات
  // ============================================
  const SPEC_HEADING_RE = /مشخصات\s*فنی|جدول\s*مشخصات|مشخصات\s*محصول/

  const extractSpecsFromDescriptionHtml = (html) => {
    if (!html || typeof window === 'undefined') return { rows: [], html }
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const rows = []
    let changed = false

    Array.from(doc.body.querySelectorAll('table')).forEach((table) => {
      const previous = table.previousElementSibling
      const previousText = previous ? (previous.textContent || '').replace(/\s+/g, ' ').trim() : ''
      const ownText = (table.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)
      if (!SPEC_HEADING_RE.test(previousText) && !SPEC_HEADING_RE.test(ownText)) return

      Array.from(table.querySelectorAll('tr')).forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('th,td'))
        if (cells.length < 2) return
        const label = (cells[0].textContent || '').trim()
        const value = (cells[1].textContent || '').trim()
        if (label && value) rows.push({ label, value })
      })

      const parent = table.parentElement
      const heading = previous && /^H[1-6]$/.test(previous.tagName) ? previous : null
      if (heading) heading.remove()
      table.remove()
      changed = true
      // اگر کانتینر بعد از حذف خالی شد، خودش هم حذف شود (باکس سفید خالی)
      if (parent && parent !== doc.body && !(parent.textContent || '').replace(/\s+/g, ' ').trim()) {
        parent.remove()
      }
    })

    // کامنت باقی‌مانده‌ی Technical Specifications
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT)
    const comments = []
    while (walker.nextNode()) {
      if (/Technical\s+Specifications|مشخصات\s*فنی/i.test(walker.currentNode.nodeValue || '')) {
        comments.push(walker.currentNode)
      }
    }
    comments.forEach((node) => { node.remove(); changed = true })

    return { rows, html: changed ? doc.body.innerHTML.trim() : html }
  }

  // ادغام بدون تکرار بر اساس کلید مترادف‌ها (فرکانس ریموت == فرکانس کاری)
  const mergeSpecs = (base, rows) => {
    const next = { ...base }
    let added = 0
    rows.forEach(({ label, value }) => {
      const key = normSpecKey(label)
      const exists = Object.keys(next).some((existing) => normSpecKey(existing) === key)
      if (exists) return
      next[label] = value
      added += 1
    })
    return { next, added }
  }

  const handleAutoExtractSpecs = () => {
    const html = form.getFieldValue('description') || ''
    const { rows, html: cleanedHtml } = extractSpecsFromDescriptionHtml(html)
    if (rows.length === 0) {
      message.info('جدول «مشخصات فنی» در متن توضیحات پیدا نشد.')
      return
    }
    const { next, added } = mergeSpecs(specs, rows)
    setSpecs(next)
    form.setFieldValue('description', cleanedHtml)
    message.success(`${added} مشخصه استخراج و جدول از توضیحات حذف شد.`)
  }

  // استخراج آنی و بدون کلیک: به‌محض Paste شدن قالب HTML در توضیحات
  const handleDescriptionChange = useCallback((newHtml) => {
    const html = String(newHtml || '')
    if (!html) return
    const hasSpecTable = /<table\b[\s\S]*?<\/table>/i.test(html)
      && /مشخصات\s*فنی|جدول\s*مشخصات|مشخصات\s*محصول/i.test(html)
    if (!hasSpecTable) return

    const { rows, html: cleanedHtml } = extractSpecsFromDescriptionHtml(html)
    if (rows.length === 0) return

    setSpecs((prev) => mergeSpecs(prev, rows).next)
    if (cleanedHtml !== html) form.setFieldValue('description', cleanedHtml)
    message.success(
      `✨ ${rows.length} مشخصه فنی به‌طور خودکار از قالب توضیحات استخراج و در سیستم فیلترینگ ثبت شد.`,
    )
  }, [form])

  const descriptionValue = Form.useWatch('description', form)
  const watchedPrice = Form.useWatch('price', form)
  useEffect(() => {
    handleDescriptionChange(descriptionValue)
  }, [descriptionValue, handleDescriptionChange])

  const handleAddCustomSpec = () => {
    const label = newSpecLabel.trim()
    const value = newSpecValue.trim()
    if (!label || !value) {
      message.warning('نام و مقدار مشخصه را وارد کنید.')
      return
    }
    const { next } = mergeSpecs(specs, [{ label, value }])
    setSpecs(next)
    setNewSpecLabel('')
    setNewSpecValue('')
  }

  // Category store (Zustand)
  const categoriesTree = useCategoryStore((state) => state.categoriesTree)
  const categoriesLoading = useCategoryStore((state) => state.loading)

  // Brand store (Zustand)
  const brands = useBrandStore((state) => state.brands)
  const brandsLoading = useBrandStore((state) => state.loading)

  // ============================================
  // یافتن ویژگی‌های دسته‌بندی انتخاب‌شده (Category Properties)
  // ============================================
  const flattenCategories = (tree, result = []) => {
    tree.forEach(cat => {
      result.push(cat)
      if (cat.children && cat.children.length > 0) {
        flattenCategories(cat.children, result)
      }
    })
    return result
  }

  const allCategories = useMemo(() => flattenCategories(categoriesTree), [categoriesTree])

  const selectedCategoryData = useMemo(() => {
    if (!selectedCategoryId) return null
    return allCategories.find(c => c._id === selectedCategoryId || c.key === selectedCategoryId)
  }, [selectedCategoryId, allCategories])

  const categoryProperties = selectedCategoryData?.properties || []

  // Helper: map product.images from API to AntD Upload fileList
  const toFileList = (images) => {
    if (!Array.isArray(images)) return []
    return images
      .map((img, index) => {
        const url = typeof img === 'string' ? img : img?.url
        const public_id =
          img && typeof img === 'object' && img.public_id ? img.public_id : undefined
        const cardUrl =
          img && typeof img === 'object' && img.cardUrl ? img.cardUrl : undefined
        if (!url) return null
        return {
          uid: String(index),
          name: `image-${index + 1}`,
          status: 'done',
          url,
          cardUrl,
          public_id,
        }
      })
      .filter(Boolean)
  }

  // Load product for edit mode
  useEffect(() => {
    if (!isEdit) return
      ; (async () => {
        setLoading(true)
        try {
          // ✅ FIX: Use skipDiscount=true to get raw product data without discount calculation
          // This ensures we get the original price, not the discounted price
          // Add timestamp to bypass cache and get fresh data
          const res = await api.get(`/products/${id}?skipDiscount=true&_t=${Date.now()}`)
          const p = res?.data?.data
          if (p) {
            // Extract IDs from populated category and brand objects
            const categoryId = typeof p.category === 'object' && p.category ? p.category._id : p.category
            const brandId = typeof p.brand === 'object' && p.brand ? p.brand._id : p.brand

            form.setFieldsValue({
              name: p.name,
              sku: p.sku,
              price: p.price,
              compareAtPrice: p.compareAtPrice || undefined,
              stock: p.stock,
              category: categoryId,
              brand: brandId,
              description: (() => {
                if (!p.description) return '';
                try {
                  const cleanDesc = sanitizeAdminHtml(p.description);
                  const txt = document.createElement("textarea");
                  txt.innerHTML = cleanDesc;
                  return txt.value;
                } catch (e) {
                  return sanitizeAdminHtml(p.description);
                }
              })(),
              productType: p.productType || 'simple',
            })
            setFiles(toFileList(p.images))
            setProductType(p.productType || 'simple')
            setAttributes(p.attributes || [])
            setVariants(p.variants || [])
            // قیمت پایه را از ارزان‌ترین متغیر موجود مقداردهی کن تا تگ‌های تفاوت درست نمایش داده شوند
            if (Array.isArray(p.variants) && p.variants.length > 0) {
              const prices = p.variants.map((v) => Number(v.price) || 0).filter((n) => n > 0)
              if (prices.length > 0) setBasePrice(Math.min(...prices))
            }

            // Load promotion fields (ISO strings for JalaliDateTimePicker)
            const now = new Date()
            const flashExpired = Boolean(p.isFlashDeal && p.flashDealEndTime && new Date(p.flashDealEndTime) <= now)
            const specialExpired = Boolean(p.isSpecialOffer && p.specialOfferEndTime && new Date(p.specialOfferEndTime) <= now)

            const liveFlash = Boolean(p.isFlashDeal && !flashExpired)
            const liveSpecial = Boolean(p.isSpecialOffer && !specialExpired)

            // اگر منقضی شده یا هر دو غیرفعال‌اند، تخفیف صفر و فیلدهای کمپین خاموش می‌شوند
            setIsFlashDeal(liveFlash)
            setFlashDealEndTime(liveFlash ? (p.flashDealEndTime || '') : '')
            setIsSpecialOffer(liveSpecial)
            setSpecialOfferEndTime(liveSpecial ? (p.specialOfferEndTime || '') : '')
            setDiscount((liveFlash || liveSpecial) ? (p.discount || 0) : 0)
            setCampaignLabel((liveFlash || liveSpecial) ? (p.campaignLabel || '') : '')
            setCampaignTheme((liveFlash || liveSpecial) ? (p.campaignTheme || '') : '')
            setIsFromActiveSale(p.isFromActiveSale || false)

            if (flashExpired || specialExpired) {
              message.info('کمپین تخفیف این محصول منقضی شده بود و به طور هوشمند غیرفعال شد.')
            }

            // Load specs: specifications (full text) first, then properties only
            // for labels that are not already present (synonym-aware).
            const specsObj = {}
            if (p.specifications && typeof p.specifications === 'object' && !Array.isArray(p.specifications)) {
              Object.entries(p.specifications).forEach(([label, value]) => {
                if (value !== null && value !== undefined && String(value).trim() !== '') {
                  specsObj[label] = String(value)
                }
              })
            }
            if (p.properties && Array.isArray(p.properties)) {
              p.properties.forEach(prop => {
                if (!prop || !prop.label || prop.value === undefined) return
                const key = normSpecKey(prop.label)
                const exists = Object.keys(specsObj).some((existing) => normSpecKey(existing) === key)
                if (!exists) specsObj[prop.label] = prop.value
              })
            }
            setSpecs(specsObj)

            // Set selected category for dynamic properties
            if (p.category) {
              setSelectedCategoryId(typeof p.category === 'object' ? p.category._id : p.category)
            }
          }
        } catch (err) {
          message.error(
            err?.message || 'خطا در دریافت اطلاعات محصول از سرور',
          )
        } finally {
          setLoading(false)
        }
      })()
  }, [id, isEdit, form])

  // Check for existing global Special Offer and Flash Deal timers
  const [activeGlobalOfferTime, setActiveGlobalOfferTime] = useState(null);
  const [activeGlobalFlashDealTime, setActiveGlobalFlashDealTime] = useState(null);

  useEffect(() => {
    const fetchGlobalTimers = async () => {
      try {
        const nowIso = new Date().toISOString();
        const [resOffer, resFlash] = await Promise.all([
          api.get(`/products?isSpecialOffer=true&specialOfferEndTime[gt]=${nowIso}&limit=1&fields=specialOfferEndTime&nocache=true`),
          api.get(`/products?isFlashDeal=true&flashDealEndTime[gt]=${nowIso}&limit=1&fields=flashDealEndTime&nocache=true`)
        ]);

        const activeOffer = resOffer?.data?.data?.[0];
        if (activeOffer?.specialOfferEndTime) setActiveGlobalOfferTime(activeOffer.specialOfferEndTime);

        const activeFlash = resFlash?.data?.data?.[0];
        if (activeFlash?.flashDealEndTime) setActiveGlobalFlashDealTime(activeFlash.flashDealEndTime);
      } catch (err) {
        console.error("Failed to check global offer times", err);
      }
    };

    fetchGlobalTimers();
  }, []);

  // ============================================
  // مدیریت ویژگی‌ها (Attributes)
  // ============================================
  const handleAddAttribute = () => {
    if (!newAttributeName.trim()) {
      message.warning('نام ویژگی را وارد کنید')
      return
    }
    if (!newAttributeValues.trim()) {
      message.warning('مقادیر ویژگی را وارد کنید')
      return
    }

    const values = newAttributeValues
      .split(/[,،]/)
      .map((v) => v.trim())
      .filter(Boolean)

    if (values.length === 0) {
      message.warning('حداقل یک مقدار برای ویژگی وارد کنید')
      return
    }

    setAttributes([...attributes, { name: newAttributeName, values }])
    setNewAttributeName('')
    setNewAttributeValues('')
    message.success('ویژگی اضافه شد')
  }

  const handleRemoveAttribute = (index) => {
    const newAttrs = [...attributes]
    newAttrs.splice(index, 1)
    setAttributes(newAttrs)
    message.success('ویژگی حذف شد')
  }

  // ============================================
  // تولید خودکار متغیرها از ویژگی‌ها با حفظ قیمت و موجودی قبلی
  // ============================================
  const generateVariants = () => {
    if (attributes.length === 0) {
      message.warning('ابتدا ویژگی‌هایی تعریف کنید')
      return
    }

    // محاسبه ترکیبات (Cartesian Product)
    const combinations = attributes.reduce(
      (acc, attr) => {
        const newCombinations = []
        acc.forEach((combination) => {
          attr.values.forEach((value) => {
            newCombinations.push([
              ...combination,
              { name: attr.name, value },
            ])
          })
        })
        return newCombinations
      },
      [[]],
    )

    // ساخت متغیرها با حفظ قیمت و موجودی متغیرهای از قبل موجود
    const newVariants = combinations.map((options, index) => {
      const existing = variants.find((oldV) =>
        Array.isArray(oldV.options) &&
        oldV.options.length === options.length &&
        oldV.options.every((oldOpt) =>
          options.some(
            (opt) => opt.name === oldOpt.name && opt.value === oldOpt.value,
          ),
        ),
      )

      return {
        _id: existing?._id || `variant-${Date.now()}-${index}`,
        sku: existing?.sku || '',
        price: existing?.price ?? basePrice,
        stock: existing?.stock ?? 0,
        options,
        images: existing?.images || [],
        // حفظ تیک تخفیف متغیر موجود؛ متغیر جدید默认 شامل تخفیف است
        excludeFromPromotion: existing?.excludeFromPromotion === true,
      }
    })

    setVariants(newVariants)
    message.success(`${newVariants.length} متغیر ایجاد شد`)
  }

  // ============================================
  // جدول متغیرها (با امکان ویرایش)
  // ============================================
  const handleVariantChange = (id, field, value) => {
    setVariants((prev) =>
      prev.map((v) => (v._id === id ? { ...v, [field]: value } : v)),
    )
  }

  const variantColumns = [
    {
      title: 'گزینه‌ها',
      dataIndex: 'options',
      key: 'options',
      render: (options) =>
        options.map((opt, i) => (
          <Tag key={i} color="blue">
            {opt.name}: {opt.value}
          </Tag>
        )),
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 150,
      render: (text, record) => (
        <Input
          value={text}
          onChange={(e) =>
            handleVariantChange(record._id, 'sku', e.target.value)
          }
          placeholder="SKU"
        />
      ),
    },
    {
      title: 'قیمت (تومان)',
      dataIndex: 'price',
      key: 'price',
      width: 200,
      render: (text, record) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <InputNumber
            value={text}
            onChange={(value) =>
              handleVariantChange(record._id, 'price', value)
            }
            min={0}
            style={{ width: '100%' }}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={parseNumericInput}
          />
          {record.price !== basePrice && basePrice > 0 && (
            <Tag color={record.price > basePrice ? 'orange' : 'green'}>
              {record.price > basePrice ? '+' : '−'}{Math.abs(record.price - basePrice).toLocaleString('fa-IR')}
            </Tag>
          )}
          {(isFlashDeal || isSpecialOffer) &&
            discount > 0 &&
            record.excludeFromPromotion !== true &&
            Number(record.price) > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--ok)', fontWeight: 600 }}>
                نهایی: {formatCurrency(calculateDiscountPricing(record.price, discount).finalPrice)} (
                {formatNumber(discount)}٪-)
              </div>
            )}
        </Space>
      ),
    },
    {
      title: 'موجودی',
      dataIndex: 'stock',
      key: 'stock',
      width: 120,
      render: (text, record) => (
        <InputNumber
          value={text}
          onChange={(value) =>
            handleVariantChange(record._id, 'stock', value)
          }
          min={0}
          style={{ width: '100%' }}
          parser={parseNumericInput}
        />
      ),
    },
    {
      title: 'تخفیف',
      key: 'promotion',
      width: 130,
      render: (_, record) => (
        <Tooltip title="تیک روشن = تخفیف روی این متغیر اعمال می‌شود؛ خاموش = این متغیر از تخفیف مستثنی می‌شود">
          <Checkbox
            checked={record.excludeFromPromotion !== true}
            onChange={(e) =>
              handleVariantChange(record._id, 'excludeFromPromotion', !e.target.checked)
            }
          >
            فعال
          </Checkbox>
        </Tooltip>
      ),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="حذف این متغیر؟"
          onConfirm={() =>
            setVariants((prev) => prev.filter((v) => v._id !== record._id))
          }
          okText="حذف"
          cancelText="انصراف"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />}>
            حذف
          </Button>
        </Popconfirm>
      ),
    },
  ]

  // ============================================
  // آپلود فوری تصاویر (Immediate Upload)
  // ============================================
  const handleImmediateUpload = async (file) => {
    // Generate a unique ID for tracking
    const uid = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // ── Instant blob preview (zero-latency UX) ──
    const blobUrl = createBlobPreview(file)

    const newFile = {
      uid,
      name: file.name,
      status: 'uploading',
      originFileObj: file,
      percent: 0,
      // Show local blob immediately — no white flash
      url: blobUrl,
      thumbUrl: blobUrl,
    }

    setFiles(prev => [...prev, newFile])
    setUploadingCount(prev => prev + 1)

    try {
      // ── Dual-tier variants (1200px main + 420px card WebP) ──
      const { mainFile, cardFile } = await createProductImageVariants(file)

      const formData = new FormData()
      formData.append('image', mainFile)
      if (cardFile) {
        formData.append('cardImage', cardFile)
      }

      const response = await api.post('/uploads/image', formData, {
        timeout: 180000, // 3 minutes for slow connections
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setFiles(prev => prev.map(f =>
            f.uid === uid ? { ...f, percent } : f
          ))
        }
      })

      if (response.data.success) {
        const { url, cardUrl, public_id } = response.data.data
        // ── Smooth transition: blob preview → permanent S3 URL ──
        // Preload the S3 image in the background before swapping
        const s3Img = new window.Image()
        s3Img.src = url

        setFiles(prev => prev.map(f =>
          f.uid === uid ? {
            ...f,
            status: 'done',
            url,
            cardUrl: cardUrl || url,
            public_id,
            thumbUrl: url,
            percent: 100,
          } : f
        ))

        // Revoke the blob URL to free memory
        if (blobUrl) URL.revokeObjectURL(blobUrl)

        message.success(`تصویر ${file.name} آپلود شد`)
      } else {
        throw new Error(response.data.message || 'خطا در آپلود')
      }
    } catch (error) {
      console.error('Upload error:', error)
      // Mark as error
      setFiles(prev => prev.map(f =>
        f.uid === uid ? { ...f, status: 'error', percent: 0 } : f
      ))
      message.error(`خطا در آپلود ${file.name}: ${error.response?.data?.message || error.message}`)
    } finally {
      setUploadingCount(prev => prev - 1)
    }

    // Prevent default upload behavior
    return false
  }

  // حذف تصویر آپلود شده از سرور
  const handleRemoveUploadedImage = async (file) => {
    // فوراً وضعیت را به "در حال حذف" تغییر بده
    setFiles(prev => prev.map(f =>
      f.uid === file.uid ? { ...f, status: 'removing' } : f
    ))

    // حذف فوری از UI برای تجربه کاربری بهتر
    setTimeout(() => {
      setFiles(prev => prev.filter(f => f.uid !== file.uid))
    }, 300) // کمی تأخیر برای نمایش انیمیشن

    // Track removed images for existing products (edit mode)
    const isNewUpload = !!file.originFileObj
    if (isEdit && !isNewUpload && (file.url || file.public_id)) {
      setRemovedImages(prev => [...prev, { url: file.url, public_id: file.public_id }])
    }

    // حذف از سرور در پس‌زمینه (async - بدون انتظار)
    if (file.public_id && (!isEdit || isNewUpload)) {
      api.delete(`/uploads/image/${file.public_id}`)
        .then(() => {
          console.log('Image deleted from ParsPack:', file.public_id)
        })
        .catch((error) => {
          console.error('Error deleting image from ParsPack:', error)
          // Don't show error to user - file is already removed from UI
        })
    }

    // Return false to prevent antd's default remove behavior
    return false
  }


  const handleFinish = async (values) => {
    setLoading(true)
    try {
      // ساخت payload
      const payload = {
        name: values.name,
        sku: values.sku,
        category: values.category,
        // برند اختیاری است: وقتی برند انتخاب نشده یا در ویرایش پاک شده، مقدار
        // فرم undefined می‌شود و undefined در JSON اصلاً ارسال نمی‌شود؛ در نتیجه
        // سرور فیلد برند را «بدون تغییر» می‌دید و برند قبلی محصول پاک نمی‌شد.
        // با ارسال صریح null، سرور برند را حذف می‌کند (محصول بدون برند) و در
        // ساخت محصول جدید هم محصول بدون نیاز به ثبت برند ذخیره می‌شود.
        brand: values.brand || null,
        description: values.description,
        productType,
        discount,
      }

      // برای محصولات ساده، price و stock اضافه کن
      if (productType === 'simple') {
        payload.price = values.price
        // پاک‌سازی قیمت خط‌خورده طبق قرارداد قیمت: اگر از قیمت بیشتر نباشد نادیده گرفته می‌شود؛
        // اگر بیش از ۱۰ برابر قیمت باشد فقط هشدار می‌دهد (خطای سخت نیست)
        const cmpRaw = values.compareAtPrice !== undefined && values.compareAtPrice !== null && values.compareAtPrice !== '' ? Number(values.compareAtPrice) : null
        if (cmpRaw !== null && Number.isFinite(cmpRaw) && cmpRaw > Number(values.price)) {
          if (cmpRaw > Number(values.price) * 10) {
            message.warning('قیمت خط‌خورده بیش از ۱۰ برابر قیمت است؛ احتمال اشتباه تایپی وجود دارد')
          }
          payload.compareAtPrice = cmpRaw
        } else {
          payload.compareAtPrice = null
        }
        payload.stock = values.stock
      }

      // برای محصولات متغیر، attributes و variants اضافه کن
      if (productType === 'variable') {
        payload.attributes = attributes
        // حذف _idهای موقت (مثل `variant-<timestamp>-<index>`) که ObjectId معتبر
        // نیستند و باعث خطای 500 سمت سرور می‌شدند؛ فقط _id واقعی حفظ می‌شود
        const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/
        payload.variants = variants.map((v) => {
          if (!v || typeof v !== 'object') return v
          const copy = { ...v }
          if (copy._id !== undefined && !(typeof copy._id === 'string' && OBJECT_ID_RE.test(copy._id.trim()))) {
            delete copy._id
          }
          return copy
        })
      }

      // رفع باگ تایمر مشترک: اگر زمان محلی خالی بود، زمان تایمر مشترک فعال جایگزین می‌شود.
      // قبلاً وقتی تایمر مشترک فعال بود، فرم فقط متن زمان را نشان می‌داد و مقدارش در state
      // قرار نمی‌گرفت، پس شرط `isFlashDeal && flashDealEndTime` برقرار نمی‌شد و فرم خودش
      // فلگ را خاموش می‌کرد. حالا زمان موثر (محلی یا مشترک) ارسال می‌شود.
      const effectiveFlashDealEndTime = flashDealEndTime || activeGlobalFlashDealTime || ''
      const effectiveSpecialOfferEndTime = specialOfferEndTime || activeGlobalOfferTime || ''

      if (isFlashDeal && !effectiveFlashDealEndTime) {
        message.error('برای فعال‌سازی پیشنهاد لحظه‌ای باید زمان پایان مشخص شود.')
        setLoading(false)
        return
      }
      if (isSpecialOffer && !effectiveSpecialOfferEndTime) {
        message.error('برای فعال‌سازی شگفت‌انگیز باید زمان پایان مشخص شود.')
        setLoading(false)
        return
      }

      // اضافه کردن فیلدهای فروش ویژه و تخفیف
      payload.isFlashDeal = Boolean(isFlashDeal)
      if (isFlashDeal && effectiveFlashDealEndTime) {
        payload.flashDealEndTime = effectiveFlashDealEndTime instanceof Date
          ? effectiveFlashDealEndTime.toISOString()
          : new Date(effectiveFlashDealEndTime).toISOString()
      } else {
        payload.isFlashDeal = false
        payload.flashDealEndTime = null
      }

      payload.isSpecialOffer = Boolean(isSpecialOffer)
      if (isSpecialOffer && effectiveSpecialOfferEndTime) {
        payload.specialOfferEndTime = effectiveSpecialOfferEndTime instanceof Date
          ? effectiveSpecialOfferEndTime.toISOString()
          : new Date(effectiveSpecialOfferEndTime).toISOString()
      } else {
        payload.isSpecialOffer = false
        payload.specialOfferEndTime = null
      }

      // تخفیف محصول فقط زمانی معتبر است که پیشنهاد لحظه‌ای یا شگفت‌انگیز فعال باشد
      if (!payload.isFlashDeal && !payload.isSpecialOffer) {
        payload.discount = 0
        payload.campaignLabel = ''
        payload.campaignTheme = ''
      } else {
        payload.discount = Number(discount) || 0
      }

      // اضافه کردن فیلدهای کمپین
      payload.campaignLabel = campaignLabel
      payload.campaignTheme = campaignTheme

      // اضافه کردن مشخصات فنی (مبتنی بر دسته‌بندی)
      // Convert specs object to array format: [{ label, value }]
      const specEntries = Object.entries(specs)
        .filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .map(([label, value]) => [label, String(value)])

      const propertiesArray = specEntries.map(([label, value]) => ({ label, value }))

      if (propertiesArray.length > 0) {
        payload.properties = propertiesArray
      }

      // جدول کامل مشخصات فنی (تب «مشخصات فنی» و فید ترب) با متن کامل
      if (specEntries.length > 0) {
        payload.specifications = Object.fromEntries(specEntries)
      }

      // Check if there are images still uploading
      if (uploadingCount > 0) {
        message.warning('لطفاً صبر کنید تا آپلود تصاویر تکمیل شود')
        setLoading(false)
        return
      }

      // Get already uploaded images (with url, cardUrl and public_id)
      const uploadedImages = files
        .filter(f => f.status === 'done' && f.url && f.public_id)
        .map(f => ({ url: f.url, ...(f.cardUrl ? { cardUrl: f.cardUrl } : {}), public_id: f.public_id }))

      if (!isEdit) {
        // ایجاد محصول با تصاویر آپلود شده
        message.loading({ content: 'در حال ایجاد محصول...', key: 'save' })

        // Include uploaded images directly in payload
        payload.images = uploadedImages

        const res = await api.post('/products', payload)
        const newId = res?.data?.data?._id

        message.success({ content: 'محصول با موفقیت ایجاد شد', key: 'save' })
        navigate(newId ? `/products/edit/${newId}` : '/products')
      } else {
        // ویرایش محصول
        message.loading({ content: 'در حال ذخیره تغییرات...', key: 'save' })

        // Collect existing images (from edit mode) and new uploaded images
        const existingImages = files
          .filter(f => f.status === 'done' && f.url && !f.originFileObj)
          .map(f => ({ url: f.url, ...(f.cardUrl ? { cardUrl: f.cardUrl } : {}), public_id: f.public_id }))

        const newUploadedImages = files
          .filter(f => f.status === 'done' && f.url && f.originFileObj)
          .map(f => ({ url: f.url, ...(f.cardUrl ? { cardUrl: f.cardUrl } : {}), public_id: f.public_id }))

        await api.put(`/products/${id}`, {
          ...payload,
          images: [...existingImages, ...newUploadedImages],
          imagesToRemove: removedImages,
        })

        setRemovedImages([])
        message.success({ content: 'محصول با موفقیت به‌روزرسانی شد', key: 'save' })
      }
    } catch (err) {
      message.error({ content: err?.response?.data?.message || err?.message || 'خطا در ذخیره‌سازی', key: 'save' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
            <PageHeader title={isEdit ? 'ویرایش محصول' : 'ایجاد محصول جدید'} />
      <Card loading={loading}>
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          <Tabs
            defaultActiveKey="basic"
            items={[
              {
                key: 'basic',
                label: 'اطلاعات پایه',
                children: (
                  <>
                    {/* نوع محصول */}
                    <Form.Item
                      name="productType"
                      label="نوع محصول"
                      initialValue="simple"
                      rules={[
                        {
                          required: true,
                          message: 'انتخاب نوع محصول الزامی است',
                        },
                      ]}
                    >
                      <Select
                        onChange={(value) => setProductType(value)}
                        options={[
                          { value: 'simple', label: 'محصول ساده (Simple)' },
                          {
                            value: 'variable',
                            label: 'محصول متغیر (Variable)',
                          },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item
                      name="name"
                      label="نام محصول"
                      rules={[
                        {
                          required: true,
                          message: 'وارد کردن نام محصول الزامی است',
                        },
                      ]}
                    >
                      <Input placeholder="مثلاً: تی‌شرت مردانه" />
                    </Form.Item>

                    <Form.Item
                      name="sku"
                      label="کد محصول (SKU)"
                      tooltip="این کد برای تولید شناسه KY-XXXXXXX استفاده می‌شود. ارقام آخر SKU نمایش داده می‌شوند."
                    >
                      <Input placeholder="مثلاً: WV-1234567 یا PROD-9876543" />
                    </Form.Item>

                    <Form.Item
                      name="category"
                      label="دسته‌بندی محصول"
                      rules={[
                        {
                          required: true,
                          message: 'انتخاب دسته‌بندی محصول الزامی است',
                        },
                      ]}
                      help={
                        categoriesTree.length === 0
                          ? 'هنوز هیچ دسته‌بندی‌ای بارگذاری نشده است. ابتدا دسته‌بندی‌ها را بسازید.'
                          : null
                      }
                    >
                      {categoriesLoading && categoriesTree.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center' }}>
                          <Spin tip="در حال دریافت دسته‌بندی‌ها..." spinning>
                            <div style={{ height: 24 }} />
                          </Spin>
                        </div>
                      ) : (
                        <TreeSelect
                          treeData={categoriesTree}
                          placeholder="انتخاب دسته‌بندی..."
                          allowClear
                          showSearch
                          treeDefaultExpandAll
                          filterTreeNode={(input, node) =>
                            node.title
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          disabled={categoriesTree.length === 0}
                          onChange={(value) => {
                            setSelectedCategoryId(value)
                            // Reset specs when category changes
                            setSpecs({})
                          }}
                        />
                      )}
                    </Form.Item>

                    <Form.Item
                      name="brand"
                      label="برند محصول (اختیاری)"
                      help={
                        brands.length === 0
                          ? 'هنوز هیچ برندی بارگذاری نشده است. می‌توانید از منوی «برندها» برند ایجاد کنید.'
                          : null
                      }
                    >
                      {brandsLoading && brands.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center' }}>
                          <Spin tip="در حال دریافت برندها..." spinning>
                            <div style={{ height: 24 }} />
                          </Spin>
                        </div>
                      ) : (
                        <Select
                          placeholder="انتخاب برند..."
                          allowClear
                          showSearch
                          filterOption={(input, option) =>
                            (option?.label ?? '')
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          options={brands.map((brand) => ({
                            value: brand._id,
                            label: brand.name,
                          }))}
                          disabled={brands.length === 0}
                        />
                      )}
                    </Form.Item>

                    {/* قیمت و موجودی فقط برای محصولات ساده */}
                    {productType === 'simple' && (
                      <>
                        <Form.Item
                          name="price"
                          label="قیمت (تومان)"
                          rules={[
                            {
                              required: true,
                              message: 'وارد کردن قیمت الزامی است',
                            },
                          ]}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            step={10000}
                            formatter={(value) =>
                              `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                            }
                            parser={parseNumericInput}
                          />
                        </Form.Item>

                        <Form.Item
                          name="compareAtPrice"
                          label="قیمت قبل از تخفیف / خط‌خورده (تومان)"
                          tooltip="اختیاری و فقط نمایشی — مبنای محاسبه‌ی تخفیف همیشه «قیمت» است، نه این فیلد. اگر از قیمت بیشتر نباشد ذخیره نمی‌شود."
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            step={10000}
                            formatter={(value) =>
                              `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                            }
                            parser={parseNumericInput}
                            placeholder="اختیاری (مثلاً: ۳،۵۰۰،۰۰۰)"
                          />
                        </Form.Item>

                        <Form.Item
                          name="stock"
                          label="موجودی"
                          rules={[
                            {
                              required: true,
                              message: 'وارد کردن موجودی الزامی است',
                            },
                          ]}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            step={1}
                            parser={parseNumericInput}
                          />
                        </Form.Item>
                      </>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                      <Button
                        type="dashed"
                        size="small"
                        icon={<ThunderboltOutlined />}
                        onClick={handleAutoExtractSpecs}
                      >
                        استخراج خودکار مشخصات از جدول توضیحات
                      </Button>
                    </div>

                    <Form.Item
                      name="description"
                      label="توضیحات"
                    >
                      <RichTextEditor modules={modules} formats={formats} />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'specifications',
                label: 'مشخصات فنی',
                children: (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                      <Button
                        type="dashed"
                        size="small"
                        icon={<ThunderboltOutlined />}
                        onClick={handleAutoExtractSpecs}
                      >
                        استخراج خودکار مشخصات از جدول توضیحات
                      </Button>
                    </div>

                    <Card
                      size="small"
                      title="مشخصات فنی ثبت‌شده این کالا"
                      style={{ marginBottom: 16, background: '#fafafa' }}
                    >
                      {Object.keys(specs).length === 0 ? (
                        <p style={{ margin: 0, color: '#888', fontSize: 13 }}>
                          هنوز مشخصه‌ای ثبت نشده است. با دکمه «استخراج خودکار» جدول انتهای توضیحات را بخوانید،
                          یا از پایین همین کارت مشخصه‌ی دلخواه اضافه کنید.
                        </p>
                      ) : (
                        <Space direction="vertical" style={{ width: '100%' }}>
                          {Object.entries(specs).map(([label, value]) => (
                            <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <Input value={label} disabled style={{ flex: '0 0 34%' }} />
                              <Input
                                aria-label={`مقدار ${label}`}
                                value={value === undefined || value === null ? '' : String(value)}
                                onChange={(e) => setSpecs((prev) => ({ ...prev, [label]: e.target.value }))}
                                style={{ flex: 1 }}
                              />
                              <Button
                                danger
                                type="text"
                                size="small"
                                icon={<DeleteOutlined />}
                                aria-label={`حذف ${label}`}
                                onClick={() => setSpecs((prev) => {
                                  const next = { ...prev }
                                  delete next[label]
                                  return next
                                })}
                              />
                            </div>
                          ))}
                        </Space>
                      )}

                      <Divider style={{ margin: '12px 0' }} />
                      <Space.Compact style={{ width: '100%' }}>
                        <Input
                          placeholder="نام مشخصه جدید"
                          value={newSpecLabel}
                          onChange={(e) => setNewSpecLabel(e.target.value)}
                          style={{ width: '38%' }}
                        />
                        <Input
                          placeholder="مقدار"
                          value={newSpecValue}
                          onChange={(e) => setNewSpecValue(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCustomSpec}>
                          افزودن مشخصه
                        </Button>
                      </Space.Compact>
                    </Card>

                    {!selectedCategoryId ? (
                      <Alert
                        message="ابتدا دسته‌بندی را انتخاب کنید"
                        description="برای وارد کردن مشخصات فنی، ابتدا در تب «اطلاعات پایه» دسته‌بندی محصول را انتخاب کنید."
                        type="info"
                        showIcon
                      />
                    ) : categoryProperties.length === 0 ? (
                      <Alert
                        message="ویژگی فنی تعریف نشده"
                        description={
                          <>
                            برای این دسته‌بندی هیچ ویژگی فنی تعریف نشده است.
                            می‌توانید از صفحه «مدیریت دسته‌بندی‌ها» ویژگی‌های فنی را اضافه کنید.
                          </>
                        }
                        type="warning"
                        showIcon
                      />
                    ) : (
                      <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                          <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
                            ویژگی‌های فنی محصول را وارد کنید. این اطلاعات در تب «مشخصات فنی» صفحه محصول و همچنین در فیلترهای صفحه لیست محصولات نمایش داده می‌شوند.
                          </p>
                        </div>

                        {categoryProperties.map((prop, idx) => (
                          <div key={idx} style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}>
                              {prop.name}
                              {prop.unit && <span style={{ fontWeight: 'normal', color: '#888' }}> ({prop.unit})</span>}
                            </label>
                            {prop.type === 'select' && prop.options && prop.options.length > 0 ? (
                              <Select
                                style={{ width: '100%' }}
                                placeholder={`انتخاب ${prop.name}...`}
                                value={specs[prop.name] || undefined}
                                onChange={(value) => setSpecs({ ...specs, [prop.name]: value })}
                                allowClear
                                options={prop.options.map(opt => ({ value: opt, label: opt }))}
                              />
                            ) : prop.type === 'number' ? (
                              <InputNumber
                                style={{ width: '100%' }}
                                placeholder={`مقدار ${prop.name} را وارد کنید`}
                                value={specs[prop.name] !== undefined ? Number(specs[prop.name]) : undefined}
                                onChange={(value) => setSpecs({ ...specs, [prop.name]: value })}
                              />
                            ) : (
                              <Input
                                placeholder={`${prop.name} را وارد کنید`}
                                value={specs[prop.name] || ''}
                                onChange={(e) => setSpecs({ ...specs, [prop.name]: e.target.value })}
                              />
                            )}
                          </div>
                        ))}
                      </Space>
                    )}
                  </>
                ),
              },
              {
                key: 'images',
                label: 'تصاویر محصول',
                children: (
                  <>
                    {/* راهنمای ابعاد تصویر */}
                    <Alert
                      message="راهنمای ابعاد تصاویر"
                      description={
                        <div style={{ lineHeight: 1.8 }}>
                          <p style={{ margin: 0 }}>
                            <strong>📐 ابعاد توصیه‌شده:</strong> تصاویر <strong>مربعی (نسبت 1:1)</strong> بهترین نمایش را خواهند داشت.
                          </p>
                          <p style={{ margin: '8px 0 0 0' }}>
                            <strong>🖼️ اندازه ایده‌آل:</strong> <Tag color="blue">800×800</Tag> یا <Tag color="green">1000×1000</Tag> پیکسل
                          </p>
                          <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: 12 }}>
                            💡 تصاویر با پس‌زمینه سفید بهترین نتیجه را دارند
                          </p>
                          <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: 12 }}>
                            ⚡ حداکثر حجم مجاز: <strong>5MB</strong> برای هر تصویر
                          </p>
                        </div>
                      }
                      type="info"
                      showIcon
                      style={{ marginBottom: 16, borderRadius: 8 }}
                    />

                    <Upload.Dragger
                      multiple
                      beforeUpload={handleImmediateUpload}
                      fileList={files.filter(f => f.status !== 'removing')}
                      onRemove={handleRemoveUploadedImage}
                      listType="picture"
                      showUploadList={{
                        showPreviewIcon: true,
                        showRemoveIcon: true,
                        showDownloadIcon: false,
                      }}
                      progress={{
                        strokeColor: {
                          '0%': '#108ee9',
                          '100%': '#87d068',
                        },
                        strokeWidth: 3,
                        format: (percent) => percent && `${parseFloat(percent.toFixed(0))}%`,
                      }}
                    >
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                      </p>
                      <p className="ant-upload-text">
                        تصاویر را بکشید و رها کنید یا برای انتخاب کلیک کنید.
                      </p>
                      <p className="ant-upload-hint">
                        {uploadingCount > 0
                          ? `⏳ در حال آپلود ${uploadingCount} تصویر...`
                          : '✅ تصاویر بلافاصله آپلود می‌شوند'
                        }
                      </p>
                    </Upload.Dragger>
                  </>
                ),
              },
              {
                key: 'promotions',
                label: 'فروش ویژه و تخفیف',
                children: (() => {
                  const hasPromo = Boolean(isFlashDeal || isSpecialOffer)
                  const numericBasePrice = Number(watchedPrice) || 0
                  const simplePricing = calculateDiscountPricing(numericBasePrice, discount)
                  const activePromoMode = isFlashDeal
                    ? 'flash'
                    : isSpecialOffer
                      ? 'special'
                      : 'custom'

                  const toggleFlash = (checked) => {
                    if (checked && isSpecialOffer) {
                      message.warning('یک محصول نمی‌تواند همزمان در پیشنهاد زمان‌دار و شگفت‌انگیز باشد.')
                      return
                    }
                    setIsFlashDeal(checked)
                    if (!checked) {
                      setFlashDealEndTime('')
                      if (!isSpecialOffer) setDiscount(0)
                    }
                  }

                  const toggleSpecial = (checked) => {
                    if (checked && isFlashDeal) {
                      message.warning('یک محصول نمی‌تواند همزمان در پیشنهاد زمان‌دار و شگفت‌انگیز باشد.')
                      return
                    }
                    setIsSpecialOffer(checked)
                    if (!checked) {
                      setSpecialOfferEndTime('')
                      if (!isFlashDeal) setDiscount(0)
                    }
                  }

                  return (
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                      {/* گام ۱: انتخاب نوع لیبل تخفیف */}
                      <Card
                        size="small"
                        title={
                          <Space>
                            <TagOutlined style={{ color: 'var(--brand-600)' }} />
                            <span>۱. انتخاب نوع تخفیف لیبلی (سه ساختار مجزا)</span>
                          </Space>
                        }
                      >
                        <Row gutter={[14, 14]}>
                          {/* نوع ۱: زمان‌دار / لحظه‌ای */}
                          <Col xs={24} md={8}>
                            <div
                              style={{
                                height: '100%',
                                padding: 14,
                                borderRadius: 10,
                                border: isFlashDeal
                                  ? '2px solid #ff6900'
                                  : '1px solid var(--line)',
                                background: isFlashDeal ? '#fff7ed' : 'var(--surface-sunken)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                                opacity: isSpecialOffer ? 0.6 : 1,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <span
                                  style={{
                                    padding: '3px 10px',
                                    borderRadius: 999,
                                    color: '#fff',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: FIXED_PROMOTION_THEMES.flash.gradient,
                                  }}
                                >
                                  <ClockCircleOutlined /> زمان‌دار (لحظه‌ای)
                                </span>
                                <Switch
                                  checked={isFlashDeal}
                                  disabled={isSpecialOffer}
                                  onChange={toggleFlash}
                                  checkedChildren="فعال"
                                  unCheckedChildren="خاموش"
                                />
                              </div>
                              <div style={{ fontSize: 12.5, color: 'var(--ink-600)', lineHeight: 1.65 }}>
                                نمایش در بخش <strong>«فرصت‌های زمان‌دار»</strong> صفحه اصلی با تایمر هماهنگ.
                              </div>
                            </div>
                          </Col>

                          {/* نوع ۲: شگفت‌انگیز */}
                          <Col xs={24} md={8}>
                            <div
                              style={{
                                height: '100%',
                                padding: 14,
                                borderRadius: 10,
                                border: isSpecialOffer
                                  ? '2px solid #e7000b'
                                  : '1px solid var(--line)',
                                background: isSpecialOffer ? '#fef2f2' : 'var(--surface-sunken)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                                opacity: isFlashDeal ? 0.6 : 1,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <span
                                  style={{
                                    padding: '3px 10px',
                                    borderRadius: 999,
                                    color: '#fff',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: FIXED_PROMOTION_THEMES.special.gradient,
                                  }}
                                >
                                  <FireOutlined /> شگفت‌انگیز
                                </span>
                                <Switch
                                  checked={isSpecialOffer}
                                  disabled={isFlashDeal}
                                  onChange={toggleSpecial}
                                  checkedChildren="فعال"
                                  unCheckedChildren="خاموش"
                                />
                              </div>
                              <div style={{ fontSize: 12.5, color: 'var(--ink-600)', lineHeight: 1.65 }}>
                                نمایش در بخش <strong>«پیشنهادهای منتخب»</strong> صفحه اصلی با لیبل قرمز شگفت‌انگیز.
                              </div>
                            </div>
                          </Col>

                          {/* نوع ۳: کمپین زمان‌دار با لیبل و رنگ سفارشی */}
                          <Col xs={24} md={8}>
                            <div
                              style={{
                                height: '100%',
                                padding: 14,
                                borderRadius: 10,
                                border: isFromActiveSale
                                  ? '2px solid var(--brand-600)'
                                  : '1px solid var(--line)',
                                background: isFromActiveSale ? 'var(--brand-50)' : 'var(--surface-sunken)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: 10,
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                                  <Tag color="gold" style={{ margin: 0, fontWeight: 700 }}>
                                    لیبل و رنگ سفارشی
                                  </Tag>
                                  {isFromActiveSale && <Tag color="green">عضو کمپین فعال</Tag>}
                                </div>
                                <div style={{ fontSize: 12.5, color: 'var(--ink-600)', lineHeight: 1.65 }}>
                                  {isFromActiveSale
                                    ? `این محصول در کمپین «${campaignLabel}» قرار دارد. ویرایش نام لیبل، رنگ و نمایش در منتخب‌ها از بخش مالی انجام می‌شود.`
                                    : 'کمپین‌های لیبل‌دار با رنگ سفارشی و نمایش اختیاری در منتخب‌های صفحه اصلی از بخش تخفیف‌های زمان‌دار مدیریت می‌شوند.'}
                                </div>
                              </div>
                              <Link to="/sales">
                                <Button size="small" icon={<LinkOutlined />} block>
                                  مدیریت تخفیف‌های زمان‌دار و کمپین‌ها
                                </Button>
                              </Link>
                            </div>
                          </Col>
                        </Row>

                        {isFromActiveSale && (
                          <Alert
                            type="info"
                            showIcon
                            style={{ marginTop: 14 }}
                            message={`کمپین فعال «${campaignLabel}» روی این محصول اعمال شده و کنترل شگفت‌انگیز را بر عهده دارد.`}
                          />
                        )}
                      </Card>

                      {/* گام ۲: درصد تخفیف و محاسبه قیمت نهایی تمام‌شده */}
                      <Card
                        size="small"
                        title={
                          <Space>
                            <PercentageOutlined style={{ color: 'var(--brand-600)' }} />
                            <span>۲. تنظیم درصد تخفیف و مشاهده قیمت نهایی تمام‌شده</span>
                          </Space>
                        }
                      >
                        <Row gutter={[20, 16]} align="top">
                          <Col xs={24} lg={13}>
                            <Row gutter={[12, 12]}>
                              <Col xs={24} sm={productType === 'simple' && numericBasePrice > 0 ? 12 : 24}>
                                <Form.Item label="درصد تخفیف (%)" style={{ marginBottom: 8 }}>
                                  <InputNumber
                                    value={discount}
                                    onChange={(value) => {
                                      const n = Math.min(99, Math.max(0, Number(value) || 0))
                                      setDiscount(n)
                                    }}
                                    min={0}
                                    max={99}
                                    disabled={!hasPromo}
                                    style={{ width: '100%' }}
                                    addonAfter="%"
                                    placeholder={!hasPromo ? 'ابتدا یک نوع تخفیف را فعال کنید' : 'مثلاً: ۲۰'}
                                    parser={parseNumericInput}
                                  />
                                </Form.Item>
                              </Col>

                              {productType === 'simple' && numericBasePrice > 0 && (
                                <Col xs={24} sm={12}>
                                  <Form.Item
                                    label="قیمت نهایی تمام‌شده (تومان)"
                                    tooltip="با وارد کردن قیمت نهایی دلخواه، درصد تخفیف متناظر به‌صورت خودکار محاسبه می‌شود"
                                    style={{ marginBottom: 8 }}
                                  >
                                    <InputNumber
                                      value={hasPromo ? simplePricing.finalPrice : numericBasePrice}
                                      onChange={(val) => {
                                        if (!hasPromo || val == null) return
                                        const calc = calculatePercentFromFinalPrice(numericBasePrice, val)
                                        setDiscount(calc.discountPercent)
                                      }}
                                      min={0}
                                      max={numericBasePrice}
                                      step={10000}
                                      disabled={!hasPromo}
                                      style={{ width: '100%' }}
                                      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                      parser={parseNumericInput}
                                    />
                                  </Form.Item>
                                </Col>
                              )}
                            </Row>

                            <div className="ekg-jalali-presets" style={{ marginBottom: 12 }}>
                              {[5, 10, 15, 20, 25, 30, 50].map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  disabled={!hasPromo}
                                  className={`ekg-jalali-preset-btn${Number(discount) === pct ? ' is-active' : ''}`}
                                  onClick={() => hasPromo && setDiscount(pct)}
                                  style={!hasPromo ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                                >
                                  {formatNumber(pct)}٪
                                </button>
                              ))}
                            </div>

                            {!hasPromo ? (
                              <Alert
                                type="warning"
                                showIcon
                                message="درصد تخفیف فقط با فعال‌سازی «زمان‌دار (لحظه‌ای)» یا «شگفت‌انگیز» اعمال می‌شود."
                              />
                            ) : productType === 'simple' && numericBasePrice <= 0 ? (
                              <Alert
                                type="info"
                                showIcon
                                message="برای مشاهده قیمت نهایی تمام‌شده، ابتدا قیمت محصول را در تب «اطلاعات پایه» وارد کنید."
                              />
                            ) : productType === 'simple' ? (
                              <div className="promo-price-summary-grid">
                                <div>
                                  <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>قیمت پایه</div>
                                  <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 2 }}>
                                    {formatCurrency(numericBasePrice)}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>کسر تخفیف</div>
                                  <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--err)', marginTop: 2 }}>
                                    {formatCurrency(simplePricing.savings)}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>قیمت نهایی مشتری</div>
                                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ok)', marginTop: 2 }}>
                                    {formatCurrency(simplePricing.finalPrice)}
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </Col>

                          <Col xs={24} lg={11}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-600)', marginBottom: 6 }}>
                              پیش‌نمایش کارت محصول در ویترین سایت:
                            </div>
                            <PromotionBadgePreview
                              mode={activePromoMode}
                              label={
                                activePromoMode === 'flash'
                                  ? 'پیشنهاد لحظه‌ای'
                                  : activePromoMode === 'special'
                                    ? 'شگفت‌انگیز'
                                    : campaignLabel || 'لیبل سفارشی'
                              }
                              discountPercent={hasPromo ? discount : 0}
                              basePrice={
                                productType === 'simple'
                                  ? numericBasePrice
                                  : variants.length > 0
                                    ? Math.min(...variants.map((v) => Number(v.price) || 0).filter((n) => n > 0), 0) || basePrice
                                    : basePrice
                              }
                            />
                          </Col>
                        </Row>

                        {/* جدول پیش‌نمایش قیمت نهایی متغیرها */}
                        {productType === 'variable' && variants.length > 0 && (
                          <div style={{ marginTop: 18 }}>
                            <Divider style={{ margin: '12px 0' }} />
                            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>
                              پیش‌نمایش قیمت نهایی تمام‌شده برای هر متغیر
                            </div>
                            <Table
                              size="small"
                              bordered
                              pagination={false}
                              scroll={{ x: 'max-content' }}
                              rowKey="_id"
                              dataSource={variants}
                              columns={[
                                {
                                  title: 'متغیر',
                                  key: 'opts',
                                  render: (_, rec) =>
                                    (rec.options || []).map((o, i) => (
                                      <Tag key={i} color="blue">
                                        {o.name}: {o.value}
                                      </Tag>
                                    )),
                                },
                                {
                                  title: 'شامل تخفیف',
                                  key: 'incl',
                                  width: 110,
                                  align: 'center',
                                  render: (_, rec) => (
                                    <Checkbox
                                      checked={rec.excludeFromPromotion !== true}
                                      onChange={(e) =>
                                        handleVariantChange(rec._id, 'excludeFromPromotion', !e.target.checked)
                                      }
                                    >
                                      فعال
                                    </Checkbox>
                                  ),
                                },
                                {
                                  title: 'قیمت پایه',
                                  dataIndex: 'price',
                                  key: 'base',
                                  render: (p) => formatCurrency(p || 0),
                                },
                                {
                                  title: 'مقدار تخفیف',
                                  key: 'sav',
                                  render: (_, rec) => {
                                    if (!hasPromo || rec.excludeFromPromotion === true) return '—'
                                    const calc = calculateDiscountPricing(rec.price, discount)
                                    return (
                                      <span style={{ color: 'var(--err)' }}>
                                        {formatCurrency(calc.savings)}
                                      </span>
                                    )
                                  },
                                },
                                {
                                  title: 'قیمت نهایی تمام‌شده',
                                  key: 'final',
                                  render: (_, rec) => {
                                    const included = hasPromo && rec.excludeFromPromotion !== true
                                    const calc = calculateDiscountPricing(
                                      rec.price,
                                      included ? discount : 0,
                                    )
                                    return (
                                      <strong style={{ color: included ? 'var(--ok)' : 'var(--ink-800)' }}>
                                        {formatCurrency(calc.finalPrice)}
                                      </strong>
                                    )
                                  },
                                },
                              ]}
                            />
                          </div>
                        )}
                      </Card>

                      {/* گام ۳: زمان‌بندی پایان (در صورت فعال‌بودن یکی از دو حالت محصولی) */}
                      {isFlashDeal && (
                        <Card
                          size="small"
                          title="۳. تنظیم زمان پایان پیشنهاد زمان‌دار (لحظه‌ای)"
                          style={{ borderInlineStart: '4px solid #ff6900' }}
                        >
                          <Form.Item label="زمان پایان (تاریخ و ساعت شمسی)" style={{ marginBottom: 0 }}>
                            {activeGlobalFlashDealTime ? (
                              <div style={{ background: '#fff7ed', padding: 12, border: '1px dashed #ff6900', borderRadius: 8 }}>
                                <div style={{ color: '#c2410c', fontWeight: 700, fontSize: 13 }}>
                                  ⚡ زمان با سایر پیشنهادهای لحظه‌ای هماهنگ است
                                </div>
                                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-700)' }}>
                                  زمان پایان فعال: <strong>{formatPersianDate(activeGlobalFlashDealTime, true)}</strong>
                                </div>
                              </div>
                            ) : (
                              <JalaliDateTimePicker
                                value={flashDealEndTime}
                                onChange={(date) => setFlashDealEndTime(date)}
                                showTime
                                presets="future"
                                minDate={new Date()}
                                placeholder="انتخاب تاریخ و ساعت پایان (شمسی)"
                              />
                            )}
                            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--ink-500)', fontSize: 12 }}>
                              {activeGlobalFlashDealTime
                                ? 'این محصول به‌طور خودکار به تایمر مشترک فعال پیشنهاد لحظه‌ای می‌پیوندد.'
                                : 'این اولین پیشنهاد لحظه‌ای است؛ زمانی که تنظیم کنید برای محصولات بعدی نیز اعمال می‌شود.'}
                            </p>
                          </Form.Item>
                        </Card>
                      )}

                      {isSpecialOffer && !isFromActiveSale && (
                        <Card
                          size="small"
                          title="۳. تنظیم زمان پایان پیشنهاد شگفت‌انگیز"
                          style={{ borderInlineStart: '4px solid #e7000b' }}
                        >
                          <Form.Item label="زمان پایان کمپین (تاریخ و ساعت شمسی)" style={{ marginBottom: 0 }}>
                            {activeGlobalOfferTime ? (
                              <div style={{ background: '#fef2f2', padding: 12, border: '1px dashed #e7000b', borderRadius: 8 }}>
                                <div style={{ color: '#b3261e', fontWeight: 700, fontSize: 13 }}>
                                  ⏰ زمان با سایر محصولات شگفت‌انگیز هماهنگ است
                                </div>
                                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-700)' }}>
                                  زمان پایان فعال: <strong>{formatPersianDate(activeGlobalOfferTime, true)}</strong>
                                </div>
                              </div>
                            ) : (
                              <JalaliDateTimePicker
                                value={specialOfferEndTime}
                                onChange={(date) => setSpecialOfferEndTime(date)}
                                showTime
                                presets="future"
                                minDate={new Date()}
                                placeholder="انتخاب تاریخ و ساعت پایان (شمسی)"
                              />
                            )}
                            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--ink-500)', fontSize: 12 }}>
                              {activeGlobalOfferTime
                                ? 'این محصول به‌طور خودکار به تایمر مشترک شگفت‌انگیز می‌پیوندد.'
                                : 'این اولین محصول شگفت‌انگیز است؛ زمانی که تنظیم کنید برای محصولات بعدی نیز اعمال می‌شود.'}
                            </p>
                          </Form.Item>
                        </Card>
                      )}
                    </Space>
                  )
                })(),
              },
              // تب ویژگی‌ها و متغیرها (فقط برای محصولات متغیر)
              ...(productType === 'variable'
                ? [
                  {
                    key: 'variants',
                    label: 'ویژگی‌ها و متغیرها',
                    children: (
                      <Space
                        direction="vertical"
                        style={{ width: '100%' }}
                        size="large"
                      >
                        {/* بخش ۱: مدیریت ویژگی‌ها */}
                        <Card title="ویژگی‌ها (Attributes)" size="small">
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <div>
                              <Space>
                                <Input
                                  placeholder="نام ویژگی (مثلاً: رنگ)"
                                  value={newAttributeName}
                                  onChange={(e) =>
                                    setNewAttributeName(e.target.value)
                                  }
                                  style={{ width: 200, maxWidth: '100%' }}
                                />
                                <Input
                                  placeholder="مقادیر (با کاما جدا کنید: آبی، قرمز)"
                                  value={newAttributeValues}
                                  onChange={(e) =>
                                    setNewAttributeValues(e.target.value)
                                  }
                                  style={{ width: 300, maxWidth: '100%' }}
                                />
                                <Button
                                  type="primary"
                                  icon={<PlusOutlined />}
                                  onClick={handleAddAttribute}
                                >
                                  افزودن ویژگی
                                </Button>
                              </Space>
                            </div>

                            {/* لیست ویژگی‌های موجود */}
                            {attributes.length > 0 && (
                              <div
                                style={{
                                  marginTop: 16,
                                  padding: 16,
                                  background: '#f5f5f5',
                                  borderRadius: 8,
                                }}
                              >
                                <h4>ویژگی‌های تعریف شده:</h4>
                                <Space direction="vertical" style={{ width: '100%' }}>
                                  {attributes.map((attr, index) => (
                                    <div
                                      key={index}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: 8,
                                        background: '#fff',
                                        borderRadius: 4,
                                      }}
                                    >
                                      <div>
                                        <strong>{attr.name}:</strong>{' '}
                                        {attr.values.join(', ')}
                                      </div>
                                      <Button
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={() =>
                                          handleRemoveAttribute(index)
                                        }
                                      >
                                        حذف
                                      </Button>
                                    </div>
                                  ))}
                                </Space>
                              </div>
                            )}
                          </Space>
                        </Card>

                        {/* بخش ۲: تولید خودکار متغیرها */}
                        <Card title="متغیرها (Variants)" size="small">
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <Space wrap>
                              <InputNumber
                                value={basePrice}
                                onChange={(value) => setBasePrice(value || 0)}
                                min={0}
                                placeholder="قیمت پایه"
                                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                parser={parseNumericInput}
                                style={{ width: 200 }}
                              />
                              <Button
                                onClick={() => setVariants((p) => p.map((v) => ({ ...v, price: basePrice })))}
                                disabled={variants.length === 0}
                              >
                                اعمال قیمت پایه به همه
                              </Button>
                            </Space>
                            <Button
                              type="primary"
                              onClick={generateVariants}
                              disabled={attributes.length === 0}
                            >
                              ایجاد متغیرها از ویژگی‌ها
                            </Button>

                            <Alert
                              message="تیک «تخفیف» هر متغیر را در جدول خاموش کنید تا کمپین (لحظه‌ای / شگفت‌انگیز / زمان‌دار) روی همان متغیر اعمال نشود. پیش‌فرض روشن است و رفتار قبلی حفظ می‌شود."
                              type="info"
                              showIcon
                              style={{ fontSize: 12 }}
                            />

                            {/* جدول متغیرها */}
                            {variants.length > 0 && (
                              <Table
                                columns={variantColumns}
                                dataSource={variants}
                                rowKey="_id"
                                scroll={{ x: 'max-content' }}
                                pagination={false}
                                bordered
                                size="small"
                              />
                            )}
                          </Space>
                        </Card>
                      </Space>
                    ),
                  },
                ]
                : []),
            ]}
          />

          <Form.Item style={{ marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
            >
              {isEdit ? 'ذخیره تغییرات' : 'ایجاد محصول'}
            </Button>
            <Button
              style={{ marginRight: 8 }}
              onClick={() => navigate('/products')}
              disabled={loading}
            >
              انصراف
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default ProductForm
