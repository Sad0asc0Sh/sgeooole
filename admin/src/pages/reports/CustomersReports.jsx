import { useEffect, useState, useCallback } from 'react'
import { Card, Input, Button, Space, Avatar, message } from 'antd'
import {
  UserOutlined,
  TeamOutlined,
  SyncOutlined,
  DollarOutlined,
  SearchOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader'
import StatTile from '../../components/ui/StatTile'
import StatusPill from '../../components/ui/StatusPill'
import ResponsiveTable from '../../components/ResponsiveTable'
import JalaliRangePicker from '../../components/JalaliRangePicker'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import { formatPersianShortDate, toSafeDate } from '../../utils/dateUtils'
import './Reports.css'

function compactAxisValue(val) {
  const n = Number(val) || 0
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} م`
  if (n >= 1_000) return `${Math.round(n / 1_000)} ه`
  return n.toLocaleString('fa-IR')
}

function CustomersReports() {
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState([])
  const [search, setSearch] = useState('')
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    buyingCustomers: 0,
    repeatCustomers: 0,
    repeatRate: 0,
    newCustomersInPeriod: 0,
    totalRevenue: 0,
    averageLTV: 0,
  })
  const [customers, setCustomers] = useState([])
  const [provinces, setProvinces] = useState([])

  const fetchReports = useCallback(async (selectedRange = range, searchTerm = search) => {
    setLoading(true)
    try {
      const params = {}
      if (Array.isArray(selectedRange) && selectedRange.length === 2) {
        const s = toSafeDate(selectedRange[0])
        const e = toSafeDate(selectedRange[1])
        if (s) params.startDate = s.toISOString()
        if (e) params.endDate = e.toISOString()
      }
      if (searchTerm.trim()) params.search = searchTerm.trim()

      const res = await api.get('/reports/customers', { params })
      const data = res?.data?.data || {}

      // Support both new structured payload and legacy array fallback
      if (Array.isArray(data)) {
        setCustomers(data)
      } else {
        setSummary((prev) => ({ ...prev, ...(data.summary || {}) }))
        setCustomers(Array.isArray(data.topCustomers) ? data.topCustomers : [])
        setProvinces(Array.isArray(data.provinceBreakdown) ? data.provinceBreakdown : [])
      }
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || 'خطا در دریافت گزارش مشتریان')
    } finally {
      setLoading(false)
    }
  }, [range, search])

  useEffect(() => {
    fetchReports([], '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRangeChange = (values) => {
    const next = Array.isArray(values) ? values : []
    setRange(next)
    fetchReports(next, search)
  }

  const handleExport = () => {
    if (!customers.length) {
      message.warning('داده‌ای برای خروجی وجود ندارد')
      return
    }
    const headers = ['نام مشتری', 'موبایل', 'ایمیل', 'استان / شهر', 'تعداد سفارش', 'مجموع خرید', 'میانگین سفارش', 'آخرین خرید']
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = customers.map((c) => [
      c.name,
      c.mobile || '',
      c.email || '',
      [c.province, c.city].filter(Boolean).join(' - '),
      c.ordersCount,
      c.totalSpent,
      c.avgOrderValue || 0,
      formatPersianShortDate(c.lastOrderAt, true),
    ])
    const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers-report-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    message.success('گزارش مشتریان آماده شد')
  }

  const columns = [
    {
      title: 'مشتری',
      dataIndex: 'name',
      key: 'name',
      mobileTitle: true,
      render: (name, r) => {
        const label = name || r.email || 'مشتری'
        return (
          <Space size={9}>
            <Avatar
              size={32}
              style={{
                background: 'linear-gradient(150deg, #e79d13, #b45309)',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {label.trim().charAt(0)}
            </Avatar>
            <div>
              {r.userId ? (
                <Link to={`/customers/${r.userId}`} style={{ fontWeight: 600 }}>
                  {label}
                </Link>
              ) : (
                <strong>{label}</strong>
              )}
              {r.email && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-400)' }}>{r.email}</div>
              )}
            </div>
          </Space>
        )
      },
    },
    {
      title: 'موبایل',
      dataIndex: 'mobile',
      key: 'mobile',
      render: (m) => <span dir="ltr">{m || '—'}</span>,
    },
    {
      title: 'منطقه',
      key: 'location',
      render: (_, r) => [r.province, r.city].filter(Boolean).join('، ') || '—',
    },
    {
      title: 'سفارش‌ها',
      dataIndex: 'ordersCount',
      key: 'ordersCount',
      align: 'center',
      render: (c) => `${formatNumber(c || 0)} سفارش`,
    },
    {
      title: 'میانگین هر خرید',
      dataIndex: 'avgOrderValue',
      key: 'avgOrderValue',
      render: (v) => formatCurrency(v || 0),
    },
    {
      title: 'مجموع خرید',
      dataIndex: 'totalSpent',
      key: 'totalSpent',
      mobileBadge: true,
      render: (val) => (
        <span className="money-cell" style={{ color: 'var(--ok)' }}>
          {formatCurrency(val || 0)}
        </span>
      ),
    },
    {
      title: 'وفاداری',
      key: 'segment',
      render: (_, r) => {
        const count = r.ordersCount || 0
        if (count >= 5) return <StatusPill size="sm" tone="brand" label="VIP" />
        if (count >= 2) return <StatusPill size="sm" tone="ok" label="خریدار وفادار" />
        return <StatusPill size="sm" tone="neutral" label="یک‌بار خرید" />
      },
    },
    {
      title: 'آخرین خرید',
      dataIndex: 'lastOrderAt',
      key: 'lastOrderAt',
      render: (d) => formatPersianShortDate(d, false),
    },
  ]

  return (
    <div className="report-page">
      <PageHeader
        title="گزارش مشتریان و وفاداری"
        subtitle="تحلیل ارزش طول عمر مشتری (LTV)، نرخ خرید مجدد و توزیع جغرافیایی فروش"
        actions={
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              خروجی CSV
            </Button>
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={() => fetchReports(range, search)}
            >
              به‌روزرسانی
            </Button>
          </Space>
        }
      />

      <div className="filter-bar">
        <Input.Search
          placeholder="جستجو در نام، ایمیل، موبایل، استان یا شهر..."
          allowClear
          enterButton={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={(val) => fetchReports(range, val)}
          style={{ width: 320, maxWidth: '100%' }}
        />
        <div style={{ minWidth: 260, flex: '1 1 300px', maxWidth: 440 }}>
          <JalaliRangePicker
            value={range}
            onChange={handleRangeChange}
            presets="analytics"
            placeholder="بازه تاریخ سفارش‌ها (همه زمان‌ها)"
          />
        </div>
      </div>

      <div className="kpi-grid">
        <StatTile
          loading={loading}
          label="کل مشتریان ثبت‌نامی"
          value={formatNumber(summary.totalCustomers)}
          icon={<TeamOutlined />}
          tone="info"
          foot={`ثبت‌نام جدید بازه: ${formatNumber(summary.newCustomersInPeriod)} نفر`}
        />
        <StatTile
          loading={loading}
          label="مشتریان خریدکننده"
          value={formatNumber(summary.buyingCustomers)}
          icon={<UserOutlined />}
          tone="brand"
          foot={`مجموع درآمد: ${formatCurrency(summary.totalRevenue)}`}
        />
        <StatTile
          loading={loading}
          label="نرخ خرید مجدد"
          value={`${summary.repeatRate}٪`}
          icon={<SyncOutlined />}
          tone="ok"
          foot={`${formatNumber(summary.repeatCustomers)} مشتری با ۲+ خرید`}
        />
        <StatTile
          loading={loading}
          label="میانگین ارزش مشتری (LTV)"
          value={formatCurrency(summary.averageLTV)}
          icon={<DollarOutlined />}
          tone="neutral"
          foot="میانگین فروش به ازای هر خریدار"
        />
      </div>

      {provinces.length > 0 && (
        <Card className="report-chart-card" title="برترین استان‌ها و شهرها بر اساس درآمد فروش">
          <div className="report-chart-wrap" style={{ height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={provinces} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#efece7" vertical={false} />
                <XAxis dataKey="province" tick={{ fontSize: 11.5, fill: '#57534e' }} />
                <YAxis
                  tickFormatter={compactAxisValue}
                  tick={{ fontSize: 11, fill: '#8a817a' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(v) => [formatCurrency(v), 'مجموع فروش']}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2ddd6', direction: 'rtl' }}
                />
                <Bar dataKey="totalRevenue" fill="#b45309" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="report-card" title="فهرست برترین خریداران">
        <ResponsiveTable
          columns={columns}
          dataSource={customers}
          loading={loading}
          rowKey={(r, i) => r.userId || r.email || String(i)}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  )
}

export default CustomersReports
