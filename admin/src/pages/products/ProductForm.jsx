import { useEffect, useState, useMemo } from 'react'
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
} from 'antd'
import {
  InboxOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import RichTextEditor from '../../components/RichTextEditor'
import { useNavigate, useParams } from 'react-router-dom'
import { useCategoryStore, useBrandStore } from '../../stores'
import api from '../../api'
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
  'align', 'list', 'bullet', 'indent',
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
        if (!url) return null
        return {
          uid: String(index),
          name: `image-${index + 1}`,
          status: 'done',
          url,
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
              stock: p.stock,
              category: categoryId,
              brand: brandId,
              description: (() => {
                if (!p.description) return '';
                try {
                  const txt = document.createElement("textarea");
                  txt.innerHTML = p.description;
                  return txt.value;
                } catch (e) {
                  return p.description;
                }
              })(),
              productType: p.productType || 'simple',
            })
            setFiles(toFileList(p.images))
            setProductType(p.productType || 'simple')
            setAttributes(p.attributes || [])
            setVariants(p.variants || [])

            // Load promotion fields (ISO strings for JalaliDateTimePicker)
            setDiscount(p.discount || 0)
            setIsFlashDeal(p.isFlashDeal || false)
            setFlashDealEndTime(p.flashDealEndTime || '')
            setIsSpecialOffer(p.isSpecialOffer || false)
            setSpecialOfferEndTime(p.specialOfferEndTime || '')
            setCampaignLabel(p.campaignLabel || '')
            setCampaignTheme(p.campaignTheme || '')
            setIsFromActiveSale(p.isFromActiveSale || false)

            // Load specs from product.properties
            if (p.properties && Array.isArray(p.properties)) {
              const specsObj = {}
              p.properties.forEach(prop => {
                if (prop.label && prop.value !== undefined) {
                  specsObj[prop.label] = prop.value
                }
              })
              setSpecs(specsObj)
            }

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
      .split(',')
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
  // تولید خودکار متغیرها از ویژگی‌ها
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

    // ساخت متغیرها
    const newVariants = combinations.map((options, index) => ({
      _id: `variant-${Date.now()}-${index}`,
      sku: '',
      price: 0,
      stock: 0,
      options,
      images: [],
    }))

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
      width: 150,
      render: (text, record) => (
        <InputNumber
          value={text}
          onChange={(value) =>
            handleVariantChange(record._id, 'price', value)
          }
          min={0}
          style={{ width: '100%' }}
        />
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
        />
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

    // Add file to list with uploading status
    const newFile = {
      uid,
      name: file.name,
      status: 'uploading',
      originFileObj: file,
      percent: 0,
    }

    setFiles(prev => [...prev, newFile])
    setUploadingCount(prev => prev + 1)

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await api.post('/uploads/image', formData, {
        timeout: 180000, // 3 minutes for slow connections to Cloudinary
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setFiles(prev => prev.map(f =>
            f.uid === uid ? { ...f, percent } : f
          ))
        }
      })

      if (response.data.success) {
        const { url, public_id } = response.data.data
        // Update file with uploaded info
        setFiles(prev => prev.map(f =>
          f.uid === uid ? {
            ...f,
            status: 'done',
            url,
            public_id,
            thumbUrl: url,
            percent: 100,
          } : f
        ))
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

  // حذف تصویر آپلود شده از Cloudinary
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

    // حذف از Cloudinary در پس‌زمینه (async - بدون انتظار)
    if (file.public_id && (!isEdit || isNewUpload)) {
      api.delete(`/uploads/image/${file.public_id}`)
        .then(() => {
          console.log('Image deleted from Cloudinary:', file.public_id)
        })
        .catch((error) => {
          console.error('Error deleting image from Cloudinary:', error)
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
        brand: values.brand,
        description: values.description,
        productType,
        discount,
      }

      // برای محصولات ساده، price و stock اضافه کن
      if (productType === 'simple') {
        payload.price = values.price
        payload.stock = values.stock
      }

      // برای محصولات متغیر، attributes و variants اضافه کن
      if (productType === 'variable') {
        payload.attributes = attributes
        payload.variants = variants
      }

      // اضافه کردن فیلدهای فروش ویژه
      payload.isFlashDeal = isFlashDeal
      if (isFlashDeal && flashDealEndTime) {
        // flashDealEndTime might be Date object or ISO string
        payload.flashDealEndTime = flashDealEndTime instanceof Date
          ? flashDealEndTime.toISOString()
          : new Date(flashDealEndTime).toISOString()
      }

      payload.isSpecialOffer = isSpecialOffer
      if (isSpecialOffer && specialOfferEndTime) {
        // specialOfferEndTime might be Date object or ISO string
        payload.specialOfferEndTime = specialOfferEndTime instanceof Date
          ? specialOfferEndTime.toISOString()
          : new Date(specialOfferEndTime).toISOString()
      } else if (!isSpecialOffer) {
        // Explicitly clear the timer if special offer is disabled
        payload.specialOfferEndTime = null
      }

      // اضافه کردن فیلدهای کمپین
      payload.campaignLabel = campaignLabel
      payload.campaignTheme = campaignTheme

      // اضافه کردن مشخصات فنی (مبتنی بر دسته‌بندی)
      // Convert specs object to array format: [{ label, value }]
      const propertiesArray = Object.entries(specs)
        .filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .map(([label, value]) => ({ label, value: String(value) }))

      if (propertiesArray.length > 0) {
        payload.properties = propertiesArray
      }

      // Check if there are images still uploading
      if (uploadingCount > 0) {
        message.warning('لطفاً صبر کنید تا آپلود تصاویر تکمیل شود')
        setLoading(false)
        return
      }

      // Get already uploaded images (with url and public_id)
      const uploadedImages = files
        .filter(f => f.status === 'done' && f.url && f.public_id)
        .map(f => ({ url: f.url, public_id: f.public_id }))

      if (!isEdit) {
        // ایجاد محصول با تصاویر آپلود شده
        message.loading({ content: 'در حال ایجاد محصول...', key: 'save' })

        // Include uploaded images directly in payload
        payload.images = uploadedImages

        const res = await api.post('/v1/admin/products', payload)
        const newId = res?.data?.data?._id

        message.success({ content: 'محصول با موفقیت ایجاد شد', key: 'save' })
        navigate(newId ? `/products/edit/${newId}` : '/products')
      } else {
        // ویرایش محصول
        message.loading({ content: 'در حال ذخیره تغییرات...', key: 'save' })

        // Collect existing images (from edit mode) and new uploaded images
        const existingImages = files
          .filter(f => f.status === 'done' && f.url && !f.originFileObj)
          .map(f => ({ url: f.url, public_id: f.public_id }))

        const newUploadedImages = files
          .filter(f => f.status === 'done' && f.url && f.originFileObj)
          .map(f => ({ url: f.url, public_id: f.public_id }))

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
      <h1>{isEdit ? 'ویرایش محصول' : 'ایجاد محصول جدید'}</h1>
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
                            parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
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
                          />
                        </Form.Item>
                      </>
                    )}

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
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    {/* بخش تخفیف عمومی */}
                    <Card title="تخفیف محصول" size="small">
                      <Form.Item label="درصد تخفیف (%)">
                        <InputNumber
                          value={discount}
                          onChange={(value) => setDiscount(value || 0)}
                          min={0}
                          max={100}
                          style={{ width: '200px' }}
                          placeholder="مثلاً: 20"
                        />
                        <p style={{ marginTop: 8, color: '#888', fontSize: '13px' }}>
                          این تخفیف روی کارت محصول نمایش داده می‌شود
                        </p>
                      </Form.Item>
                    </Card>

                    {/* بخش پیشنهاد لحظه‌ای (Flash Deal) */}
                    <Card
                      title="پیشنهاد لحظه‌ای (Flash Deal)"
                      size="small"
                      style={{
                        marginBottom: '16px',
                        borderLeft: isFlashDeal ? '4px solid #faad14' : 'none'
                      }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <input
                            type="checkbox"
                            id="flashDeal"
                            checked={isFlashDeal}
                            disabled={isSpecialOffer}
                            onChange={(e) => {
                              if (e.target.checked && isSpecialOffer) {
                                message.warning('یک محصول نمی‌تواند همزمان در کمپین پیشنهاد لحظه‌ای و شگفت‌انگیز باشد.')
                                return
                              }
                              setIsFlashDeal(e.target.checked)
                            }}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: isSpecialOffer ? 'not-allowed' : 'pointer',
                              opacity: isSpecialOffer ? 0.5 : 1
                            }}
                          />
                          <label
                            htmlFor="flashDeal"
                            style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: isSpecialOffer ? 'not-allowed' : 'pointer',
                              userSelect: 'none',
                              opacity: isSpecialOffer ? 0.5 : 1
                            }}
                          >
                            فعال‌سازی پیشنهاد لحظه‌ای
                          </label>
                          {isSpecialOffer && (
                            <span style={{
                              fontSize: '12px',
                              color: '#f5222d',
                              fontWeight: 'normal'
                            }}>
                              (غیرفعال - شگفت‌انگیز فعال است)
                            </span>
                          )}
                        </div>

                        {isFlashDeal && (
                          <div
                            style={{
                              marginTop: '16px',
                              padding: '16px',
                              background: '#fffbe6',
                              borderRadius: '8px',
                              animation: 'fadeIn 0.3s ease-in'
                            }}
                          >
                            <Form.Item
                              label="زمان پایان (تاریخ شمسی)"
                              style={{ marginBottom: 0 }}
                            >
                              {activeGlobalFlashDealTime ? (
                                <div style={{ background: '#fff', padding: '10px', border: '1px dashed #faad14', borderRadius: '6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#faad14', fontWeight: 'bold', fontSize: '13px' }}>
                                    <span>⚡ زمان با سایر پیشنهادهای لحظه‌ای هماهنگ است</span>
                                  </div>
                                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                                    زمان پایان: {new Date(activeGlobalFlashDealTime).toLocaleString('fa-IR')}
                                  </div>
                                  <div style={{ display: 'none' }}>
                                    <JalaliDateTimePicker
                                      value={activeGlobalFlashDealTime}
                                      onChange={() => { }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <JalaliDateTimePicker
                                  value={flashDealEndTime}
                                  onChange={(date) => setFlashDealEndTime(date)}
                                  placeholder="انتخاب تاریخ و زمان پایان"
                                  borderColor="#d9d9d9"
                                  focusColor="#faad14"
                                />
                              )}
                              <p style={{ marginTop: 8, color: '#666', fontSize: '12px' }}>
                                {activeGlobalFlashDealTime
                                  ? "این محصول به طور خودکار به تایمر فعال پیشنهاد لحظه‌ای می‌پیوندد."
                                  : "این اولین پیشنهاد لحظه‌ای است. زمانی که تنظیم کنید برای محصولات بعدی نیز اعمال می‌شود."}
                              </p>
                            </Form.Item>

                          </div>
                        )}
                      </Space>
                    </Card>

                    {/* بخش شگفت‌انگیز (Special Offer) */}
                    <Card
                      title="شگفت‌انگیز (Special Offer)"
                      size="small"
                      style={{
                        borderLeft: isSpecialOffer ? '4px solid #f5222d' : 'none'
                      }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <input
                            type="checkbox"
                            id="specialOffer"
                            checked={isSpecialOffer}
                            disabled={isFlashDeal}
                            onChange={(e) => {
                              if (e.target.checked && isFlashDeal) {
                                message.warning('یک محصول نمی‌تواند همزمان در کمپین پیشنهاد لحظه‌ای و شگفت‌انگیز باشد.')
                                return
                              }
                              setIsSpecialOffer(e.target.checked)
                            }}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: isFlashDeal ? 'not-allowed' : 'pointer',
                              opacity: isFlashDeal ? 0.5 : 1
                            }}
                          />
                          <label
                            htmlFor="specialOffer"
                            style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: isFlashDeal ? 'not-allowed' : 'pointer',
                              userSelect: 'none',
                              opacity: isFlashDeal ? 0.5 : 1
                            }}
                          >
                            فعال‌سازی‌شگفت‌انگیز
                          </label>
                          {isFlashDeal && (
                            <span style={{
                              fontSize: '12px',
                              color: '#faad14',
                              fontWeight: 'normal'
                            }}>
                              (غیرفعال - پیشنهاد لحظه‌ای فعال است)
                            </span>
                          )}
                        </div>

                        {isFromActiveSale && (
                          <div style={{ marginTop: '12px', padding: '8px', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '4px', fontSize: '12px' }}>
                            این محصول در کمپین فعال <strong>{campaignLabel}</strong> قرار دارد و وضعیت شگفت‌انگیز آن توسط کمپین کنترل می‌شود.
                          </div>
                        )}

                        {isSpecialOffer && !isFromActiveSale && (
                          <div
                            style={{
                              marginTop: '16px',
                              padding: '16px',
                              background: '#fff1f0',
                              borderRadius: '8px',
                              animation: 'fadeIn 0.3s ease-in'
                            }}
                          >
                            <Form.Item
                              label="زمان پایان کمپین (تاریخ شمسی)"
                              style={{ marginBottom: 0 }}
                            >
                              {activeGlobalOfferTime ? (
                                <div style={{ background: '#fff', padding: '10px', border: '1px dashed #f5222d', borderRadius: '6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f5222d', fontWeight: 'bold', fontSize: '13px' }}>
                                    <span>⏰ زمان با سایر محصولات شگفت‌انگیز هماهنگ است</span>
                                  </div>
                                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                                    زمان پایان: {new Date(activeGlobalOfferTime).toLocaleString('fa-IR')}
                                  </div>
                                  <div style={{ display: 'none' }}>
                                    {/* Hidden input to ensure value is passed if needed, though backend handles sync */}
                                    <JalaliDateTimePicker
                                      value={activeGlobalOfferTime}
                                      onChange={() => { }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <JalaliDateTimePicker
                                  value={specialOfferEndTime}
                                  onChange={(date) => setSpecialOfferEndTime(date)}
                                  placeholder="انتخاب تاریخ و زمان پایان"
                                  borderColor="#d9d9d9"
                                  focusColor="#f5222d"
                                />
                              )}

                              <p style={{ marginTop: 8, color: '#666', fontSize: '12px' }}>
                                {activeGlobalOfferTime
                                  ? "این محصول به طور خودکار به تایمر فعال شگفت‌انگیز می‌پیوندد."
                                  : "این اولین محصول شگفت‌انگیز است. زمانی که تنظیم کنید برای محصولات بعدی نیز اعمال می‌شود."}
                              </p>
                            </Form.Item>
                          </div>
                        )}
                      </Space>
                    </Card>

                    {/* راهنمای استفاده */}
                    <Card size="small" style={{ background: '#fafafa' }}>
                      <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>
                        📌 راهنمای استفاده:
                      </h4>
                      <ul style={{ marginBottom: 0, paddingRight: '20px', fontSize: '13px', color: '#666' }}>
                        <li style={{ marginBottom: '6px' }}>
                          <strong>پیشنهاد لحظه‌ای:</strong> همه محصولات از یک تایمر مشترک استفاده می‌کنند
                        </li>
                        <li style={{ marginBottom: '6px' }}>
                          <strong>شگفت‌انگیز:</strong> همه محصولات از یک تایمر مشترک استفاده می‌کنند
                        </li>
                        <li style={{ marginBottom: '6px', color: '#f5222d', fontWeight: '500' }}>
                          ⚠️ یک محصول <strong>فقط</strong> می‌تواند در یکی از کمپین‌ها باشد (پیشنهاد لحظه‌ای یا شگفت‌انگیز)
                        </li>
                        <li>
                          محصولات پس از اتمام زمان به صورت خودکار از لیست حذف می‌شوند
                        </li>
                      </ul>
                    </Card>
                  </Space>
                ),
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
                                  style={{ width: 200 }}
                                />
                                <Input
                                  placeholder="مقادیر (با کاما جدا کنید: آبی، قرمز)"
                                  value={newAttributeValues}
                                  onChange={(e) =>
                                    setNewAttributeValues(e.target.value)
                                  }
                                  style={{ width: 300 }}
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
                            <Button
                              type="primary"
                              onClick={generateVariants}
                              disabled={attributes.length === 0}
                            >
                              ایجاد متغیرها از ویژگی‌ها
                            </Button>

                            {/* جدول متغیرها */}
                            {variants.length > 0 && (
                              <Table
                                columns={variantColumns}
                                dataSource={variants}
                                rowKey="_id"
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
