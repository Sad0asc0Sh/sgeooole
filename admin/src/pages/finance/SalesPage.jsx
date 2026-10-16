import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Popconfirm,
  message,
  DatePicker,
  Switch,
  Radio,
  Alert,
} from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
import { PlusOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'
import PageHeader from '../../components/ui/PageHeader'

dayjs.extend(jalaliday)
dayjs.calendar('jalali')

const { RangePicker } = DatePicker

const formatPersianDate = (date, includeTime = false) => {
  if (!date) return '-'
  const jalaliDate = dayjs(date).calendar('jalali').locale('fa')
  const year = jalaliDate.format('YYYY')
  const month = jalaliDate.format('MM')
  const day = jalaliDate.format('DD')

  if (includeTime) {
    const time = jalaliDate.format('HH:mm')
    return `${year}/${month}/${day} - ${time}`
  }
  return `${year}/${month}/${day}`
}

function SalesPage() {
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingSale, setEditingSale] = useState(null)
  // محصولاتی که قبلاً در «پیشنهاد لحظه‌ای» یا «شگفت‌انگیز» فعال شده‌اند: { [productId]: [{type,label,endTime}] }
  const [conflictMap, setConflictMap] = useState({})
  const [conflictsLoading, setConflictsLoading] = useState(false)
  const [form] = Form.useForm()
  const watchedRange = Form.useWatch('dateRange', form)

  const fetchSales = async () => {
    setLoading(true)
    try {
      const res = await api.get('/sales/admin')
      const data = res?.data?.data || []
      setSales(Array.isArray(data) ? data : [])
    } catch (err) {
      message.error('خطا در دریافت لیست تخفیف‌ها')
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    setProductsLoading(true)
    try {
      const res = await api.get('/products', {
        params: { limit: 1000, fields: 'name,_id,sku' },
      })
      const data = res?.data?.data || []
      setProducts(Array.isArray(data) ? data : [])
    } catch (err) {
      message.error('خطا در دریافت لیست محصولات')
    } finally {
      setProductsLoading(false)
    }
  }

  const fetchConflicts = async (excludeSaleId, startDate) => {
    setConflictsLoading(true)
    try {
      const res = await api.get('/sales/admin/product-conflicts', {
        params: {
          ...(excludeSaleId ? { excludeSaleId } : {}),
          ...(startDate ? { startDate } : {}),
        },
      })
      const rows = Array.isArray(res?.data?.data) ? res.data.data : []
      const map = {}
      rows.forEach((row) => {
        map[row.productId] = row.conflicts || []
      })
      setConflictMap(map)
      return map
    } catch (err) {
      setConflictMap({})
      message.error('خطا در بررسی محصولاتِ درگیر در پیشنهاد لحظه‌ای/شگفت‌انگیز')
      return {}
    } finally {
      setConflictsLoading(false)
    }
  }

  useEffect(() => {
    fetchSales()
    fetchProducts()
  }, [])

  // با باز بودن مودال و تغییر بازه زمانی، فهرست محصولات درگیر را به‌روز نگه می‌داریم
  useEffect(() => {
    if (!modalOpen) return
    const start = watchedRange?.[0]
    fetchConflicts(editingSale?._id, start ? start.toISOString() : undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, editingSale?._id, watchedRange?.[0]?.valueOf?.()])

  const productOptions = useMemo(
    () =>
      products.map((p) => {
        const conflicts = conflictMap[p._id] || []
        return {
          label: p.sku ? `${p.name} (${p.sku})` : p.name,
          value: p._id,
          sku: p.sku || '',
          disabled: conflicts.length > 0,
          conflicts,
        }
      }),
    [products, conflictMap],
  )

  const openCreateModal = () => {
    setEditingSale(null)
    form.resetFields()
    form.setFieldsValue({
      isActive: true,
      showInFeatured: true,
    })
    setModalOpen(true)
  }

  const openEditModal = (sale) => {
    setEditingSale(sale)
    form.resetFields()
    form.setFieldsValue({
      name: sale.name,
      discountPercentage: sale.discountPercentage,
      dateRange: [dayjs(sale.startDate), dayjs(sale.endDate)],
      products: sale.products?.map((p) => (typeof p === 'object' ? p._id : p)),
      isActive: sale.isActive,
      badgeTheme: sale.badgeTheme || 'lime-blue',
      showInFeatured: sale.showInFeatured !== false,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      const payload = {
        name: values.name,
        discountPercentage: values.discountPercentage,
        startDate: values.dateRange[0].toISOString(),
        endDate: values.dateRange[1].toISOString(),
        products: values.products || [],
        isActive: values.isActive,
        badgeTheme: values.badgeTheme,
        showInFeatured: values.showInFeatured !== false,
      }

      setSaving(true)

      if (editingSale) {
        await api.put(`/sales/admin/${editingSale._id}`, payload)
        message.success('تخفیف با موفقیت به‌روزرسانی شد')
      } else {
        await api.post('/sales/admin', payload)
        message.success('تخفیف جدید با موفقیت ایجاد شد')
      }

      setModalOpen(false)
      setEditingSale(null)
      form.resetFields()
      fetchSales()
    } catch (err) {
      if (err?.errorFields) {
        return
      }

      if (err?.response?.status === 409) {
        const start = form.getFieldValue('dateRange')?.[0]
        fetchConflicts(editingSale?._id, start ? start.toISOString() : undefined)
      }

      const msg =
        err?.response?.data?.message ||
        err?.message ||
        (editingSale ? 'خطا در به‌روزرسانی تخفیف' : 'خطا در ایجاد تخفیف')
      message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (sale) => {
    try {
      await api.delete(`/sales/admin/${sale._id}`)
      message.success('تخفیف با موفقیت حذف شد')
      fetchSales()
    } catch (err) {
      message.error('خطا در حذف تخفیف')
    }
  }

  const getSaleStatus = (sale) => {
    const now = new Date()
    const start = new Date(sale.startDate)
    const end = new Date(sale.endDate)

    if (!sale.isActive) {
      return { text: 'غیرفعال', color: 'default' }
    }

    if (now < start) {
      return { text: 'در انتظار شروع', color: 'blue' }
    }

    if (now >= start && now <= end) {
      return { text: 'در حال اجرا', color: 'green' }
    }

    if (now > end) {
      return { text: 'پایان یافته', color: 'red' }
    }

    return { text: 'نامشخص', color: 'default' }
  }

  const columns = [
    {
      title: 'نام تخفیف',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'درصد تخفیف',
      dataIndex: 'discountPercentage',
      key: 'discountPercentage',
      render: (value) => <Tag color="orange">{value}%</Tag>,
    },
    {
      title: 'تاریخ شروع',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (date) => formatPersianDate(date, true),
    },
    {
      title: 'تاریخ پایان',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date) => formatPersianDate(date, true),
    },
    {
      title: 'تعداد محصولات',
      dataIndex: 'products',
      key: 'products',
      render: (products) => (
        <Tag color="blue">{Array.isArray(products) ? products.length : 0} محصول</Tag>
      ),
    },
    {
      title: 'منتخب‌ها',
      dataIndex: 'showInFeatured',
      key: 'showInFeatured',
      render: (value) =>
        value === false ? <Tag>عدم نمایش</Tag> : <Tag color="purple">نمایش در منتخب‌ها</Tag>,
    },
    {
      title: 'وضعیت',
      mobileBadge: true,
      key: 'status',
      render: (_, record) => {
        const status = getSaleStatus(record)
        return (
          <Tag color={status.color} icon={<ClockCircleOutlined />}>
            {status.text}
          </Tag>
        )
      },
    },
    {
      title: 'عملیات',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            ویرایش
          </Button>
          <Popconfirm
            title="حذف تخفیف"
            description="آیا از حذف این تخفیف مطمئن هستید؟"
            okText="حذف"
            cancelText="انصراف"
            onConfirm={() => handleDelete(record)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              حذف
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
         title="مدیریت تخفیف‌های زمان‌دار"
         actions={
           <>
<Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                       ایجاد تخفیف جدید
                     </Button>
           </>
         }
       />

      <Card>
        <ResponsiveTable columns={columns} dataSource={sales} loading={loading} rowKey="_id"
 scroll={{ x: 'max-content' }} />
      </Card>

      <Modal
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setEditingSale(null)
          form.resetFields()
        }}
        onOk={handleSubmit}
        confirmLoading={saving}
        title={editingSale ? 'ویرایش تخفیف' : 'ایجاد تخفیف جدید'}
        okText="ذخیره"
        cancelText="انصراف"
        width={700}
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="name"
            label="نام تخفیف"
            rules={[{ required: true, message: 'لطفاً نام تخفیف را وارد کنید' }]}
          >
            <Input placeholder="مثلاً: فروش ویژه عید نوروز" />
          </Form.Item>

          <Form.Item
            name="discountPercentage"
            label="درصد تخفیف"
            rules={[
              { required: true, message: 'لطفاً درصد تخفیف را وارد کنید' },
              {
                type: 'number',
                min: 1,
                max: 99,
                message: 'درصد تخفیف باید بین ۱ تا ۹۹ باشد',
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={99}
              placeholder="مثلاً: 20"
              addonAfter="%"
            />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="بازه زمانی تخفیف"
            rules={[{ required: true, message: 'لطفاً بازه زمانی را انتخاب کنید' }]}
          >
            <RangePicker
              showTime
              format="YYYY/MM/DD HH:mm"
              style={{ width: '100%' }}
              placeholder={['تاریخ شروع', 'تاریخ پایان']}
            />
          </Form.Item>

          <Form.Item
            name="products"
            label="محصولات شامل تخفیف"
            extra="محصولاتی که قبلاً در «پیشنهاد لحظه‌ای» یا «شگفت‌انگیز» فعال شده‌اند غیرقابل انتخاب هستند. برای انتخاب آن‌ها، ابتدا کمپین قبلی را از صفحه‌ی ویرایش محصول غیرفعال کنید."
          >
            <Select
              mode="multiple"
              placeholder="انتخاب محصولات..."
              loading={productsLoading || conflictsLoading}
              showSearch
              optionLabelProp="label"
              filterOption={(input, option) => {
                const search = (input || '').toString().toLowerCase()
                const label = (option?.label ?? '').toString().toLowerCase()
                const sku = (option?.sku ?? '').toString().toLowerCase()
                return label.includes(search) || sku.includes(search)
              }}
              options={productOptions}
              optionRender={(option) => {
                const conflicts = option.data.conflicts || []
                return (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span>{option.data.label}</span>
                    {conflicts.map((c) => (
                      <Tag key={c.type} color={c.type === 'flash' ? 'gold' : 'red'} style={{ marginInlineEnd: 0 }}>
                        {c.label} فعال است
                      </Tag>
                    ))}
                  </div>
                )
              }}
            />
          </Form.Item>

          {Object.keys(conflictMap).length > 0 && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`${Object.keys(conflictMap).length.toLocaleString('fa-IR')} محصول در پیشنهاد لحظه‌ای یا شگفت‌انگیز فعال هستند و در این فهرست غیرفعال شده‌اند.`}
            />
          )}

          <Form.Item name="badgeTheme" label="رنگ نشان (Badge Color)">
            <Radio.Group>
              <Radio value="lime-blue">
                <span style={{ color: '#65a30d' }}>●</span> بهاره
                <span
                  style={{
                    display: 'inline-block',
                    width: 32,
                    height: 12,
                    borderRadius: 6,
                    marginInlineStart: 8,
                    verticalAlign: 'middle',
                    background: 'linear-gradient(to left, #65a30d, #16a34a, #2563eb)',
                  }}
                />
              </Radio>
              <Radio value="gold-red">
                <span style={{ color: '#ca8a04' }}>●</span> طلایی (نوروز/لوکس)
                <span
                  style={{
                    display: 'inline-block',
                    width: 32,
                    height: 12,
                    borderRadius: 6,
                    marginInlineStart: 8,
                    verticalAlign: 'middle',
                    background: 'linear-gradient(to left, #fbbf24, #f97316)',
                  }}
                />
              </Radio>
              <Radio value="red-purple">
                <span style={{ color: '#dc2626' }}>●</span> آتشین (حراج ویژه)
                <span
                  style={{
                    display: 'inline-block',
                    width: 32,
                    height: 12,
                    borderRadius: 6,
                    marginInlineStart: 8,
                    verticalAlign: 'middle',
                    background: 'linear-gradient(to left, #f43f5e, #7e22ce)',
                  }}
                />
              </Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="showInFeatured"
            label="نمایش در منتخب‌های صفحه اصلی"
            valuePropName="checked"
            extra="اگر فعال باشد، محصولات این تخفیف با لیبل همین تخفیف (نام تخفیف) در بخش «پیشنهادهای منتخب» صفحه‌ی اصلی نمایش داده می‌شوند. اگر خاموش باشد فقط قیمت تخفیفی اعمال می‌شود."
          >
            <Switch checkedChildren="نمایش" unCheckedChildren="عدم نمایش" />
          </Form.Item>

          <Form.Item name="isActive" label="وضعیت" valuePropName="checked">
            <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SalesPage
