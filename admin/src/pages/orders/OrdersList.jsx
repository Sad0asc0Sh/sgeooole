import { useEffect, useState } from 'react'
import { Card, Input, Select, Space, Button, Segmented } from 'antd'
import { SearchOutlined, ReloadOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import Countdown from 'react-countdown'
import ResponsiveTable from '../../components/ResponsiveTable'
import PageHeader from '../../components/ui/PageHeader'
import StatusPill from '../../components/ui/StatusPill'
import { PERMISSIONS } from '../../rbac/permissions'
import { useCan } from '../../rbac/useCan'
import { formatCurrency, formatNumber, getStatusLabel } from '../../utils/formatters'
import { formatPersianDate } from '../../utils/dateUtils'
import api from '../../api'

function OrdersList() {
  const { can } = useCan()
  const canCreate = can(PERMISSIONS.ORDER_CREATE)

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

      if (filters.search) params.set('search', filters.search)
      if (filters.orderStatus) params.set('orderStatus', filters.orderStatus)
      if (filters.isPaid !== null && filters.isPaid !== undefined) {
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

  const columns = [
    {
      title: 'شماره سفارش',
      dataIndex: 'orderCode',
      key: 'orderId',
      width: 150,
      mobileTitle: true,
      render: (code, record) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
          {code || `#${record._id.slice(-8)}`}
        </span>
      ),
    },
    {
      title: 'مشتری',
      dataIndex: ['user', 'name'],
      key: 'customer',
      ellipsis: true,
      mobileSubtitle: true,
      render: (name, record) => name || record.shippingAddress?.fullName || record.user?.email || '—',
    },
    {
      title: 'تعداد محصول',
      dataIndex: 'orderItems',
      key: 'itemsCount',
      width: 105,
      align: 'center',
      render: (items) => `${formatNumber(items?.length || 0)} قلم`,
    },
    {
      title: 'مبلغ کل',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 150,
      render: (price) => <span className="money-cell">{formatCurrency(price)}</span>,
    },
    {
      title: 'پرداخت',
      dataIndex: 'isPaid',
      key: 'isPaid',
      width: 115,
      align: 'center',
      render: (isPaid) => (
        <StatusPill
          status={isPaid ? 'paid' : 'unpaid'}
          label={isPaid ? 'پرداخت شده' : 'پرداخت نشده'}
          tone={isPaid ? 'ok' : 'err'}
        />
      ),
    },
    {
      title: 'وضعیت سفارش',
      mobileBadge: true,
      dataIndex: 'orderStatus',
      key: 'orderStatus',
      width: 155,
      render: (status, record) => (
        <Space direction="vertical" size={0}>
          <StatusPill status={status} label={getStatusLabel(status)} />
          {status === 'Shipped' && record.autoCompleteAt && (
            <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>
              <Countdown
                date={new Date(record.autoCompleteAt)}
                renderer={({ days, hours, completed }) => {
                  if (completed) return <span style={{ color: '#0f6b33' }}>تکمیل شد</span>
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
      width: 185,
      render: (date) => formatPersianDate(date, true),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 110,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <PageHeader
        title="مدیریت سفارش‌ها"
        subtitle="پیگیری وضعیت پرداخت، پردازش بسته‌ها و ارسال سفارش‌های مشتریان"
        count={pagination.total}
        actions={
          <Space wrap>
            {canCreate && (
              <Link to="/orders/create">
                <Button type="primary" icon={<PlusOutlined />}>
                  ثبت سفارش جدید
                </Button>
              </Link>
            )}
            <Button icon={<ReloadOutlined spin={loading} />} onClick={() => fetchOrders()}>
              به‌روزرسانی
            </Button>
          </Space>
        }
      />

      <div className="quick-tabs-bar">
        <Segmented
          value={filters.orderStatus || 'all'}
          onChange={(val) =>
            setFilters((prev) => ({ ...prev, orderStatus: val === 'all' ? null : val }))
          }
          options={[
            { label: 'همه سفارش‌ها', value: 'all' },
            { label: 'ثبت سفارش', value: 'Pending' },
            { label: 'در حال پردازش', value: 'Processing' },
            { label: 'تحویل به پست', value: 'Shipped' },
            { label: 'تحویل شده', value: 'Delivered' },
            { label: 'لغو شده', value: 'Cancelled' },
          ]}
        />
      </div>

      <div className="filter-bar">
        <Input
          placeholder="جستجو (کد سفارش، نام مشتری...)"
          prefix={<SearchOutlined />}
          style={{ width: 300, maxWidth: '100%' }}
          allowClear
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          onPressEnter={() => fetchOrders(1, pagination.pageSize)}
          onBlur={() => fetchOrders(1, pagination.pageSize)}
        />
        <Select
          placeholder="وضعیت پرداخت"
          style={{ width: 180, maxWidth: '100%' }}
          allowClear
          value={filters.isPaid}
          onChange={(value) => setFilters((prev) => ({ ...prev, isPaid: value ?? null }))}
        >
          <Select.Option value={true}>پرداخت شده</Select.Option>
          <Select.Option value={false}>پرداخت نشده</Select.Option>
        </Select>
      </div>

      <Card styles={{ body: { padding: '0 16px 16px' } }}>
        <ResponsiveTable
          columns={columns}
          dataSource={orders}
          loading={loading}
          rowKey="_id"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `${formatNumber(total)} سفارش`,
          }}
          onChange={onTableChange}
          onRow={(record) => ({
            onClick: () => navigate(`/orders/${record._id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  )
}

export default OrdersList
