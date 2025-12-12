import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Table,
  Select,
  Button,
  message,
  Row,
  Col,
  Divider,
  Image,
  Input,
  Space,
  Alert,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'
import { useNotificationStore } from '../../stores'
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

const { TextArea } = Input

function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const addNotification = useNotificationStore((state) => state.addNotification)

  const [trackingCode, setTrackingCode] = useState('')
  const [deliveryDays, setDeliveryDays] = useState('')

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/orders/${id}`)
      const data = res?.data?.data
      setOrder(data)
      setStatus(data?.orderStatus || '')
      setAdminNotes(data?.adminNotes || '')
      setTrackingCode(data?.trackingCode || '')
    } catch (err) {
      const errorMsg =
        err?.response?.data?.message || err?.message || 'خطا در دریافت جزئیات سفارش'
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleStatusUpdate = async () => {
    if (!status) {
      message.warning('وضعیت سفارش را انتخاب کنید')
      return
    }

    if (status === order?.orderStatus && adminNotes === (order?.adminNotes || '') && trackingCode === (order?.trackingCode || '') && !deliveryDays) {
      message.info('تغییری برای ذخیره وجود ندارد')
      return
    }

    setSaving(true)
    try {
      await api.put(`/orders/${id}/status`, {
        status,
        adminNotes: adminNotes || undefined,
        trackingCode: trackingCode,
        deliveryDays: deliveryDays || undefined,
      })

      message.success('وضعیت سفارش با موفقیت به‌روزرسانی شد')

      // نوتیفیکیشن لینک‌دار برای این سفارش
      addNotification({
        type: 'order',
        title: 'یادداشت جدید روی سفارش',
        message: `برای سفارش #${order?._id?.slice(-8) || ''} یادداشت/وضعیت جدید ثبت شد`,
        link: `/orders/${order?._id}`,
      })

      fetchOrder()
    } catch (err) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'خطا در به‌روزرسانی وضعیت سفارش'
      message.error(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const getStatusColor = (orderStatus) => {
    const colors = {
      Pending: 'orange',
      Processing: 'blue',
      Shipped: 'purple',
      Delivered: 'green',
      Cancelled: 'red',
    }
    return colors[orderStatus] || 'default'
  }

  const getStatusLabel = (orderStatus) => {
    const labels = {
      Pending: 'ثبت سفارش',
      Processing: 'درحال پردازش',
      Shipped: 'تحویل به پست',
      Delivered: 'تحویل شده',
      Cancelled: 'لغو شده',
    }
    return labels[orderStatus] || orderStatus
  }

  const itemsColumns = [
    {
      title: 'تصویر',
      dataIndex: ['product', 'images'],
      key: 'image',
      width: 80,
      render: (images) => {
        let url = null
        if (Array.isArray(images) && images.length > 0) {
          const first = images[0]
          url = typeof first === 'string' ? first : first?.url
        }
        return url ? (
          <Image src={url} width={50} height={50} style={{ borderRadius: 4 }} />
        ) : (
          <div
            style={{
              width: 50,
              height: 50,
              background: '#f0f0f0',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#999',
            }}
          >
            بدون تصویر
          </div>
        )
      },
    },
    {
      title: 'نام محصول',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'SKU',
      dataIndex: ['product', 'sku'],
      key: 'sku',
      render: (sku) => sku || '—',
    },
    {
      title: 'تعداد',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
      width: 80,
    },
    {
      title: 'قیمت واحد',
      dataIndex: 'price',
      key: 'price',
      render: (price) =>
        price != null
          ? `${new Intl.NumberFormat('fa-IR').format(price)} تومان`
          : '—',
    },
    {
      title: 'جمع جزء',
      key: 'subtotal',
      render: (_, record) => {
        const subtotal = (record.price || 0) * (record.quantity || 0)
        return `${new Intl.NumberFormat('fa-IR').format(subtotal)} تومان`
      },
    },
  ]

  if (!order && !loading) {
    return (
      <div>
        <Alert
          message="سفارش یافت نشد"
          description="سفارشی با این شناسه پیدا نشد. لطفاً به لیست سفارشات برگردید و دوباره تلاش کنید."
          type="error"
          showIcon
          action={
            <Button type="primary" onClick={() => navigate('/orders')}>
              بازگشت به لیست سفارشات
            </Button>
          }
        />
      </div>
    )
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
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>
            بازگشت
          </Button>
          <h1 style={{ margin: 0 }}>
            جزئیات سفارش {order?.orderCode || `#${order?._id?.slice(-8)}` || '...'}
          </h1>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={fetchOrder} loading={loading}>
          بارگذاری مجدد
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="اطلاعات سفارش" loading={loading}>
            {order && (
              <>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="شماره سفارش" span={2}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.2em' }}>
                      {order.orderCode || `#${order._id}`}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="وضعیت سفارش">
                    <Tag color={getStatusColor(order.orderStatus)}>
                      {getStatusLabel(order.orderStatus)}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="وضعیت پرداخت">
                    <Tag color={order.isPaid ? 'green' : 'red'}>
                      {order.isPaid ? 'پرداخت شده' : 'پرداخت نشده'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="تاریخ ثبت">
                    {formatPersianDate(order.createdAt, true)}
                  </Descriptions.Item>
                  <Descriptions.Item label="تاریخ پرداخت">
                    {formatPersianDate(order.paidAt, true)}
                  </Descriptions.Item>
                  <Descriptions.Item label="تاریخ ارسال">
                    {formatPersianDate(order.shippedAt, true)}
                  </Descriptions.Item>
                  <Descriptions.Item label="تاریخ تحویل">
                    {formatPersianDate(order.deliveredAt, true)}
                  </Descriptions.Item>
                  <Descriptions.Item label="روش پرداخت" span={2}>
                    {order.paymentMethod || '—'}
                  </Descriptions.Item>
                  {order.trackingCode && (
                    <Descriptions.Item label="کد رهگیری پستی" span={2}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{order.trackingCode}</span>
                    </Descriptions.Item>
                  )}
                </Descriptions>

                <Divider>اطلاعات مشتری و آدرس</Divider>

                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="نام مشتری">
                    {order.user?.name || order.user?.email || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="ایمیل">
                    {order.user?.email || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="نام گیرنده">
                    {order.shippingAddress?.fullName || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="شماره تماس">
                    {order.shippingAddress?.phone || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="آدرس">
                    {order.shippingAddress?.address || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="شهر">
                    {order.shippingAddress?.city || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="کد پستی">
                    {order.shippingAddress?.postalCode || '—'}
                  </Descriptions.Item>
                </Descriptions>

                <Divider>آیتم‌های سفارش</Divider>

                <Table
                  columns={itemsColumns}
                  dataSource={order.orderItems || []}
                  rowKey={(r, i) => r.product?._id || String(i)}
                  pagination={false}
                  size="small"
                  locale={{
                    emptyText: 'آیتمی برای این سفارش ثبت نشده است',
                  }}
                />
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="مدیریت سفارش" loading={loading}>
            {order && (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div>
                  <label
                    style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}
                  >
                    وضعیت سفارش:
                  </label>
                  <Select
                    value={status}
                    onChange={setStatus}
                    style={{ width: '100%' }}
                    size="large"
                  >
                    <Select.Option value="Pending">ثبت سفارش</Select.Option>
                    <Select.Option value="Processing">درحال پردازش</Select.Option>
                    <Select.Option value="Shipped">تحویل به پست</Select.Option>
                    <Select.Option value="Delivered">تحویل شده</Select.Option>
                    <Select.Option value="Cancelled">لغو شده</Select.Option>
                  </Select>
                </div>

                {status === 'Shipped' && (
                  <>
                    <div>
                      <label
                        style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}
                      >
                        کد رهگیری پستی:
                      </label>
                      <Input
                        value={trackingCode}
                        onChange={(e) => setTrackingCode(e.target.value)}
                        placeholder="کد ۲۴ رقمی پست"
                        style={{ fontFamily: 'monospace' }}
                      />
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <label
                        style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}
                      >
                        زمان تقریبی تحویل (روز):
                      </label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="مثلاً ۳ روز"
                        onChange={(e) => setDeliveryDays(e.target.value)}
                        suffix="روز"
                      />
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                        پس از گذشت این زمان، وضعیت سفارش به صورت خودکار به «تحویل شده» تغییر می‌کند.
                      </div>
                    </div>
                  </>
                )}

                {order?.autoCompleteAt && order?.orderStatus === 'Shipped' && (
                  <Alert
                    message="تایمر تکمیل خودکار"
                    description={
                      <div style={{ direction: 'ltr', textAlign: 'right' }}>
                        <Countdown
                          date={new Date(order.autoCompleteAt)}
                          renderer={({ days, hours, minutes, seconds, completed }) => {
                            if (completed) return <span>در حال تکمیل...</span>
                            return (
                              <span style={{ fontWeight: 'bold', fontSize: '1.1em', color: '#1890ff' }}>
                                {days} روز : {hours} ساعت : {minutes} دقیقه : {seconds} ثانیه
                              </span>
                            )
                          }}
                        />
                        <div style={{ fontSize: 12, marginTop: 4 }}>تا تغییر وضعیت خودکار به «تحویل شده»</div>
                      </div>
                    }
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                )}

                <div>
                  <label
                    style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}
                  >
                    یادداشت ادمین (اختیاری):
                  </label>
                  <TextArea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={4}
                    placeholder="یادداشت‌های داخلی درباره این سفارش..."
                  />
                </div>

                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<SaveOutlined />}
                  onClick={handleStatusUpdate}
                  loading={saving}
                >
                  ذخیره تغییرات
                </Button>
              </Space>
            )}
          </Card>

          <Card
            title="خلاصه مالی"
            style={{ marginTop: 16 }}
            loading={loading}
          >
            {order && (
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="مبلغ محصولات">
                  {new Intl.NumberFormat('fa-IR').format(order.itemsPrice || 0)} تومان
                </Descriptions.Item>
                <Descriptions.Item label="هزینه ارسال">
                  {new Intl.NumberFormat('fa-IR').format(order.shippingPrice || 0)} تومان
                </Descriptions.Item>
                <Descriptions.Item label="مالیات">
                  {new Intl.NumberFormat('fa-IR').format(order.taxPrice || 0)} تومان
                </Descriptions.Item>
                <Descriptions.Item label="مبلغ کل">
                  <strong style={{ fontSize: '1.1em', color: '#1890ff' }}>
                    {new Intl.NumberFormat('fa-IR').format(order.totalPrice || 0)} تومان
                  </strong>
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default OrderDetail

