import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, Button, Segmented, Space, message, Empty } from 'antd'
import {
  DollarOutlined,
  ShoppingCartOutlined,
  PercentageOutlined,
  RiseOutlined,
  FallOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  TagOutlined,
} from '@ant-design/icons'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader'
import StatTile from '../../components/ui/StatTile'
import StatusPill from '../../components/ui/StatusPill'
import ResponsiveTable from '../../components/ResponsiveTable'
import JalaliRangePicker from '../../components/JalaliRangePicker'
import { formatCurrency, formatNumber, getStatusLabel } from '../../utils/formatters'
import { formatChartDate, toSafeDate } from '../../utils/dateUtils'
import './Reports.css'

const PAYMENT_METHOD_LABELS = {
  online: 'پرداخت آنلاین (درگاه بانکی)',
  cash: 'پرداخت در محل',
  card_to_card: 'کارت به کارت',
  wallet: 'کیف پول',
}

const GATEWAY_LABELS = {
  zarinpal: 'زرین‌پال',
  sadad: 'سداد (ملی)',
  none: '—',
}

function compactAxisValue(val) {
  const n = Number(val) || 0
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} م‌ت`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} م`
  if (n >= 1_000) return `${Math.round(n / 1_000)} ه`
  return n.toLocaleString('fa-IR')
}

