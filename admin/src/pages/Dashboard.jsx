import { useEffect, useState } from 'react'
import { Row, Col, Card, Table, Tag, Button, message, Skeleton } from 'antd'
import {
  DollarOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  UserAddOutlined,
  RiseOutlined,
  FallOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons'
import {
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { getStatusColor, getStatusLabel, formatCurrency } from '../utils/formatters'

// ── Professional stat card ──────────────────────────────
function StatCard({ loading, title, value, icon, tone, footer }) {
  if (loading) {
    return (
      <Card styles={{ body: { padding: 18 } }}>
        <Skeleton active paragraph={{ rows: 1 }} />
      </Card>
    )
  }

  const tones = {
    indigo: { bg: '#eef2ff', fg: '#4f46e5' },
    green: { bg: '#f0fdf4', fg: '#16a34a' },
    amber: { bg: '#fffbeb', fg: '#d97706' },
    sky: { bg: '#f0f9ff', fg: '#0284c7' },
  }
  const t = tones[tone] || tones.indigo

  return (
    <Card
      hoverable
      styles={{ body: { padding: 18 } }}
      style={{ height: '100%' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background: t.bg,
            color: t.fg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              color: '#64748b',
              marginBottom: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 21,
              fontWeight: 800,
              color: '#0f172a',
              lineHeight: 1.3,
            }}
          >
            {value}
          </div>
          {footer && (
            <div style={{ fontSize: 12, marginTop: 4, color: '#64748b' }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function Dashboard() {
  const [loading, setLoading] = useState(false)
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
      render: (val, record) => val || record.orderCode || `#${(record._id || '').slice(-8)}`,
    },
    {
      title: 'مشتری',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      render: (name, record) => name || record.customer?.email || record.user?.name || '—',
    },
    {
      title: 'مبلغ کل',
      dataIndex: 'totalAmount',
      key: 'total',
      render: (val, record) => formatCurrency(val || record.totalPrice || 0),
    },
    {
      title: 'وضعیت',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        const resolvedStatus = status || record.orderStatus
        return (
          <Tag color={getStatusColor(resolvedStatus)}>
            {getStatusLabel(resolvedStatus)}
          </Tag>
        )
      },
    },
  ]

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const res = await api.get('/dashboard/stats')
      const data = res?.data?.data || {}
      setStats({
        totalSales: data.totalSales || 0,
        newOrders: data.newOrders || 0,
        pendingOrders: data.pendingOrders || 0,
        lowStockProducts: Array.isArray(data.lowStockProducts) ? data.lowStockProducts : [],
        newCustomers: data.newCustomers || 0,
        recentOrders: Array.isArray(data.recentOrders) ? data.recentOrders : [],
        salesChart: Array.isArray(data.salesChart) ? data.salesChart : [],
        openTickets: data.openTickets || 0,
        salesGrowth: data.salesGrowth || 0,
        averageOrderValue: data.averageOrderValue || 0,
      })
    } catch (err) {
      console.error('Dashboard fetch error:', err)
      message.error(
        err?.response?.data?.message ||
        err?.message ||
        'خطا در دریافت اطلاعات داشبورد'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [])

  return (
    <div>
      <div className="page-header">
        <h1>داشبورد</h1>
        <Button onClick={() => fetchDashboard()} loading={loading}>
          به‌روزرسانی اطلاعات
        </Button>
      </div>

      {/* ── Stat cards ── */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            loading={loading}
            title="مجموع فروش"
            value={formatCurrency(stats.totalSales)}
            icon={<DollarOutlined />}
            tone="green"
            footer={
              stats.salesGrowth !== 0 ? (
                <span
                  style={{
                    color: stats.salesGrowth > 0 ? '#16a34a' : '#dc2626',
                    fontWeight: 600,
                  }}
                >
                  {stats.salesGrowth > 0 ? <RiseOutlined /> : <FallOutlined />}{' '}
                  {Math.abs(Number(stats.salesGrowth)).toFixed(1)}٪ نسبت به هفته
                  قبل
                </span>
              ) : null
            }
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <StatCard
            loading={loading}
            title="میانگین ارزش سفارش (AOV)"
            value={formatCurrency(stats.averageOrderValue)}
            icon={<ShoppingCartOutlined />}
            tone="indigo"
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <StatCard
            loading={loading}
            title="سفارش‌های در انتظار / در حال پردازش"
            value={stats.pendingOrders}
            icon={<ShoppingOutlined />}
            tone="amber"
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <StatCard
            loading={loading}
            title="مشتریان جدید (۲۴ ساعت)"
            value={stats.newCustomers}
            icon={<UserAddOutlined />}
            tone="sky"
            footer={
              <span style={{ color: '#dc2626' }}>
                <CustomerServiceOutlined /> تیکت باز: {stats.openTickets}
              </span>
            }
          />
        </Col>
      </Row>

      {/* ── Chart & low stock ── */}
      <Row gutter={[14, 14]}>
        <Col xs={24} lg={16}>
          <Card
            title="روند فروش (۷ روز گذشته)"
            extra={
              <Button type="link" onClick={() => navigate('/reports/sales')}>
                گزارش فروش
              </Button>
            }
            loading={loading}
            styles={{ body: { padding: '8px 8px 0 16px' } }}
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={stats.salesChart}
                margin={{ top: 16, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={56} />
                <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 10 }} />
                <Line
                  type="monotone"
                  dataKey="sales"
                  name="فروش"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title="محصولات با موجودی کم"
            extra={
              <Button type="link" onClick={() => navigate('/inventory')}>
                مدیریت موجودی
              </Button>
            }
            loading={loading}
            styles={{ body: { padding: '8px 20px' } }}
          >
            {stats.lowStockProducts.slice(0, 7).map((product, index) => (
              <div
                key={product._id || product.id || index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {product.name}
                </span>
                <Tag color="red" style={{ flexShrink: 0 }}>
                  {product.stock ?? product.countInStock ?? 0} عدد
                </Tag>
              </div>
            ))}
            {!loading && stats.lowStockProducts.length === 0 && (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>
                محصولی با موجودی کم یافت نشد.
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card
            title="سفارش‌های اخیر"
            extra={
              <Button type="link" onClick={() => navigate('/orders')}>
                مشاهده همه سفارش‌ها
              </Button>
            }
            loading={loading}
          >
            <Table
              columns={orderColumns}
              dataSource={stats.recentOrders}
              rowKey={(r) => r._id || r.id || r.orderNumber}
              pagination={false}
              scroll={{ x: 'max-content' }}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
