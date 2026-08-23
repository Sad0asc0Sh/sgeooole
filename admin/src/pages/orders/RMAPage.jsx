import { useEffect, useState } from 'react'
import {
  Card,
  Tag,
  Input,
  Select,
  Button,
  Modal,
  Descriptions,
  message,
  Space,
  Image,
  InputNumber,
  Divider,
} from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
import {
  SearchOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'

const { TextArea } = Input

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

function RMAPage() {
  const [rmas, setRmas] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    status: null,
    orderId: '',
  })
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  })

  // Modal مدیریت
  const [manageOpen, setManageOpen] = useState(false)
  const [selectedRMA, setSelectedRMA] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [refundAmount, setRefundAmount] = useState(0)
  const [saving, setSaving] = useState(false)

  const fetchRMAs = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))

      if (filters.status) {
        params.set('status', filters.status)
      }
      if (filters.orderId) {
        params.set('orderId', filters.orderId)
      }

      const res = await api.get('/rma/admin', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination

      setRmas(list)
      if (pg) {
        setPagination({
          current: pg.currentPage || page,
          pageSize: pg.itemsPerPage || pageSize,
          total: pg.totalItems || list.length,
        })
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'خطا در دریافت لیست مرجوعی‌ها'
      message.error(errorMsg)
      console.error('Fetch RMAs error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRMAs(1, pagination.pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status])

  const openManageModal = async (rmaId) => {
    setManageOpen(true)
    setDetailLoading(true)
    try {
      const res = await api.get(`/rma/${rmaId}`)
      const rmaData = res?.data?.data
      setSelectedRMA(rmaData)
      setNewStatus(rmaData?.status || 'Pending')
      setAdminNotes(rmaData?.adminNotes || '')
      setRefundAmount(rmaData?.refundAmount || 0)
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'خطا در دریافت جزئیات مرجوعی'
      message.error(errorMsg)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSaveChanges = async () => {
    if (!selectedRMA) return

    if (!newStatus) {
      message.warning('وضعیت جدید را انتخاب کنید')
      return
    }

    setSaving(true)
    try {
      await api.put(`/rma/${selectedRMA._id}/status`, {
        status: newStatus,
        adminNotes: adminNotes || undefined,
        refundAmount: refundAmount || 0,
      })
      message.success('وضعیت مرجوعی با موفقیت به‌روزرسانی شد')
      setManageOpen(false)
      setSelectedRMA(null)
      fetchRMAs()
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'خطا در به‌روزرسانی وضعیت'
      message.error(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      Pending: 'orange',
      Approved: 'green',
      Rejected: 'red',
      Processing: 'blue',
      Completed: 'cyan',
    }
    return colors[status] || 'default'
  }

  const getStatusLabel = (status) => {
    const labels = {
      Pending: 'در انتظار',
      Approved: 'تأیید شده',
      Rejected: 'رد شده',
      Processing: 'در حال پردازش',
      Completed: 'کامل شده',
    }
    return labels[status] || status
  }

  const columns = [
    {
      title: 'شماره سفارش',
      key: 'orderId',
      width: 150,
      render: (_, record) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
          #{record.order?._id?.slice(-8) || '—'}
        </span>
      ),
    },
    {
      title: 'مشتری',
      key: 'customer',
      ellipsis: true,
      render: (_, record) =>
        record.user ? `${record.user.name || '—'} (${record.user.email || '—'})` : '—',
    },
    {
      title: 'دلیل مرجوعی',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: 'تعداد آیتم',
      key: 'itemsCount',
      align: 'center',
      width: 100,
      render: (_, record) => {
        const totalQuantity = (record.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)
        return totalQuantity || 0
      },
    },
    {
      title: 'وضعیت',
      mobileBadge: true,
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: 'مبلغ بازپرداختی',
      dataIndex: 'refundAmount',
      key: 'refundAmount',
      width: 150,
      render: (amount) =>
        amount > 0
          ? `${new Intl.NumberFormat('fa-IR').format(amount)} تومان`
          : '—',
    },
    {
      title: 'تاریخ درخواست',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 220,
      render: (date) => formatPersianDate(date, true),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<SettingOutlined />}
          onClick={() => openManageModal(record._id)}
        >
          مدیریت
        </Button>
      ),
    },
  ]

  const onTableChange = (pag) => {
    setPagination((prev) => ({
      ...prev,
      current: pag.current,
      pageSize: pag.pageSize,
    }))
    fetchRMAs(pag.current, pag.pageSize)
  }

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
        <h1>مدیریت مرجوعی (RMA)</h1>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => fetchRMAs()}
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
          placeholder="جستجو بر اساس شماره سفارش..."
          prefix={<SearchOutlined />}
          style={{ width: 300, maxWidth: '100%' }}
          allowClear
          value={filters.orderId}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, orderId: e.target.value }))
          }
          onPressEnter={() => fetchRMAs(1, pagination.pageSize)}
          onBlur={() => fetchRMAs(1, pagination.pageSize)}
        />
        <Select
          placeholder="وضعیت مرجوعی"
          style={{ width: 180, maxWidth: '100%' }}
          allowClear
          onChange={(value) =>
            setFilters((prev) => ({ ...prev, status: value || null }))
          }
        >
          <Select.Option value="Pending">در انتظار</Select.Option>
          <Select.Option value="Approved">تأیید شده</Select.Option>
          <Select.Option value="Rejected">رد شده</Select.Option>
          <Select.Option value="Processing">در حال پردازش</Select.Option>
          <Select.Option value="Completed">کامل شده</Select.Option>
        </Select>
      </div>

      <Card>
        <ResponsiveTable
          columns={columns}
          dataSource={rmas}
          loading={loading}
          rowKey="_id"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `${total} درخواست`,
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
                <p>هیچ درخواست مرجوعی یافت نشد</p>
              </div>
            ),
          }}
        />
      </Card>

      {/* Modal مدیریت RMA */}
      <Modal
        open={manageOpen}
        onCancel={() => {
          setManageOpen(false)
          setSelectedRMA(null)
        }}
        onOk={handleSaveChanges}
        okText="ذخیره تغییرات"
        cancelText="لغو"
        confirmLoading={saving}
        width={800}
        title={`مدیریت درخواست مرجوعی #${selectedRMA?._id?.slice(-8) || ''}`}
      >
        <Card loading={detailLoading} bordered={false}>
          {selectedRMA && (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* اطلاعات کلی */}
              <div>
                <h3>اطلاعات درخواست</h3>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="شماره سفارش">
                    <span style={{ fontFamily: 'monospace' }}>
                      #{selectedRMA.order?._id || '—'}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="وضعیت سفارش">
                    {selectedRMA.order?.orderStatus || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="مشتری">
                    {selectedRMA.user?.name || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="ایمیل">
                    {selectedRMA.user?.email || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="دلیل مرجوعی" span={2}>
                    {selectedRMA.reason || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="وضعیت فعلی">
                    <Tag color={getStatusColor(selectedRMA.status)}>
                      {getStatusLabel(selectedRMA.status)}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="تاریخ درخواست">
                    {formatPersianDate(selectedRMA.createdAt, true)}
                  </Descriptions.Item>
                </Descriptions>
              </div>

              {/* آیتم‌های مرجوعی */}
              <div>
                <h3>محصولات مرجوعی</h3>
                {selectedRMA.items && selectedRMA.items.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {selectedRMA.items.map((item, index) => (
                      <Card key={index} size="small" style={{ background: '#fafafa' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          {item.product?.images && item.product.images[0] && (
                            <Image
                              src={
                                typeof item.product.images[0] === 'string'
                                  ? item.product.images[0]
                                  : item.product.images[0]?.url
                              }
                              width={50}
                              height={50}
                              style={{ borderRadius: 4 }}
                            />
                          )}
                          <div style={{ flex: 1 }}>
                            <div><strong>{item.product?.name || 'محصول حذف شده'}</strong></div>
                            <div style={{ fontSize: '0.9em', color: '#666' }}>
                              SKU: {item.product?.sku || '—'} | تعداد: {item.quantity} |
                              قیمت: {item.price ? `${new Intl.NumberFormat('fa-IR').format(item.price)} تومان` : '—'}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#999' }}>هیچ محصولی ثبت نشده است</p>
                )}
              </div>

              <Divider />

              {/* مدیریت وضعیت */}
              <div>
                <h3>تغییر وضعیت</h3>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                      وضعیت جدید:
                    </label>
                    <Select
                      value={newStatus}
                      onChange={setNewStatus}
                      style={{ width: '100%' }}
                      size="large"
                    >
                      <Select.Option value="Pending">در انتظار</Select.Option>
                      <Select.Option value="Approved">تأیید شده</Select.Option>
                      <Select.Option value="Rejected">رد شده</Select.Option>
                      <Select.Option value="Processing">در حال پردازش</Select.Option>
                      <Select.Option value="Completed">کامل شده</Select.Option>
                    </Select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                      مبلغ بازپرداختی (تومان):
                    </label>
                    <InputNumber
                      value={refundAmount}
                      onChange={setRefundAmount}
                      style={{ width: '100%' }}
                      size="large"
                      min={0}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>
                      یادداشت ادمین (اختیاری):
                    </label>
                    <TextArea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={4}
                      placeholder="یادداشت‌های داخلی برای این درخواست مرجوعی..."
                    />
                  </div>
                </Space>
              </div>
            </Space>
          )}
        </Card>
      </Modal>
    </div>
  )
}

export default RMAPage
