import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Tag, Button, message } from 'antd'
import {
  DollarOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  UserAddOutlined,
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
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { getStatusColor, getStatusLabel, formatCurrency } from '../utils/formatters'

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
      <h1 style={{ marginBottom: 24 }}>داشبورد</h1>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="مجموع فروش"
              value={stats.totalSales}
              precision={0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<DollarOutlined />}
              suffix="تومان"
            />
            <div style={{ marginTop: 8, fontSize: 12, color: stats.salesGrowth >= 0 ? 'green' : 'red' }}>
              {stats.salesGrowth > 0 ? '+' : ''}{stats.salesGrowth}% نسبت به هفته قبل
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="میانگین ارزش سفارش (AOV)"
              value={stats.averageOrderValue}
              precision={0}
              valueStyle={{ color: '#722ed1' }}
              suffix="تومان"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Link to="/orders">
              <Statistic
                title="سفارش‌های جدید (۲۴ ساعت گذشته)"
                value={stats.newOrders}
                valueStyle={{ color: '#1890ff' }}
                prefix={<ShoppingCartOutlined />}
              />
            </Link>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="سفارش‌های در انتظار / در حال پردازش"
              value={stats.pendingOrders}
              valueStyle={{ color: '#faad14' }}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading}>
            <Statistic
              title="مشتریان جدید (۲۴ ساعت گذشته)"
              value={stats.newCustomers}
              valueStyle={{ color: '#52c41a' }}
              prefix={<UserAddOutlined />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#cf1322' }}>
              تیکت‌های باز: {stats.openTickets}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title="روند فروش (۷ روز گذشته)"
            extra={
              <Button type="link" onClick={() => navigate('/reports/sales')}>
                گزارش فروش
              </Button>
            }
            loading={loading}
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.salesChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#1890ff"
                  strokeWidth={2}
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
          >
            {stats.lowStockProducts.map((product, index) => (
              <div
                key={product._id || product.id || index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <span>{product.name}</span>
                <Tag color="red">{product.stock ?? product.countInStock ?? 0} عدد</Tag>
              </div>
            ))}
            {!loading && stats.lowStockProducts.length === 0 && (
              <div style={{ color: '#999', textAlign: 'center' }}>
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
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
