import { useEffect, useMemo, useState } from 'react'
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Switch,
  Tag,
  Image,
  Modal,
  message,
  Checkbox,
  Upload,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  ExportOutlined,
  ImportOutlined,
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
  FieldTimeOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import api from '../../api'
import { useCategoryStore } from '../../stores'
import JalaliDateTimePicker from '../../components/JalaliDateTimePicker'
import { PERMISSIONS } from '../../rbac/permissions'
import { useCan } from '../../rbac/useCan'

const { Dragger } = Upload
const CSV_DIRECT_UPLOAD_LIMIT_BYTES = 900 * 1024
const CSV_CHUNK_MAX_BYTES = 700 * 1024
const CSV_CHUNK_RETRY_COUNT = 3
const CSV_IMPORT_MESSAGE_KEY = 'csv-import-progress'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const isNonEmptyRow = (row = {}) =>
  Object.values(row).some((value) => String(value ?? '').trim() !== '')

const normalizeCsvHeader = (header) =>
  String(header || '')
    .replace(/\uFEFF/g, '')
    .trim()

const escapeCsvValue = (value) => {
  const str = String(value ?? '')
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const csvSerializeRow = (headers, row) =>
  headers.map((header) => escapeCsvValue(row?.[header] ?? '')).join(',')

const csvSerialize = (headers, rows) => {
  const lines = [headers.map(escapeCsvValue).join(',')]
  rows.forEach((row) => {
    lines.push(csvSerializeRow(headers, row))
  })
  return lines.join('\n')
}

const parseCsvText = (text = '') => {
  const matrix = []
  const parseErrors = []

  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      matrix.push(row)
      row = []
      field = ''
    } else if (char === '\r') {
      // Ignore \r and let \n close the row.
    } else {
      field += char
    }
  }

  if (inQuotes) {
    parseErrors.push({ row: matrix.length + 1, message: 'Unclosed quoted field in CSV' })
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    matrix.push(row)
  }

  if (matrix.length === 0) {
    return { headers: [], rows: [], parseErrors }
  }

  const headers = matrix[0].map(normalizeCsvHeader).filter(Boolean)
  if (!headers.length) {
    parseErrors.push({ row: 1, message: 'CSV header is missing or invalid' })
    return { headers: [], rows: [], parseErrors }
  }

  const rows = []
  for (let i = 1; i < matrix.length; i++) {
    const rawRow = matrix[i]
    const rowObject = {}
    headers.forEach((header, idx) => {
      rowObject[header] = String(rawRow[idx] ?? '').trim()
    })

    if (isNonEmptyRow(rowObject)) {
      rows.push(rowObject)
    }
  }

  return { headers, rows, parseErrors }
}

const buildCsvChunks = (rows, headers, maxChunkBytes = CSV_CHUNK_MAX_BYTES) => {
  const normalizedRows = rows.map((row) =>
    headers.reduce((acc, header) => {
      acc[header] = row?.[header] ?? ''
      return acc
    }, {}),
  )

  const chunks = []
  let currentChunkRows = []
  let currentChunkSize = 0

  normalizedRows.forEach((row) => {
    const rowCsv = csvSerializeRow(headers, row)
    const rowSize = new Blob([`${rowCsv}\n`]).size

    if (currentChunkRows.length > 0 && currentChunkSize + rowSize > maxChunkBytes) {
      chunks.push(currentChunkRows)
      currentChunkRows = [row]
      currentChunkSize = rowSize
      return
    }

    currentChunkRows.push(row)
    currentChunkSize += rowSize
  })

  if (currentChunkRows.length > 0) {
    chunks.push(currentChunkRows)
  }

  return chunks
}

