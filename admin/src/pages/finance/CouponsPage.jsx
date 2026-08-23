import { useEffect, useState } from 'react'
import {
  Card,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  message,
  Space,
  Switch,
  Tooltip,
} from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'

// فعال‌سازی تقویم جلالی برای dayjs
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

// تابع کمکی برای تبدیل تاریخ به شمسی
const toJalali = (date) => {
  if (!date) return null
  return dayjs(date).calendar('jalali').locale('fa')
}

// تابع برای فرمت کردن تاریخ با نام ماه فارسی
const formatPersianDate = (date, includeTime = false) => {
  if (!date) return '—'
  const jalaliDate = toJalali(date)
  const year = jalaliDate.format('YYYY')
  const month =
    [
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
    ][parseInt(jalaliDate.format('M')) - 1]
  const day = jalaliDate.format('DD')

  if (includeTime) {
    const time = jalaliDate.format('HH:mm')
    return `${day} ${month} ${year} - ساعت ${time}`
  }
  return `${day} ${month} ${year}`
}

function CouponsPage() {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [saving, setSaving] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  })
  const [form] = Form.useForm()

  const fetchCoupons = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))

      const res = await api.get('/coupons', { params })
      const list = res?.data?.data || []
      const pg = res?.data?.pagination

      setCoupons(list)
      if (pg) {
        setPagination({
          current: pg.currentPage || page,
          pageSize: pg.itemsPerPage || pageSize,
          total: pg.totalItems || list.length,
        })
      }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'خطا در دریافت کوپن‌ها'
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoupons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreateModal = () => {
    setEditingCoupon(null)
    form.resetFields()
    setOpen(true)
  }

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon)
    form.setFieldsValue({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minPurchase: coupon.minPurchase || 0,
      expiresAt: coupon.expiresAt ? dayjs(coupon.expiresAt) : null,
      isActive: coupon.isActive,
      usageLimit: coupon.usageLimit || null,
    })
    setOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      const payload = {
        code: values.code,
        discountType: values.discountType,
        discountValue: values.discountValue,
        minPurchase: values.minPurchase || 0,
        expiresAt: values.expiresAt?.toISOString(),
        isActive: values.isActive !== undefined ? values.isActive : true,
        usageLimit: values.usageLimit || null,
      }

      if (editingCoupon) {
        // به‌روزرسانی
        await api.put(`/coupons/${editingCoupon._id}`, payload)
        message.success('کوپن با موفقیت به‌روزرسانی شد')
      } else {
        // ایجاد
        await api.post('/coupons', payload)
        message.success('کوپن با موفقیت ایجاد شد')
      }

      setOpen(false)
      form.resetFields()
      setEditingCoupon(null)
      fetchCoupons()
    } catch (err) {
      if (err?.errorFields) {
        message.error('لطفاً فیلدهای الزامی را تکمیل کنید')
        return
      }
      const errorMsg =
        err?.response?.data?.message || err?.message || 'خطا در ذخیره‌سازی کوپن'
      message.error(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (coupon) => {
    try {
      await api.put(`/coupons/${coupon._id}`, {
        isActive: !coupon.isActive,
      })
      message.success('وضعیت کوپن به‌روزرسانی شد')
      fetchCoupons()
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'خطا در به‌روزرسانی'
      message.error(errorMsg)
    }
  }

  const removeCoupon = (id) => {
    Modal.confirm({
      title: 'حذف کوپن',
      content: 'آیا از حذف این کوپن اطمینان دارید؟ این عمل غیرقابل بازگشت است.',
      okText: 'حذف',
      okType: 'danger',
      cancelText: 'انصراف',
      onOk: async () => {
        try {
          await api.delete(`/coupons/${id}`)
          message.success('کوپن با موفقیت حذف شد')
          fetchCoupons()
        } catch (err) {
          const errorMsg = err?.response?.data?.message || err?.message || 'خطا در حذف کوپن'
          message.error(errorMsg)
        }
      },
    })
  }

  const getDiscountTypeLabel = (type) => {
    return type === 'percent' ? 'درصدی' : 'مبلغ ثابت'
  }

  const getDiscountTypeColor = (type) => {
    return type === 'percent' ? 'blue' : 'green'
  }

  const columns = [
    {
      title: 'کد تخفیف',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (code) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.95em' }}>
          {code}
        </span>
      ),
    },
    {
      title: 'نوع تخفیف',
      dataIndex: 'discountType',
      key: 'discountType',
      width: 120,
      render: (type) => (
        <Tag color={getDiscountTypeColor(type)}>{getDiscountTypeLabel(type)}</Tag>
      ),
    },
    {
      title: 'مقدار تخفیف',
      dataIndex: 'discountValue',
      key: 'discountValue',
      width: 150,
      render: (value, record) => {
        if (record.discountType === 'percent') {
          return `${value}%`
        } else {
          return `${new Intl.NumberFormat('fa-IR').format(value)} تومان`
        }
      },
    },
    {
      title: 'حداقل خرید',
      dataIndex: 'minPurchase',
      key: 'minPurchase',
      width: 150,
      render: (value) =>
        value > 0 ? `${new Intl.NumberFormat('fa-IR').format(value)} تومان` : '—',
    },
    {
      title: 'تاریخ انقضا',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 200,
      render: (date) => {
        if (!date) return '—'
        const isExpired = new Date(date) < new Date()
        return (
          <Tooltip title={formatPersianDate(date, true)}>
            <Tag color={isExpired ? 'red' : 'default'}>
              {isExpired ? 'منقضی شده' : formatPersianDate(date)}
            </Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'محدودیت استفاده',
      key: 'usageLimit',
      width: 150,
      align: 'center',
      render: (_, record) => {
        if (!record.usageLimit) return <Tag>نامحدود</Tag>
        return (
          <Tooltip
            title={`${record.usageCount || 0} بار استفاده شده از ${record.usageLimit}`}
          >
            <Tag color="orange">
              {record.usageCount || 0} / {record.usageLimit}
            </Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'وضعیت',
      mobileBadge: true,
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      align: 'center',
      render: (isActive, record) => (
        <Switch
          checked={isActive}
          onChange={() => toggleActive(record)}
          checkedChildren="فعال"
          unCheckedChildren="غیرفعال"
        />
      ),
    },
    {
      title: 'عملیات',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title="ویرایش">
            <Button
              type="default"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="حذف">
            <Button
              type="default"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => removeCoupon(record._id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const onTableChange = (pag) => {
    setPagination((prev) => ({
      ...prev,
      current: pag.current,
      pageSize: pag.pageSize,
    }))
    fetchCoupons(pag.current, pag.pageSize)
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
        <h1>مدیریت کدهای تخفیف</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => fetchCoupons()}>
            بارگذاری مجدد
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            ایجاد کوپن جدید
          </Button>
        </Space>
      </div>

      <Card>
        <ResponsiveTable
          columns={columns}
          dataSource={coupons}
          loading={loading}
          rowKey="_id"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `${total} کوپن`,
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
                <p>هیچ کوپنی یافت نشد</p>
              </div>
            ),
          }}
        />
      </Card>

      {/* Modal ایجاد/ویرایش */}
      <Modal
        open={open}
        onCancel={() => {
          setOpen(false)
          form.resetFields()
          setEditingCoupon(null)
        }}
        onOk={handleSubmit}
        title={editingCoupon ? 'ویرایش کوپن' : 'ایجاد کوپن جدید'}
        okText="ذخیره"
        cancelText="انصراف"
        confirmLoading={saving}
        width={600}
      >
        <Form layout="vertical" form={form} style={{ marginTop: 24 }}>
          <Form.Item
            name="code"
            label="کد تخفیف"
            rules={[{ required: true, message: 'کد تخفیف الزامی است' }]}
          >
            <Input
              placeholder="مثال: SUMMER2024"
              style={{ textTransform: 'uppercase' }}
              maxLength={20}
            />
          </Form.Item>

          <Form.Item
            name="discountType"
            label="نوع تخفیف"
            initialValue="percent"
            rules={[{ required: true, message: 'نوع تخفیف الزامی است' }]}
          >
            <Select>
              <Select.Option value="percent">درصدی</Select.Option>
              <Select.Option value="fixed">مبلغ ثابت (تومان)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.discountType !== currentValues.discountType
            }
          >
            {({ getFieldValue }) => {
              const discountType = getFieldValue('discountType')
              return (
                <Form.Item
                  name="discountValue"
                  label={discountType === 'percent' ? 'درصد تخفیف' : 'مبلغ تخفیف (تومان)'}
                  rules={[
                    { required: true, message: 'مقدار تخفیف الزامی است' },
                    {
                      validator: (_, value) => {
                        if (discountType === 'percent' && (value < 0 || value > 100)) {
                          return Promise.reject('درصد تخفیف باید بین 0 تا 100 باشد')
                        }
                        if (value < 0) {
                          return Promise.reject('مقدار نمی‌تواند منفی باشد')
                        }
                        return Promise.resolve()
                      },
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={discountType === 'percent' ? 100 : undefined}
                    formatter={(value) => {
                      if (discountType === 'fixed') {
                        return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                      }
                      return value
                    }}
                    parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                  />
                </Form.Item>
              )
            }}
          </Form.Item>

          <Form.Item name="minPurchase" label="حداقل خرید (تومان)" initialValue={0}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item
            name="expiresAt"
            label="تاریخ انقضا"
            rules={[{ required: true, message: 'تاریخ انقضا الزامی است' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              showTime
              format="YYYY/MM/DD HH:mm:ss"
              placeholder="تاریخ و زمان انقضا را انتخاب کنید (شمسی)"
            />
          </Form.Item>

          <Form.Item name="usageLimit" label="محدودیت تعداد استفاده (اختیاری)">
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              placeholder="خالی = نامحدود"
            />
          </Form.Item>

          <Form.Item name="isActive" label="وضعیت" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CouponsPage
