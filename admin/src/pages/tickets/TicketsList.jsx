import { useEffect, useState } from 'react'
import { Card, Input, Select, message } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import StatusPill from '../../components/ui/StatusPill'
import ResponsiveTable from '../../components/ResponsiveTable'
import { formatPersianDate } from '../../utils/dateUtils'
import { formatNumber } from '../../utils/formatters'
import api from '../../api'

const STATUS_META = {
  open: { label: 'باز', tone: 'warn' },
  pending: { label: 'در انتظار بررسی', tone: 'info' },
  closed: { label: 'بسته‌شده', tone: 'neutral' },
}

const PRIORITY_META = {
  high: { label: 'فوری', tone: 'err' },
  medium: { label: 'متوسط', tone: 'warn' },
  low: { label: 'عادی', tone: 'ok' },
}

function TicketsList() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState()
  const [priority, setPriority] = useState()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })

  const fetchTickets = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = { page, limit: pageSize, sort: '-createdAt' }
      if (search) params.search = search
      if (status) params.status = status
      if (priority) params.priority = priority
      const res = await api.get('/tickets/admin/all', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination
      setData(list)
      if (pg) {
        setPagination({
          current: pg.currentPage || page,
          pageSize,
          total: pg.totalItems || list.length,
        })
      }
    } catch (err) {
      message.error(err?.message || 'خطا در دریافت تیکت‌ها')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets(1, pagination.pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, priority])

  const columns = [
    {
      title: 'موضوع',
      dataIndex: 'subject',
      key: 'subject',
      mobileTitle: true,
      render: (v, r) => (
        <Link to={`/tickets/${r._id}`} style={{ fontWeight: 600 }}>
          {v}
        </Link>
      ),
    },
    {
      title: 'کاربر',
      dataIndex: ['user', 'name'],
      key: 'user',
      mobileSubtitle: true,
      render: (_, r) => (r.user ? `${r.user.name || 'کاربر'} (${r.user.email || r.user.mobile || '—'})` : '—'),
    },
    {
      title: 'سفارش مرتبط',
      dataIndex: ['order', 'orderNumber'],
      key: 'order',
      render: (_, r) => r.order?.orderNumber || r.order?.orderCode || '—',
    },
    {
      title: 'اولویت',
      dataIndex: 'priority',
      key: 'priority',
      render: (p) => {
        const meta = PRIORITY_META[p] || { label: p || 'عادی', tone: 'neutral' }
        return <StatusPill size="sm" tone={meta.tone} label={meta.label} />
      },
    },
    {
      title: 'وضعیت',
      mobileBadge: true,
      dataIndex: 'status',
      key: 'status',
      render: (s) => {
        const meta = STATUS_META[s] || { label: s || '—', tone: 'neutral' }
        return <StatusPill tone={meta.tone} label={meta.label} />
      },
    },
    {
      title: 'تاریخ ثبت',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d) => formatPersianDate(d, true),
    },
  ]

  const onTableChange = (pag) => {
    setPagination((prev) => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))
    fetchTickets(pag.current, pag.pageSize)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <PageHeader
        title="پشتیبانی و تیکت‌ها"
        subtitle="پیام‌ها، پیگیری‌ها و درخواست‌های پشتیبانی مشتریان"
        count={pagination.total}
      />

      <div className="filter-bar">
        <Input
          placeholder="جستجو در موضوع یا متن پیام..."
          prefix={<SearchOutlined />}
          style={{ width: 300, maxWidth: '100%' }}
          allowClear
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={() => fetchTickets(1, pagination.pageSize)}
          onBlur={() => fetchTickets(1, pagination.pageSize)}
        />
        <Select
          placeholder="وضعیت تیکت"
          style={{ width: 170 }}
          allowClear
          value={status}
          onChange={setStatus}
        >
          <Select.Option value="open">باز</Select.Option>
          <Select.Option value="pending">در انتظار بررسی</Select.Option>
          <Select.Option value="closed">بسته‌شده</Select.Option>
        </Select>
        <Select
          placeholder="اولویت"
          style={{ width: 150 }}
          allowClear
          value={priority}
          onChange={setPriority}
        >
          <Select.Option value="high">فوری</Select.Option>
          <Select.Option value="medium">متوسط</Select.Option>
          <Select.Option value="low">عادی</Select.Option>
        </Select>
      </div>

      <Card>
        <ResponsiveTable
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="_id"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (t) => `${formatNumber(t)} تیکت`,
          }}
          onChange={onTableChange}
        />
      </Card>
    </div>
  )
}

export default TicketsList
