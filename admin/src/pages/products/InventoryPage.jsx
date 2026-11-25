import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  InputNumber,
  Button,
  message,
  Input,
  Select,
  Alert,
  Space,
} from 'antd'
import {
  SearchOutlined,
  SaveOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  WarningOutlined,
  EditOutlined,
} from '@ant-design/icons'
import ResponsiveTable from '../../components/ResponsiveTable'
import PageHeader from '../../components/ui/PageHeader'
import StatTile from '../../components/ui/StatTile'
import StatusPill from '../../components/ui/StatusPill'
import S3AdminImage from '../../components/S3AdminImage'
import { formatNumber, parseNumericInput } from '../../utils/formatters'
import api from '../../api'

function InventoryPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [updatingIds, setUpdatingIds] = useState(new Set())
  const [editedStocks, setEditedStocks] = useState({})
  const [filters, setFilters] = useState({
    search: '',
    stockStatus: null,
  })
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  })

  const fetchProducts = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))
      params.set('sort', 'name')
      params.set('fields', 'name,sku,stock,images,_id,isActive,productType')
      params.set('productType', 'simple')

      if (filters.search) params.set('search', filters.search)

      const res = await api.get('/products', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination

      let filteredList = list
      if (filters.stockStatus === 'low') {
        filteredList = list.filter((p) => p.stock > 0 && p.stock <= 10)
      } else if (filters.stockStatus === 'out') {
        filteredList = list.filter((p) => p.stock === 0)
      } else if (filters.stockStatus === 'in') {
        filteredList = list.filter((p) => p.stock > 10)
      }

      setProducts(filteredList)
      if (pg) {
        setPagination({
          current: pg.currentPage || page,
          pageSize: pg.itemsPerPage || pageSize,
          total: pg.totalItems || filteredList.length,
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
  }, [filters.search, filters.stockStatus])

  const kpiStats = useMemo(() => {
    let low = 0
    let out = 0
    products.forEach((p) => {
      if ((p.stock || 0) <= 0) out++
      else if (p.stock <= 10) low++
    })
    const dirtyCount = products.filter(
      (p) => editedStocks[p._id] !== undefined && editedStocks[p._id] !== p.stock,
    ).length
    return { pageCount: products.length, low, out, dirtyCount }
  }, [products, editedStocks])

  const handleStockChange = (productId, value) => {
    setEditedStocks((prev) => ({
      ...prev,
      [productId]: value,
    }))
  }

  const handleUpdateStock = async (product) => {
    const newStock = editedStocks[product._id]
    if (newStock === undefined || newStock === product.stock) {
      message.warning('مقدار موجودی تغییری نکرده است')
      return
    }
    if (newStock < 0) {
      message.error('موجودی نمی‌تواند منفی باشد')
      return
    }

    setUpdatingIds((prev) => new Set(prev).add(product._id))
    try {
      await api.put(`/products/${product._id}/stock`, { stock: newStock })
      setProducts((prev) =>
        prev.map((p) => (p._id === product._id ? { ...p, stock: newStock } : p)),
      )
      setEditedStocks((prev) => {
        const updated = { ...prev }
        delete updated[product._id]
        return updated
      })
      message.success(`موجودی محصول "${product.name}" به‌روزرسانی شد`)
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || 'خطا در به‌روزرسانی موجودی')
    } finally {
      setUpdatingIds((prev) => {
        const updated = new Set(prev)
        updated.delete(product._id)
        return updated
      })
    }
  }

  const handleBulkSave = async () => {
    const changed = products.filter(
      (p) =>
        editedStocks[p._id] !== undefined &&
        editedStocks[p._id] !== p.stock &&
        editedStocks[p._id] >= 0,
    )
    if (changed.length === 0) return

    setBulkSaving(true)
    let saved = 0
    let failed = 0
    for (const product of changed) {
      try {
        const newStock = editedStocks[product._id]
        await api.put(`/products/${product._id}/stock`, { stock: newStock })
        saved++
        setProducts((prev) =>
          prev.map((p) => (p._id === product._id ? { ...p, stock: newStock } : p)),
        )
        setEditedStocks((prev) => {
          const next = { ...prev }
          delete next[product._id]
          return next
        })
      } catch {
        failed++
      }
    }
    setBulkSaving(false)
    if (saved > 0) message.success(`موجودی ${formatNumber(saved)} محصول با موفقیت ذخیره شد`)
    if (failed > 0) message.error(`ذخیره موجودی ${formatNumber(failed)} محصول ناموفق بود`)
  }

  const columns = [
    {
      title: 'تصویر',
      dataIndex: 'images',
      key: 'image',
      width: 80,
      mobileThumb: true,
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
          <S3AdminImage src={url} width={50} height={50} />
        ) : (
          <div
            style={{
              width: 50,
              height: 50,
              background: 'var(--surface-inset)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: 'var(--ink-400)',
            }}
          >
            بدون تصویر
          </div>
        )
      },
    },
    {
      title: 'نام محصول',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      mobileTitle: true,
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 140,
      render: (sku) => <span style={{ fontFamily: 'monospace' }}>{sku || '—'}</span>,
    },
    {
      title: 'موجودی فعلی',
      dataIndex: 'stock',
      key: 'currentStock',
      width: 130,
      mobileBadge: true,
      render: (stock) => (
        <StatusPill
          size="sm"
          tone={stock === 0 ? 'err' : stock <= 10 ? 'warn' : 'ok'}
          label={stock === 0 ? 'ناموجود' : `${formatNumber(stock)} عدد`}
        />
      ),
    },
    {
      title: 'موجودی جدید',
      key: 'newStock',
      width: 150,
      render: (_, record) => (
        <InputNumber
          min={0}
          value={editedStocks[record._id] ?? record.stock}
          onChange={(value) => handleStockChange(record._id, value)}
          style={{ width: '100%' }}
          disabled={updatingIds.has(record._id) || bulkSaving}
          parser={parseNumericInput}
        />
      ),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 120,
      render: (_, record) => {
        const hasChanges =
          editedStocks[record._id] !== undefined && editedStocks[record._id] !== record.stock
        return (
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            loading={updatingIds.has(record._id)}
            disabled={!hasChanges || bulkSaving}
            onClick={() => handleUpdateStock(record)}
          >
            ذخیره
          </Button>
        )
      },
    },
  ]

  const onTableChange = (pag) => {
    setPagination((prev) => ({
      ...prev,
      current: pag.current,
      pageSize: pag.pageSize,
    }))
    fetchProducts(pag.current, pag.pageSize)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <PageHeader
        title="مدیریت موجودی و انبار"
        subtitle="تنظیم سریع و گروهی تعداد موجودی محصولات ساده"
        count={pagination.total}
        actions={
          <Space wrap>
            {kpiStats.dirtyCount > 0 && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={bulkSaving}
                onClick={handleBulkSave}
              >
                ذخیره همه تغییرات ({formatNumber(kpiStats.dirtyCount)})
              </Button>
            )}
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={() => {
                setEditedStocks({})
                fetchProducts()
              }}
            >
              به‌روزرسانی
            </Button>
          </Space>
        }
      />

      <div className="kpi-grid">
        <StatTile label="محصولات این صفحه" value={formatNumber(kpiStats.pageCount)} icon={<InboxOutlined />} tone="info" />
        <StatTile label="موجودی کم (۱ تا ۱۰)" value={formatNumber(kpiStats.low)} icon={<WarningOutlined />} tone="warn" />
        <StatTile label="ناموجود (۰)" value={formatNumber(kpiStats.out)} icon={<InboxOutlined />} tone={kpiStats.out > 0 ? 'err' : 'ok'} />
        <StatTile label="تغییرات ذخیره‌نشده" value={formatNumber(kpiStats.dirtyCount)} icon={<EditOutlined />} tone={kpiStats.dirtyCount > 0 ? 'brand' : 'neutral'} />
      </div>

      <Alert
        message="توجه"
        description="این صفحه برای مدیریت موجودی محصولات ساده است. موجودی محصولات متغیر در تب «ویژگی‌ها و متغیرها»ی صفحه ویرایش همان محصول تنظیم می‌شود."
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        closable
      />

      <div className="filter-bar">
        <Input
          placeholder="جستجو بر اساس نام یا SKU..."
          prefix={<SearchOutlined />}
          style={{ width: 300, maxWidth: '100%' }}
          allowClear
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          onPressEnter={() => fetchProducts(1, pagination.pageSize)}
          onBlur={() => fetchProducts(1, pagination.pageSize)}
        />
        <Select
          placeholder="وضعیت موجودی"
          style={{ width: 200, maxWidth: '100%' }}
          allowClear
          onChange={(value) => setFilters((prev) => ({ ...prev, stockStatus: value || null }))}
        >
          <Select.Option value="in">موجود (بیش از ۱۰)</Select.Option>
          <Select.Option value="low">کم (۱ تا ۱۰)</Select.Option>
          <Select.Option value="out">ناموجود (۰)</Select.Option>
        </Select>
      </div>

      <Card>
        <ResponsiveTable
          columns={columns}
          dataSource={products}
          loading={loading}
          rowKey="_id"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `${formatNumber(total)} محصول`,
          }}
          onChange={onTableChange}
        />
      </Card>
    </div>
  )
}

export default InventoryPage
