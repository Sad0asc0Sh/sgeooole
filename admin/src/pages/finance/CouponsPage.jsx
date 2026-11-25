import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Space,
  Switch,
  Tooltip,
  Segmented,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PercentageOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import ResponsiveTable from '../../components/ResponsiveTable'
import PageHeader from '../../components/ui/PageHeader'
import StatTile from '../../components/ui/StatTile'
import StatusPill from '../../components/ui/StatusPill'
import JalaliDateTimePicker from '../../components/JalaliDateTimePicker'
import { formatPersianDate, toSafeDate } from '../../utils/dateUtils'
import { formatCurrency, formatNumber, parseNumericInput } from '../../utils/formatters'
import api from '../../api'

function CouponsPage() {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
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
      message.error(err?.response?.data?.message || err?.message || 'خطا در دریافت کوپن‌ها')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoupons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kpiStats = useMemo(() => {
    const now = new Date()
    let active = 0
    let expired = 0
    coupons.forEach((c) => {
      const isExp = c.expiresAt && new Date(c.expiresAt) < now
      if (isExp) expired++
      else if (c.isActive) active++
    })
    return { total: pagination.total || coupons.length, active, expired }
  }, [coupons, pagination.total])

  const filteredCoupons = useMemo(() => {
    const now = new Date()
    const q = search.trim().toLowerCase()
    return coupons.filter((c) => {
      if (q && !String(c.code || '').toLowerCase().includes(q)) return false
      const isExp = c.expiresAt && new Date(c.expiresAt) < now
      if (statusFilter === 'active') return c.isActive && !isExp
      if (statusFilter === 'expired') return isExp
      if (statusFilter === 'inactive') return !c.isActive
      return true
    })
  }, [coupons, search, statusFilter])

  const openCreateModal = () => {
    setEditingCoupon(null)
    form.resetFields()
    form.setFieldsValue({ discountType: 'percent', minPurchase: 0, isActive: true })
    setOpen(true)
  }

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon)
    form.setFieldsValue({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minPurchase: coupon.minPurchase || 0,
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt) : null,
      isActive: coupon.isActive,
      usageLimit: coupon.usageLimit || null,
    })
    setOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const expiryDate = toSafeDate(values.expiresAt)
      if (!expiryDate) {
        message.error('لطفاً تاریخ انقضا را انتخاب کنید')
        return
      }

      setSaving(true)

      const payload = {
        code: values.code,
        discountType: values.discountType,
        discountValue: values.discountValue,
        minPurchase: values.minPurchase || 0,
        expiresAt: expiryDate.toISOString(),
        isActive: values.isActive !== undefined ? values.isActive : true,
        usageLimit: values.usageLimit || null,
      }

      if (editingCoupon) {
        await api.put(`/coupons/${editingCoupon._id}`, payload)
        message.success('کوپن با موفقیت به‌روزرسانی شد')
      } else {
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
      message.error(err?.response?.data?.message || err?.message || 'خطا در ذخیره‌سازی کوپن')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (coupon) => {
    try {
      await api.put(`/coupons/${coupon._id}`, { isActive: !coupon.isActive })
      message.success('وضعیت کوپن به‌روزرسانی شد')
      fetchCoupons()
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || 'خطا در به‌روزرسانی')
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
          message.error(err?.response?.data?.message || err?.message || 'خطا در حذف کوپن')
        }
      },
    })
  }

  const columns = [
    {
      title: 'کد تخفیف',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      mobileTitle: true,
      render: (code) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13.5 }} dir="ltr">
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
        <StatusPill
          size="sm"
          tone={type === 'percent' ? 'info' : 'ok'}
          label={type === 'percent' ? 'درصدی' : 'مبلغ ثابت'}
        />
      ),
    },
    {
      title: 'مقدار تخفیف',
      dataIndex: 'discountValue',
      key: 'discountValue',
      width: 150,
      render: (value, record) =>
        record.discountType === 'percent'
          ? `${formatNumber(value)}٪`
          : formatCurrency(value),
    },
    {
      title: 'حداقل خرید',
      dataIndex: 'minPurchase',
      key: 'minPurchase',
      width: 150,
      render: (value) => (value > 0 ? formatCurrency(value) : '—'),
    },
    {
      title: 'تاریخ انقضا',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 190,
      render: (date) => {
        if (!date) return '—'
        const isExpired = new Date(date) < new Date()
        return (
          <Tooltip title={formatPersianDate(date, true)}>
            <StatusPill
              size="sm"
              tone={isExpired ? 'err' : 'neutral'}
              label={isExpired ? 'منقضی شده' : formatPersianDate(date)}
            />
          </Tooltip>
        )
      },
    },
    {
      title: 'محدودیت استفاده',
      key: 'usageLimit',
      width: 140,
      align: 'center',
      render: (_, record) =>
        record.usageLimit ? (
          <StatusPill
            size="sm"
            tone="warn"
            label={`${formatNumber(record.usageCount || 0)} / ${formatNumber(record.usageLimit)}`}
          />
        ) : (
          <StatusPill size="sm" tone="neutral" label="نامحدود" />
        ),
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
      width: 130,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title="ویرایش">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          </Tooltip>
          <Tooltip title="حذف">
            <Button
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <PageHeader
        title="مدیریت کدهای تخفیف"
        subtitle="تعریف کوپن‌های درصدی و مبلغ ثابت برای سبد خرید مشتریان"
        count={pagination.total}
        actions={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => fetchCoupons()}>
              به‌روزرسانی
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              ایجاد کوپن جدید
            </Button>
          </Space>
        }
      />

      <div className="kpi-grid-3">
        <StatTile label="کل کدهای تخفیف" value={formatNumber(kpiStats.total)} icon={<PercentageOutlined />} tone="brand" />
        <StatTile label="کوپن‌های فعال" value={formatNumber(kpiStats.active)} icon={<CheckCircleOutlined />} tone="ok" />
        <StatTile label="منقضی‌شده" value={formatNumber(kpiStats.expired)} icon={<ClockCircleOutlined />} tone={kpiStats.expired > 0 ? 'warn' : 'neutral'} />
      </div>

      <div className="filter-bar">
        <Input
          placeholder="جستجو در کد تخفیف..."
          prefix={<SearchOutlined />}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 240 }}
        />
        <div className="quick-tabs-bar">
          <Segmented
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: 'همه', value: 'all' },
              { label: 'فعال', value: 'active' },
              { label: 'منقضی‌شده', value: 'expired' },
              { label: 'غیرفعال', value: 'inactive' },
            ]}
          />
        </div>
      </div>

      <Card>
        <ResponsiveTable
          columns={columns}
          dataSource={filteredCoupons}
          loading={loading}
          rowKey="_id"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `${formatNumber(total)} کوپن`,
          }}
          onChange={onTableChange}
        />
      </Card>

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
        <Form layout="vertical" form={form} style={{ marginTop: 16 }}>
          <Form.Item
            name="code"
            label="کد تخفیف"
            rules={[{ required: true, message: 'کد تخفیف الزامی است' }]}
          >
            <Input
              placeholder="مثال: EKG1405"
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
                    formatter={(value) =>
                      discountType === 'fixed'
                        ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                        : value
                    }
                    parser={parseNumericInput}
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
              parser={parseNumericInput}
            />
          </Form.Item>

          <Form.Item
            name="expiresAt"
            label="تاریخ و ساعت انقضا (شمسی)"
            rules={[
              {
                validator: (_, val) =>
                  toSafeDate(val)
                    ? Promise.resolve()
                    : Promise.reject(new Error('تاریخ انقضا الزامی است')),
              },
            ]}
          >
            <JalaliDateTimePicker
              showTime
              presets="future"
              minDate={new Date()}
              placeholder="تاریخ و زمان انقضا را انتخاب کنید (شمسی)"
            />
          </Form.Item>

          <Form.Item name="usageLimit" label="محدودیت تعداد استفاده (اختیاری)">
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              placeholder="خالی = نامحدود"
              parser={parseNumericInput}
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
