import { useEffect, useState } from 'react'
import { Card, Tag, Input, Select, Space, message } from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
import { SearchOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'

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
      if (pg) setPagination({ current: pg.currentPage || page, pageSize, total: pg.totalItems || list.length })
    } catch (err) {
      message.error(err?.message || 'خطا در دریافت تیکت‌ها')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTickets(1, pagination.pageSize) }, [status, priority])

  const columns = [
    {
      title: 'موضوع',
      dataIndex: 'subject',
      key: 'subject',
      render: (v, r) => <Link to={`/tickets/${r._id}`}>{v}</Link>,
    },
    {
      title: 'کاربر',
      dataIndex: ['user', 'name'],
      key: 'user',
      render: (_, r) => r.user ? `${r.user.name} (${r.user.email})` : '-',
    },
    {
      title: 'سفارش',
      dataIndex: ['order', 'orderNumber'],
      key: 'order',
      render: (_, r) => r.order?.orderNumber || '-',
    },
    {
      title: 'اولویت',
      dataIndex: 'priority',
      key: 'priority',
      render: (p) => <Tag color={p==='high'?'red':p==='medium'?'orange':'green'}>{p}</Tag>,
    },
    {
      title: 'وضعیت',
      mobileBadge: true,
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={s==='closed'?'red':s==='pending'?'blue':'green'}>{s}</Tag>,
    },
    {
      title: 'تاریخ',
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>تیکت‌ها</h1>
        <Space>
          <Input
            placeholder="جستجو (موضوع/پیام)"
            prefix={<SearchOutlined />}
            style={{ width: 320, maxWidth: '100%' }}
            allowClear
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => fetchTickets(1, pagination.pageSize)}
            onBlur={() => fetchTickets(1, pagination.pageSize)}
          />
          <Select placeholder="وضعیت" style={{ width: 150, maxWidth: '100%' }} allowClear onChange={setStatus}>
            {['open','pending','closed'].map(s => (
              <Select.Option key={s} value={s}>{s}</Select.Option>
            ))}
          </Select>
          <Select placeholder="اولویت" style={{ width: 150, maxWidth: '100%' }} allowClear onChange={setPriority}>
            {['low','medium','high'].map(p => (
              <Select.Option key={p} value={p}>{p}</Select.Option>
            ))}
          </Select>
        </Space>
      </div>
      <Card>
        <ResponsiveTable
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="_id"
          scroll={{ x: 'max-content' }}
          pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true }}
          onChange={onTableChange}
        />
      </Card>
    </div>
  )
}

export default TicketsList

