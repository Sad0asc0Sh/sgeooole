import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, Button, Skeleton, Empty, Segmented, Space } from 'antd'
import {
  DollarOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  UserAddOutlined,
  RiseOutlined,
  FallOutlined,
  CustomerServiceOutlined,
  ReloadOutlined,
  InboxOutlined,
  WarningOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  TagOutlined,
} from '@ant-design/icons'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { getStatusLabel, formatCurrency, formatNumber } from '../utils/formatters'
import { formatChartDate, formatPersianShortDate } from '../utils/dateUtils'
import { PERMISSIONS } from '../rbac/permissions'
import { useCan } from '../rbac/useCan'
import PageHeader from '../components/ui/PageHeader'
import StatTile from '../components/ui/StatTile'
import EmptyState from '../components/ui/EmptyState'
import StatusPill from '../components/ui/StatusPill'
import ResponsiveTable from '../components/ResponsiveTable'
import './Dashboard.css'

function GrowthFoot({ value, prefix = 'نسبت به دوره قبل', extra }) {
  const num = Number(value)
  const hasGrowth = Number.isFinite(num)
  const up = num >= 0
  const formattedPct = Math.abs(num).toLocaleString('fa-IR', { maximumFractionDigits: 1 })
  return (
    <>
      {hasGrowth && (
        <span className={up ? 'up' : 'down'}>
          {up ? <RiseOutlined /> : <FallOutlined />} {formattedPct}٪ {prefix}
        </span>
      )}
      {extra ? <span style={{ color: 'var(--ink-400)' }}>{extra}</span> : null}
    </>
  )
}

function ChartEmpty() {
  return (
    <div className="chart-empty">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="برای این بازه داده‌ای برای نمایش وجود ندارد"
      />
    </div>
  )
}

function compactAxisValue(val) {
  const n = Number(val) || 0
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} م‌ت`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} م`
  if (n >= 1_000) return `${Math.round(n / 1_000)} ه`
  return n.toLocaleString('fa-IR')
}

const PIPELINE_META = [
  { key: 'Pending', label: 'ثبت سفارش', color: '#8a6200' },
  { key: 'Processing', label: 'در حال پردازش', color: '#0e7490' },
  { key: 'Shipped', label: 'تحویل به پست', color: '#b45309' },
  { key: 'Delivered', label: 'تحویل شده', color: '#0f6b33' },
  { key: 'Cancelled', label: 'لغو شده', color: '#b3261e' },
]

