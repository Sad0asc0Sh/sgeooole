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
    Switch,
    DatePicker,
    Select,
    Typography,
    Space,
    Alert
} from 'antd'
import {
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    HomeOutlined,
    BankOutlined,
    SafetyCertificateOutlined,
    SaveOutlined,
    IdcardOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import DatePickerJalali from 'react-multi-date-picker'
import persian from 'react-date-object/calendars/persian'
import persian_fa from 'react-date-object/locales/persian_fa'
import { useAuthStore } from '../../stores'
import api from '../../api'

dayjs.extend(jalaliday)

const { Title, Text } = Typography
const { Option } = Select

// Validation Helpers
const validateNationalCode = (_, value) => {
    if (!value) return Promise.resolve()
    if (!/^\d{10}$/.test(value)) {
        return Promise.reject(new Error('کد ملی باید ۱۰ رقم باشد'))
    }
    const check = parseInt(value[9])
    const sum =
        Array.from(value.substring(0, 9))
            .map((n, i) => parseInt(n) * (10 - i))
            .reduce((a, b) => a + b, 0) % 11
    if ((sum < 2 && check === sum) || (sum >= 2 && check === 11 - sum)) {
        return Promise.resolve()
    }
    return Promise.reject(new Error('کد ملی نامعتبر است'))
}

const validateSheba = (_, value) => {
    if (!value) return Promise.resolve()
    if (!/^IR\d{24}$/.test(value)) {
        return Promise.reject(new Error('شماره شبا باید با IR شروع شده و ۲۶ کاراکتر باشد'))
    }
    // Basic ISO 7064 check could be added here, but regex is a good start
    return Promise.resolve()
}

const validateMobile = (_, value) => {
    if (!value) return Promise.resolve()
    if (!/^09\d{9}$/.test(value)) {
        return Promise.reject(new Error('شماره موبایل باید با 09 شروع شود و ۱۱ رقم باشد'))
    }
    return Promise.resolve()
}

const UserProfilePage = () => {
    const [form] = Form.useForm()
    const { user, setUser } = useAuthStore()
    const [loading, setLoading] = useState(false)
    const [isLegal, setIsLegal] = useState(false)

    useEffect(() => {
        if (user) {
            setIsLegal(user.isLegal || false)
            form.setFieldsValue({
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                nationalCode: user.nationalCode,
                landline: user.landline,
                shebaNumber: user.shebaNumber,
                province: user.province,
                city: user.city,
                isLegal: user.isLegal || false,
                companyName: user.companyName,
                companyNationalId: user.companyNationalId,
                companyRegistrationId: user.companyRegistrationId,
                companyLandline: user.companyLandline,
                companyProvince: user.companyProvince,
                companyCity: user.companyCity,
                // birthDate handling needs care with DatePicker
                birthDate: user.birthDate ? new Date(user.birthDate) : null
            })
        }
    }, [user, form])

    const onFinish = async (values) => {
        setLoading(true)
        try {
            // Convert DatePicker value to ISO string if present
            const submitData = { ...values }
            if (values.birthDate) {
                // react-multi-date-picker returns an object or string, ensure it's standard Date or ISO
                submitData.birthDate = new Date(values.birthDate).toISOString()
            }

            const res = await api.put('/auth/me/update', submitData)
            if (res.data.success) {
                message.success('اطلاعات حساب کاربری با موفقیت به‌روزرسانی شد')
                setUser(res.data.data)
            }
        } catch (error) {
            console.error('Update error:', error)
            message.error(error?.response?.data?.message || 'خطا در ذخیره اطلاعات')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <Card title="اطلاعات حساب کاربری" bordered={false} className="shadow-md">
                <Alert
                    message="توجه"
                    description="لطفاً اطلاعات زیر را با دقت و صحت کامل وارد نمایید. این اطلاعات برای احراز هویت و امور مالی استفاده می‌شود."
                    type="info"
                    showIcon
                    style={{ marginBottom: 24 }}
                />

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    initialValues={{ isLegal: false }}
                >
                    <Row gutter={24}>
                        <Col span={24}>
                            <Form.Item name="isLegal" valuePropName="checked">
                                <Switch
                                    checkedChildren="شخص حقوقی"
                                    unCheckedChildren="شخص حقیقی"
                                    onChange={(checked) => setIsLegal(checked)}
                                />
                            </Form.Item>
                            <Divider orientation="left">
                                {isLegal ? 'اطلاعات نماینده / رابط' : 'اطلاعات شخصی'}
                            </Divider>
                        </Col>

                        {/* Personal / Representative Info */}
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="name"
                                label="نام و نام خانوادگی"
                                rules={[{ required: true, message: 'لطفاً نام و نام خانوادگی را وارد کنید' }]}
                            >
                                <Input prefix={<UserOutlined />} placeholder="مثال: علی محمدی" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="nationalCode"
                                label="کد ملی"
                                rules={[{ required: true, message: 'لطفاً کد ملی را وارد کنید' }, { validator: validateNationalCode }]}
                            >
                                <Input prefix={<IdcardOutlined />} placeholder="۱۰ رقم بدون خط تیره" maxLength={10} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="birthDate"
                                label="تاریخ تولد"
                                rules={[{ required: true, message: 'لطفاً تاریخ تولد را انتخاب کنید' }]}
                            >
                                <DatePickerJalali
                                    calendar={persian}
                                    locale={persian_fa}
                                    calendarPosition="bottom-right"
                                    inputClass="ant-input"
                                    containerStyle={{ width: '100%' }}
                                    format="YYYY/MM/DD"
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
                                <Input prefix={<MailOutlined />} dir="ltr" placeholder="example@domain.com" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="password"
                                label="رمز عبور جدید (اختیاری)"
                                rules={[{ min: 6, message: 'حداقل ۶ کاراکتر' }]}
                                extra="فقط در صورت تمایل به تغییر رمز عبور وارد کنید"
                            >
                                <Input.Password prefix={<SafetyCertificateOutlined />} placeholder="رمز عبور جدید" />
                            </Form.Item>
                        </Col>

                        {/* Contact Info */}
                        <Col span={24}>
                            <Divider orientation="left">اطلاعات تماس و سکونت</Divider>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="mobile"
                                label="شماره موبایل"
                                rules={[
                                    { required: true, message: 'لطفاً شماره موبایل را وارد کنید' },
                                    { validator: validateMobile }
                                ]}
                            >
                                <Input prefix={<PhoneOutlined />} placeholder="09xxxxxxxxx" maxLength={11} dir="ltr" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="landline"
                                label="تلفن ثابت"
                                rules={[{ required: false, message: 'لطفاً تلفن ثابت را وارد کنید' }]}
                            >
                                <Input prefix={<PhoneOutlined />} placeholder="به همراه کد شهر" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="province"
                                label="استان"
                                rules={[{ required: true, message: 'لطفاً استان را وارد کنید' }]}
                            >
                                <Input prefix={<HomeOutlined />} placeholder="مثال: تهران" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="city"
                                label="شهر"
                                rules={[{ required: true, message: 'لطفاً شهر را وارد کنید' }]}
                            >
                                <Input prefix={<HomeOutlined />} placeholder="مثال: تهران" />
                            </Form.Item>
                        </Col>

                        {/* Financial Info */}
                        <Col span={24}>
                            <Divider orientation="left">اطلاعات مالی (جهت بازگشت وجه)</Divider>
                        </Col>
                        <Col xs={24} md={24}>
                            <Form.Item
                                name="shebaNumber"
                                label="شماره شبا"
                                rules={[{ required: true, message: 'لطفاً شماره شبا را وارد کنید' }, { validator: validateSheba }]}
                                extra="شماره شبا باید ۲۶ کاراکتر و با IR شروع شود"
                            >
                                <Input prefix={<BankOutlined />} placeholder="IR000000000000000000000000" style={{ fontFamily: 'monospace' }} dir="ltr" />
                            </Form.Item>
                        </Col>

                        {/* Legal Entity Section */}
                        {isLegal && (
                            <>
                                <Col span={24}>
                                    <Divider orientation="left" style={{ borderColor: '#1890ff', color: '#1890ff' }}>اطلاعات حقوقی سازمان / شرکت</Divider>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item
                                        name="companyName"
                                        label="نام سازمان / شرکت"
                                        rules={[{ required: true, message: 'نام شرکت الزامی است' }]}
                                    >
                                        <Input prefix={<BankOutlined />} placeholder="نام کامل ثبتی" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item
                                        name="companyNationalId"
                                        label="شناسه ملی"
                                        rules={[{ required: true, message: 'شناسه ملی الزامی است' }, { len: 11, message: 'شناسه ملی باید ۱۱ رقم باشد' }]}
                                    >
                                        <Input placeholder="۱۱ رقم" maxLength={11} />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item
                                        name="companyRegistrationId"
                                        label="شماره ثبت"
                                        rules={[{ required: true, message: 'شماره ثبت الزامی است' }]}
                                    >
                                        <Input placeholder="شماره ثبت شرکت" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item
                                        name="companyLandline"
                                        label="تلفن ثابت شرکت"
                                        rules={[{ required: true, message: 'تلفن ثابت شرکت الزامی است' }]}
                                    >
                                        <Input prefix={<PhoneOutlined />} placeholder="به همراه کد شهر" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item
                                        name="companyProvince"
                                        label="استان (دفتر مرکزی)"
                                        rules={[{ required: true, message: 'استان الزامی است' }]}
                                    >
                                        <Input placeholder="استان محل شرکت" />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} md={12}>
                                    <Form.Item
                                        name="companyCity"
                                        label="شهر (دفتر مرکزی)"
                                        rules={[{ required: true, message: 'شهر الزامی است' }]}
                                    >
                                        <Input placeholder="شهر محل شرکت" />
                                    </Form.Item>
                                </Col>
                            </>
                        )}

                        <Col span={24}>
                            <Divider />
                            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} block size="large">
                                ثبت و ذخیره اطلاعات
                            </Button>
                        </Col>
                    </Row>
                </Form>
            </Card>
        </div>
    )
}

export default UserProfilePage
