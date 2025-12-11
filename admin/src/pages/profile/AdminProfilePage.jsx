import { useState, useEffect } from 'react'
import {
    Card,
    Form,
    Input,
    Button,
    message,
    Row,
    Col,
    Divider,
    Typography,
    Tag,
    Avatar,
    Upload
} from 'antd'
import {
    UserOutlined,
    MailOutlined,
    SafetyCertificateOutlined,
    SaveOutlined,
    CrownOutlined,
    CameraOutlined
} from '@ant-design/icons'
import { useAuthStore } from '../../stores'
import api from '../../api'

const { Title, Text } = Typography

// نقش‌ها به فارسی
const roleLabels = {
    superadmin: { label: 'مدیر ارشد', color: 'red' },
    manager: { label: 'مدیر', color: 'orange' },
    operator: { label: 'اپراتور', color: 'blue' },
    support: { label: 'پشتیبانی', color: 'green' }
}

const AdminProfilePage = () => {
    const [form] = Form.useForm()
    const { user, setUser } = useAuthStore()
    const [loading, setLoading] = useState(false)
    const [avatarLoading, setAvatarLoading] = useState(false)

    useEffect(() => {
        if (user) {
            form.setFieldsValue({
                name: user.name,
                email: user.email
            })
        }
    }, [user, form])

    const onFinish = async (values) => {
        setLoading(true)
        try {
            // فقط اگر رمز عبور وارد شده باشد ارسال شود
            const submitData = {
                name: values.name,
                email: values.email
            }

            if (values.password && values.password.trim()) {
                submitData.password = values.password
            }

            const res = await api.put('/auth/admin/profile', submitData)
            if (res.data.success) {
                message.success('اطلاعات پروفایل با موفقیت به‌روزرسانی شد')
                setUser(res.data.data)
                // پاک کردن فیلد رمز عبور بعد از ذخیره موفق
                form.setFieldValue('password', '')
                form.setFieldValue('confirmPassword', '')
            }
        } catch (error) {
            console.error('Update error:', error)
            message.error(error?.response?.data?.message || 'خطا در ذخیره اطلاعات')
        } finally {
            setLoading(false)
        }
    }

    const handleAvatarUpload = async (info) => {
        if (info.file.status === 'uploading') {
            setAvatarLoading(true)
            return
        }
        if (info.file.status === 'done') {
            setAvatarLoading(false)
            if (info.file.response?.success) {
                setUser({ ...user, avatar: info.file.response.data })
                message.success('تصویر پروفایل با موفقیت به‌روزرسانی شد')
            }
        }
        if (info.file.status === 'error') {
            setAvatarLoading(false)
            message.error('خطا در آپلود تصویر')
        }
    }

    const roleInfo = roleLabels[user?.role] || { label: user?.role, color: 'default' }

    return (
        <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            <Card bordered={false} className="shadow-md">
                {/* هدر پروفایل */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: 32,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: 12,
                    padding: '32px 24px',
                    marginTop: -24,
                    marginLeft: -24,
                    marginRight: -24
                }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                        <Avatar
                            size={100}
                            src={user?.avatar?.url}
                            icon={!user?.avatar?.url && <UserOutlined />}
                            style={{
                                border: '4px solid white',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }}
                        />
                        <Upload
                            name="avatar"
                            action="/api/upload/avatar"
                            showUploadList={false}
                            onChange={handleAvatarUpload}
                            accept="image/*"
                        >
                            <Button
                                type="primary"
                                shape="circle"
                                size="small"
                                icon={<CameraOutlined />}
                                loading={avatarLoading}
                                style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    background: '#fff',
                                    color: '#667eea',
                                    border: 'none'
                                }}
                            />
                        </Upload>
                    </div>
                    <Title level={3} style={{ color: 'white', marginTop: 16, marginBottom: 8 }}>
                        {user?.name}
                    </Title>
                    <Tag
                        icon={<CrownOutlined />}
                        color={roleInfo.color}
                        style={{ fontSize: 14, padding: '4px 12px' }}
                    >
                        {roleInfo.label}
                    </Tag>
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                >
                    <Divider orientation="right">اطلاعات پایه</Divider>

                    <Row gutter={24}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="name"
                                label="نام و نام خانوادگی"
                                rules={[{ required: true, message: 'لطفاً نام را وارد کنید' }]}
                            >
                                <Input
                                    prefix={<UserOutlined />}
                                    placeholder="نام کامل"
                                    size="large"
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="email"
                                label="پست الکترونیک"
                                rules={[
                                    { required: true, message: 'لطفاً ایمیل را وارد کنید' },
                                    { type: 'email', message: 'فرمت ایمیل صحیح نیست' }
                                ]}
                            >
                                <Input
                                    prefix={<MailOutlined />}
                                    dir="ltr"
                                    placeholder="email@example.com"
                                    size="large"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation="right">تغییر رمز عبور</Divider>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                        برای تغییر رمز عبور، رمز جدید را وارد کنید. در غیر این صورت این بخش را خالی بگذارید.
                    </Text>

                    <Row gutter={24}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="password"
                                label="رمز عبور جدید"
                                rules={[
                                    { min: 6, message: 'رمز عبور باید حداقل ۶ کاراکتر باشد' }
                                ]}
                            >
                                <Input.Password
                                    prefix={<SafetyCertificateOutlined />}
                                    placeholder="رمز عبور جدید"
                                    size="large"
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="confirmPassword"
                                label="تکرار رمز عبور جدید"
                                dependencies={['password']}
                                rules={[
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            if (!value || getFieldValue('password') === value) {
                                                return Promise.resolve()
                                            }
                                            return Promise.reject(new Error('رمز عبور و تکرار آن یکسان نیستند'))
                                        },
                                    }),
                                ]}
                            >
                                <Input.Password
                                    prefix={<SafetyCertificateOutlined />}
                                    placeholder="تکرار رمز عبور"
                                    size="large"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider />

                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        loading={loading}
                        block
                        size="large"
                        style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            height: 48
                        }}
                    >
                        ذخیره تغییرات
                    </Button>
                </Form>
            </Card>
        </div>
    )
}

export default AdminProfilePage
