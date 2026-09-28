import { useEffect, useState, useCallback } from 'react'
import { Card, Table, Button, Skeleton, Empty } from 'antd'
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
} from '@ant-design/icons'
import {
  LineChart,
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
import { getStatusLabel, formatCurrency } from '../utils/formatters'
import PageHeader from '../components/ui/PageHeader'
import StatTile from '../components/ui/StatTile'
import EmptyState from '../components/ui/EmptyState'
import StatusPill from '../components/ui/StatusPill'
import './Dashboard.css'

/** A number that moves needs a direction word, not just an arrow. */
function GrowthFoot({ value }) {
  if (!value) return null
  const up = value > 0
  return (
    <span className={up ? 'up' : 'down'}>
      {up ? <RiseOutlined /> : <FallOutlined />} {Math.abs(Number(value)).toFixed(1)}٪
      نسبت به هفته قبل
    </span>
  )
}

/** The chart's own empty state — antd's default reads as an error. */
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

function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalSales: 0,
    newOrders: 0,
    pendingOrders: 0,
    lowStockProducts: [],
    newCustomers: 0,
    recentOrders: [],
    salesChart: [],
    openTickets: 0,
    salesGrowth: 0,
    averageOrderValue: 0,
  })

  const orderColumns = [
    {
      title: 'شماره سفارش',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
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
      render: (name, record) =>
        name || record.customer?.email || record.user?.name || '—',
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
      title: 'وضعیت',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <StatusPill
          status={status || record.orderStatus}
          label={getStatusLabel(status || record.orderStatus)}
        />
      ),
    },
  ]

  const fetchDashboard = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await api.get('/dashboard/stats')
      const data = res?.data?.data || {}
      setStats({
        totalSales: data.totalSales || 0,
        newOrders: data.newOrders || 0,
        pendingOrders: data.pendingOrders || 0,
        lowStockProducts: Array.isArray(data.lowStockProducts)
          ? data.lowStockProducts
          : [],
        newCustomers: data.newCustomers || 0,
        recentOrders: Array.isArray(data.recentOrders) ? data.recentOrders : [],
        salesChart: Array.isArray(data.salesChart) ? data.salesChart : [],
        openTickets: data.openTickets || 0,
        salesGrowth: data.salesGrowth || 0,
        averageOrderValue: data.averageOrderValue || 0,
      })
    } catch (err) {
      // A failed refresh should not wipe the numbers already on screen.
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const lowStock = stats.lowStockProducts.slice(0, 7)
  const hasChartData = stats.salesChart.length > 0

  return (
    <div className="dashboard">
      <PageHeader
        title="داشبورد"
        subtitle="وضعیت امروز فروشگاه در یک نگاه"
        actions={
          <Button
            icon={<ReloadOutlined spin={refreshing} />}
            onClick={() => fetchDashboard({ quiet: true })}
            loading={refreshing}
          >
            به‌روزرسانی
          </Button>
        }
      />

      {/* ── KPI row ── */}
      <div className="stat-grid">
        <StatTile
          loading={loading}
          label="مجموع فروش"
          value={formatCurrency(stats.totalSales)}
          icon={<DollarOutlined />}
          tone="ok"
          foot={<GrowthFoot value={stats.salesGrowth} />}
          onClick={() => navigate('/reports/sales')}
        />
        <StatTile
          loading={loading}
          label="میانگین ارزش سفارش"
          value={formatCurrency(stats.averageOrderValue)}
          icon={<ShoppingCartOutlined />}
          tone="brand"
          onClick={() => navigate('/reports/sales')}
        />
        <StatTile
          loading={loading}
          label="سفارش‌های در انتظار"
          value={stats.pendingOrders.toLocaleString('fa-IR')}
          icon={<ShoppingOutlined />}
          tone="warn"
          onClick={() => navigate('/orders')}
        />
        <StatTile
          loading={loading}
          label="مشتریان جدید (۲۴ ساعت)"
          value={stats.newCustomers.toLocaleString('fa-IR')}
          icon={<UserAddOutlined />}
          tone="info"
          foot={
            stats.openTickets > 0 ? (
              <button
                type="button"
                className="tile-link"
                onClick={() => navigate('/tickets')}
              >
                <CustomerServiceOutlined /> {stats.openTickets.toLocaleString('fa-IR')} تیکت باز
              </button>
            ) : (
              'تیکت بازی وجود ندارد'
            )
          }
        />
      </div>

      {/* ── Trend + attention ── */}
      <div className="dash-split">
        <Card
          className="dash-chart-card"
          title="روند فروش — ۷ روز گذشته"
          extra={
            <Button
              type="link"
              size="small"
              onClick={() => navigate('/reports/sales')}
            >
              گزارش کامل
            </Button>
          }
        >
          {loading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : hasChartData ? (
            <ResponsiveContainer width="100%" height={264}>
              <AreaChart
                data={stats.salesChart}
                margin={{ top: 12, right: 6, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#b45309" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#b45309" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="0"
                  stroke="#efece7"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#8a817a' }}
                  axisLine={{ stroke: '#e2ddd6' }}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#8a817a' }}
                  axisLine={false}
                  tickLine={false}
                  width={62}
                />
                <Tooltip
                  formatter={(v) => [formatCurrency(v), 'فروش']}
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid #e2ddd6',
                    boxShadow: '0 4px 12px rgba(28,25,23,0.08)',
                    fontSize: 12.5,
                  }}
                  labelStyle={{ color: '#57534e', marginBottom: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  name="فروش"
                  stroke="#b45309"
                  strokeWidth={2.2}
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
          className="dash-stock-card"
          title="نیازمند رسیدگی"
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
              {lowStock.map((product, index) => (
                <li className="stock-row" key={product._id || product.id || index}>
                  <span className="stock-name" title={product.name}>
                    {product.name}
                  </span>
                  <span className="stock-count">
                    {(product.stock ?? product.countInStock ?? 0).toLocaleString('fa-IR')} عدد
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Recent orders ── */}
      <Card
        className="dash-orders-card"
        title="سفارش‌های اخیر"
        extra={
          <Button
            type="link"
            size="small"
            onClick={() => navigate('/orders')}
          >
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
          <Table
            columns={orderColumns}
            dataSource={stats.recentOrders}
            rowKey={(r) => r._id || r.id || r.orderNumber}
            pagination={false}
            scroll={{ x: 'max-content' }}
            size="middle"
          />
        )}
      </Card>
    </div>
  )
}

export default Dashboard
