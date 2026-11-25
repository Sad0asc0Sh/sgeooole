import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Popconfirm,
  message,
  Switch,
  Alert,
  Segmented,
  Table,
  Row,
  Col,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  GiftOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  ShoppingOutlined,
  CalendarOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import ResponsiveTable from '../../components/ResponsiveTable'
import PageHeader from '../../components/ui/PageHeader'
import StatTile from '../../components/ui/StatTile'
import StatusPill from '../../components/ui/StatusPill'
import JalaliRangePicker from '../../components/JalaliRangePicker'
import PromotionBadgePreview from '../../components/promotions/PromotionBadgePreview'
import {
  SALE_BADGE_THEMES,
  getSaleBadgeTheme,
  calculateDiscountPricing,
  getProductBasePriceRange,
} from '../../utils/promotionPricing'
import { formatPersianShortDate, toSafeDate } from '../../utils/dateUtils'
import { formatCurrency, formatNumber, parseNumericInput } from '../../utils/formatters'
import api from '../../api'

function getSaleStatus(sale) {
  const now = new Date()
  const start = new Date(sale.startDate)
  const end = new Date(sale.endDate)

  if (!sale.isActive) return { key: 'inactive', text: 'غیرفعال', tone: 'neutral' }
  if (now < start) return { key: 'scheduled', text: 'در انتظار شروع', tone: 'info' }
  if (now >= start && now <= end) return { key: 'running', text: 'در حال اجرا', tone: 'ok' }
  return { key: 'ended', text: 'پایان یافته', tone: 'err' }
}