function ProductsList({ mode }) {
  const { can } = useCan()
  const canCreate = can(PERMISSIONS.PRODUCT_CREATE)
  const canUpdate = can(PERMISSIONS.PRODUCT_UPDATE)
  const canDelete = can(PERMISSIONS.PRODUCT_DELETE)
  const canImport = can(PERMISSIONS.PRODUCT_IMPORT)
  const canExport = can(PERMISSIONS.PRODUCT_EXPORT)

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [filters, setFilters] = useState({
    search: '',
    searchField: 'all',
    category: null,
    status: null,
    productType: '',
  })
  const [includeChildren, setIncludeChildren] = useState(true)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  })
  const [dynamicFilters, setDynamicFilters] = useState({})
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [timerModalVisible, setTimerModalVisible] = useState(false)
  const [specialOfferEndTime, setSpecialOfferEndTime] = useState('')
  const [flashTimerModalVisible, setFlashTimerModalVisible] = useState(false)
  const [flashDealEndTime, setFlashDealEndTime] = useState('')

  const categories = useCategoryStore((state) => state.categoriesFlat)
  const categoriesLoading = useCategoryStore((state) => state.loading)
  const fetchCategoriesTree = useCategoryStore((state) => state.fetchCategoriesTree)

  useEffect(() => {
    if (!categories || categories.length === 0) {
      fetchCategoriesTree()
    }
  }, [categories, fetchCategoriesTree])

  useEffect(() => {
    const onFocus = () => fetchCategoriesTree()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchCategoriesTree])

  useEffect(() => {
    if (!filters.category) return
    const stillExists = categories.some((c) => c._id === filters.category)
    if (!stillExists) {
      setFilters((prev) => ({ ...prev, category: null }))
      setDynamicFilters({})
    }
  }, [categories, filters.category])

  const fetchProducts = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))
      params.set('sort', '-createdAt')
      params.set(
        'fields',
        'name,sku,price,stock,isActive,images,_id,category,productType,isFlashDeal,flashDealEndTime,isSpecialOffer,specialOfferEndTime,discount',
      )
      // ✅ FIX: Get raw prices for admin panel (without discount calculation)
      params.set('skipDiscount', 'true')

      // Add Dynamic Filters
      Object.keys(dynamicFilters).forEach((key) => {
        if (dynamicFilters[key]) {
          params.append(`properties[${key}]`, dynamicFilters[key])
        }
      })

      if (filters.search) {
        params.set('search', filters.search)
        if (filters.searchField && filters.searchField !== 'all') {
          params.set('searchField', filters.searchField)
        }
      }
      if (filters.category) {
        params.set('category', filters.category)
        if (includeChildren) {
          params.set('includeChildren', 'true')
        }
      }
      if (filters.status) {
        if (filters.status === 'active') {
          params.set('isActive[eq]', 'true')
        } else if (filters.status === 'inactive') {
          params.set('includeInactive', 'true')
          params.set('isActive[eq]', 'false')
        }
      }

      // Product type filter (simple / variable)
      if (mode === 'variable') {
        // legacy route: فقط محصولات متغیر
        params.set('productType', 'variable')
      } else if (filters.productType) {
        params.set('productType', filters.productType)
      }

      const res = await api.get('/products', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination
      setProducts(list)
      if (pg) {
        setPagination({
          current: pg.currentPage || page,
          pageSize: pg.itemsPerPage || pageSize,
          total: pg.totalItems || list.length,
        })
      }
    } catch (err) {
      message.error(err?.message || 'خطا در دریافت لیست محصولات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts(1, pagination.pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, filters.category, filters.status, filters.productType, includeChildren, dynamicFilters])

  const handleBulkDelete = () => {
    if (!canDelete) {
      message.error('شما مجوز حذف محصول را ندارید.')
      return
    }

    if (selectedRowKeys.length === 0) {
      message.warning('هیچ محصولی انتخاب نشده است')
      return
    }

    Modal.confirm({
      title: 'حذف گروهی محصولات',
      content: `آیا از حذف ${selectedRowKeys.length} محصول انتخاب شده مطمئن هستید؟ این عملیات قابل بازگشت نیست.`,
      okText: 'حذف محصولات انتخاب‌شده',
      cancelText: 'انصراف',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await api.post('/products/bulk-delete', { ids: selectedRowKeys })
          setSelectedRowKeys([])
          fetchProducts()
          message.success(res?.data?.message || 'محصولات انتخاب‌شده با موفقیت حذف شدند')
        } catch (err) {
          message.error(err?.response?.data?.message || err?.message || 'خطا در حذف گروهی محصولات')
        }
      },
    })
  }

  const handleStatusToggle = async (record) => {
    if (!canUpdate) {
      message.error('شما مجوز ویرایش محصول را ندارید.')
      return
    }

    const nextActive = !record.isActive
    try {
      await api.put(`/products/${record._id}`, { isActive: nextActive })
      setProducts((prev) =>
        prev.map((p) =>
          p._id === record._id ? { ...p, isActive: nextActive } : p,
        ),
      )
      message.success('وضعیت محصول با موفقیت به‌روزرسانی شد')
    } catch (err) {
      message.error(err?.message || 'خطا در تغییر وضعیت محصول')
    }
  }

  const columns = [
    {
      title: 'تصویر',
      dataIndex: 'images',
      key: 'image',
      render: (images) => {
        let url = null

        if (Array.isArray(images) && images.length > 0) {
          const first = images[0]
          url = typeof first === 'string' ? first : first?.url
        } else if (typeof images === 'string') {
          url = images
        } else if (images && typeof images === 'object' && images.url) {
          url = images.url
        }

        return url ? (
          <Image src={url} width={50} height={50} style={{ borderRadius: 4 }} />
        ) : null
      },
    },
    {
      title: 'نام محصول',
      dataIndex: 'name',
      key: 'name',
    },
    // ستون نوع محصول (وقتی از صفحه اصلی محصولات استفاده می‌کنیم)
    ...(mode
      ? []
      : [
        {
          title: 'نوع محصول',
          dataIndex: 'productType',
          key: 'productType',
          render: (type) => (type === 'variable' ? 'متغیر' : 'ساده'),
        },
      ]),
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
    },
    {
      title: 'ویژگی‌ها',
      key: 'features',
      render: (_, record) => (
        <Space size={[0, 4]} wrap>
          {record.isSpecialOffer && <Tag color="red">شگفت‌انگیز</Tag>}
          {record.isFlashDeal && <Tag color="gold">لحظه‌ای</Tag>}
        </Space>
      ),
    },
    {
      title: 'دسته‌بندی',
      dataIndex: 'category',
      key: 'category',
      render: (category) =>
        categories.find((c) => c._id === category)?.name || '-',
    },
    {
      title: 'قیمت',
      dataIndex: 'price',
      key: 'price',
      render: (price) =>
        price != null
          ? `${new Intl.NumberFormat('fa-IR').format(price)} تومان`
          : '-',
    },
    {
      title: 'موجودی',
      dataIndex: 'stock',
      key: 'stock',
      render: (stock) => (
        <Tag color={stock > 10 ? 'green' : stock > 0 ? 'orange' : 'red'}>
          {stock} عدد
        </Tag>
      ),
    },
    {
      title: 'وضعیت',
      dataIndex: 'isActive',
      key: 'status',
      render: (status, record) => (
        <Switch
          checked={!!status}
          onChange={() => handleStatusToggle(record)}
          disabled={!canUpdate}
          checkedChildren="فعال"
          unCheckedChildren="غیرفعال"
        />
      ),
    },
    {
      title: 'عملیات',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {canUpdate && (
            <Link to={`/products/edit/${record._id}`}>
            <Button type="primary" size="small" icon={<EditOutlined />}>
              ویرایش
            </Button>
          </Link>
          )}
          {canDelete && (
            <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: 'حذف محصول',
                content:
                  'آیا از حذف این محصول مطمئن هستید؟ این عملیات قابل بازگشت نیست.',
                okText: 'حذف',
                cancelText: 'انصراف',
                okType: 'danger',
                onOk: async () => {
                  try {
                    await api.delete(`/products/${record._id}`)
                    message.success('محصول با موفقیت حذف شد')
                    fetchProducts()
                  } catch (err) {
                    message.error(err?.message || 'خطا در حذف محصول')
                  }
                },
              })
            }}
          >
            حذف
          </Button>
          )}
        </Space>
      ),
    },
  ]

  const rowSelection = canUpdate || canDelete ? {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    preserveSelectedRowKeys: true,
  } : undefined

  const handleSelectAll = async () => {
    if (!canUpdate) {
      message.error('شما مجوز انتخاب گروهی را ندارید.')
      return
    }

    try {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.category) {
        params.set('category', filters.category)
        if (includeChildren) params.set('includeChildren', 'true')
      }
      if (filters.status) {
        if (filters.status === 'active') params.set('isActive[eq]', 'true')
        else if (filters.status === 'inactive') params.set('isActive[eq]', 'false')
      }
      if (mode === 'variable') params.set('productType', 'variable')
      else if (filters.productType) params.set('productType', filters.productType)

      const res = await api.get('/products/all-ids', { params })
      const ids = res?.data?.ids || []
      setSelectedRowKeys(ids)
      message.success(`${ids.length} محصول انتخاب شد`)
    } catch (err) {
      message.error('خطا در انتخاب همه محصولات')
    }
  }

  const onTableChange = (pag) => {
    setPagination((prev) => ({
      ...prev,
      current: pag.current,
      pageSize: pag.pageSize,
    }))
    fetchProducts(pag.current, pag.pageSize)
  }

  // Handle Excel Export
  const handleExport = async () => {
    if (!canExport) {
      message.error('شما مجوز برون‌ریزی ندارید.')
      return
    }

    try {
      const response = await api.get('/products/export/excel', {
        responseType: 'blob',
        timeout: 0,
      })

      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'products.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      message.success('فایل Excel با موفقیت دانلود شد')
    } catch (err) {
      console.error('Error exporting products:', err)
      message.error('خطا در برون‌ریزی محصولات')
    }
  }

  const importLargeCsvInChunks = async (file) => {
    const fileText = await file.text()
    const { headers, rows, parseErrors } = parseCsvText(fileText)

    if (parseErrors.length > 0) {
      const firstError = parseErrors[0]
      throw new Error(`CSV parse error at row ${firstError?.row ?? '-'}: ${firstError?.message || 'unknown error'}`)
    }

    if (!headers.length) {
      throw new Error('CSV header is missing or invalid')
    }

    if (!rows.length) {
      throw new Error('CSV file has no importable rows')
    }

    const chunks = buildCsvChunks(rows, headers)
    let totalImported = 0
    const aggregatedErrors = []

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      message.loading({
        key: CSV_IMPORT_MESSAGE_KEY,
        duration: 0,
        content: `Processing CSV chunk ${chunkIndex + 1} of ${chunks.length}`,
      })

      const chunkCsv = csvSerialize(headers, chunks[chunkIndex])

      let chunkUploaded = false
      let lastError = null

      for (let attempt = 1; attempt <= CSV_CHUNK_RETRY_COUNT; attempt++) {
        try {
          const chunkFormData = new FormData()
          chunkFormData.append(
            'file',
            new Blob([chunkCsv], { type: 'text/csv;charset=utf-8' }),
            `products-chunk-${chunkIndex + 1}.csv`,
          )

          const response = await api.post('/products/import/csv', chunkFormData, {
            timeout: 600000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          })

          const data = response?.data || {}
          totalImported += Number(data.imported || 0)

          if (Array.isArray(data.errors) && data.errors.length > 0) {
            aggregatedErrors.push(...data.errors.map((item) => `Chunk ${chunkIndex + 1}: ${item}`))
          }

          chunkUploaded = true
          lastError = null
          break
        } catch (error) {
          lastError = error
          if (attempt < CSV_CHUNK_RETRY_COUNT) {
            await wait(1000 * attempt)
          }
        }
      }

      if (!chunkUploaded && lastError) {
        throw lastError
      }
    }

    message.destroy(CSV_IMPORT_MESSAGE_KEY)

    return {
      imported: totalImported,
      errors: aggregatedErrors,
      totalChunks: chunks.length,
    }
  }
  // Upload props for CSV import
  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv',
    showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }) => {
      setUploading(true)
      const shouldUseChunkImport = file.size > CSV_DIRECT_UPLOAD_LIMIT_BYTES

      try {
        let data

        if (shouldUseChunkImport) {
          data = await importLargeCsvInChunks(file)
        } else {
          const formData = new FormData()
          formData.append('file', file)

          const response = await api.post('/products/import/csv', formData, {
            timeout: 600000, // 10 minutes timeout for large CSVs
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          })
          data = response.data
        }

        onSuccess(data)
        if (Array.isArray(data?.errors) && data.errors.length > 0) {
          message.warning(`${data.imported || 0} products imported with ${data.errors.length} warnings`)
        } else {
          message.success(data?.message || `${data?.imported || 0} products imported successfully`)
        }

        setImportModalVisible(false)
        fetchProducts() // Refresh product list
      } catch (err) {
        message.destroy(CSV_IMPORT_MESSAGE_KEY)
        console.error('Error importing products:', err)
        const status = err?.response?.status
        const serverMessage = err?.response?.data?.message
        const isNetworkError = !err?.response

        let errorMessage = serverMessage || err.message || 'Error importing products'

        if (status === 413) {
          errorMessage = 'File is larger than the server upload limit'
        } else if (err?.code === 'ECONNABORTED') {
          errorMessage = 'Import request timed out before completion'
        } else if (isNetworkError) {
          errorMessage = 'Network connection dropped during CSV import'
        }

        onError(err)
        message.error(errorMessage)
      } finally {
        message.destroy(CSV_IMPORT_MESSAGE_KEY)
        setUploading(false)
      }
    },
  }

  const handleUpdateTimer = async () => {
    try {
      setLoading(true)
      const endTime = specialOfferEndTime instanceof Date
        ? specialOfferEndTime.toISOString()
        : new Date(specialOfferEndTime).toISOString()

      const res = await api.put('/products/special-offers/timer', { endTime })
      const count = res?.data?.data?.modifiedCount || 0

      if (count > 0) {
        message.success(`زمان برای ${count} محصول با موفقیت به‌روزرسانی شد`)
        setTimerModalVisible(false)
        fetchProducts()
      } else {
        message.warning('هیچ محصولی با وضعیت «شگفت‌انگیز» پیدا نشد. لطفاً ابتدا تیک شگفت‌انگیز را برای محصولات مورد نظر فعال کنید.')
      }
    } catch (err) {
      message.error(err?.message || 'خطا در به‌روزرسانی زمان')
    } finally {
      setLoading(false)
    }
  }

  const handleDisableTimer = async () => {
    try {
      setLoading(true)
      const res = await api.put('/products/special-offers/timer', { disable: true })
      const count = res?.data?.data?.modifiedCount || 0

      message.success(`تایمر برای ${count} محصول غیرفعال شد`)
      setTimerModalVisible(false)
      fetchProducts()
    } catch (err) {
      message.error(err?.message || 'خطا در غیرفعال‌سازی تایمر')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateFlashTimer = async () => {
    try {
      setLoading(true)
      const endTime = flashDealEndTime instanceof Date
        ? flashDealEndTime.toISOString()
        : new Date(flashDealEndTime).toISOString()

      const res = await api.put('/products/flash-deals/timer', { endTime })
      const count = res?.data?.data?.modifiedCount || 0

      if (count > 0) {
        message.success(`Flash Deal timer updated for ${count} products`)
        setFlashTimerModalVisible(false)
        fetchProducts()
      } else {
        message.warning('No products with active Flash Deal found.')
      }
    } catch (err) {
      message.error(err?.message || 'Failed to update Flash Deal timer')
    } finally {
      setLoading(false)
    }
  }

  const handleDisableFlashTimer = async () => {
    try {
      setLoading(true)
      const res = await api.put('/products/flash-deals/timer', { disable: true })
      const count = res?.data?.data?.modifiedCount || 0

      message.success(`Flash Deal timer disabled for ${count} products`)
      setFlashTimerModalVisible(false)
      fetchProducts()
    } catch (err) {
      message.error(err?.message || 'Failed to disable Flash Deal timer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1>لیست محصولات</h1>
        <Space>
          {canImport && (
            <Button icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
            درون‌ریزی CSV
          </Button>
          )}
          {canUpdate && (
            <Button icon={<FieldTimeOutlined />} onClick={() => setTimerModalVisible(true)}>
            تنظیم تایمر
          </Button>
          )}
          {canUpdate && (
            <Button icon={<FieldTimeOutlined />} onClick={() => setFlashTimerModalVisible(true)}>
            Flash Deal Timer
          </Button>
          )}
          {canExport && (
            <Button icon={<ExportOutlined />} onClick={handleExport}>
            برون‌ریزی Excel
          </Button>
          )}
          {canCreate && (
            <Link to="/products/new">
            <Button type="primary" icon={<PlusOutlined />}>
              محصول جدید
            </Button>
          </Link>
          )}
        </Space>
      </div>

      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Input.Group compact style={{ display: 'flex', width: 420 }}>
          <Select
            value={filters.searchField}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, searchField: value }))
            }
            style={{ width: 120 }}
          >
            <Select.Option value="all">همه</Select.Option>
            <Select.Option value="name">نام</Select.Option>
            <Select.Option value="sku">SKU</Select.Option>
          </Select>
          <Input
            placeholder={
              filters.searchField === 'sku' ? 'جستجو بر اساس SKU...' :
                filters.searchField === 'name' ? 'جستجو بر اساس نام محصول...' :
                  'جستجو بر اساس نام یا SKU...'
            }
            prefix={<SearchOutlined />}
            style={{ flex: 1 }}
            allowClear
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
            onPressEnter={() => fetchProducts(1, pagination.pageSize)}
            onBlur={() => fetchProducts(1, pagination.pageSize)}
          />
        </Input.Group>
        <Select
          placeholder="دسته‌بندی"
          style={{ width: 320, minWidth: 240 }}
          allowClear
          loading={categoriesLoading}
          showSearch
          optionLabelProp="label"
          optionFilterProp="label"
          dropdownMatchSelectWidth={false}
          value={filters.category || undefined}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, category: value || null }))
            setDynamicFilters({})
          }}
          onDropdownVisibleChange={(open) => {
            if (open) fetchCategoriesTree()
          }}
        >
          {categories.map((c) => {
            const fullName = String(c.name || '').trim()
            const leafName = String(c.title || '').trim() || fullName
            const separator = ' > '
            const lastSeparatorIndex = fullName.lastIndexOf(separator)
            const parentPath =
              lastSeparatorIndex >= 0 ? fullName.slice(0, lastSeparatorIndex) : ''

            const label = parentPath ? `${leafName} - ${parentPath}` : leafName

            return (
              <Select.Option key={c._id} value={c._id} label={label} title={fullName}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 600 }}>{leafName}</div>
                  {parentPath && <div style={{ fontSize: 11, color: '#888' }}>{parentPath}</div>}
                </div>
              </Select.Option>
            )
          })}
        </Select>
        {filters.category && (
          <Checkbox
            checked={includeChildren}
            onChange={(e) => setIncludeChildren(e.target.checked)}
          >
            نمایش محصولات زیردسته‌ها
          </Checkbox>
        )}
        <Select
          placeholder='وضعیت'
          style={{ width: 150 }}
          allowClear
          onChange={(value) =>
            setFilters((prev) => ({ ...prev, status: value || null }))
          }
        >
          <Select.Option value="active">فعال</Select.Option>
          <Select.Option value="inactive">غیرفعال</Select.Option>
        </Select>
        <Select
          placeholder="نوع محصول"
          style={{ width: 180 }}
          allowClear
          onChange={(value) =>
            setFilters((prev) => ({ ...prev, productType: value || '' }))
          }
        >
          <Select.Option value="simple">محصول ساده</Select.Option>
          <Select.Option value="variable">محصول متغیر</Select.Option>
        </Select>

        {/* Dynamic Filters based on Category */}
        {filters.category && (() => {
          const selectedCategory = categories.find(c => c._id === filters.category)
          if (!selectedCategory || !selectedCategory.properties) return null

          return selectedCategory.properties
            .filter(p => p.isFilterable)
            .map(prop => (
              <Select
                key={prop.name}
                placeholder={prop.name}
                style={{ width: 150 }}
                allowClear
                onChange={(value) =>
                  setDynamicFilters(prev => ({ ...prev, [prop.name]: value }))
                }
                value={dynamicFilters[prop.name]}
              >
                {prop.type === 'select' && prop.options ? (
                  prop.options.map(opt => (
                    <Select.Option key={opt} value={opt}>{opt}</Select.Option>
                  ))
                ) : (
                  // For text/number, we might need a different input, but Select with search/create is often used for consistency or just simple options if available.
                  // If type is not select, we can render Input, but wrapper expects Select for style consistency.
                  // Let's use Input for non-select types?
                  // Providing basic Input or simple Select behavior.
                  // Note: simple Select is better for enumerated attributes, Input is better for arbitrary ones.
                  // Given the code in CategoriesPage, options are only for 'select'.
                  // Let's use Input for others or just support Select for now if the user primarily uses Select.
                  // Actually, let's use Input if not select.
                  null
                )}
                {/* Fallback for non-select types if we want to support them later */}
              </Select>
            ).concat(
              // Handle non-select inputs separately to avoid nesting issues or just map everything
              selectedCategory.properties
                .filter(p => p.isFilterable && p.type !== 'select')
                .map(prop => (
                  <Input
                    key={prop.name}
                    placeholder={prop.name}
                    style={{ width: 150 }}
                    allowClear
                    onChange={(e) =>
                      setDynamicFilters(prev => ({ ...prev, [prop.name]: e.target.value }))
                    }
                    value={dynamicFilters[prop.name] || ''}
                  />
                ))
            ))
        })()}
      </div>

      {rowSelection && (
      <div
        style={{
          marginBottom: 16,
          padding: 12,
          background: selectedRowKeys.length > 0 ? '#e6f7ff' : '#fafafa',
          borderRadius: 8,
          border: selectedRowKeys.length > 0 ? '1px solid #91d5ff' : '1px solid #f0f0f0',
        }}
      >
        <Space wrap>
          {canUpdate && (
          <Button size="small" onClick={handleSelectAll}>
            انتخاب همه محصولات ({pagination.total})
          </Button>
          )}
          {selectedRowKeys.length > 0 && (
            <>
              <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                {selectedRowKeys.length} محصول انتخاب شده
              </span>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>
                لغو انتخاب
              </Button>
              {canUpdate && (
                <>
                  <Button
                    size="small"
                    type="primary"
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    icon={<CheckCircleOutlined />}
                    onClick={() => {
                      Modal.confirm({
                        title: 'فعال‌سازی گروهی',
                        content: `آیا می‌خواهید ${selectedRowKeys.length} محصول را فعال کنید؟`,
                        okText: 'بله، فعال کن',
                        cancelText: 'انصراف',
                        onOk: async () => {
                          try {
                            const res = await api.post('/products/bulk-status', {
                              ids: selectedRowKeys,
                              isActive: true,
                            })
                            message.success(res?.data?.message || 'محصولات فعال شدند')
                            setSelectedRowKeys([])
                            fetchProducts()
                          } catch (err) {
                            message.error('خطا در فعال‌سازی محصولات')
                          }
                        },
                      })
                    }}
                  >
                    فعال‌سازی ({selectedRowKeys.length})
                  </Button>
                  <Button
                    size="small"
                    style={{ background: '#fa8c16', borderColor: '#fa8c16', color: '#fff' }}
                    icon={<StopOutlined />}
                    onClick={() => {
                      Modal.confirm({
                        title: 'غیرفعال‌سازی گروهی',
                        content: `آیا می‌خواهید ${selectedRowKeys.length} محصول را غیرفعال کنید؟`,
                        okText: 'بله، غیرفعال کن',
                        cancelText: 'انصراف',
                        okType: 'danger',
                        onOk: async () => {
                          try {
                            const res = await api.post('/products/bulk-status', {
                              ids: selectedRowKeys,
                              isActive: false,
                            })
                            message.success(res?.data?.message || 'محصولات غیرفعال شدند')
                            setSelectedRowKeys([])
                            fetchProducts()
                          } catch (err) {
                            message.error('خطا در غیرفعال‌سازی محصولات')
                          }
                        },
                      })
                    }}
                  >
                    غیرفعال‌سازی ({selectedRowKeys.length})
                  </Button>
                </>
              )}
              {canDelete && (
              <Button size="small" danger onClick={handleBulkDelete}>
                حذف گروهی ({selectedRowKeys.length})
              </Button>
              )}
            </>
          )}
        </Space>
      </div>
      )}

      <Table
        columns={columns}
        dataSource={products}
        loading={loading}
        rowKey="_id"
        rowSelection={rowSelection}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100', '200', '500'],
          showTotal: (total) => `${total} محصول`,
        }}
        onChange={onTableChange}
      />

      {/* Import Modal */}
      <Modal
        title="درون‌ریزی محصولات از CSV"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <p>
            فایل CSV خود را با فرمت زیر آماده کنید:
          </p>
          <code style={{ display: 'block', padding: 8, background: '#f5f5f5', marginBottom: 8 }}>
            name,sku,productType,price,compareAtPrice,stock,category,brand,description,isActive,isFeatured
          </code>
          <p style={{ fontSize: '0.9em', color: '#666' }}>
            نکته: نام دسته‌بندی و برند باید دقیقاً با نام موجود در سیستم مطابقت داشته باشد.
          </p>
        </div>

        <Dragger {...uploadProps} disabled={uploading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            فایل CSV را اینجا بکشید یا کلیک کنید
          </p>
          <p className="ant-upload-hint">
            فقط فایل‌های با پسوند .csv پذیرفته می‌شوند
          </p>
        </Dragger>
      </Modal>

      {/* Special Offer Timer Modal */}
      <Modal
        title="تنظیم تایمر پیشنهاد شگفت‌انگیز"
        open={timerModalVisible}
        onCancel={() => setTimerModalVisible(false)}
        onOk={handleUpdateTimer}
        okText="ذخیره زمان"
        cancelText="انصراف"
        confirmLoading={loading}
        footer={[
          <Button key="disable" danger onClick={handleDisableTimer} loading={loading}>
            غیرفعال کردن تایمر
          </Button>,
          <Button key="back" onClick={() => setTimerModalVisible(false)}>
            انصراف
          </Button>,
          <Button key="submit" type="primary" onClick={handleUpdateTimer} loading={loading}>
            ذخیره زمان
          </Button>,
        ]}
      >
        <p style={{ marginBottom: 12, color: '#666' }}>
          این زمان برای <strong>همه</strong> محصولاتی که تیک «شگفت‌انگیز» (Special Offer) دارند اعمال خواهد شد.
        </p>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>زمان پایان:</label>
          <JalaliDateTimePicker
            value={specialOfferEndTime}
            onChange={setSpecialOfferEndTime}
          />
        </div>
      </Modal>

      {/* Flash Deal Timer Modal */}
      <Modal
        title="Flash Deal Timer"
        open={flashTimerModalVisible}
        onCancel={() => setFlashTimerModalVisible(false)}
        onOk={handleUpdateFlashTimer}
        okText="Update Timer"
        cancelText="Cancel"
        confirmLoading={loading}
        footer={[
          <Button key="disable" danger onClick={handleDisableFlashTimer} loading={loading}>
            Disable Timer
          </Button>,
          <Button key="back" onClick={() => setFlashTimerModalVisible(false)}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" onClick={handleUpdateFlashTimer} loading={loading}>
            Update Timer
          </Button>,
        ]}
      >
        <p style={{ marginBottom: 12, color: '#666' }}>
          This sets a shared countdown end time for all products marked as Flash Deal.
        </p>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>End time:</label>
          <JalaliDateTimePicker value={flashDealEndTime} onChange={setFlashDealEndTime} />
        </div>
      </Modal>
    </div>
  )
}

export default ProductsList