function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [days, setDays] = useState(7)
  const [chartMetric, setChartMetric] = useState('sales')
  const navigate = useNavigate()
  const { can } = useCan()

  const canCreateProduct = can(PERMISSIONS.PRODUCT_CREATE)
  const canCreateOrder = can(PERMISSIONS.ORDER_CREATE)

  const [stats, setStats] = useState({
    totalSales: 0,
    totalPaidOrders: 0,
    periodSales: 0,
    periodOrders: 0,
    todaySales: 0,
    todayOrders: 0,
    salesGrowth: 0,
    ordersGrowth: 0,
    averageOrderValue: 0,
    periodAverageOrderValue: 0,
    paymentConversionRate: 0,
    newCustomersPeriod: 0,
    totalCustomers: 0,
    newOrders: 0,
    pendingOrders: 0,
    lowStockProducts: [],
    newCustomers: 0,
    recentOrders: [],
    salesChart: [],
    openTickets: 0,
    orderStatusBreakdown: {},
    totalOrdersAllTime: 0,
    attention: {
      pendingOrders: 0,
      openTickets: 0,
      pendingReviews: 0,
      outOfStockCount: 0,
      lowStockCount: 0,
      abandonedCartsCount: 0,
      abandonedCartsValue: 0,
    },
    catalogHealth: {
      totalProducts: 0,
      activeProducts: 0,
      activeSalesCount: 0,
      activeFlashDealsCount: 0,
      activeSpecialOffersCount: 0,
    },
    topProducts: [],
    topCategories: [],
  })

  const fetchDashboard = useCallback(
    async ({ quiet = false, periodDays = days } = {}) => {
      if (quiet) setRefreshing(true)
      else setLoading(true)
      try {
        const res = await api.get('/dashboard/stats', { params: { days: periodDays } })
        const data = res?.data?.data || {}
        setStats((prev) => ({
          ...prev,
          ...data,
          lowStockProducts: Array.isArray(data.lowStockProducts) ? data.lowStockProducts : [],
          recentOrders: Array.isArray(data.recentOrders) ? data.recentOrders : [],
          salesChart: Array.isArray(data.salesChart) ? data.salesChart : [],
          topProducts: Array.isArray(data.topProducts) ? data.topProducts : [],
          topCategories: Array.isArray(data.topCategories) ? data.topCategories : [],
          attention: { ...prev.attention, ...(data.attention || {}) },
          catalogHealth: { ...prev.catalogHealth, ...(data.catalogHealth || {}) },
          orderStatusBreakdown: data.orderStatusBreakdown || {},
        }))
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [days],
  )

  useEffect(() => {
    fetchDashboard({ periodDays: days })
  }, [days, fetchDashboard])

  const orderColumns = useMemo(
    () => [
      {
        title: 'شماره سفارش',
        dataIndex: 'orderNumber',
        key: 'orderNumber',
        mobileTitle: true,
        render: (val, record) => (
          <span className="mono-cell">
            {val || record.orderCode || `#${(record._id || '').slice(-8)}`}
          </span>
        ),
      },
      {
        title: 'مشتری',
        dataIndex: ['customer', 'name'],
        key: 'customer',
        mobileSubtitle: true,
        render: (name, record) =>
          name || record.customer?.email || record.user?.name || '—',
      },
      {
        title: 'اقلام',
        dataIndex: 'itemsCount',
        key: 'itemsCount',
        align: 'center',
        render: (cnt) => `${formatNumber(cnt || 0)} قلم`,
      },
      {
        title: 'مبلغ کل',
        dataIndex: 'totalAmount',
        key: 'total',
        align: 'left',
        render: (val, record) => (
          <span className="money-cell">{formatCurrency(val || record.totalPrice || 0)}</span>
        ),
      },
      {
        title: 'پرداخت',
        dataIndex: 'isPaid',
        key: 'isPaid',
        render: (isPaid) => (
          <StatusPill
            size="sm"
            status={isPaid ? 'paid' : 'failed'}
            label={isPaid ? 'پرداخت‌شده' : 'پرداخت‌نشده'}
            tone={isPaid ? 'ok' : 'neutral'}
          />
        ),
      },
      {
        title: 'وضعیت',
        dataIndex: 'status',
        key: 'status',
        mobileBadge: true,
        render: (status, record) => (
          <StatusPill
            status={status || record.orderStatus}
            label={getStatusLabel(status || record.orderStatus)}
          />
        ),
      },
      {
        title: 'تاریخ ثبت',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (d) => formatPersianShortDate(d, true),
      },
    ],
    [],
  )

  const lowStock = stats.lowStockProducts.slice(0, 7)
  const hasChartData = stats.salesChart.some((d) => (d.sales || 0) > 0 || (d.orders || 0) > 0)
  const activePromosTotal =
    (stats.catalogHealth.activeSalesCount || 0) +
    (stats.catalogHealth.activeFlashDealsCount || 0) +
    (stats.catalogHealth.activeSpecialOffersCount || 0)

  const totalPipeline = PIPELINE_META.reduce(
    (sum, item) => sum + (stats.orderStatusBreakdown?.[item.key] || 0),
    0,
  )

  return (
    <div className="dashboard">
      <PageHeader
        title="داشبورد مدیریت"
        subtitle={`نمای جامع عملکرد فروش، عملیات و سلامت موجودی در ${formatNumber(days)} روز گذشته`}
        actions={
          <div className="dash-header-controls">
            <Segmented
              value={days}
              onChange={(val) => setDays(val)}
              options={[
                { label: '۷ روز', value: 7 },
                { label: '۳۰ روز', value: 30 },
                { label: '۹۰ روز', value: 90 },
              ]}
            />
            {canCreateProduct && (
              <Button icon={<PlusOutlined />} onClick={() => navigate('/products/new')}>
                محصول جدید
              </Button>
            )}
            {canCreateOrder && (
              <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => navigate('/orders/create')}>
                ثبت سفارش
              </Button>
            )}
            <Button
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={() => fetchDashboard({ quiet: true, periodDays: days })}
              loading={refreshing}
            >
              به‌روزرسانی
            </Button>
          </div>
        }
      />

      {/* ── Band 1: Executive KPIs ── */}
      <div className="stat-grid">
        <StatTile
          loading={loading}
          label={`فروش ${formatNumber(days)} روزه`}
          value={formatCurrency(stats.periodSales)}
          icon={<DollarOutlined />}
          tone="ok"
          foot={
            <GrowthFoot
              value={stats.salesGrowth}
              extra={`امروز: ${formatCurrency(stats.todaySales)}`}
            />
          }
          onClick={() => navigate('/reports/sales')}
        />
        <StatTile
          loading={loading}
          label={`سفارش‌های پرداخت‌شده (${formatNumber(days)} روز)`}
          value={formatNumber(stats.periodOrders)}
          icon={<ShoppingCartOutlined />}
          tone="brand"
          foot={
            <GrowthFoot
              value={stats.ordersGrowth}
              extra={`نرخ پرداخت: ${Number(stats.paymentConversionRate || 0).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`}
            />
          }
          onClick={() => navigate('/orders')}
        />
        <StatTile
          loading={loading}
          label="میانگین ارزش سفارش (AOV)"
          value={formatCurrency(stats.periodAverageOrderValue || stats.averageOrderValue)}
          icon={<ShoppingOutlined />}
          tone="info"
          foot={`کل فروش تاریخچه: ${formatCurrency(stats.totalSales)}`}
          onClick={() => navigate('/reports/sales')}
        />
        <StatTile
          loading={loading}
          label={`مشتریان جدید (${formatNumber(days)} روز)`}
          value={formatNumber(stats.newCustomersPeriod || stats.newCustomers)}
          icon={<UserAddOutlined />}
          tone="neutral"
          foot={`کل مشتریان ثبت‌نامی: ${formatNumber(stats.totalCustomers)} نفر`}
          onClick={() => navigate('/customers')}
        />
      </div>

      {/* ── Band 2: Operational Command Strip ── */}
      <div className="dash-ops-strip">
        <button type="button" className="dash-op-pill" onClick={() => navigate('/orders')}>
          <span className="dash-op-top">
            <span className="dash-op-icon tone-warn">
              <ClockCircleOutlined />
            </span>
            <span className="dash-op-count">{formatNumber(stats.attention.pendingOrders)}</span>
          </span>
          <span className="dash-op-text">
            <span className="dash-op-label">سفارش در انتظار</span>
            <span className="dash-op-sub">نیازمند پردازش و ارسال</span>
          </span>
        </button>

        <button type="button" className="dash-op-pill" onClick={() => navigate('/inventory')}>
          <span className="dash-op-top">
            <span className="dash-op-icon tone-err">
              <InboxOutlined />
            </span>
            <span className="dash-op-count">
              {formatNumber(stats.attention.outOfStockCount)} / {formatNumber(stats.attention.lowStockCount)}
            </span>
          </span>
          <span className="dash-op-text">
            <span className="dash-op-label">ناموجود / کم‌موجودی</span>
            <span className="dash-op-sub">کالاهای نیازمند شارژ</span>
          </span>
        </button>

        <button type="button" className="dash-op-pill" onClick={() => navigate('/tickets')}>
          <span className="dash-op-top">
            <span className="dash-op-icon tone-info">
              <CustomerServiceOutlined />
            </span>
            <span className="dash-op-count">{formatNumber(stats.attention.openTickets)}</span>
          </span>
          <span className="dash-op-text">
            <span className="dash-op-label">تیکت پشتیبانی باز</span>
            <span className="dash-op-sub">در انتظار پاسخگویی</span>
          </span>
        </button>

        <button type="button" className="dash-op-pill" onClick={() => navigate('/reviews')}>
          <span className="dash-op-top">
            <span className="dash-op-icon tone-brand">
              <MessageOutlined />
            </span>
            <span className="dash-op-count">{formatNumber(stats.attention.pendingReviews)}</span>
          </span>
          <span className="dash-op-text">
            <span className="dash-op-label">دیدگاه در انتظار تایید</span>
            <span className="dash-op-sub">بررسی و انتشار نظرات</span>
          </span>
        </button>

        <button type="button" className="dash-op-pill" onClick={() => navigate('/abandoned-carts')}>
          <span className="dash-op-top">
            <span className="dash-op-icon tone-warn">
              <WarningOutlined />
            </span>
            <span className="dash-op-count">{formatNumber(stats.attention.abandonedCartsCount)}</span>
          </span>
          <span className="dash-op-text">
            <span className="dash-op-label">سبد رهاشده (۷ روز)</span>
            <span className="dash-op-sub">{formatCurrency(stats.attention.abandonedCartsValue)}</span>
          </span>
        </button>

        <button type="button" className="dash-op-pill" onClick={() => navigate('/sales')}>
          <span className="dash-op-top">
            <span className="dash-op-icon tone-ok">
              <TagOutlined />
            </span>
            <span className="dash-op-count">{formatNumber(activePromosTotal)}</span>
          </span>
          <span className="dash-op-text">
            <span className="dash-op-label">کمپین و تخفیف فعال</span>
            <span className="dash-op-sub">
              {formatNumber(stats.catalogHealth.activeProducts)} کالای فعال
            </span>
          </span>
        </button>
      </div>

      {/* ── Band 3: Trend Chart + Order Pipeline ── */}
      <div className="dash-split">
        <Card
          className="dash-chart-card"
          title={`روند عملکرد — ${formatNumber(days)} روز گذشته`}
          extra={
            <Space size={8}>
              <Segmented
                size="small"
                value={chartMetric}
                onChange={setChartMetric}
                options={[
                  { label: 'درآمد فروش', value: 'sales' },
                  { label: 'تعداد سفارش', value: 'orders' },
                ]}
              />
              <Button type="link" size="small" onClick={() => navigate('/reports/sales')}>
                گزارش کامل
              </Button>
            </Space>
          }
        >
          {loading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : hasChartData ? (
            <ResponsiveContainer width="100%" height={272}>
              <AreaChart
                data={stats.salesChart}
                margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b45309" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#b45309" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke="#efece7" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => formatChartDate(v, 'day')}
                  tick={{ fontSize: 11, fill: '#8a817a' }}
                  axisLine={{ stroke: '#e2ddd6' }}
                  tickLine={false}
                  dy={6}
                  minTickGap={18}
                />
                <YAxis
                  tickFormatter={compactAxisValue}
                  tick={{ fontSize: 11, fill: '#8a817a' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  labelFormatter={(v) => formatChartDate(v, 'day')}
                  formatter={(v) =>
                    chartMetric === 'sales'
                      ? [formatCurrency(v), 'درآمد فروش']
                      : [`${formatNumber(v)} سفارش`, 'تعداد سفارش']
                  }
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid #e2ddd6',
                    boxShadow: '0 4px 12px rgba(28,25,23,0.08)',
                    fontSize: 12.5,
                    direction: 'rtl',
                  }}
                  labelStyle={{ color: '#57534e', marginBottom: 2, fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke="#b45309"
                  strokeWidth={2.3}
                  fill="url(#salesFill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </Card>

        <Card
          className="dash-pipeline-card"
          title="وضعیت کلی سفارش‌ها"
          extra={
            <Button type="link" size="small" onClick={() => navigate('/orders')}>
              مدیریت سفارش‌ها
            </Button>
          }
        >
          {loading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : totalPipeline === 0 ? (
            <EmptyState
              compact
              icon={<ShoppingCartOutlined />}
              title="سفارشی ثبت نشده"
              description="پس از ثبت سفارش، توزیع وضعیت‌ها اینجا دیده می‌شود."
            />
          ) : (
            <>
              <div className="pipeline-list">
                {PIPELINE_META.map((item) => {
                  const count = stats.orderStatusBreakdown?.[item.key] || 0
                  const pct = totalPipeline > 0 ? Math.round((count / totalPipeline) * 100) : 0
                  return (
                    <div className="pipeline-item" key={item.key}>
                      <div className="pipeline-row-head">
                        <span className="pipeline-label">
                          <span className="pipeline-dot" style={{ background: item.color }} />
                          {item.label}
                        </span>
                        <span className="pipeline-val">
                          {formatNumber(count)} ({formatNumber(pct)}٪)
                        </span>
                      </div>
                      <div className="pipeline-track">
                        <div
                          className="pipeline-fill"
                          style={{ width: `${pct}%`, background: item.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="pipeline-footer">
                <span>کل سفارش‌های ثبت‌شده</span>
                <strong>{formatNumber(totalPipeline)} سفارش</strong>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Band 4: Top Selling Products + Critical Inventory ── */}
      <div className="dash-intel-grid">
        <Card
          className="dash-top-card"
          title={`پرفروش‌ترین محصولات (${formatNumber(days)} روز اخیر)`}
          extra={
            <Button type="link" size="small" onClick={() => navigate('/reports/products')}>
              گزارش محصولات
            </Button>
          }
        >
          {loading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : stats.topProducts.length === 0 ? (
            <EmptyState
              compact
              icon={<ShoppingOutlined />}
              title="فروشی در این بازه ثبت نشده"
              description="با ثبت سفارش‌های پرداخت‌شده، پرفروش‌ترین کالاها اینجا مرتب می‌شوند."
            />
          ) : (
            <>
              <ul className="top-list">
                {stats.topProducts.map((p, idx) => (
                  <li
                    key={p.productId || idx}
                    className="top-row"
                    onClick={() => p.productId && navigate(`/products/edit/${p.productId}`)}
                  >
                    <span className="top-rank">{formatNumber(idx + 1)}</span>
                    <div className="top-meta">
                      <span className="top-name" title={p.name}>
                        {p.name}
                      </span>
                      <span className="top-sub">
                        {formatNumber(p.quantitySold)} عدد فروخته‌شده • موجودی فعلی: {formatNumber(p.stock ?? 0)}
                      </span>
                    </div>
                    <span className="top-revenue">{formatCurrency(p.revenue)}</span>
                  </li>
                ))}
              </ul>
              {stats.topCategories.length > 0 && (
                <div className="dash-cat-strip">
                  {stats.topCategories.map((cat) => (
                    <span className="dash-cat-chip" key={cat.categoryId || cat.name}>
                      <span>{cat.name}:</span>
                      <strong>{formatCurrency(cat.revenue)}</strong>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        <Card
          className="dash-stock-card"
          title="هشدار موجودی انبار"
          extra={
            <Button type="link" size="small" onClick={() => navigate('/inventory')}>
              مدیریت موجودی
            </Button>
          }
        >
          {loading ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : lowStock.length === 0 ? (
            <EmptyState
              compact
              icon={<InboxOutlined />}
              title="موجودی همه‌چیز کافی است"
              description="هیچ محصولی به زیر حد سفارش نرسیده."
            />
          ) : (
            <ul className="stock-list">
              {lowStock.map((product, index) => {
                const count = product.stock ?? product.countInStock ?? 0
                const isOut = count <= 0
                return (
                  <li
                    className="stock-row"
                    key={product._id || product.id || index}
                    onClick={() =>
                      (product._id || product.id) &&
                      navigate(`/products/edit/${product._id || product.id}`)
                    }
                  >
                    <div className="stock-info">
                      <span className="stock-name" title={product.name}>
                        {product.name}
                      </span>
                      {product.sku && <span className="stock-sku">{product.sku}</span>}
                    </div>
                    <span className={`stock-count ${isOut ? 'is-out' : 'is-low'}`}>
                      {isOut ? 'ناموجود' : `${formatNumber(count)} عدد`}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Band 5: Recent orders ── */}
      <Card
        className="dash-orders-card"
        title="سفارش‌های اخیر"
        extra={
          <Button type="link" size="small" onClick={() => navigate('/orders')}>
            همه سفارش‌ها <ArrowLeftOutlined />
          </Button>
        }
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : stats.recentOrders.length === 0 ? (
          <EmptyState
            icon={<WarningOutlined />}
            title="هنوز سفارشی ثبت نشده"
            description="به‌محض ثبت اولین سفارش، اینجا نمایش داده می‌شود."
          />
        ) : (
          <ResponsiveTable
            columns={orderColumns}
            dataSource={stats.recentOrders}
            rowKey={(r) => r._id || r.id || r.orderNumber}
            pagination={false}
            scroll={{ x: 'max-content' }}
            size="middle"
            onRow={(record) => ({
              onClick: () => (record._id || record.id) && navigate(`/orders/${record._id || record.id}`),
              style: { cursor: 'pointer' },
            })}
          />
        )}
      </Card>
    </div>
  )
}

export default Dashboard
