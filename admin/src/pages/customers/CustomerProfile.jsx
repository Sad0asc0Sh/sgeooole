import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tabs,
  Table,
  Tag,
  message,
  Form,
  Input,
  Switch,
  Button,
  Space,
  Select,
  Divider,
} from 'antd'
import { SaveOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import api from '../../api'
import { useAuthStore } from '../../stores'

dayjs.extend(jalaliday)
dayjs.calendar('jalali')

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

const ROLE_ORDER = ['user', 'manager', 'admin', 'superadmin']
const ROLE_LABELS = {
  user: 'کاربر',
  manager: 'مدیر',
  admin: 'ادمین',
  superadmin: 'سوپر ادمین',
}

function CustomerProfile() {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [sendingNotification, setSendingNotification] = useState(false)
  const [form] = Form.useForm()
  const [notificationForm] = Form.useForm()

  const currentRole = useAuthStore((state) => state.user?.role || 'user')
  const selectableRoles =
    currentRole === 'superadmin' ? ROLE_ORDER : ['user']

  const fetchUser = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/users/admin/${id}`)
      const userData = res?.data?.data
      setUser(userData)
      form.setFieldsValue({
        name: userData?.name || '',
        email: userData?.email || '',
        phoneNumber: userData?.phoneNumber || '',
        isActive: userData?.isActive ?? true,
        role: userData?.role || 'user',
      })
    } catch (err) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'خطا در دریافت اطلاعات کاربر'
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrders = async () => {
    setOrdersLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('userId', id)
      params.set('limit', '100')

      const res = await api.get('/orders', { params })
      setOrders(res?.data?.data || [])
    } catch (err) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.message ||
        'خطا در دریافت سفارش‌ها'
      message.error(errorMsg)
    } finally {
      setOrdersLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
    fetchOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleSaveProfile = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      await api.put(`/users/admin/${id}`, {
        name: values.name,
        email: values.email,
        phoneNumber: values.phoneNumber,
        isActive: values.isActive,
        role: values.role,
      })

      message.success('اطلاعات کاربر با موفقیت به‌روزرسانی شد.')
      fetchUser()
    } catch (err) {
      if (err?.errorFields) {
        message.error('لطفاً خطاهای فرم را برطرف کنید.')
      } else {
        const errorMsg =
          err?.response?.data?.message ||
          err?.message ||
          'خطا در به‌روزرسانی اطلاعات کاربر'
        message.error(errorMsg)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSendNotification = async (values) => {
    setSendingNotification(true)
    try {
      await api.post('/notifications/send', {
        userId: id,
        title: values.title,
        message: values.message,
        type: values.type,
      })
      message.success('اعلان با موفقیت ارسال شد')
      notificationForm.resetFields()
    } catch (err) {
      const errorMsg =
        err?.response?.data?.message || 'خطا در ارسال اعلان'
      message.error(errorMsg)
    } finally {
      setSendingNotification(false)
    }
  }

  const orderColumns = [
    {
      title: 'شماره سفارش',
      key: 'orderId',
      width: 150,
      render: (_, record) => (
        <Link to={`/orders/${record._id}`}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
            #{record._id?.slice(-8) || '-'}
          </span>
        </Link>
      ),
    },
    {
      title: 'مبلغ کل',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 150,
      render: (price) =>
        `${new Intl.NumberFormat('fa-IR').format(price || 0)} تومان`,
    },
    {
      title: 'وضعیت سفارش',
      dataIndex: 'orderStatus',
      key: 'orderStatus',
      width: 140,
      render: (status) => {
        const colors = {
          Pending: 'orange',
          Processing: 'blue',
          Shipped: 'cyan',
          Delivered: 'green',
          Cancelled: 'red',
        }
        return <Tag color={colors[status] || 'default'}>{status}</Tag>
      },
    },
    {
      title: 'وضعیت پرداخت',
      dataIndex: 'isPaid',
      key: 'isPaid',
      width: 130,
      align: 'center',
      render: (isPaid) => (
        <Tag color={isPaid ? 'green' : 'red'}>
          {isPaid ? 'پرداخت شده' : 'پرداخت نشده'}
        </Tag>
      ),
    },
    {
      title: 'تاریخ ثبت',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 200,
      render: (date) => formatPersianDate(date, true),
    },
  ]

  const tabItems = [
    {
      key: 'profile',
      label: 'پروفایل کاربر',
      children: (
        <div style={{ maxWidth: 800 }}>
          {user && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h3>اطلاعات پایه</h3>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="شناسه کاربر" span={2}>
                    <span style={{ fontFamily: 'monospace' }}>{user._id}</span>
                  </Descriptions.Item>
                  <Descriptions.Item label="تاریخ ایجاد">
                    {formatPersianDate(user.createdAt, true)}
                  </Descriptions.Item>
                  <Descriptions.Item label="آخرین ورود">
                    {formatPersianDate(user.lastLogin, true)}
                  </Descriptions.Item>
                  <Descriptions.Item label="شماره موبایل">
                    {user.mobile || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="موجودی کیف پول">
                    {user.wallet ? `${new Intl.NumberFormat('fa-IR').format(user.wallet)} تومان` : '0 تومان'}
                  </Descriptions.Item>
                </Descriptions>
              </div>

              {/* ✅ اطلاعات شخصی */}
              {(user.nationalCode || user.birthDate || user.landline || user.province || user.city || user.shebaNumber) && (
                <div style={{ marginBottom: 24 }}>
                  <h3>اطلاعات شخصی</h3>
                  <Descriptions bordered size="small" column={2}>
                    {user.nationalCode && (
                      <Descriptions.Item label="کد ملی">{user.nationalCode}</Descriptions.Item>
                    )}
                    {user.birthDate && (
                      <Descriptions.Item label="تاریخ تولد">{formatPersianDate(user.birthDate)}</Descriptions.Item>
                    )}
                    {user.landline && (
                      <Descriptions.Item label="تلفن ثابت">{user.landline}</Descriptions.Item>
                    )}
                    {user.province && (
                      <Descriptions.Item label="استان">{user.province}</Descriptions.Item>
                    )}
                    {user.city && (
                      <Descriptions.Item label="شهر">{user.city}</Descriptions.Item>
                    )}
                    {user.shebaNumber && (
                      <Descriptions.Item label="شماره شبا" span={2}>
                        <span style={{ fontFamily: 'monospace', direction: 'ltr', display: 'inline-block' }}>{user.shebaNumber}</span>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </div>
              )}

              {/* ✅ اطلاعات حقوقی */}
              {user.isLegal && (
                <div style={{ marginBottom: 24 }}>
                  <h3>اطلاعات شخص حقوقی</h3>
                  <Descriptions bordered size="small" column={2}>
                    {user.companyName && (
                      <Descriptions.Item label="نام شرکت/سازمان" span={2}>{user.companyName}</Descriptions.Item>
                    )}
                    {user.companyNationalId && (
                      <Descriptions.Item label="شناسه ملی">{user.companyNationalId}</Descriptions.Item>
                    )}
                    {user.companyRegistrationId && (
                      <Descriptions.Item label="شماره ثبت">{user.companyRegistrationId}</Descriptions.Item>
                    )}
                    {user.companyLandline && (
                      <Descriptions.Item label="تلفن ثابت شرکت">{user.companyLandline}</Descriptions.Item>
                    )}
                    {user.companyProvince && (
                      <Descriptions.Item label="استان">{user.companyProvince}</Descriptions.Item>
                    )}
                    {user.companyCity && (
                      <Descriptions.Item label="شهر">{user.companyCity}</Descriptions.Item>
                    )}
                  </Descriptions>
                </div>
              )}

              <Divider />

              <div>
                <h3>ویرایش اطلاعات</h3>
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                  <Form.Item
                    name="name"
                    label="نام"
                    rules={[
                      { required: true, message: 'لطفاً نام را وارد کنید.' },
                    ]}
                  >
                    <Input placeholder="نام کاربر" size="large" />
                  </Form.Item>

                  <Form.Item
                    name="email"
                    label="ایمیل"
                    rules={[
                      { required: true, message: 'لطفاً ایمیل را وارد کنید.' },
                      { type: 'email', message: 'ایمیل وارد شده معتبر نیست.' },
                    ]}
                  >
                    <Input placeholder="ایمیل کاربر" size="large" />
                  </Form.Item>

                  <Form.Item
                    name="phoneNumber"
                    label="شماره تماس"
                  >
                    <Input placeholder="شماره تماس" size="large" />
                  </Form.Item>

                  <Form.Item name="role" label="نقش کاربر">
                    <Select size="large">
                      {selectableRoles.map((role) => (
                        <Select.Option key={role} value={role}>
                          {ROLE_LABELS[role] || role}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="isActive"
                    label="وضعیت حساب"
                    valuePropName="checked"
                  >
                    <Switch
                      checkedChildren="فعال"
                      unCheckedChildren="غیرفعال"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      size="large"
                      icon={<SaveOutlined />}
                      onClick={handleSaveProfile}
                      loading={saving}
                    >
                      ذخیره تغییرات
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'orders',
      label: 'سفارش‌های کاربر',
      children: (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <h3>لیست سفارش‌ها</h3>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchOrders}
              loading={ordersLoading}
            >
              بارگذاری مجدد
            </Button>
          </div>
          <Table
            columns={orderColumns}
            dataSource={orders}
            loading={ordersLoading}
            rowKey="_id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
            }}
          />
        </div>
      ),
    },
    {
      key: 'notifications',
      label: 'ارسال پیام',
      children: (
        <div style={{ maxWidth: 600 }}>
          <h3>ارسال پیام به کاربر</h3>
          <Form
            form={notificationForm}
            layout="vertical"
            onFinish={handleSendNotification}
            initialValues={{ type: 'info' }}
          >
            <Form.Item
              name="title"
              label="عنوان پیام"
              rules={[{ required: true, message: 'لطفاً عنوان پیام را وارد کنید' }]}
            >
              <Input placeholder="مثال: خوش‌آمدید" />
            </Form.Item>

            <Form.Item
              name="message"
              label="متن پیام"
              rules={[{ required: true, message: 'لطفاً متن پیام را وارد کنید' }]}
            >
              <Input.TextArea rows={4} placeholder="متن پیام خود را بنویسید..." />
            </Form.Item>

            <Form.Item name="type" label="نوع پیام">
              <Select>
                <Select.Option value="info">اطلاع‌رسانی (آبی)</Select.Option>
                <Select.Option value="success">موفقیت (سبز)</Select.Option>
                <Select.Option value="warning">هشدار (نارنجی)</Select.Option>
                <Select.Option value="error">خطا (قرمز)</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                icon={<SendOutlined />}
                htmlType="submit"
                loading={sendingNotification}
              >
                ارسال پیام
              </Button>
            </Form.Item>
          </Form>
        </div>
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
        }}
      >
        <h1>پروفایل مشتری</h1>
        <Space>
          <Link to="/customers">
            <Button>بازگشت به لیست مشتریان</Button>
          </Link>
        </Space>
      </div>

      <Card loading={loading}>
        {user && (
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>{user.name}</h2>
            <p style={{ color: '#666', margin: '4px 0 0 0' }}>{user.email}</p>
          </div>
        )}
        <Tabs items={tabItems} />
      </Card>
    </div>
  )
}

export default CustomerProfile
