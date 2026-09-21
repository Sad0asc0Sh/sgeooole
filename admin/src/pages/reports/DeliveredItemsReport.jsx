import { useEffect, useState, useCallback } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Input,
  Button,
  Space,
  Tag,
  message,
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'
import ResponsiveTable from '../../components/ResponsiveTable'
import { formatPersianDate } from '../../utils/dateUtils'
import { formatCurrency, formatNumber } from '../../utils/formatters'

const { RangePicker } = DatePicker

// فعال‌سازی تقویم جلالی
dayjs.extend(jalaliday)
dayjs.calendar('jalali')

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
      const params = {
        page,
        limit: pageSize,
      }
      if (overrideFilters.search) {
        params.search = overrideFilters.search
      }
      const [start, end] = overrideFilters.range || []
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
    const next = { ...filters, range: values || [] }
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

  // خروجی CSV با همان فیلترهای جاری (حداکثر ۲۰۰۰ ردیف)
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
        const str = value == null ? '' : String(value)
        return `"${str.replace(/"/g, '""')}"`
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

      message.success(`${rows.length} ردیف خروجی گرفته شد`)
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.userMessage ||
        err?.message ||
        'خطا در تهیه فایل خروجی'
      message.error(msg)
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
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
              {record.variantLabel}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'تعداد',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center',
      render: (qty) => formatNumber(qty),
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
        <span style={{ fontWeight: 600, color: '#3f8600' }}>
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
          <div style={{ fontSize: 12, color: '#8c8c8c' }} dir="ltr">
            {record.customerPhone || ''}
          </div>
          {record.customerCity ? (
            <Tag style={{ marginTop: 4 }}>{record.customerCity}</Tag>
          ) : null}
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
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h1>تاریخچه تحویل محصولات</h1>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={exporting}
          onClick={handleExport}
        >
          خروجی اکسل (CSV)
        </Button>
      </div>

      {/* فیلترها */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input.Search
            placeholder="جست‌وجو: کد سفارش، نام محصول، نام/تلفن/شهر مشتری"
            allowClear
            enterButton={<SearchOutlined />}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onSearch={handleSearch}
            style={{ width: 340, maxWidth: '100%' }}
          />
          <RangePicker
            value={filters.range}
            onChange={handleRangeChange}
            allowClear
            placeholder={['از تاریخ تحویل', 'تا تاریخ تحویل']}
          />
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            حذف فیلترها
          </Button>
        </Space>
      </Card>

      {/* آمار کلی */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={8} lg={5}>
          <Card>
            <Statistic
              title="اقلام تحویل‌شده"
              value={summary.totalRows}
              valueStyle={{ color: '#1890ff' }}
              formatter={(v) => formatNumber(v)}
            />
          </Card>
        </Col>
        <Col xs={12} md={8} lg={5}>
          <Card>
            <Statistic
              title="مجموع واحدها"
              value={summary.totalUnits}
              valueStyle={{ color: '#722ed1' }}
              formatter={(v) => formatNumber(v)}
            />
          </Card>
        </Col>
        <Col xs={12} md={8} lg={5}>
          <Card>
            <Statistic
              title="ارزش اقلام تحویل‌شده"
              value={summary.totalRevenue}
              precision={0}
              valueStyle={{ color: '#3f8600' }}
              suffix="تومان"
              formatter={(v) => formatNumber(v)}
            />
          </Card>
        </Col>
        <Col xs={12} md={8} lg={5}>
          <Card>
            <Statistic
              title="سفارش‌های تحویل‌شده"
              value={summary.ordersCount}
              valueStyle={{ color: '#fa8c16' }}
              formatter={(v) => formatNumber(v)}
            />
          </Card>
        </Col>
        <Col xs={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="مشتریان"
              value={summary.customersCount}
              valueStyle={{ color: '#eb2f96' }}
              formatter={(v) => formatNumber(v)}
            />
          </Card>
        </Col>
      </Row>

      {/* جدول */}
      <Card title="جزئیات اقلام تحویل‌شده (جدیدترین‌ها اول)">
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