function SalesReports() {
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState([])
  const [chartType, setChartType] = useState('revenue')
  const [summary, setSummary] = useState({
    totalSales: 0,
    grossItemsSales: 0,
    totalDiscount: 0,
    totalShipping: 0,
    ordersCount: 0,
    allOrdersCount: 0,
    cancelledOrdersCount: 0,
    unpaidOrdersCount: 0,
    averageOrderValue: 0,
    totalItemsSold: 0,
    cancellationRate: 0,
    previousPeriodSales: 0,
    salesGrowth: 0,
  })
  const [series, setSeries] = useState([])
  const [statusBreakdown, setStatusBreakdown] = useState([])
  const [paymentBreakdown, setPaymentBreakdown] = useState([])
  const [granularity, setGranularity] = useState('day')

  const fetchReports = useCallback(async (selectedRange = range) => {
    setLoading(true)
    try {
      const params = {}
      if (Array.isArray(selectedRange) && selectedRange.length === 2) {
        const s = toSafeDate(selectedRange[0])
        const e = toSafeDate(selectedRange[1])
        if (s) params.startDate = s.toISOString()
        if (e) params.endDate = e.toISOString()
      }
      const res = await api.get('/reports/sales', { params })
      const data = res?.data?.data || {}
      setSummary((prev) => ({ ...prev, ...(data.summary || {}) }))
      setSeries(Array.isArray(data.series) ? data.series : [])
      setStatusBreakdown(Array.isArray(data.statusBreakdown) ? data.statusBreakdown : [])
      setPaymentBreakdown(
        Array.isArray(data.paymentMethodBreakdown) ? data.paymentMethodBreakdown : [],
      )
      setGranularity(data.granularity === 'month' ? 'month' : 'day')
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || 'خطا در دریافت گزارش فروش')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    fetchReports([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRangeChange = (values) => {
    const next = Array.isArray(values) ? values : []
    setRange(next)
    fetchReports(next)
  }

  const handleExportCsv = () => {
    if (!series.length) {
      message.warning('داده‌ای برای خروجی وجود ندارد')
      return
    }
    const headers = [
      'بازه زمانی',
      'تعداد سفارش',
      'اقلام فروخته‌شده',
      'جمع تخفیف (تومان)',
      'درآمد فروش (تومان)',
      'میانگین سفارش (تومان)',
    ]
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = series.map((r) => [
      formatChartDate(r.bucket, granularity),
      r.ordersCount,
      r.itemsSold,
      r.totalDiscount,
      r.totalSales,
      r.avgOrderValue,
    ])
    const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-report-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    message.success('فایل گزارش فروش آماده شد')
  }

  const totalStatuses = useMemo(
    () => statusBreakdown.reduce((sum, s) => sum + (s.count || 0), 0),
    [statusBreakdown],
  )
  const totalPayments = useMemo(
    () => paymentBreakdown.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
    [paymentBreakdown],
  )

  const columns = [
    {
      title: 'بازه زمانی',
      dataIndex: 'bucket',
      key: 'bucket',
      mobileTitle: true,
      render: (val) => <strong>{formatChartDate(val, granularity)}</strong>,
    },
    {
      title: 'سفارش پرداخت‌شده',
      dataIndex: 'ordersCount',
      key: 'ordersCount',
      align: 'center',
      render: (val) => `${formatNumber(val)} سفارش`,
    },
    {
      title: 'تعداد اقلام',
      dataIndex: 'itemsSold',
      key: 'itemsSold',
      align: 'center',
      render: (val) => `${formatNumber(val)} عدد`,
    },
    {
      title: 'مجموع تخفیف',
      dataIndex: 'totalDiscount',
      key: 'totalDiscount',
      render: (val) => formatCurrency(val || 0),
    },
    {
      title: 'میانگین سبد (AOV)',
      dataIndex: 'avgOrderValue',
      key: 'avgOrderValue',
      render: (val) => formatCurrency(val || 0),
    },
    {
      title: 'مبلغ فروش',
      dataIndex: 'totalSales',
      key: 'totalSales',
      mobileBadge: true,
      render: (val) => (
        <span className="money-cell" style={{ color: 'var(--ok)' }}>
          {formatCurrency(val || 0)}
        </span>
      ),
    },
  ]

  const growthNum = Number(summary.salesGrowth || 0)
  const growthUp = growthNum >= 0

  return (
    <div className="report-page">
      <PageHeader
        title="گزارش فروش و درآمد"
        subtitle="تحلیل مالی، روند سفارش‌ها، نرخ لغو و تفکیک روش‌های پرداخت"
        actions={
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
              خروجی CSV
            </Button>
            <Button icon={<ReloadOutlined spin={loading} />} onClick={() => fetchReports(range)}>
              به‌روزرسانی
            </Button>
          </Space>
        }
      />

      <div className="filter-bar">
        <div style={{ minWidth: 280, flex: '1 1 320px', maxWidth: 460 }}>
          <JalaliRangePicker
            value={range}
            onChange={handleRangeChange}
            presets="analytics"
            placeholder="بازه تاریخ گزارش فروش (پیش‌فرض: ۳۰ روز اخیر)"
          />
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-grid-5">
        <StatTile
          loading={loading}
          label="فروش خالص (پرداخت‌شده)"
          value={formatCurrency(summary.totalSales)}
          icon={<DollarOutlined />}
          tone="ok"
          foot={
            <span className={growthUp ? 'up' : 'down'}>
              {growthUp ? <RiseOutlined /> : <FallOutlined />} {Math.abs(growthNum).toFixed(1)}٪
              نسبت به دوره قبل
            </span>
          }
        />
        <StatTile
          loading={loading}
          label="سفارش‌های پرداخت‌شده"
          value={formatNumber(summary.ordersCount)}
          icon={<ShoppingCartOutlined />}
          tone="brand"
          foot={`از کل ${formatNumber(summary.allOrdersCount)} سفارش (${formatNumber(summary.totalItemsSold)} قلم)`}
        />
        <StatTile
          loading={loading}
          label="میانگین ارزش سفارش"
          value={formatCurrency(summary.averageOrderValue)}
          icon={<TagOutlined />}
          tone="info"
          foot={`هزینه ارسال: ${formatCurrency(summary.totalShipping)}`}
        />
        <StatTile
          loading={loading}
          label="مجموع تخفیف اعمال‌شده"
          value={formatCurrency(summary.totalDiscount)}
          icon={<PercentageOutlined />}
          tone="warn"
          foot={`فروش ناخالص کالا: ${formatCurrency(summary.grossItemsSales)}`}
        />
        <StatTile
          loading={loading}
          label="نرخ لغو سفارش"
          value={`${summary.cancellationRate}٪`}
          icon={<CloseCircleOutlined />}
          tone={summary.cancellationRate > 15 ? 'err' : 'neutral'}
          foot={`${formatNumber(summary.cancelledOrdersCount)} لغوشده • ${formatNumber(summary.unpaidOrdersCount)} پرداخت‌نشده`}
        />
      </div>

      {/* Main Chart */}
      <Card
        className="report-chart-card"
        title={chartType === 'revenue' ? 'نمودار روند درآمد فروش' : 'نمودار تعداد سفارش‌های پرداخت‌شده'}
        extra={
          <Segmented
            size="small"
            value={chartType}
            onChange={setChartType}
            options={[
              { label: 'درآمد فروش', value: 'revenue' },
              { label: 'تعداد سفارش', value: 'orders' },
            ]}
          />
        }
      >
        {series.length === 0 ? (
          <Empty description="داده‌ای در این بازه ثبت نشده است" />
        ) : (
          <div className="report-chart-wrap">
            <ResponsiveContainer>
              {chartType === 'revenue' ? (
                <AreaChart data={series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reportSalesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#b45309" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="#b45309" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#efece7" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(v) => formatChartDate(v, granularity)}
                    tick={{ fontSize: 11, fill: '#8a817a' }}
                    minTickGap={18}
                  />
                  <YAxis
                    tickFormatter={compactAxisValue}
                    tick={{ fontSize: 11, fill: '#8a817a' }}
                    axisLine={false}
                    tickLine={false}
                    width={58}
                  />
                  <Tooltip
                    labelFormatter={(v) => formatChartDate(v, granularity)}
                    formatter={(v) => [formatCurrency(v), 'درآمد فروش']}
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid #e2ddd6',
                      direction: 'rtl',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalSales"
                    stroke="#b45309"
                    strokeWidth={2.3}
                    fill="url(#reportSalesGrad)"
                    dot={false}
                  />
                </AreaChart>
              ) : (
                <BarChart data={series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#efece7" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(v) => formatChartDate(v, granularity)}
                    tick={{ fontSize: 11, fill: '#8a817a' }}
                    minTickGap={18}
                  />
                  <YAxis
                    tickFormatter={(v) => formatNumber(v)}
                    tick={{ fontSize: 11, fill: '#8a817a' }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip
                    labelFormatter={(v) => formatChartDate(v, granularity)}
                    formatter={(v) => [`${formatNumber(v)} سفارش`, 'تعداد سفارش']}
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid #e2ddd6',
                      direction: 'rtl',
                    }}
                  />
                  <Bar dataKey="ordersCount" fill="#b45309" radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Breakdown Split */}
      <div className="panel-section-grid">
        <Card className="report-card" title="تفکیک وضعیت سفارش‌های بازه">
          {statusBreakdown.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="سفارشی یافت نشد" />
          ) : (
            <div className="report-breakdown-list">
              {statusBreakdown.map((item) => {
                const pct = totalStatuses > 0 ? Math.round((item.count / totalStatuses) * 100) : 0
                return (
                  <div className="report-breakdown-row" key={item.status}>
                    <div className="report-breakdown-head">
                      <StatusPill status={item.status} label={getStatusLabel(item.status)} />
                      <span className="report-breakdown-val">
                        {formatNumber(item.count)} سفارش ({formatNumber(pct)}٪) •{' '}
                        {formatCurrency(item.totalAmount)}
                      </span>
                    </div>
                    <div className="report-breakdown-track">
                      <div className="report-breakdown-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="report-card" title="تفکیک روش و درگاه پرداخت">
          {paymentBreakdown.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="تراکنش موفقی ثبت نشده" />
          ) : (
            <div className="report-breakdown-list">
              {paymentBreakdown.map((p, idx) => {
                const pct = totalPayments > 0 ? Math.round((p.totalAmount / totalPayments) * 100) : 0
                const label = `${PAYMENT_METHOD_LABELS[p.method] || p.method}${
                  p.gateway && p.gateway !== 'none' ? ` — ${GATEWAY_LABELS[p.gateway] || p.gateway}` : ''
                }`
                return (
                  <div className="report-breakdown-row" key={`${p.method}-${p.gateway}-${idx}`}>
                    <div className="report-breakdown-head">
                      <span className="report-breakdown-label">{label}</span>
                      <span className="report-breakdown-val">
                        {formatNumber(p.count)} سفارش • {formatCurrency(p.totalAmount)}
                      </span>
                    </div>
                    <div className="report-breakdown-track">
                      <div
                        className="report-breakdown-fill"
                        style={{ width: `${pct}%`, background: 'var(--ok)' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Detailed Table */}
      <Card className="report-card" title="جدول تفصیلی عملکرد روزانه / ماهانه">
        <ResponsiveTable
          columns={columns}
          dataSource={[...series].reverse()}
          loading={loading}
          rowKey="bucket"
          pagination={{ pageSize: 15, showSizeChanger: true }}
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  )
}

export default SalesReports
