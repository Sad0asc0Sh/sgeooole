import { useEffect, useState } from 'react'
import { Table, Card, Tag, Input, Select, Space, Button } from 'antd'
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'
import Countdown from 'react-countdown'

// فعال‌سازی تقویم جلالی
dayjs.extend(jalaliday)
dayjs.calendar('jalali')

// نام ماه‌های شمسی
const persianMonths = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

// تابع برای فرمت کردن تاریخ با نام ماه فارسی
const formatPersianDate = (date, includeTime = false) => {
  if (!date) return '—'
  const jalaliDate = dayjs(date).calendar('jalali').locale('fa')
  const year = jalaliDate.format('YYYY')
  const month = persianMonths[parseInt(jalaliDate.format('M')) - 1]
  const day = jalaliDate.format('DD')

  if (includeTime) {
    const time = jalaliDate.format('HH:mm')
    return `${day} ${month} ${year} - ساعت ${time}`
  }
  return `${day} ${month} ${year}`
}

function OrdersList() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    orderStatus: null,
    isPaid: null,
  })
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  })
  const navigate = useNavigate()

  const fetchOrders = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))

      if (filters.search) {
        params.set('search', filters.search)
      }
      if (filters.orderStatus) {
        params.set('orderStatus', filters.orderStatus)
      }
      if (filters.isPaid !== null) {
        params.set('isPaid', String(filters.isPaid))
      }

      const res = await api.get('/orders', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination

      setOrders(list)
      if (pg) {
        setPagination({
          current: pg.currentPage || page,
          pageSize: pg.itemsPerPage || pageSize,
          total: pg.totalItems || list.length,
        })
      }
    } catch (err) {
      console.error('Error fetching orders:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders(1, pagination.pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.orderStatus, filters.isPaid])

  const getStatusColor = (status) => {
    const colors = {
      Pending: 'orange',
      Processing: 'blue',
      Shipped: 'purple',
      Delivered: 'green',
      Cancelled: 'red',
    }
    return colors[status] || 'default'
  }

  const getStatusLabel = (status) => {
    const labels = {
      Pending: 'ثبت سفارش',
      Processing: 'درحال پردازش',
      Shipped: 'تحویل به پست',
      Delivered: 'تحویل شده',
      Cancelled: 'لغو شده',
    }
    return labels[status] || status
  }

  const columns = [
    {
      title: 'شماره سفارش',
      dataIndex: 'orderCode', // Use orderCode primarily
      key: 'orderId',
      width: 150,
      render: (code, record) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.85em', fontWeight: 'bold' }}>
          {code || `#${record._id.slice(-8)}`}
        </span>
      ),
    },
    {
      title: 'مشتری',
      dataIndex: ['user', 'name'],
      key: 'customer',
      ellipsis: true,
      render: (name, record) => name || record.user?.email || '—',
    },
    {
      title: 'تعداد محصول',
      dataIndex: 'orderItems',
      key: 'itemsCount',
      width: 100,
      align: 'center',
      render: (items) => items?.length || 0,
    },
    {
      title: 'مبلغ کل',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 150,
      render: (price) =>
        price != null
          ? `${new Intl.NumberFormat('fa-IR').format(price)} تومان`
          : '—',
    },
    {
      title: 'پرداخت',
      dataIndex: 'isPaid',
      key: 'isPaid',
      width: 100,
      align: 'center',
      render: (isPaid) => (
        <Tag color={isPaid ? 'green' : 'red'}>
          {isPaid ? 'پرداخت شده' : 'پرداخت نشده'}
        </Tag>
      ),
    },
    {
      title: 'وضعیت سفارش',
      dataIndex: 'orderStatus',
      key: 'orderStatus',
      width: 150,
      render: (status, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
          {status === 'Shipped' && record.autoCompleteAt && (
            <div style={{ fontSize: '0.75em', color: '#1890ff', marginTop: 4 }}>
              <Countdown
                date={new Date(record.autoCompleteAt)}
                renderer={({ days, hours, minutes, completed }) => {
                  if (completed) return <span style={{ color: 'green' }}>تکمیل شد</span>
                  return <span>{days} روز {hours} ساعت</span>
                }}
              />
            </div>
          )}
        </Space>
      ),
    },
    {
      title: 'تاریخ ثبت',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => formatPersianDate(date, true),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Link to={`/orders/${record._id}`}>
          <Button type="primary" size="small" icon={<EyeOutlined />}>
            مشاهده
          </Button>
        </Link>
      ),
    },
  ]

  const onTableChange = (pag) => {
    setPagination((prev) => ({
      ...prev,
      current: pag.current,
      pageSize: pag.pageSize,
    }))
    fetchOrders(pag.current, pag.pageSize)
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h1>مدیریت سفارشات</h1>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => fetchOrders()}
        >
          بارگذاری مجدد
        </Button>
      </div>

      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Input
          placeholder="جستجو (کد سفارش، نام مشتری...)"
          prefix={<SearchOutlined />}
          style={{ width: 300 }}
          allowClear
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, search: e.target.value }))
          }
          onPressEnter={() => fetchOrders(1, pagination.pageSize)}
          onBlur={() => fetchOrders(1, pagination.pageSize)}
        />
        <Select
          placeholder="وضعیت سفارش"
          style={{ width: 180 }}
          allowClear
          onChange={(value) =>
            setFilters((prev) => ({ ...prev, orderStatus: value || null }))
          }
        >
          <Select.Option value="Pending">ثبت سفارش</Select.Option>
          <Select.Option value="Processing">درحال پردازش</Select.Option>
          <Select.Option value="Shipped">تحویل به پست</Select.Option>
          <Select.Option value="Delivered">تحویل شده</Select.Option>
          <Select.Option value="Cancelled">لغو شده</Select.Option>
        </Select>
        <Select
          placeholder="وضعیت پرداخت"
          style={{ width: 180 }}
          allowClear
          onChange={(value) =>
            setFilters((prev) => ({ ...prev, isPaid: value }))
          }
        >
          <Select.Option value={true}>پرداخت شده</Select.Option>
          <Select.Option value={false}>پرداخت نشده</Select.Option>
        </Select>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={orders}
          loading={loading}
          rowKey="_id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `${total} سفارش`,
          }}
          onChange={onTableChange}
          onRow={(record) => ({
            onDoubleClick: () => navigate(`/orders/${record._id}`),
            style: { cursor: 'pointer' },
          })}
          locale={{
            emptyText: (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 0',
                  color: '#999',
                }}
              >
                <p>هیچ سفارشی یافت نشد</p>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  )
}

export default OrdersList
