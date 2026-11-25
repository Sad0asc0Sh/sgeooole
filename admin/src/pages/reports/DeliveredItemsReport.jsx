import { useEffect, useState, useCallback } from 'react'
import { Card, Input, Button, Tag, message } from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  EyeOutlined,
  ShoppingOutlined,
  InboxOutlined,
  DollarOutlined,
  TruckOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import api from '../../api'
import ResponsiveTable from '../../components/ResponsiveTable'
import { formatPersianDate, toSafeDate } from '../../utils/dateUtils'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import PageHeader from '../../components/ui/PageHeader'
import StatTile from '../../components/ui/StatTile'
import JalaliRangePicker from '../../components/JalaliRangePicker'
import './Reports.css'

const DEFAULT_PAGE_SIZE = 20
const EXPORT_LIMIT = 2000

function DeliveredItemsReport() {
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState({
    totalRows: 0,
    totalUnits: 0,
    totalRevenue: 0,
    ordersCount: 0,
    customersCount: 0,
  })
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  })
  const [filters, setFilters] = useState({
    search: '',
    range: [],
  })

  const buildParams = useCallback(
    (page, pageSize, overrideFilters = filters) => {
      const params = { page, limit: pageSize }
      if (overrideFilters.search) params.search = overrideFilters.search
      const [rawStart, rawEnd] = overrideFilters.range || []
      const start = toSafeDate(rawStart)
      const end = toSafeDate(rawEnd)
      if (start) params.startDate = start.toISOString()
      if (end) params.endDate = end.toISOString()
      return params
    },
    [filters],
  )

  const fetchReport = useCallback(
    async (page = 1, pageSize = DEFAULT_PAGE_SIZE, overrideFilters) => {
      setLoading(true)
      try {
        const params = buildParams(page, pageSize, overrideFilters)
        const res = await api.get('/reports/delivered-items', { params })
        const data = res?.data?.data || {}

        setItems(Array.isArray(data.items) ? data.items : [])
        setSummary({
          totalRows: data.summary?.totalRows || 0,
          totalUnits: data.summary?.totalUnits || 0,
          totalRevenue: data.summary?.totalRevenue || 0,
          ordersCount: data.summary?.ordersCount || 0,
          customersCount: data.summary?.customersCount || 0,
        })

        const pg = data.pagination || {}
        setPagination({
          current: pg.currentPage || page,
          pageSize: pg.itemsPerPage || pageSize,
          total: pg.totalItems || 0,
        })
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.userMessage ||
          err?.message ||
          'خطا در دریافت تاریخچه تحویل محصولات'
        message.error(msg)
      } finally {
        setLoading(false)
      }
    },
    [buildParams],
  )

  useEffect(() => {
    fetchReport(1, DEFAULT_PAGE_SIZE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearch = (value) => {
    const next = { ...filters, search: (value || '').trim() }
    setFilters(next)
    fetchReport(1, pagination.pageSize, next)
  }

  const handleRangeChange = (values) => {
    const next = { ...filters, range: Array.isArray(values) ? values : [] }
    setFilters(next)
    fetchReport(1, pagination.pageSize, next)
  }

  const handleReset = () => {
    const next = { search: '', range: [] }
    setFilters(next)
    fetchReport(1, DEFAULT_PAGE_SIZE, next)
  }

  const handleTableChange = (pg) => {
    fetchReport(pg.current, pg.pageSize)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = buildParams(1, EXPORT_LIMIT)
      const res = await api.get('/reports/delivered-items', { params })
      const data = res?.data?.data || {}
      const rows = Array.isArray(data.items) ? data.items : []

      if (rows.length === 0) {
        message.warning('ردیفی برای خروجی گرفتن وجود ندارد')
        return
      }

      const headers = [
        'ردیف',
        'کد سفارش',
        'نام محصول',
        'مشخصات واریانت',
        'تعداد',
        'قیمت واحد (تومان)',
        'جمع ردیف (تومان)',
        'نام مشتری',
        'تلفن مشتری',
        'شهر',
        'تاریخ تحویل',
      ]

      const escapeCell = (value) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return `"${value}"`
        }
        const str = value == null ? '' : String(value)
        const safe =
          /^[\t\r\n ]*[=+\-@]/.test(str) || /^[\t\r]/.test(str)
            ? `'${str}`
            : str
        return `"${safe.replace(/"/g, '""')}"`
      }

      const lines = [headers.map(escapeCell).join(',')]
      rows.forEach((row, idx) => {
        lines.push(
          [
            idx + 1,
            row.orderCode,
            row.productName,
            row.variantLabel || '',
            row.quantity,
            row.unitPrice,
            row.lineTotal,
            row.customerName,
            row.customerPhone,
            row.customerCity,
            formatPersianDate(row.deliveryDate, true),
          ]
            .map(escapeCell)
            .join(','),
        )
      })

      const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const stamp = dayjs().format('YYYYMMDD-HHmm')
      link.href = url
      link.download = `delivered-items-${stamp}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      message.success(`${formatNumber(rows.length)} ردیف خروجی گرفته شد`)
    } catch (err) {
      message.error(
        err?.response?.data?.message || err?.userMessage || err?.message || 'خطا در تهیه فایل خروجی',
      )
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      title: 'کد سفارش',
      dataIndex: 'orderCode',
      key: 'orderCode',
      width: 130,
      mobileBadge: true,
      render: (code, record) => (
        <Link to={`/orders/${record.orderId}`}>
          <Tag color="blue">{code}</Tag>
        </Link>
      ),
    },
    {
      title: 'محصول',
      dataIndex: 'productName',
      key: 'productName',
      mobileTitle: true,
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          {record.variantLabel ? (
            <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{record.variantLabel}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'تعداد',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 85,
      align: 'center',
      render: (qty) => `${formatNumber(qty)} عدد`,
    },
    {
      title: 'قیمت واحد',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 140,
      mobile: false,
      render: (price) => formatCurrency(price),
    },
    {
      title: 'جمع ردیف',
      dataIndex: 'lineTotal',
      key: 'lineTotal',
      width: 140,
      render: (total) => (
        <span className="money-cell" style={{ color: 'var(--ok)' }}>
          {formatCurrency(total)}
        </span>
      ),
    },
    {
      title: 'مشتری',
      key: 'customer',
      width: 190,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.customerName || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)' }} dir="ltr">
            {record.customerPhone || ''}
          </div>
          {record.customerCity ? <Tag style={{ marginTop: 4 }}>{record.customerCity}</Tag> : null}
        </div>
      ),
    },
    {
      title: 'تاریخ تحویل',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      width: 190,
      render: (date) => formatPersianDate(date, true),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Link to={`/orders/${record.orderId}`}>
          <Button type="link" icon={<EyeOutlined />} size="small">
            سفارش
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <div className="report-page">
      <PageHeader
        title="تاریخچه تحویل محصولات"
        subtitle="پیگیری دقیق اقلام تحویل‌شده به مشتریان به تفکیک سفارش و زمان تحویل"
        actions={
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={handleExport}
          >
            خروجی اکسل (CSV)
          </Button>
        }
      />

      <div className="filter-bar">
        <Input.Search
          placeholder="جست‌وجو: کد سفارش، نام محصول، نام/تلفن/شهر مشتری"
          allowClear
          enterButton={<SearchOutlined />}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          onSearch={handleSearch}
          style={{ width: 340, maxWidth: '100%' }}
        />
        <div className="filter-range-slot">
          <JalaliRangePicker
            value={filters.range}
            onChange={handleRangeChange}
            presets="analytics"
            placeholder="بازه تاریخ تحویل (شمسی)"
          />
        </div>
        <Button icon={<ReloadOutlined />} onClick={handleReset}>
          حذف فیلترها
        </Button>
      </div>

      <div className="kpi-grid-5">
        <StatTile
          loading={loading}
          label="اقلام تحویل‌شده"
          value={formatNumber(summary.totalRows)}
          icon={<ShoppingOutlined />}
          tone="brand"
        />
        <StatTile
          loading={loading}
          label="مجموع واحدها"
          value={formatNumber(summary.totalUnits)}
          icon={<InboxOutlined />}
          tone="info"
        />
        <StatTile
          loading={loading}
          label="ارزش اقلام تحویل‌شده"
          value={formatCurrency(summary.totalRevenue)}
          icon={<DollarOutlined />}
          tone="ok"
        />
        <StatTile
          loading={loading}
          label="سفارش‌های تحویل‌شده"
          value={formatNumber(summary.ordersCount)}
          icon={<TruckOutlined />}
          tone="warn"
        />
        <StatTile
          loading={loading}
          label="مشتریان"
          value={formatNumber(summary.customersCount)}
          icon={<UserOutlined />}
          tone="neutral"
        />
      </div>

      <Card className="report-card" title="جزئیات اقلام تحویل‌شده (جدیدترین‌ها اول)">
        <ResponsiveTable
          columns={columns}
          dataSource={items}
          rowKey={(record, index) => `${record.orderId}-${index}`}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `مجموع ${formatNumber(total)} ردیف`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  )
}

export default DeliveredItemsReport
