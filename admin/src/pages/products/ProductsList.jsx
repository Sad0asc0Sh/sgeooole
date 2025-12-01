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
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import api from '../../api'
import JalaliDateTimePicker from '../../components/JalaliDateTimePicker'

const { Dragger } = Upload

function ProductsList({ mode }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [filters, setFilters] = useState({
    search: '',
    category: null,
    status: null,
    productType: '',
  })
  const [includeChildren, setIncludeChildren] = useState(true)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [categories, setCategories] = useState([])
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [timerModalVisible, setTimerModalVisible] = useState(false)
  const [specialOfferEndTime, setSpecialOfferEndTime] = useState('')

  useEffect(() => {
    ; (async () => {
      try {
        const res = await api.get('/categories', {
          params: { limit: 1000, fields: 'name,slug,_id' },
        })
        setCategories(res?.data?.data || [])
      } catch (_) { }
    })()
  }, [])

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ text: c.name, value: c._id })),
    [categories],
  )

  const fetchProducts = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))
      params.set('sort', '-createdAt')
      params.set('fields', 'name,sku,price,stock,isActive,images,_id,category,productType')

      if (filters.search) params.set('search', filters.search)
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
  }, [mode, filters.category, filters.status, filters.productType, includeChildren])

  const handleBulkDelete = () => {
    Modal.confirm({
      title: 'حذف گروهی محصولات',
      content: `آیا از حذف ${selectedRowKeys.length} محصول انتخاب شده مطمئن هستید؟ این عملیات قابل بازگشت نیست.`,
      okText: 'حذف محصولات انتخاب‌شده',
      cancelText: 'انصراف',
      okType: 'danger',
      onOk: async () => {
        try {
          await Promise.all(
            selectedRowKeys.map((id) => api.delete(`/products/${id}`)),
          )
          setSelectedRowKeys([])
          fetchProducts()
          message.success('محصولات انتخاب‌شده با موفقیت حذف شدند')
        } catch (err) {
          message.error(err?.message || 'خطا در حذف گروهی محصولات')
        }
      },
    })
  }

  const handleStatusToggle = async (record) => {
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
          <Link to={`/products/edit/${record._id}`}>
            <Button type="primary" size="small" icon={<EditOutlined />}>
              ویرایش
            </Button>
          </Link>
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
        </Space>
      ),
    },
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
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
    try {
      const response = await api.get('/products/export/excel', {
        responseType: 'blob',
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

  // Upload props for CSV import
  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv',
    showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }) => {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/products/import/csv`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'خطا در آپلود فایل')
        }

        onSuccess(data)
        message.success(data.message || 'محصولات با موفقیت درون‌ریزی شدند')
        setImportModalVisible(false)
        fetchProducts() // Refresh product list
      } catch (err) {
        console.error('Error importing products:', err)
        onError(err)
        message.error(err.message || 'خطا در درون‌ریزی محصولات')
      } finally {
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
          <Button icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
            درون‌ریزی CSV
          </Button>
          <Button icon={<FieldTimeOutlined />} onClick={() => setTimerModalVisible(true)}>
            تنظیم تایمر
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            برون‌ریزی Excel
          </Button>
          <Link to="/products/new">
            <Button type="primary" icon={<PlusOutlined />}>
              محصول جدید
            </Button>
          </Link>
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
        <Input
          placeholder="جستجو بر اساس نام یا SKU..."
          prefix={<SearchOutlined />}
          style={{ width: 300 }}
          allowClear
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, search: e.target.value }))
          }
          onPressEnter={() => fetchProducts(1, pagination.pageSize)}
          onBlur={() => fetchProducts(1, pagination.pageSize)}
        />
        <Select
          placeholder="دسته‌بندی"
          style={{ width: 200 }}
          allowClear
          onChange={(value) =>
            setFilters((prev) => ({ ...prev, category: value || null }))
          }
        >
          {categories.map((c) => (
            <Select.Option key={c._id} value={c._id}>
              {c.name}
            </Select.Option>
          ))}
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
      </div>

      {selectedRowKeys.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            background: '#e6f7ff',
            borderRadius: 8,
          }}
        >
          <Space>
            <span>{selectedRowKeys.length} محصول انتخاب شده است</span>
            <Button size="small" danger onClick={handleBulkDelete}>
              حذف گروهی
            </Button>
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
    </div>
  )
}

export default ProductsList
