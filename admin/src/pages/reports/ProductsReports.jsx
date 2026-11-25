import { useEffect, useState, useCallback } from 'react'
import { Card, Tabs, Button, Space, message, Empty } from 'antd'
import {
  ShoppingOutlined,
  InboxOutlined,
  WarningOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  DownloadOutlined,
  EditOutlined,
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
import { toSafeDate } from '../../utils/dateUtils'
import './Reports.css'

function compactAxisValue(val) {
  const n = Number(val) || 0
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} م`
  if (n >= 1_000) return `${Math.round(n / 1_000)} ه`
  return n.toLocaleString('fa-IR')
}

function ProductsReports() {
  const [range, setRange] = useState([])
  const [summary, setSummary] = useState({
    totalProducts: 0,
    activeProducts: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
    totalInventoryValue: 0,
    totalUnitsSold: 0,
    totalRevenue: 0,
  })
  const [topSelling, setTopSelling] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [outOfStock, setOutOfStock] = useState([])
  const [categorySales, setCategorySales] = useState([])
  const [loading, setLoading] = useState(false)

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
      const res = await api.get('/reports/products', { params })
      const data = res?.data?.data || {}
      setSummary((prev) => ({ ...prev, ...(data.summary || {}) }))
      setTopSelling(Array.isArray(data.topSelling) ? data.topSelling : [])
      setLowStock(Array.isArray(data.lowStock) ? data.lowStock : [])
      setOutOfStock(Array.isArray(data.outOfStock) ? data.outOfStock : [])
      setCategorySales(Array.isArray(data.categorySales) ? data.categorySales : [])
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || 'خطا در دریافت گزارش محصولات')
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

  const handleExport = () => {
    if (!topSelling.length) {
      message.warning('ردیفی برای خروجی وجود ندارد')
      return
    }
    const headers = ['رتبه', 'نام محصول', 'SKU', 'دسته‌بندی', 'تعداد فروش', 'درآمد فروش', 'موجودی فعلی']
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = topSelling.map((r, i) => [
      i + 1,
      r.name,
      r.sku || '',
      r.categoryName || '',
      r.totalQuantity,
      r.totalRevenue,
      r.stock ?? 0,
    ])
    const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `products-report-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    message.success('گزارش محصولات خروجی گرفته شد')
  }

  const topSellingColumns = [
    {
      title: 'رتبه',
      key: 'rank',
      width: 68,
      align: 'center',
      render: (_, __, idx) => (
        <span className={`report-rank-badge${idx < 3 ? ' is-top' : ''}`}>
          {formatNumber(idx + 1)}
        </span>
      ),
    },
    {
      title: 'نام محصول',
      dataIndex: 'name',
      key: 'name',
      mobileTitle: true,
      render: (name, r) => (
        <div>
          <Link to={`/products/edit/${r.productId}`} style={{ fontWeight: 600 }}>
            {name}
          </Link>
          {r.sku && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-400)', fontFamily: 'monospace' }}>
              {r.sku}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'دسته‌بندی',
      dataIndex: 'categoryName',
      key: 'categoryName',
      render: (c) => c || '—',
    },
    {
      title: 'تعداد فروش',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      align: 'center',
      render: (q) => <strong>{formatNumber(q)} عدد</strong>,
    },
    {
      title: 'درآمد فروش',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      mobileBadge: true,
      render: (rev) => (
        <span className="money-cell" style={{ color: 'var(--ok)' }}>
          {formatCurrency(rev || 0)}
        </span>
      ),
    },
    {
      title: 'موجودی فعلی',
      dataIndex: 'stock',
      key: 'stock',
      align: 'center',
      render: (stock) => (
        <StatusPill
          size="sm"
          tone={stock <= 0 ? 'err' : stock <= 10 ? 'warn' : 'ok'}
          label={stock <= 0 ? 'ناموجود' : `${formatNumber(stock)} عدد`}
        />
      ),
    },
  ]

  const stockColumns = (isOut) => [
    {
      title: 'نام محصول',
      dataIndex: 'name',
      key: 'name',
      mobileTitle: true,
      render: (name, r) => (
        <Link to={`/products/edit/${r.productId}`} style={{ fontWeight: 600 }}>
          {name}
        </Link>
      ),
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      render: (sku) => <span style={{ fontFamily: 'monospace' }}>{sku || '—'}</span>,
    },
    {
      title: 'نوع',
      dataIndex: 'productType',
      key: 'productType',
      render: (t) => (t === 'variable' ? 'متغیر' : 'ساده'),
    },
    {
      title: 'قیمت پایه',
      dataIndex: 'price',
      key: 'price',
      render: (p) => formatCurrency(p || 0),
    },
    {
      title: 'وضعیت موجودی',
      dataIndex: 'stock',
      key: 'stock',
      mobileBadge: true,
      render: (s) => (
        <StatusPill
          tone={isOut ? 'err' : 'warn'}
          label={isOut ? 'ناموجود (۰)' : `${formatNumber(s)} عدد`}
        />
      ),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 110,
      render: (_, r) => (
        <Link to={`/products/edit/${r.productId}`}>
          <Button size="small" icon={<EditOutlined />}>
            ویرایش
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <div className="report-page">
      <PageHeader
        title="گزارش محصولات و انبار"
        subtitle="تحلیل پرفروش‌ترین کالاها، سهم دسته‌بندی‌ها و ریسک اتمام موجودی"
        actions={
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              خروجی CSV
            </Button>
            <Button icon={<ReloadOutlined spin={loading} />} onClick={() => fetchReports(range)}>
              به‌روزرسانی
            </Button>
          </Space>
        }
      />

      <div className="filter-bar">
        <div className="filter-range-slot">
          <JalaliRangePicker
            value={range}
            onChange={handleRangeChange}
            presets="analytics"
            placeholder="فیلتر بازه تاریخ فروش محصولات (همه زمان‌ها)"
          />
        </div>
      </div>

      <div className="kpi-grid-5">
        <StatTile
          loading={loading}
          label="محصولات فعال"
          value={formatNumber(summary.activeProducts)}
          icon={<CheckCircleOutlined />}
          tone="brand"
          foot={`از کل ${formatNumber(summary.totalProducts)} محصول ثبت‌شده`}
        />
        <StatTile
          loading={loading}
          label="ارزش موجودی انبار"
          value={formatCurrency(summary.totalInventoryValue)}
          icon={<DollarOutlined />}
          tone="info"
          foot="مجموع ارزش کالاهای فعال موجود"
        />
        <StatTile
          loading={loading}
          label="درآمد پرفروش‌ها"
          value={formatCurrency(summary.totalRevenue)}
          icon={<ShoppingOutlined />}
          tone="ok"
          foot={`${formatNumber(summary.totalUnitsSold)} عدد فروش در کالاهای برتر`}
        />
        <StatTile
          loading={loading}
          label="موجودی کم (≤۱۰)"
          value={formatNumber(summary.lowStockCount)}
          icon={<WarningOutlined />}
          tone="warn"
          foot="نیازمند برنامه‌ریزی تامین"
        />
        <StatTile
          loading={loading}
          label="کالاهای ناموجود"
          value={formatNumber(summary.outOfStockCount)}
          icon={<InboxOutlined />}
          tone={summary.outOfStockCount > 0 ? 'err' : 'ok'}
          foot="محصولات فعال با موجودی صفر"
        />
      </div>

      {categorySales.length > 0 && (
        <Card className="report-chart-card" title="درآمد فروش به تفکیک دسته‌بندی">
          <div className="report-chart-wrap" style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={categorySales} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#efece7" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: '#57534e' }} />
                <YAxis
                  tickFormatter={compactAxisValue}
                  tick={{ fontSize: 11, fill: '#8a817a' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={(v) => [formatCurrency(v), 'فروش دسته‌بندی']}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e2ddd6', direction: 'rtl' }}
                />
                <Bar dataKey="totalRevenue" fill="#b45309" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="report-card">
        <Tabs
          defaultActiveKey="top"
          items={[
            {
              key: 'top',
              label: `پرفروش‌ترین محصولات (${formatNumber(topSelling.length)})`,
              children:
                topSelling.length === 0 && !loading ? (
                  <Empty description="فروشی در این بازه ثبت نشده است" />
                ) : (
                  <ResponsiveTable
                    columns={topSellingColumns}
                    dataSource={topSelling}
                    loading={loading}
                    rowKey={(r, i) => r.productId || `${r.name}-${i}`}
                    pagination={{ pageSize: 15 }}
                    scroll={{ x: 'max-content' }}
                  />
                ),
            },
            {
              key: 'out',
              label: `ناموجودها (${formatNumber(outOfStock.length)})`,
              children: (
                <ResponsiveTable
                  columns={stockColumns(true)}
                  dataSource={outOfStock}
                  loading={loading}
                  rowKey={(r, i) => r.productId || `${r.name}-${i}`}
                  pagination={{ pageSize: 15 }}
                  scroll={{ x: 'max-content' }}
                />
              ),
            },
            {
              key: 'low',
              label: `موجودی بحرانی (${formatNumber(lowStock.length)})`,
              children: (
                <ResponsiveTable
                  columns={stockColumns(false)}
                  dataSource={lowStock}
                  loading={loading}
                  rowKey={(r, i) => r.productId || `${r.name}-${i}`}
                  pagination={{ pageSize: 15 }}
                  scroll={{ x: 'max-content' }}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}

export default ProductsReports
