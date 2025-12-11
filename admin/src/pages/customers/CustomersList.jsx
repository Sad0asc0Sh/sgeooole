import { useEffect, useState } from 'react'
import { Table, Card, Input, Tag, Button, Select, Space, message } from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
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

function CustomersList() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  })

  const fetchUsers = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))

      if (search) {
        params.set('search', search)
      }
      if (roleFilter) {
        params.set('role', roleFilter)
      }
      if (activeFilter !== null) {
        params.set('isActive', activeFilter)
      }

      const res = await api.get('/users/admin/all', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination

      setUsers(list)
      if (pg) {
        setPagination({
          current: pg.currentPage || page,
          pageSize: pg.itemsPerPage || pageSize,
          total: pg.totalItems || list.length,
        })
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'خطا در دریافت لیست مشتریان'
      message.error(errorMsg)
      console.error('Fetch users error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers(1, pagination.pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, activeFilter])

  const columns = [
    {
      title: 'نام',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'ایمیل',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: 'شماره تلفن',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
      render: (phone) => phone || '—',
    },
    {
      title: 'تاریخ ثبت‌نام',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 200,
      render: (date) => formatPersianDate(date, true),
    },
    {
      title: 'نقش',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role) => {
        const colors = {
          user: 'default',
          support: 'cyan',
          editor: 'geekblue',
          admin: 'blue',
          manager: 'purple',
          superadmin: 'red',
        }
        const labels = {
          user: 'کاربر عادی',
          support: 'پشتیبان',
          editor: 'ویرایشگر',
          admin: 'ادمین',
          manager: 'مدیر ارشد',
          superadmin: 'سوپرادمین',
        }
        return <Tag color={colors[role] || 'default'}>{labels[role] || role}</Tag>
      },
    },
    {
      title: 'وضعیت',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? 'فعال' : 'مسدود'}</Tag>
      ),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Link to={`/customers/${record._id}`}>
          <Button type="primary" size="small">
            نمایش پروفایل
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
    fetchUsers(pag.current, pag.pageSize)
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
        <h1>مدیریت مشتریان</h1>
        <Button icon={<ReloadOutlined />} onClick={() => fetchUsers()}>
          بارگذاری مجدد
        </Button>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Input
          placeholder="جستجوی نام یا ایمیل..."
          prefix={<SearchOutlined />}
          style={{ width: 300 }}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          placeholder="نقش"
          style={{ width: 150 }}
          allowClear
          value={roleFilter}
          onChange={setRoleFilter}
        >
          <Select.Option value="user">کاربر عادی</Select.Option>
          <Select.Option value="support">پشتیبان</Select.Option>
          <Select.Option value="editor">ویرایشگر</Select.Option>
          <Select.Option value="admin">ادمین</Select.Option>
          <Select.Option value="manager">مدیر ارشد</Select.Option>
          <Select.Option value="superadmin">سوپرادمین</Select.Option>
        </Select>
        <Select
          placeholder="وضعیت"
          style={{ width: 150 }}
          allowClear
          value={activeFilter}
          onChange={setActiveFilter}
        >
          <Select.Option value="true">فعال</Select.Option>
          <Select.Option value="false">مسدود</Select.Option>
        </Select>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={users}
          loading={loading}
          rowKey="_id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `${total} کاربر`,
          }}
          onChange={onTableChange}
          locale={{
            emptyText: (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 0',
                  color: '#999',
                }}
              >
                <p>هیچ کاربری یافت نشد</p>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  )
}

export default CustomersList

