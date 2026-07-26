import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  Input,
  Space,
  Alert,
  Modal,
  Radio,
  Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined,
  SaveOutlined,
  ReloadOutlined,
  PlusOutlined,
  LinkOutlined,
  CarOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'
import { useNotificationStore } from '../../stores'
import Countdown from 'react-countdown'
import { PERMISSIONS } from '../../rbac/permissions'
import S3AdminImage from '../../components/S3AdminImage'
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

const { TextArea } = Input

function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = useCan()
  const canUpdateStatus = can(PERMISSIONS.ORDER_UPDATE_STATUS)

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const addNotification = useNotificationStore((state) => state.addNotification)

  const [trackingCode, setTrackingCode] = useState('')
  const [deliveryDays, setDeliveryDays] = useState('')
  const [courierName, setCourierName] = useState('')
  const [preparedTrackingUrl, setPreparedTrackingUrl] = useState('')
  const [couriersList, setCouriersList] = useState([])
  const [deliveryMode, setDeliveryMode] = useState('online') // 'online' | 'local'

  // Modal State for adding new Courier company
  const [isAddCourierModalOpen, setIsAddCourierModalOpen] = useState(false)
  const [newCourierName, setNewCourierName] = useState('')
  const [newCourierTemplate, setNewCourierTemplate] = useState('')
  const [savingCourier, setSavingCourier] = useState(false)

  const defaultCouriers = [
    { name: 'پست پیشتاز', trackingUrlTemplate: 'https://tracking.post.ir/?id={{code}}' },
    { name: 'تیپاکس', trackingUrlTemplate: 'https://tipaxco.com/tracking?id={{code}}' },
    { name: 'چاپار', trackingUrlTemplate: 'https://chaparnet.com/tracking/?tracking_code={{code}}' },
    { name: 'دکا پست (DekaPost)', trackingUrlTemplate: 'https://dekapost.ir/track?code={{code}}' },
    { name: 'پیک اختصاصی (ارسال درون‌شهری)', trackingUrlTemplate: '' },
  ]

  const fetchCouriers = async () => {
    try {
      const res = await api.get('/settings/public')
      const fetchedCouriers = res?.data?.data?.shippingSettings?.couriers
      if (Array.isArray(fetchedCouriers) && fetchedCouriers.length > 0) {
        setCouriersList(fetchedCouriers)
      } else {
        setCouriersList(defaultCouriers)
      }
    } catch {
      setCouriersList(defaultCouriers)
    }
  }

  useEffect(() => {
    fetchCouriers()
  }, [])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/orders/${id}`)
      const data = res?.data?.data
      setOrder(data)
      setStatus(data?.orderStatus || '')
      setAdminNotes(data?.adminNotes || '')
      setTrackingCode(data?.trackingCode || '')
      setCourierName(data?.courierName || '')
      setPreparedTrackingUrl(data?.preparedTrackingUrl || '')

      if (data?.preparedTrackingUrl && data.preparedTrackingUrl.trim().length > 0) {
        setDeliveryMode('online')
      } else if (data?.courierName && data.courierName.includes('پیک')) {
        setDeliveryMode('local')
      } else {
        setDeliveryMode('online')
      }
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

  const handleCourierSelect = (selectedName) => {
    setCourierName(selectedName)
    const courierObj = couriersList.find((c) => c.name === selectedName)
    if (courierObj && courierObj.trackingUrlTemplate && trackingCode) {
      const generated = courierObj.trackingUrlTemplate
        .replace('{{code}}', trackingCode.trim())
        .replace('{code}', trackingCode.trim())
      setPreparedTrackingUrl(generated)
    } else if (courierObj && !courierObj.trackingUrlTemplate) {
      setPreparedTrackingUrl('')
    }
  }

  const handleTrackingCodeChange = (codeVal) => {
    const val = codeVal
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    setTrackingCode(val)

    // Auto-update prepared tracking url if template exists
    const courierObj = couriersList.find((c) => c.name === courierName)
    if (courierObj && courierObj.trackingUrlTemplate && val.trim()) {
      const generated = courierObj.trackingUrlTemplate
        .replace('{{code}}', val.trim())
        .replace('{code}', val.trim())
      setPreparedTrackingUrl(generated)
    }
  }

  const handleSaveNewCourier = async () => {
    if (!newCourierName.trim()) {
      message.warning('لطفاً نام شرکت پستی را وارد کنید')
      return
    }

    setSavingCourier(true)
    try {
      const newEntry = {
        name: newCourierName.trim(),
        trackingUrlTemplate: newCourierTemplate.trim(),
        isActive: true,
      }
      const updatedList = [...couriersList.filter((c) => c.name !== newEntry.name), newEntry]

      // Save to global settings
      await api.put('/settings', {
        shippingSettings: { couriers: updatedList },
      })

      message.success(`شرکت پستی «${newEntry.name}» با موفقیت ثبت دائم گردید.`)
      setCouriersList(updatedList)
      setCourierName(newEntry.name)

      if (newEntry.trackingUrlTemplate && trackingCode) {
        const generated = newEntry.trackingUrlTemplate
          .replace('{{code}}', trackingCode.trim())
          .replace('{code}', trackingCode.trim())
        setPreparedTrackingUrl(generated)
      } else if (!newEntry.trackingUrlTemplate) {
        setPreparedTrackingUrl('')
        setDeliveryMode('local')
      }

      setIsAddCourierModalOpen(false)
      setNewCourierName('')
      setNewCourierTemplate('')
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'خطا در ثبت شرکت پستی جدید'
      message.error(msg)
    } finally {
      setSavingCourier(false)
    }
  }

  const handleStatusUpdate = async () => {
    if (!canUpdateStatus) {
      message.error('شما مجوز تغییر وضعیت سفارش را ندارید.')
      return
    }

    if (!status) {
      message.warning('وضعیت سفارش را انتخاب کنید')
      return
    }

    let finalUrl = deliveryMode === 'local' ? '' : preparedTrackingUrl
    if (deliveryMode === 'online' && (!finalUrl || finalUrl.trim() === '') && courierName && trackingCode) {
      const courierObj = couriersList.find((c) => c.name === courierName)
      if (courierObj && courierObj.trackingUrlTemplate) {
        finalUrl = courierObj.trackingUrlTemplate
          .replace('{{code}}', trackingCode.trim())
          .replace('{code}', trackingCode.trim())
      }
    }

    setSaving(true)
    try {
      await api.put(`/orders/${id}/status`, {
        status,
        adminNotes: adminNotes || undefined,
        trackingCode: trackingCode,
        courierName: courierName || (deliveryMode === 'local' ? 'پیک اختصاصی (ارسال درون‌شهری)' : undefined),
        preparedTrackingUrl: finalUrl,
        deliveryDays: deliveryDays || undefined,
      })

      message.success('اطلاعات و وضعیت سفارش با موفقیت به روزرسانی شد')
      setDeliveryDays('')

      // نوتیفیکیشن لینک‌دار برای این سفارش
      addNotification({
        type: 'order',
        title: 'بروزرسانی اطلاعات سفارش',
        message: `اطلاعات ارسال سفارش #${order?._id?.slice(-8) || ''} بروزرسانی گردید.`,
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
          <S3AdminImage src={url} width={50} height={50} />
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
                  {order.courierName && (
                    <Descriptions.Item label="شرکت حمل‌ونقل" span={1}>
                      <strong>{order.courierName}</strong>
                    </Descriptions.Item>
                  )}
                  {order.trackingCode && (
                    <Descriptions.Item label="کد رهگیری مرسوله" span={1}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{order.trackingCode}</span>
                    </Descriptions.Item>
                  )}
                  {order.preparedTrackingUrl ? (
                    <Descriptions.Item label="لینک رهگیری آنلاین" span={2}>
                      <a href={order.preparedTrackingUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'monospace' }}>
                        {order.preparedTrackingUrl}
                      </a>
                    </Descriptions.Item>
                  ) : order.orderStatus === 'Shipped' && (
                    <Descriptions.Item label="نوع ارسال" span={2}>
                      <Tag color="purple">پیک اختصاصی / ارسال درون‌شهری (بدون لینک آنلاین)</Tag>
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
          {/* مدیریت وضعیت سفارش */}
          <Card title="مدیریت وضعیت سفارش" loading={loading} style={{ marginBottom: 16 }}>
            {order && (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {!canUpdateStatus && (
                  <Alert
                    type="info"
                    showIcon
                    message="دسترسی فقط مشاهده"
                    description="شما مجوز تغییر وضعیت/یادداشت سفارش را ندارید."
                  />
                )}
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                    وضعیت فعلی سفارش:
                  </label>
                  <Select
                    value={status}
                    onChange={setStatus}
                    style={{ width: '100%' }}
                    size="large"
                    disabled={!canUpdateStatus}
                  >
                    <Select.Option value="Pending">ثبت سفارش</Select.Option>
                    <Select.Option value="Processing">درحال پردازش</Select.Option>
                    <Select.Option value="Shipped">تحویل به پست / ارسال شده</Select.Option>
                    <Select.Option value="Delivered">تحویل شده به مشتری</Select.Option>
                    <Select.Option value="Cancelled">لغو شده</Select.Option>
                  </Select>
                </div>
              </Space>
            )}
          </Card>

          {/* مدیریت ارسال و رهگیری مرسوله (Always Re-editable UI) */}
          <Card
            title={
              <Space>
                <CarOutlined style={{ color: '#1890ff' }} />
                <span>تنظیمات ارسال و رهگیری مرسوله</span>
              </Space>
            }
            loading={loading}
          >
            {order && (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                    نوع ارسال و رهگیری:
                  </label>
                  <Radio.Group
                    value={deliveryMode}
                    onChange={(e) => setDeliveryMode(e.target.value)}
                    buttonStyle="solid"
                    style={{ width: '100%' }}
                    disabled={!canUpdateStatus}
                  >
                    <Radio.Button value="online" style={{ width: '50%', textAlign: 'center' }}>
                      <GlobalOutlined /> پیگیری آنلاین
                    </Radio.Button>
                    <Radio.Button value="local" style={{ width: '50%', textAlign: 'center' }}>
                      <CarOutlined /> پیک اختصاصی
                    </Radio.Button>
                  </Radio.Group>
                </div>

                {deliveryMode === 'online' ? (
                  <>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <label style={{ fontWeight: 'bold' }}>شرکت حمل‌ونقل:</label>
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => setIsAddCourierModalOpen(true)}
                          disabled={!canUpdateStatus}
                          style={{ padding: 0 }}
                        >
                          + افزودن شرکت جدید
                        </Button>
                      </div>
                      <Select
                        value={courierName || undefined}
                        onChange={handleCourierSelect}
                        placeholder="انتخاب شرکت پستی (مثل دکا پست، پست، تیپاکس...)"
                        style={{ width: '100%' }}
                        disabled={!canUpdateStatus}
                        showSearch
                        allowClear
                      >
                        {couriersList.map((c, idx) => (
                          <Select.Option key={idx} value={c.name}>
                            {c.name} {c.trackingUrlTemplate ? '' : ' (بدون لینک)'}
                          </Select.Option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                        کد رهگیری مرسوله:
                      </label>
                      <Input
                        value={trackingCode}
                        onChange={(e) => handleTrackingCodeChange(e.target.value)}
                        placeholder="کد ۲۴ رقمی یا شماره مرسوله"
                        style={{ fontFamily: 'monospace' }}
                        disabled={!canUpdateStatus}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                        لینک مستقیم پیگیری آنلاین:
                      </label>
                      <Input
                        value={preparedTrackingUrl}
                        onChange={(e) => setPreparedTrackingUrl(e.target.value)}
                        placeholder="https://..."
                        style={{ fontFamily: 'monospace' }}
                        disabled={!canUpdateStatus}
                        addonAfter={
                          preparedTrackingUrl ? (
                            <Tooltip title="تست و باز کردن لینک در تب جدید">
                              <a href={preparedTrackingUrl} target="_blank" rel="noopener noreferrer">
                                <LinkOutlined />
                              </a>
                            </Tooltip>
                          ) : null
                        }
                      />
                      {preparedTrackingUrl && (
                        <div style={{ fontSize: 12, marginTop: 4, color: '#52c41a' }}>
                          <CheckCircleOutlined /> پیش‌نمایش لینک: {' '}
                          <a href={preparedTrackingUrl} target="_blank" rel="noopener noreferrer">
                            باز کردن لینک پیگیری
                          </a>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    icon={<CarOutlined />}
                    message="تحویل با پیک اختصاصی (ارسال درون‌شهری)"
                    description={
                      <div>
                        این سفارش به صورت تحویل مستقیم توسط سفیر یا پیک در شهر مبدا ثبت می‌شود و در پنل کاربر بدون نیاز به لینک آنلاین با نشان «پیک اختصاصی» نمایش داده می‌شود.
                      </div>
                    }
                  />
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                    زمان تقریبی تحویل (روز):
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={deliveryDays}
                    placeholder="مثلاً ۳ روز"
                    onChange={(e) => {
                      const val = e.target.value
                        .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
                        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
                      setDeliveryDays(val)
                    }}
                    suffix="روز"
                    disabled={!canUpdateStatus}
                  />
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    پس از گذشت این زمان، وضعیت سفارش به صورت خودکار به «تحویل داده شد» تغییر می‌کند.
                  </div>
                </div>

                {order?.autoCompleteAt && order?.orderStatus === 'Shipped' && (
                  <Alert
                    message="تایمر تکمیل خودکار فعلی"
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
                  />
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                    یادداشت ادمین (اختیاری):
                  </label>
                  <TextArea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                    placeholder="یادداشت‌های داخلی درباره این سفارش..."
                    disabled={!canUpdateStatus}
                  />
                </div>

                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<SaveOutlined />}
                  onClick={handleStatusUpdate}
                  loading={saving}
                  disabled={!canUpdateStatus}
                >
                  ذخیره و ارسال اطلاعات جدید به مشتری
                </Button>
              </Space>
            )}
          </Card>

          <Card title="خلاصه مالی" style={{ marginTop: 16 }} loading={loading}>
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

      {/* Modal for adding any new Courier company on the fly (e.g. DekaPost) */}
      <Modal
        title="افزودن شرکت پستی / حمل‌ونقل جدید"
        open={isAddCourierModalOpen}
        onOk={handleSaveNewCourier}
        onCancel={() => setIsAddCourierModalOpen(false)}
        confirmLoading={savingCourier}
        okText="ذخیره شرکت جدید"
        cancelText="انصراف"
      >
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            نام شرکت حمل‌ونقل (مثلا دکا پست، اسنپ‌باکس...):
          </label>
          <Input
            value={newCourierName}
            onChange={(e) => setNewCourierName(e.target.value)}
            placeholder="مثلاً دکا پست (DekaPost)"
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
            الگوی لینک رهگیری آنلاین (اختیاری):
          </label>
          <Input
            value={newCourierTemplate}
            onChange={(e) => setNewCourierTemplate(e.target.value)}
            placeholder="مثلاً https://dekapost.ir/track?code={{code}}"
            style={{ fontFamily: 'monospace' }}
          />
          <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
            💡 در الگوی لینک از عبارت <code>{'{{code}}'}</code> در محل قرارگیری کد رهگیری استفاده کنید. در صورت خالی بودن، به صورت تحویل درون‌شهری ثبت خواهد شد.
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default OrderDetail
