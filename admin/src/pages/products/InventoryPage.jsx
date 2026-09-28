import PageHeader from '../../components/ui/PageHeader'
import { useEffect, useState } from 'react'
import {
  Card,
  InputNumber,
  Button,
  message,
  Tag,
  Space,
  Input,
  Select,
  Alert,
} from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
import { SearchOutlined, SaveOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons'
import api from '../../api'
import S3AdminImage from '../../components/S3AdminImage'

function InventoryPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
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

      // فقط محصولات ساده را واکشی کن (محصولات متغیر موجودی در variants دارند)
      params.set('productType', 'simple')

      if (filters.search) {
        params.set('search', filters.search)
      }

      const res = await api.get('/products', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination

      // Apply stock filter on client side if needed
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
      await api.put(`/products/${product._id}/stock`, {
        stock: newStock,
      })

      // Update local state
      setProducts((prev) =>
        prev.map((p) => (p._id === product._id ? { ...p, stock: newStock } : p)),
      )

      // Remove from edited stocks
      setEditedStocks((prev) => {
        const updated = { ...prev }
        delete updated[product._id]
        return updated
      })

      message.success(`موجودی محصول "${product.name}" به‌روزرسانی شد`)
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'خطا در به‌روزرسانی موجودی'
      message.error(errorMsg)
      console.error('Stock update error:', err)
    } finally {
      setUpdatingIds((prev) => {
        const updated = new Set(prev)
        updated.delete(product._id)
        return updated
      })
    }
  }

  const getStockColor = (stock) => {
    if (stock === 0) return 'red'
    if (stock <= 10) return 'orange'
    return 'green'
  }

  const columns = [
    {
      title: 'تصویر',
      dataIndex: 'images',
      key: 'image',
      width: 80,
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
              background: '#f0f0f0',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#999',
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
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 150,
      render: (sku) => sku || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'موجودی فعلی',
      dataIndex: 'stock',
      key: 'currentStock',
      width: 120,
      render: (stock) => (
        <Tag color={getStockColor(stock)}>
          {stock} عدد
        </Tag>
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
          disabled={updatingIds.has(record._id)}
        />
      ),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 120,
      render: (_, record) => {
        const hasChanges = editedStocks[record._id] !== undefined &&
                          editedStocks[record._id] !== record.stock
        const isUpdating = updatingIds.has(record._id)

        return (
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            loading={isUpdating}
            disabled={!hasChanges}
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
    <div>
      <PageHeader
        title="مدیریت موجودی"
        subtitle="تنظیم تعداد موجودی محصولات ساده"
        actions={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setEditedStocks({})
              fetchProducts()
            }}
          >
            بارگذاری مجدد
          </Button>
        }
      />

      <Alert
        message="توجه"
        description="این صفحه فقط برای مدیریت موجودی محصولات ساده است. برای محصولات متغیر، موجودی باید در سطح هر variant در صفحه ویرایش محصول تنظیم شود."
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
        closable
      />

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
          style={{ width: 300, maxWidth: '100%' }}
          allowClear
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, search: e.target.value }))
          }
          onPressEnter={() => fetchProducts(1, pagination.pageSize)}
          onBlur={() => fetchProducts(1, pagination.pageSize)}
        />
        <Select
          placeholder="وضعیت موجودی"
          style={{ width: 200, maxWidth: '100%' }}
          allowClear
          onChange={(value) =>
            setFilters((prev) => ({ ...prev, stockStatus: value || null }))
          }
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
            showTotal: (total) => `${total} محصول`,
          }}
          onChange={onTableChange}
          locale={{
            emptyText: (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 0',
                  color: '#999',
                }}
              >
                <p>هیچ محصولی یافت نشد</p>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  )
}

export default InventoryPage
