import { useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Tag,
  message,
  Space,
  Statistic,
  Row,
  Col,
  Select,
  Tooltip,
  Modal,
  Descriptions,
  Image,
  Progress,
} from 'antd'
import {
  ReloadOutlined,
  MailOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  MessageOutlined,
  DeleteOutlined,
  ClearOutlined,
  WarningOutlined,
  FireOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'
import { PERMISSIONS } from '../../rbac/permissions'
import { useCan } from '../../rbac/useCan'

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

function AbandonedCartsPage() {
  const { can } = useCan()
  const canReadSettings = can(PERMISSIONS.SETTINGS_READ)
  const canManageCarts = can(PERMISSIONS.CART_MANAGE)

  const [carts, setCarts] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [hoursAgo, setHoursAgo] = useState(0)
  const [daysAgo, setDaysAgo] = useState(7)
  const [lastRefreshTime, setLastRefreshTime] = useState(null)
  const [settings, setSettings] = useState(null) // تنظیمات سبد خرید

  // Modal جزئیات
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedCart, setSelectedCart] = useState(null)

  const fetchSettings = async () => {
    if (!canReadSettings) {
      setSettings({
        cartSettings: {
          cartTTLHours: 1,
          expiryWarningMinutes: 30,
          permanentCart: false,
        },
      })
      return
    }

    try {
      const res = await api.get('/settings')
      const data = res?.data?.data
      setSettings(data)
    } catch (err) {
      console.error('Failed to fetch settings:', err)
      // استفاده از مقادیر پیش‌فرض در صورت خطا
      setSettings({
        cartSettings: {
          cartTTLHours: 1,
          expiryWarningMinutes: 30,
          permanentCart: false,
        },
      })
    }
  }

  const fetchAbandonedCarts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('hoursAgo', String(hoursAgo))
      params.set('daysAgo', String(daysAgo))

      const res = await api.get('/carts/admin/abandoned', { params })
      const data = res?.data?.data || []
      const statsData = res?.data?.stats || null

      setCarts(data)
      setStats(statsData)
      setLastRefreshTime(new Date())
    } catch (err) {
      const errorMsg =
        err?.response?.data?.message || err?.message || 'خطا در دریافت سبدهای رها شده'
      message.error(errorMsg)
      console.error('Fetch abandoned carts error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
    fetchAbandonedCarts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoursAgo, daysAgo])

  // Auto-refresh every minute to update countdown timers
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAbandonedCarts()
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoursAgo, daysAgo])

  const getTimeAgo = (updatedAt) => {
    const now = new Date()
    const updated = new Date(updatedAt)
    const diffInMs = now - updated
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInDays > 0) {
      return `${diffInDays} روز پیش`
    } else if (diffInHours > 0) {
      return `${diffInHours} ساعت پیش`
    } else {
      return `${diffInMinutes} دقیقه پیش`
    }
  }

  // محاسبه زمان باقی‌مانده تا انقضا
  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null

    const now = new Date()
    const expiry = new Date(expiresAt)
    const diffInMs = expiry - now

    // اگر منقضی شده
    if (diffInMs <= 0) {
      return { expired: true, text: 'منقضی شده', minutes: 0, total: 0 }
    }

    const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    let text = ''
    if (diffInDays > 0) {
      const remainingHours = diffInHours % 24
      text = `${diffInDays} روز${remainingHours > 0 ? ` و ${remainingHours} ساعت` : ''}`
    } else if (diffInHours > 0) {
      const remainingMinutes = diffInMinutes % 60
      text = `${diffInHours} ساعت${remainingMinutes > 0 ? ` و ${remainingMinutes} دقیقه` : ''}`
    } else {
      text = `${diffInMinutes} دقیقه`
    }

    return {
      expired: false,
      text,
      minutes: diffInMinutes,
      total: diffInMinutes,
    }
  }

  // محاسبه درصد پیشرفت برای Progress Bar
  const getExpiryProgress = (cart) => {
    const remaining = getTimeRemaining(cart.expiresAt)
    if (!remaining || remaining.expired) return { percent: 100, status: 'exception' }

    // محاسبه زمان سپری شده از updatedAt تا الان
    const now = new Date()
    const updated = new Date(cart.updatedAt)
    const expiry = new Date(cart.expiresAt)
    const totalDuration = expiry - updated
    const elapsed = now - updated

    const percent = Math.min(100, Math.floor((elapsed / totalDuration) * 100))

    // تعیین وضعیت بر اساس زمان باقیمانده و تنظیمات
    const warningMinutes = settings?.cartSettings?.expiryWarningMinutes || 30
    const urgentThreshold = Math.floor(warningMinutes / 2) // نصف زمان هشدار

    let status = 'success'
    if (remaining.minutes <= urgentThreshold) {
      status = 'exception' // قرمز - فوری
    } else if (remaining.minutes <= warningMinutes) {
      status = 'normal' // نارنجی - متوسط
    }

    return { percent, status }
  }

  // آیکون و رنگ بر اساس فوریت
  const getUrgencyIcon = (cart) => {
    const remaining = getTimeRemaining(cart.expiresAt)
    if (!remaining || remaining.expired) {
      return { icon: <ClockCircleOutlined />, color: '#999' }
    }

    // استفاده از تنظیمات برای تعیین آستانه فوریت
    const warningMinutes = settings?.cartSettings?.expiryWarningMinutes || 30
    const urgentThreshold = Math.floor(warningMinutes / 2) // نصف زمان هشدار

    if (remaining.minutes <= urgentThreshold) {
      return { icon: <FireOutlined />, color: '#ff4d4f' } // قرمز - فوری
    } else if (remaining.minutes <= warningMinutes) {
      return { icon: <WarningOutlined />, color: '#fa8c16' } // نارنجی - متوسط
    } else {
      return { icon: <ClockCircleOutlined />, color: '#52c41a' } // سبز - عادی
    }
  }

  const handleEmailReminder = async (cart) => {
    if (!canManageCarts) {
      message.error('شما مجوز مدیریت سبدهای خرید را ندارید.')
      return
    }

    Modal.confirm({
      title: 'ارسال ایمیل یادآوری',
      content: `آیا می‌خواهید ایمیل یادآوری به ${cart.user?.name || cart.user?.email} ارسال شود؟`,
      okText: 'ارسال',
      cancelText: 'لغو',
      onOk: async () => {
        try {
          await api.post(`/carts/admin/remind/email/${cart._id}`)
          message.success('ایمیل یادآوری با موفقیت ارسال شد')
        } catch (err) {
          const errorMsg = err?.response?.data?.message || 'خطا در ارسال ایمیل'
          message.error(errorMsg)
          console.error('Email reminder error:', err)
        }
      },
    })
  }

  const handleSmsReminder = async (cart) => {
    if (!canManageCarts) {
      message.error('شما مجوز مدیریت سبدهای خرید را ندارید.')
      return
    }

    Modal.confirm({
      title: 'ارسال پیامک یادآوری',
      content: `آیا می‌خواهید پیامک یادآوری به شماره ${cart.user?.mobile || 'نامشخص'} ارسال شود؟`,
      okText: 'ارسال',
      cancelText: 'لغو',
      onOk: async () => {
        try {
          await api.post(`/carts/admin/remind/sms/${cart._id}`)
          message.success('پیامک یادآوری با موفقیت ارسال شد')
        } catch (err) {
          const errorMsg = err?.response?.data?.message || 'خطا در ارسال پیامک'
          message.error(errorMsg)
          console.error('SMS reminder error:', err)
        }
      },
    })
  }

  const handleDeleteCart = async (cart) => {
    if (!canManageCarts) {
      message.error('شما مجوز مدیریت سبدهای خرید را ندارید.')
      return
    }

    Modal.confirm({
      title: 'حذف سبد خرید',
      content: `آیا مطمئن هستید که می‌خواهید سبد خرید ${cart.user?.name || 'این کاربر'} را حذف کنید؟`,
      okText: 'حذف',
      cancelText: 'لغو',
      okType: 'danger',
      onOk: async () => {
        try {
          await api.delete(`/carts/admin/${cart._id}`)
          message.success('سبد خرید با موفقیت حذف شد')
          fetchAbandonedCarts()
        } catch (err) {
          const errorMsg = err?.response?.data?.message || 'خطا در حذف سبد خرید'
          message.error(errorMsg)
          console.error('Delete cart error:', err)
        }
      },
    })
  }

  const handleCleanupExpired = async () => {
    if (!canManageCarts) {
      message.error('شما مجوز مدیریت سبدهای خرید را ندارید.')
      return
    }

    Modal.confirm({
      title: 'پاکسازی سبدهای منقضی شده',
      content: 'آیا می‌خواهید تمام سبدهای خریدی که زمان انقضای آنها گذشته است را پاکسازی کنید؟',
      okText: 'پاکسازی',
      cancelText: 'لغو',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await api.post('/carts/admin/cleanup')
          const count = res?.data?.count || 0
          message.success(`${count} سبد خرید منقضی شده پاکسازی شد`)
          fetchAbandonedCarts()
        } catch (err) {
          const errorMsg = err?.response?.data?.message || 'خطا در پاکسازی سبدها'
          message.error(errorMsg)
          console.error('Cleanup error:', err)
        }
      },
    })
  }

  const showCartDetails = (cart) => {
    setSelectedCart(cart)
    setDetailOpen(true)
  }

  const columns = [
    {
      title: 'مشتری',
      key: 'customer',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.user?.name || '—'}</div>
          <div style={{ fontSize: '0.85em', color: '#666' }}>
            {record.user?.email || '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'تعداد آیتم',
      dataIndex: 'items',
      key: 'itemsCount',
      align: 'center',
      width: 120,
      render: (items) => {
        const totalQty = items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
        return (
          <Tag icon={<ShoppingCartOutlined />} color="blue">
            {items?.length || 0} محصول ({totalQty} عدد)
          </Tag>
        )
      },
    },
    {
      title: 'مبلغ کل',
      key: 'totalValue',
      width: 150,
      render: (_, record) => {
        const total = record.items?.reduce(
          (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
          0,
        ) || 0
        return `${new Intl.NumberFormat('fa-IR').format(total)} تومان`
      },
    },
    {
      title: 'آخرین به‌روزرسانی',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (updatedAt) => (
        <Tooltip title={formatPersianDate(updatedAt, true)}>
          <Tag icon={<ClockCircleOutlined />} color="orange">
            {getTimeAgo(updatedAt)}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'زمان باقیمانده تا انقضا',
      key: 'expiresAt',
      width: 220,
      render: (_, record) => {
        const remaining = getTimeRemaining(record.expiresAt)
        const progress = getExpiryProgress(record)
        const urgency = getUrgencyIcon(record)

        if (!remaining) {
          return (
            <Tag color="blue">
              سبد ماندگار
            </Tag>
          )
        }

        if (remaining.expired) {
          return (
            <div>
              <Tag icon={<ClockCircleOutlined />} color="default">
                منقضی شده
              </Tag>
              <Progress
                percent={100}
                status="exception"
                size="small"
                showInfo={false}
                style={{ marginTop: 4 }}
              />
            </div>
          )
        }

        return (
          <div>
            <Tooltip title={`انقضا در: ${formatPersianDate(record.expiresAt, true)}`}>
              <Tag icon={urgency.icon} color={urgency.color === '#ff4d4f' ? 'error' : urgency.color === '#fa8c16' ? 'warning' : 'success'}>
                {remaining.text}
              </Tag>
            </Tooltip>
            <Progress
              percent={progress.percent}
              status={progress.status}
              size="small"
              showInfo={false}
              style={{ marginTop: 4 }}
              strokeColor={urgency.color}
            />
          </div>
        )
      },
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 350,
      align: 'center',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="default"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => showCartDetails(record)}
          >
            جزئیات
          </Button>
          {canManageCarts && (
            <Button
              type="primary"
              size="small"
              icon={<MailOutlined />}
              onClick={() => handleEmailReminder(record)}
            >
              ایمیل
            </Button>
          )}
          {canManageCarts && (
            <Button
              type="primary"
              size="small"
              icon={<MessageOutlined />}
              onClick={() => handleSmsReminder(record)}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              پیامک
            </Button>
          )}
          {canManageCarts && (
            <Button
              danger
              type="primary"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteCart(record)}
            >
              حذف
            </Button>
          )}
        </Space>
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
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>سبدهای رها شده</h1>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {lastRefreshTime && (
              <div style={{ fontSize: '12px', color: '#999' }}>
                <ClockCircleOutlined style={{ marginLeft: 4 }} />
                آخرین به‌روزرسانی: {lastRefreshTime.toLocaleTimeString('fa-IR')}
                <span style={{ marginRight: 8, color: '#52c41a' }}>
                  • به‌روزرسانی خودکار هر 1 دقیقه
                </span>
              </div>
            )}
            {settings?.cartSettings && (
              <div style={{ fontSize: '12px', color: '#666' }}>
                🔥 فوری: کمتر از {Math.floor((settings.cartSettings.expiryWarningMinutes || 30) / 2)} دقیقه
                <span style={{ marginRight: 8 }}>|</span>
                ⚠️  متوسط: کمتر از {settings.cartSettings.expiryWarningMinutes || 30} دقیقه
              </div>
            )}
          </div>
        </div>
        <Space>
          {canManageCarts && (
            <Button danger type="primary" icon={<ClearOutlined />} onClick={handleCleanupExpired}>
              پاکسازی منقضی‌ها
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={fetchAbandonedCarts}>
            بارگذاری مجدد
          </Button>
        </Space>
      </div>

      {/* آمار */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="تعداد سبدهای رها شده"
                value={stats.totalCarts || 0}
                prefix={<ShoppingCartOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="تعداد کل آیتم‌ها"
                value={stats.totalItems || 0}
                prefix={<ShoppingCartOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="مجموع ارزش"
                value={stats.totalValue || 0}
                prefix={<DollarOutlined />}
                suffix="تومان"
                valueStyle={{ color: '#52c41a' }}
                formatter={(value) => new Intl.NumberFormat('fa-IR').format(value)}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* فیلترها */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <label style={{ marginLeft: 8 }}>حداقل زمان رها شدن:</label>
          <Select
            value={hoursAgo}
            onChange={setHoursAgo}
            style={{ width: 150 }}
          >
            <Select.Option value={0}>هم‌اکنون (همه)</Select.Option>
            <Select.Option value={1}>1 ساعت</Select.Option>
            <Select.Option value={2}>2 ساعت</Select.Option>
            <Select.Option value={6}>6 ساعت</Select.Option>
            <Select.Option value={12}>12 ساعت</Select.Option>
            <Select.Option value={24}>24 ساعت</Select.Option>
          </Select>
        </div>
        <div>
          <label style={{ marginLeft: 8 }}>حداکثر زمان:</label>
          <Select value={daysAgo} onChange={setDaysAgo} style={{ width: 150 }}>
            <Select.Option value={3}>3 روز</Select.Option>
            <Select.Option value={7}>7 روز</Select.Option>
            <Select.Option value={14}>14 روز</Select.Option>
            <Select.Option value={30}>30 روز</Select.Option>
          </Select>
        </div>
      </div>

      {/* جدول */}
      <Card>
        <Table
          columns={columns}
          dataSource={carts}
          loading={loading}
          rowKey="_id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `${total} سبد`,
          }}
          locale={{
            emptyText: (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 0',
                  color: '#999',
                }}
              >
                <p>هیچ سبد رها شده‌ای یافت نشد</p>
                <p style={{ fontSize: '0.9em' }}>
                  سبدهایی که بین {hoursAgo} ساعت تا {daysAgo} روز اخیر
                  به‌روزرسانی نشده‌اند اینجا نمایش داده می‌شوند
                </p>
              </div>
            ),
          }}
        />
      </Card>

      {/* Modal جزئیات سبد */}
      <Modal
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false)
          setSelectedCart(null)
        }}
        footer={[
          <Button key="close" onClick={() => setDetailOpen(false)}>
            بستن
          </Button>,
          canManageCarts && (
            <Button
              key="email"
              type="primary"
              icon={<MailOutlined />}
              onClick={() => {
                handleEmailReminder(selectedCart)
                setDetailOpen(false)
              }}
            >
              یادآوری ایمیل
            </Button>
          ),
          canManageCarts && (
            <Button
              key="sms"
              type="primary"
              icon={<MessageOutlined />}
              onClick={() => {
                handleSmsReminder(selectedCart)
                setDetailOpen(false)
              }}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              یادآوری پیامک
            </Button>
          ),
        ]}
        width={800}
        title={`جزئیات سبد - ${selectedCart?.user?.name || 'کاربر'}`}
      >
        {selectedCart && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* اطلاعات کاربر */}
            <div>
              <h3>اطلاعات مشتری</h3>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="نام">
                  {selectedCart.user?.name || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="ایمیل">
                  {selectedCart.user?.email || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="تلفن">
                  {selectedCart.user?.mobile || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="آخرین فعالیت">
                  {getTimeAgo(selectedCart.updatedAt)} (
                  {formatPersianDate(selectedCart.updatedAt, true)})
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* وضعیت انقضا */}
            {selectedCart.expiresAt && (
              <div>
                <h3>وضعیت انقضای سبد</h3>
                <Card style={{ background: '#fff7e6', borderColor: '#ffa940' }}>
                  {(() => {
                    const remaining = getTimeRemaining(selectedCart.expiresAt)
                    const progress = getExpiryProgress(selectedCart)
                    const urgency = getUrgencyIcon(selectedCart)

                    if (!remaining) {
                      return (
                        <div style={{ textAlign: 'center' }}>
                          <Tag color="blue" style={{ fontSize: '14px', padding: '8px 16px' }}>
                            این سبد ماندگار است و منقضی نمی‌شود
                          </Tag>
                        </div>
                      )
                    }

                    if (remaining.expired) {
                      return (
                        <div>
                          <div style={{ marginBottom: 12 }}>
                            <Tag icon={<ClockCircleOutlined />} color="default" style={{ fontSize: '14px', padding: '8px 16px' }}>
                              این سبد منقضی شده است
                            </Tag>
                          </div>
                          <Progress percent={100} status="exception" />
                          <div style={{ marginTop: 8, fontSize: '12px', color: '#999' }}>
                            زمان انقضا: {formatPersianDate(selectedCart.expiresAt, true)}
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div>
                        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '16px' }}>{urgency.icon}</span>
                          <span style={{ fontWeight: 'bold', color: urgency.color, fontSize: '16px' }}>
                            {remaining.text} تا انقضا
                          </span>
                        </div>
                        <Progress
                          percent={progress.percent}
                          status={progress.status}
                          strokeColor={urgency.color}
                        />
                        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                          <div>
                            <strong>آخرین به‌روزرسانی:</strong> {formatPersianDate(selectedCart.updatedAt, true)}
                          </div>
                          <div>
                            <strong>زمان انقضا:</strong> {formatPersianDate(selectedCart.expiresAt, true)}
                          </div>
                        </div>
                        {remaining.minutes <= (settings?.cartSettings?.expiryWarningMinutes || 30) && (
                          <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 4 }}>
                            <WarningOutlined style={{ color: '#ff4d4f', marginLeft: 8 }} />
                            <strong>توجه:</strong> این سبد به زودی منقضی می‌شود! برای جلوگیری از از دست رفتن فرصت فروش، یادآوری ارسال کنید.
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </Card>
              </div>
            )}

            {/* آیتم‌های سبد */}
            <div>
              <h3>محصولات سبد</h3>
              {selectedCart.items && selectedCart.items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedCart.items.map((item, index) => (
                    <Card key={index} size="small" style={{ background: '#fafafa' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        {item.image ? (
                          <Image
                            src={item.image}
                            width={60}
                            height={60}
                            style={{ borderRadius: 4 }}
                          />
                        ) : item.product?.images && item.product.images[0] ? (
                          <Image
                            src={
                              typeof item.product.images[0] === 'string'
                                ? item.product.images[0]
                                : item.product.images[0]?.url
                            }
                            width={60}
                            height={60}
                            style={{ borderRadius: 4 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 60,
                              height: 60,
                              background: '#e0e0e0',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <ShoppingCartOutlined style={{ fontSize: 24, color: '#999' }} />
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold' }}>{item.name || 'محصول'}</div>
                          <div style={{ fontSize: '0.9em', color: '#666' }}>
                            قیمت واحد:{' '}
                            {item.price
                              ? `${new Intl.NumberFormat('fa-IR').format(item.price)} تومان`
                              : '—'}{' '}
                            | تعداد: {item.quantity}
                          </div>
                          {item.variantOptions && item.variantOptions.length > 0 && (
                            <div style={{ fontSize: '0.85em', color: '#999' }}>
                              {item.variantOptions.map((opt, i) => (
                                <Tag key={i} size="small">
                                  {opt.name}: {opt.value}
                                </Tag>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ fontWeight: 'bold', color: '#1890ff' }}>
                          {new Intl.NumberFormat('fa-IR').format(
                            (item.price || 0) * (item.quantity || 0),
                          )}{' '}
                          تومان
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#999' }}>سبد خالی است</p>
              )}
            </div>

            {/* جمع کل */}
            <div>
              <Card style={{ background: '#f0f5ff' }}>
                <Statistic
                  title="مجموع ارزش سبد"
                  value={
                    selectedCart.items?.reduce(
                      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
                      0,
                    ) || 0
                  }
                  suffix="تومان"
                  valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                  formatter={(value) => new Intl.NumberFormat('fa-IR').format(value)}
                />
              </Card>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default AbandonedCartsPage