function SalesPage() {
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingSale, setEditingSale] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [conflictMap, setConflictMap] = useState({})
  const [conflictsLoading, setConflictsLoading] = useState(false)

  const [form] = Form.useForm()
  const watchedRange = Form.useWatch('dateRange', form)
  const watchedName = Form.useWatch('name', form)
  const watchedDiscount = Form.useWatch('discountPercentage', form)
  const watchedBadgeTheme = Form.useWatch('badgeTheme', form)
  const watchedShowInFeatured = Form.useWatch('showInFeatured', form)
  const watchedProductIds = Form.useWatch('products', form)

  const fetchSales = async () => {
    setLoading(true)
    try {
      const res = await api.get('/sales/admin')
      const data = res?.data?.data || []
      setSales(Array.isArray(data) ? data : [])
    } catch (err) {
      message.error('خطا در دریافت لیست تخفیف‌ها')
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    setProductsLoading(true)
    try {
      const res = await api.get('/products', {
        params: {
          limit: 1000,
          skipDiscount: 'true',
          fields: 'name,_id,sku,price,productType,variants,stock',
        },
      })
      const data = res?.data?.data || []
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      message.error('خطا در دریافت لیست محصولات')
    } finally {
      setProductsLoading(false)
    }
  }

  const fetchConflicts = async (excludeSaleId, startDate) => {
    setConflictsLoading(true)
    try {
      const res = await api.get('/sales/admin/product-conflicts', {
        params: {
          ...(excludeSaleId ? { excludeSaleId } : {}),
          ...(startDate ? { startDate } : {}),
        },
      })
      const rows = Array.isArray(res?.data?.data) ? res.data.data : []
      const map = {}
      rows.forEach((row) => {
        map[row.productId] = row.conflicts || []
      })
      setConflictMap(map)
      return map
    } catch (err) {
      setConflictMap({})
      message.error('خطا در بررسی محصولاتِ درگیر در پیشنهاد لحظه‌ای/شگفت‌انگیز')
      return {}
    } finally {
      setConflictsLoading(false)
    }
  }

  useEffect(() => {
    fetchSales()
    fetchProducts()
  }, [])

  const watchedStartTs = toSafeDate(watchedRange?.[0])?.getTime() || null

  useEffect(() => {
    if (!modalOpen) return
    const start = toSafeDate(watchedRange?.[0])
    fetchConflicts(editingSale?._id, start ? start.toISOString() : undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, editingSale?._id, watchedStartTs])

  const productMap = useMemo(() => {
    const map = new Map()
    products.forEach((p) => map.set(p._id, p))
    return map
  }, [products])

  const productOptions = useMemo(
    () =>
      products.map((p) => {
        const conflicts = conflictMap[p._id] || []
        const priceRange = getProductBasePriceRange(p)
        return {
          label: p.sku ? `${p.name} (${p.sku})` : p.name,
          value: p._id,
          sku: p.sku || '',
          basePrice: priceRange.minPrice,
          isVariable: priceRange.isVariable,
          disabled: conflicts.length > 0,
          conflicts,
        }
      }),
    [products, conflictMap],
  )

  const selectedProductsPreview = useMemo(() => {
    const ids = Array.isArray(watchedProductIds) ? watchedProductIds : []
    const pct = Number(watchedDiscount) || 0
    return ids
      .map((id) => {
        const prod = productMap.get(id)
        if (!prod) return null
        const range = getProductBasePriceRange(prod)
        const minCalc = calculateDiscountPricing(range.minPrice, pct)
        const maxCalc = calculateDiscountPricing(range.maxPrice, pct)
        return {
          _id: prod._id,
          name: prod.name,
          sku: prod.sku,
          isVariable: range.isVariable,
          minBase: range.minPrice,
          maxBase: range.maxPrice,
          minFinal: minCalc.finalPrice,
          maxFinal: maxCalc.finalPrice,
          savings: minCalc.savings,
        }
      })
      .filter(Boolean)
  }, [watchedProductIds, watchedDiscount, productMap])

  const previewBasePrice =
    selectedProductsPreview[0]?.minBase > 0 ? selectedProductsPreview[0].minBase : 2500000
  const isSamplePreviewPrice = !(selectedProductsPreview[0]?.minBase > 0)

  const kpiStats = useMemo(() => {
    let running = 0
    let scheduled = 0
    const coveredIds = new Set()
    sales.forEach((s) => {
      const st = getSaleStatus(s)
      if (st.key === 'running') running++
      if (st.key === 'scheduled') scheduled++
      if (st.key === 'running' && Array.isArray(s.products)) {
        s.products.forEach((p) => coveredIds.add(typeof p === 'object' ? p._id : p))
      }
    })
    return { total: sales.length, running, scheduled, covered: coveredIds.size }
  }, [sales])

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sales.filter((s) => {
      if (statusFilter !== 'all' && getSaleStatus(s).key !== statusFilter) return false
      if (q && !String(s.name || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [sales, statusFilter, search])

  const openCreateModal = () => {
    setEditingSale(null)
    form.resetFields()
    form.setFieldsValue({
      isActive: true,
      showInFeatured: true,
      badgeTheme: 'lime-blue',
      discountPercentage: 15,
      products: [],
    })
    setModalOpen(true)
  }

  const openEditModal = (sale) => {
    setEditingSale(sale)
    form.resetFields()
    form.setFieldsValue({
      name: sale.name,
      discountPercentage: sale.discountPercentage,
      dateRange: [new Date(sale.startDate), new Date(sale.endDate)],
      products: sale.products?.map((p) => (typeof p === 'object' ? p._id : p)) || [],
      isActive: sale.isActive,
      badgeTheme: sale.badgeTheme || 'lime-blue',
      showInFeatured: sale.showInFeatured !== false,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const startDate = toSafeDate(values.dateRange?.[0])
      const endDate = toSafeDate(values.dateRange?.[1])

      if (!startDate || !endDate) {
        message.error('لطفاً تاریخ شروع و پایان را به‌درستی انتخاب کنید')
        return
      }
      if (endDate <= startDate) {
        message.error('تاریخ پایان باید بعد از تاریخ شروع باشد')
        return
      }

      const payload = {
        name: values.name,
        discountPercentage: values.discountPercentage,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        products: values.products || [],
        isActive: values.isActive,
        badgeTheme: values.badgeTheme,
        showInFeatured: values.showInFeatured !== false,
      }

      setSaving(true)

      if (editingSale) {
        await api.put(`/sales/admin/${editingSale._id}`, payload)
        message.success('تخفیف با موفقیت به‌روزرسانی شد')
      } else {
        await api.post('/sales/admin', payload)
        message.success('تخفیف جدید با موفقیت ایجاد شد')
      }

      setModalOpen(false)
      setEditingSale(null)
      form.resetFields()
      fetchSales()
    } catch (err) {
      if (err?.errorFields) return
      if (err?.response?.status === 409) {
        const start = toSafeDate(form.getFieldValue('dateRange')?.[0])
        fetchConflicts(editingSale?._id, start ? start.toISOString() : undefined)
      }
      message.error(
        err?.response?.data?.message ||
          err?.message ||
          (editingSale ? 'خطا در به‌روزرسانی تخفیف' : 'خطا در ایجاد تخفیف'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (sale) => {
    try {
      await api.delete(`/sales/admin/${sale._id}`)
      message.success('تخفیف با موفقیت حذف شد')
      fetchSales()
    } catch (err) {
      message.error('خطا در حذف تخفیف')
    }
  }

  const columns = [
    {
      title: 'نام و لیبل کمپین',
      dataIndex: 'name',
      key: 'name',
      mobileTitle: true,
      render: (name, record) => {
        const theme = getSaleBadgeTheme(record.badgeTheme)
        return (
          <Space direction="vertical" size={4}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                borderRadius: 999,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                background: theme.gradient,
              }}
            >
              {name}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>{theme.label}</span>
          </Space>
        )
      },
    },
    {
      title: 'درصد تخفیف',
      dataIndex: 'discountPercentage',
      key: 'discountPercentage',
      render: (value) => (
        <StatusPill size="sm" tone="brand" label={`${formatNumber(value)}٪ تخفیف`} />
      ),
    },
    {
      title: 'تاریخ شروع',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (date) => formatPersianShortDate(date, true),
    },
    {
      title: 'تاریخ پایان',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date) => formatPersianShortDate(date, true),
    },
    {
      title: 'محصولات',
      dataIndex: 'products',
      key: 'products',
      align: 'center',
      render: (list) => (
        <Tag color="blue">{formatNumber(Array.isArray(list) ? list.length : 0)} محصول</Tag>
      ),
    },
    {
      title: 'نمایش در منتخب‌ها',
      dataIndex: 'showInFeatured',
      key: 'showInFeatured',
      render: (value) =>
        value === false ? (
          <StatusPill size="sm" tone="neutral" label="فقط قیمت تخفیفی" />
        ) : (
          <StatusPill size="sm" tone="ok" label="منتخب‌های صفحه اصلی" />
        ),
    },
    {
      title: 'وضعیت',
      mobileBadge: true,
      key: 'status',
      render: (_, record) => {
        const status = getSaleStatus(record)
        return <StatusPill tone={status.tone} label={status.text} />
      },
    },
    {
      title: 'عملیات',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            ویرایش
          </Button>
          <Popconfirm
            title="حذف تخفیف"
            description="آیا از حذف این تخفیف مطمئن هستید؟"
            okText="حذف"
            cancelText="انصراف"
            onConfirm={() => handleDelete(record)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              حذف
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <PageHeader
        title="تخفیف‌های زمان‌دار و کمپین‌های لیبل سفارشی"
        subtitle="ساخت کمپین با لیبل و رنگ دلخواه، پیش‌نمایش قیمت نهایی محصولات و کنترل نمایش در منتخب‌های صفحه اصلی"
        count={sales.length}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            ایجاد کمپین جدید
          </Button>
        }
      />

      <div className="kpi-grid">
        <StatTile label="کل کمپین‌ها" value={formatNumber(kpiStats.total)} icon={<GiftOutlined />} tone="neutral" />
        <StatTile label="در حال اجرا" value={formatNumber(kpiStats.running)} icon={<ThunderboltOutlined />} tone="ok" />
        <StatTile label="زمان‌بندی‌شده" value={formatNumber(kpiStats.scheduled)} icon={<CalendarOutlined />} tone="info" />
        <StatTile label="محصولات در تخفیف فعال" value={formatNumber(kpiStats.covered)} icon={<ShoppingOutlined />} tone="brand" />
      </div>

      <div className="filter-bar">
        <Input
          placeholder="جستجو در نام کمپین..."
          prefix={<SearchOutlined />}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 240 }}
        />
        <div className="quick-tabs-bar">
          <Segmented
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: 'همه', value: 'all' },
              { label: 'در حال اجرا', value: 'running' },
              { label: 'در انتظار شروع', value: 'scheduled' },
              { label: 'پایان یافته', value: 'ended' },
              { label: 'غیرفعال', value: 'inactive' },
            ]}
          />
        </div>
      </div>

      <Card>
        <ResponsiveTable
          columns={columns}
          dataSource={filteredSales}
          loading={loading}
          rowKey="_id"
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditingSale(null)
          form.resetFields()
        }}
        onOk={handleSubmit}
        confirmLoading={saving}
        title={editingSale ? 'ویرایش کمپین تخفیف زمان‌دار' : 'ایجاد کمپین تخفیف زمان‌دار جدید'}
        okText="ذخیره کمپین"
        cancelText="انصراف"
        width={840}
      >
        <Form layout="vertical" form={form}>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={14}>
              <Form.Item
                name="name"
                label="نام و متن لیبل کمپین"
                rules={[{ required: true, message: 'لطفاً نام تخفیف را وارد کنید' }]}
              >
                <Input placeholder="مثلاً: حراج ویژه پایان فصل" />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item
                name="discountPercentage"
                label="درصد تخفیف (%)"
                rules={[
                  { required: true, message: 'لطفاً درصد تخفیف را وارد کنید' },
                  { type: 'number', min: 1, max: 99, message: 'درصد تخفیف باید بین ۱ تا ۹۹ باشد' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={99}
                  placeholder="مثلاً: ۲۰"
                  addonAfter="%"
                  parser={parseNumericInput}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="dateRange"
            label="بازه زمانی اجرا (تاریخ و ساعت شمسی)"
            rules={[
              {
                validator: (_, val) => {
                  if (Array.isArray(val) && toSafeDate(val[0]) && toSafeDate(val[1])) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('لطفاً تاریخ و ساعت شروع و پایان را انتخاب کنید'))
                },
              },
            ]}
          >
            <JalaliRangePicker showTime presets />
          </Form.Item>

          <Form.Item
            name="badgeTheme"
            label="رنگ و تم لیبل روی کارت محصول"
            initialValue="lime-blue"
          >
            <ThemeSwatchSelector />
          </Form.Item>

          {/* Live Storefront Card & Badge Preview */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>
              پیش‌نمایش زنده لیبل و قیمت در ویترین فروشگاه:
            </div>
            <PromotionBadgePreview
              mode="custom"
              label={watchedName}
              themeKey={watchedBadgeTheme}
              discountPercent={watchedDiscount || 0}
              basePrice={previewBasePrice}
              showInFeatured={watchedShowInFeatured !== false}
              isSamplePrice={isSamplePreviewPrice}
            />
          </div>

          <Form.Item
            name="products"
            label="محصولات شامل کمپین"
            extra="محصولاتی که در «زمان‌دار (لحظه‌ای)» یا «شگفت‌انگیز» فعال‌اند غیرقابل انتخاب هستند."
          >
            <Select
              mode="multiple"
              placeholder="جستجو و انتخاب محصولات..."
              loading={productsLoading || conflictsLoading}
              showSearch
              optionLabelProp="label"
              filterOption={(input, option) => {
                const s = (input || '').toString().toLowerCase()
                return (
                  (option?.label ?? '').toString().toLowerCase().includes(s) ||
                  (option?.sku ?? '').toString().toLowerCase().includes(s)
                )
              }}
              options={productOptions}
              optionRender={(option) => {
                const conflicts = option.data.conflicts || []
                const base = option.data.basePrice || 0
                const pct = Number(watchedDiscount) || 0
                const calc = calculateDiscountPricing(base, pct)
                return (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{option.data.label}</span>
                    <Space size={6}>
                      {base > 0 && (
                        <span style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>
                          {formatCurrency(base)}
                          {pct > 0 ? ` ← ${formatCurrency(calc.finalPrice)}` : ''}
                        </span>
                      )}
                      {conflicts.map((c) => (
                        <Tag key={c.type} color={c.type === 'flash' ? 'gold' : 'red'} style={{ marginInlineEnd: 0 }}>
                          {c.label} فعال است
                        </Tag>
                      ))}
                    </Space>
                  </div>
                )
              }}
            />
          </Form.Item>

          {Object.keys(conflictMap).length > 0 && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`${formatNumber(Object.keys(conflictMap).length)} محصول در پیشنهاد لحظه‌ای یا شگفت‌انگیز فعال هستند و در این فهرست غیرفعال شده‌اند.`}
            />
          )}

          {/* Live Selected Products Final Price Preview Table */}
          {selectedProductsPreview.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-800)', marginBottom: 8 }}>
                محاسبه قیمت نهایی تمام‌شده محصولات انتخاب‌شده ({formatNumber(selectedProductsPreview.length)} محصول):
              </div>
              <Table
                size="small"
                bordered
                rowKey="_id"
                pagination={false}
                scroll={{ y: 220, x: 'max-content' }}
                dataSource={selectedProductsPreview}
                columns={[
                  {
                    title: 'محصول',
                    dataIndex: 'name',
                    key: 'name',
                    render: (name, r) => (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>{name}</div>
                        {r.sku && (
                          <div style={{ fontSize: 11, color: 'var(--ink-400)', fontFamily: 'monospace' }}>
                            {r.sku}
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    title: 'قیمت پایه',
                    key: 'base',
                    render: (_, r) =>
                      r.isVariable && r.minBase !== r.maxBase
                        ? `از ${formatCurrency(r.minBase)}`
                        : formatCurrency(r.minBase),
                  },
                  {
                    title: 'قیمت نهایی پس از تخفیف',
                    key: 'final',
                    render: (_, r) => (
                      <strong style={{ color: 'var(--ok)' }}>
                        {r.isVariable && r.minFinal !== r.maxFinal
                          ? `از ${formatCurrency(r.minFinal)}`
                          : formatCurrency(r.minFinal)}
                      </strong>
                    ),
                  },
                  {
                    title: 'حذف',
                    key: 'rm',
                    width: 60,
                    align: 'center',
                    render: (_, r) => (
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<CloseOutlined />}
                        onClick={() => {
                          const cur = form.getFieldValue('products') || []
                          form.setFieldValue(
                            'products',
                            cur.filter((pid) => pid !== r._id),
                          )
                        }}
                      />
                    ),
                  },
                ]}
              />
            </div>
          )}

          <Row gutter={[16, 12]}>
            <Col xs={24} md={14}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-sunken)',
                }}
              >
                <Form.Item
                  name="showInFeatured"
                  label="نمایش در بخش منتخب‌های صفحه اصلی"
                  valuePropName="checked"
                  style={{ marginBottom: 4 }}
                >
                  <Switch checkedChildren="نمایش داده شود" unCheckedChildren="فقط قیمت تخفیفی" />
                </Form.Item>
                <div style={{ fontSize: 11.5, color: 'var(--ink-500)', lineHeight: 1.6 }}>
                  اختیاری: اگر روشن باشد محصولات با لیبل همین کمپین در بخش «پیشنهادهای منتخب» صفحه اصلی نمایش داده می‌شوند.
                </div>
              </div>
            </Col>
            <Col xs={24} md={10}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-sunken)',
                  height: '100%',
                }}
              >
                <Form.Item name="isActive" label="وضعیت کمپین" valuePropName="checked" style={{ marginBottom: 4 }}>
                  <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
                </Form.Item>
                <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>
                  کمپین‌های غیرفعال تا زمان فعال‌سازی روی قیمت‌ها اعمال نمی‌شوند.
                </div>
              </div>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

function ThemeSwatchSelector({ value = 'lime-blue', onChange }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 10,
      }}
    >
      {SALE_BADGE_THEMES.map((theme) => {
        const selected = value === theme.value
        return (
          <button
            key={theme.value}
            type="button"
            onClick={() => onChange?.(theme.value)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: 10,
              borderRadius: 10,
              border: selected ? '2px solid var(--brand-600)' : '1px solid var(--line)',
              background: selected ? 'var(--brand-50)' : '#ffffff',
              cursor: 'pointer',
              textAlign: 'start',
              fontFamily: 'inherit',
            }}
          >
            <div
              style={{
                width: '100%',
                height: 12,
                borderRadius: 999,
                background: theme.gradient,
              }}
            />
            <span style={{ fontSize: 12.5, fontWeight: selected ? 700 : 500, color: 'var(--ink-800)' }}>
              {theme.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default SalesPage
