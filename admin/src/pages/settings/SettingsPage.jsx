import { useEffect, useState } from 'react'
import { Card, Form, Input, Tabs, Button, Space, message, InputNumber, Switch, Alert, Modal, Divider, Select, Slider, Statistic, Row, Col, Tag, Radio } from 'antd'
import { BellOutlined, RobotOutlined, LinkOutlined, SearchOutlined, ThunderboltOutlined, SwapOutlined } from '@ant-design/icons'
import api from '../../api'

function SettingsPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingWarnings, setSendingWarnings] = useState(false)
  const [previewExpiry, setPreviewExpiry] = useState(null)

  // محاسبه پیش‌نمایش زمان انقضا
  const calculateExpiryPreview = (hours) => {
    if (!hours) return null
    const now = new Date()
    const expiryDate = new Date(now.getTime() + hours * 60 * 60 * 1000)
    return expiryDate
  }

  // فرمت زمان به فارسی
  const formatExpiryTime = (date) => {
    if (!date) return ''
    const hours = Math.floor((date - new Date()) / (60 * 60 * 1000))
    const minutes = Math.floor(((date - new Date()) % (60 * 60 * 1000)) / (60 * 1000))

    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return `${days} روز${remainingHours > 0 ? ` و ${remainingHours} ساعت` : ''}`
    } else if (hours > 0) {
      return `${hours} ساعت${minutes > 0 ? ` و ${minutes} دقیقه` : ''}`
    } else {
      return `${minutes} دقیقه`
    }
  }

  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await api.get('/settings')
      const data = res?.data?.data || {}

      form.setFieldsValue({
        storeName: data.storeName || '',
        storeEmail: data.storeEmail || '',
        storePhone: data.storePhone || '',
        storeAddress: data.storeAddress || '',
        notificationSettings: {
          smsUsername: data.notificationSettings?.smsUsername || '',
          smsPassword: data.notificationSettings?.smsPassword || '',
          smsApiKey: data.notificationSettings?.smsApiKey || '',
          smsSenderNumber: data.notificationSettings?.smsSenderNumber || '',
          emailFrom: data.notificationSettings?.emailFrom || 'noreply@example.com',
        },
        cartSettings: {
          cartTTLHours: data.cartSettings?.cartTTLHours || 1,
          autoExpireEnabled: data.cartSettings?.autoExpireEnabled !== false,
          autoDeleteExpired: data.cartSettings?.autoDeleteExpired || false,
          permanentCart: data.cartSettings?.permanentCart || false,
          expiryWarningEnabled: data.cartSettings?.expiryWarningEnabled || false,
          expiryWarningMinutes: data.cartSettings?.expiryWarningMinutes || 30,
          notificationType: data.cartSettings?.notificationType || 'both',
        },
        kycSettings: {
          provider: data.kycSettings?.provider || 'mock',
          isActive: data.kycSettings?.isActive !== false,
          apiKey: data.kycSettings?.apiKey || '', // Usually empty/masked from server
          clientId: data.kycSettings?.clientId || '',
        },
        aiConfig: {
          enabled: data.aiConfig?.enabled || false,
          apiKey: data.aiConfig?.apiKey || '',
          groqModel: data.aiConfig?.groqModel || 'llama-3.3-70b-versatile',
          userDailyLimit: data.aiConfig?.userDailyLimit || 20,
          customSystemPrompt: data.aiConfig?.customSystemPrompt || '',
        },
        searchSettings: {
          trendingEnabled: data.searchSettings?.trendingEnabled || false,
          trendingLimit: data.searchSettings?.trendingLimit || 8,
          trendingPeriodDays: data.searchSettings?.trendingPeriodDays || 30,
          trackingEnabled: data.searchSettings?.trackingEnabled !== false,
        },
        popularCategoriesSettings: {
          trackingEnabled: data.popularCategoriesSettings?.trackingEnabled !== false,
          displayEnabled: data.popularCategoriesSettings?.displayEnabled || false,
          displayLimit: data.popularCategoriesSettings?.displayLimit || 8,
          periodDays: data.popularCategoriesSettings?.periodDays || 30,
          minViews: data.popularCategoriesSettings?.minViews || 5,
          minTotalViewsForActivation: data.popularCategoriesSettings?.minTotalViewsForActivation || 100,
          useFallback: data.popularCategoriesSettings?.useFallback !== false,
        },
        paymentConfig: {
          activeGateway: data.paymentConfig?.activeGateway || 'zarinpal',
          zarinpal: {
            merchantId: data.paymentConfig?.zarinpal?.merchantId || '',
            isSandbox: data.paymentConfig?.zarinpal?.isSandbox !== false,
            isActive: data.paymentConfig?.zarinpal?.isActive || false,
          },
          sadad: {
            merchantId: data.paymentConfig?.sadad?.merchantId || '',
            terminalId: data.paymentConfig?.sadad?.terminalId || '',
            terminalKey: data.paymentConfig?.sadad?.terminalKey || '',
            isSandbox: data.paymentConfig?.sadad?.isSandbox !== false,
            isActive: data.paymentConfig?.sadad?.isActive || false,
          },
        },
        socialLinks: {
          telegram: data.socialLinks?.telegram || '',
          instagram: data.socialLinks?.instagram || '',
          aparat: data.socialLinks?.aparat || '',
        },

      })
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'خطا در دریافت تنظیمات فروشگاه'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSendExpiryWarnings = async () => {
    Modal.confirm({
      title: 'ارسال هشدارهای انقضا',
      content:
        'آیا می‌خواهید هشدار انقضا را برای تمام سبدهای خریدی که نزدیک به انقضا هستند ارسال کنید؟',
      okText: 'ارسال',
      cancelText: 'لغو',
      onOk: async () => {
        try {
          setSendingWarnings(true)
          const res = await api.post('/carts/admin/send-warnings')
          const count = res?.data?.count || 0
          message.success(`هشدار انقضا برای ${count} سبد خرید ارسال شد`)
        } catch (err) {
          const errorMsg = err?.response?.data?.message || 'خطا در ارسال هشدارها'
          message.error(errorMsg)
        } finally {
          setSendingWarnings(false)
        }
      },
    })
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      const payload = {
        storeName: values.storeName || '',
        storeEmail: values.storeEmail || '',
        storePhone: values.storePhone || '',
        storeAddress: values.storeAddress || '',
      }

      if (values.notificationSettings) {
        const ns = {}

        if (
          Object.prototype.hasOwnProperty.call(
            values.notificationSettings,
            'emailFrom',
          )
        ) {
          ns.emailFrom = values.notificationSettings.emailFrom
        }

        // SMS Username
        if (
          values.notificationSettings.smsUsername !== undefined &&
          values.notificationSettings.smsUsername !== null &&
          values.notificationSettings.smsUsername !== '' &&
          values.notificationSettings.smsUsername !== '****'
        ) {
          ns.smsUsername = values.notificationSettings.smsUsername
        }

        // SMS Password
        if (
          values.notificationSettings.smsPassword !== undefined &&
          values.notificationSettings.smsPassword !== null &&
          values.notificationSettings.smsPassword !== '' &&
          values.notificationSettings.smsPassword !== '****'
        ) {
          ns.smsPassword = values.notificationSettings.smsPassword
        }

        // SMS API Key (optional - for future compatibility)
        if (
          values.notificationSettings.smsApiKey !== undefined &&
          values.notificationSettings.smsApiKey !== null &&
          values.notificationSettings.smsApiKey !== '' &&
          values.notificationSettings.smsApiKey !== '****'
        ) {
          ns.smsApiKey = values.notificationSettings.smsApiKey
        }

        // SMS Sender Number
        if (
          values.notificationSettings.smsSenderNumber !== undefined &&
          values.notificationSettings.smsSenderNumber !== null
        ) {
          ns.smsSenderNumber = values.notificationSettings.smsSenderNumber
        }

        if (Object.keys(ns).length > 0) {
          payload.notificationSettings = ns
        }
      }

      if (values.paymentConfig) {
        const pc = {
          activeGateway: values.paymentConfig.activeGateway || 'zarinpal'
        }

        // ZarinPal settings
        if (values.paymentConfig.zarinpal) {
          pc.zarinpal = {}

          if (values.paymentConfig.zarinpal.merchantId && values.paymentConfig.zarinpal.merchantId !== '****') {
            pc.zarinpal.merchantId = values.paymentConfig.zarinpal.merchantId
          }

          if (values.paymentConfig.zarinpal.isSandbox !== undefined) {
            pc.zarinpal.isSandbox = values.paymentConfig.zarinpal.isSandbox
          }

          if (values.paymentConfig.zarinpal.isActive !== undefined) {
            pc.zarinpal.isActive = values.paymentConfig.zarinpal.isActive
          }
        }

        // Sadad settings
        if (values.paymentConfig.sadad) {
          pc.sadad = {}

          if (values.paymentConfig.sadad.merchantId && values.paymentConfig.sadad.merchantId !== '****') {
            pc.sadad.merchantId = values.paymentConfig.sadad.merchantId
          }

          if (values.paymentConfig.sadad.terminalId && values.paymentConfig.sadad.terminalId !== '****') {
            pc.sadad.terminalId = values.paymentConfig.sadad.terminalId
          }

          if (values.paymentConfig.sadad.terminalKey && values.paymentConfig.sadad.terminalKey !== '****') {
            pc.sadad.terminalKey = values.paymentConfig.sadad.terminalKey
          }

          if (values.paymentConfig.sadad.isSandbox !== undefined) {
            pc.sadad.isSandbox = values.paymentConfig.sadad.isSandbox
          }

          if (values.paymentConfig.sadad.isActive !== undefined) {
            pc.sadad.isActive = values.paymentConfig.sadad.isActive
          }
        }

        payload.paymentConfig = pc
      }

      if (values.cartSettings) {
        const cs = {}

        if (values.cartSettings.cartTTLHours !== undefined) {
          cs.cartTTLHours = values.cartSettings.cartTTLHours
        }

        if (values.cartSettings.autoExpireEnabled !== undefined) {
          cs.autoExpireEnabled = values.cartSettings.autoExpireEnabled
        }

        if (values.cartSettings.autoDeleteExpired !== undefined) {
          cs.autoDeleteExpired = values.cartSettings.autoDeleteExpired
        }

        if (values.cartSettings.permanentCart !== undefined) {
          cs.permanentCart = values.cartSettings.permanentCart
        }

        if (values.cartSettings.expiryWarningEnabled !== undefined) {
          cs.expiryWarningEnabled = values.cartSettings.expiryWarningEnabled
        }

        if (values.cartSettings.expiryWarningMinutes !== undefined) {
          cs.expiryWarningMinutes = values.cartSettings.expiryWarningMinutes
        }

        if (values.cartSettings.notificationType !== undefined) {
          cs.notificationType = values.cartSettings.notificationType
        }

        if (Object.keys(cs).length > 0) {
          payload.cartSettings = cs
        }
      }

      if (values.kycSettings) {
        const kyc = { ...values.kycSettings }
        // Clean up empty strings for secrets to avoid overwriting with empty
        if (!kyc.apiKey) delete kyc.apiKey
        if (!kyc.clientId) delete kyc.clientId

        payload.kycSettings = kyc
      }

      if (values.aiConfig) {
        const ai = { ...values.aiConfig }
        if (!ai.apiKey) delete ai.apiKey
        payload.aiConfig = ai
      }

      if (values.searchSettings) {
        payload.searchSettings = { ...values.searchSettings }
      }

      if (values.popularCategoriesSettings) {
        payload.popularCategoriesSettings = { ...values.popularCategoriesSettings }
      }

      if (values.socialLinks) {
        payload.socialLinks = {
          telegram: values.socialLinks.telegram || '',
          instagram: values.socialLinks.instagram || '',
          aparat: values.socialLinks.aparat || '',
        }
      }

      setSaving(true)
      await api.put('/settings', payload)
      window.dispatchEvent(new Event('settings:updated'))
      message.success('تنظیمات با موفقیت ذخیره شد')
      fetchSettings()
    } catch (err) {
      if (err?.errorFields) {
        return
      }

      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'خطا در ذخیره تنظیمات فروشگاه'
      message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    {
      key: 'general',
      label: 'تنظیمات عمومی',
      children: (
        <>
          <Form.Item
            name="storeName"
            label="نام فروشگاه"
            rules={[
              {
                required: true,
                message: 'لطفاً نام فروشگاه را وارد کنید',
              },
            ]}
          >
            <Input placeholder="مثلاً: فروشگاه من" />
          </Form.Item>

          <Form.Item
            name="storeEmail"
            label="ایمیل فروشگاه"
            rules={[
              {
                type: 'email',
                message: 'ایمیل وارد شده معتبر نیست',
              },
            ]}
          >
            <Input placeholder="info@example.com" />
          </Form.Item>

          <Form.Item name="storePhone" label="شماره تماس فروشگاه">
            <Input placeholder="مثلاً: 0912..." />
          </Form.Item>

          <Form.Item name="storeAddress" label="آدرس فروشگاه">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Divider>🌐 لینک شبکه‌های اجتماعی</Divider>

          <Form.Item
            name={['socialLinks', 'telegram']}
            label="📱 تلگرام"
            extra="لینک کانال یا گروه تلگرام (مثلاً: https://t.me/yourstore)"
          >
            <Input placeholder="https://t.me/..." dir="ltr" />
          </Form.Item>

          <Form.Item
            name={['socialLinks', 'instagram']}
            label="📸 اینستاگرام"
            extra="لینک صفحه اینستاگرام (مثلاً: https://instagram.com/yourstore)"
          >
            <Input placeholder="https://instagram.com/..." dir="ltr" />
          </Form.Item>

          <Form.Item
            name={['socialLinks', 'aparat']}
            label="🎬 آپارات"
            extra="لینک کانال آپارات (مثلاً: https://aparat.com/yourstore)"
          >
            <Input placeholder="https://aparat.com/..." dir="ltr" />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'payment',
      label: '💳 درگاه‌های پرداخت',
      children: (
        <>
          <Alert
            message="✅ سیستم جدید درگاه‌های پرداخت چندگانه"
            description="پشتیبانی از ZarinPal و Sadad با امکان تعویض آسان بین درگاه‌ها"
            type="success"
            showIcon
            style={{ marginBottom: 24, backgroundColor: '#f6ffed', borderColor: '#52c41a' }}
          />

          {/* Active Gateway Selector */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.paymentConfig?.activeGateway !== curr.paymentConfig?.activeGateway}
          >
            {({ getFieldValue }) => {
              const activeGateway = getFieldValue(['paymentConfig', 'activeGateway']) || 'zarinpal'

              return (
                <Form.Item
                  name={['paymentConfig', 'activeGateway']}
                  label="🎯 انتخاب درگاه فعال"
                  extra="درگاهی که برای پرداخت‌های جدید استفاده می‌شود"
                >
                  <Select size="large">
                    <Select.Option value="zarinpal">
                      <span style={{ fontSize: '16px' }}>⚡ زرین‌پال (ZarinPal)</span>
                    </Select.Option>
                    <Select.Option value="sadad">
                      <span style={{ fontSize: '16px' }}>🏦 سداد (بانک ملی)</span>
                    </Select.Option>
                  </Select>
                </Form.Item>
              )
            }}
          </Form.Item>

          <Divider>تنظیمات ZarinPal</Divider>

          <Card
            title="⚡ زرین‌پال (ZarinPal)"
            style={{ marginBottom: 24 }}
            extra={
              <Form.Item
                name={['paymentConfig', 'zarinpal', 'isActive']}
                valuePropName="checked"
                style={{ margin: 0 }}
              >
                <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
              </Form.Item>
            }
          >
            <Form.Item
              name={['paymentConfig', 'zarinpal', 'merchantId']}
              label="Merchant ID (کد پذیرنده)"
              rules={[
                {
                  pattern: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
                  message: 'فرمت Merchant ID معتبر نیست (باید 36 کاراکتر UUID باشد)'
                }
              ]}
              extra={
                <div>
                  <div>فرمت: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</div>
                  <a href="https://panel.zarinpal.com" target="_blank" rel="noreferrer">
                    دریافت از پنل زرین‌پال →
                  </a>
                </div>
              }
            >
              <Input.Password
                placeholder="********-****-****-****-************"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name={['paymentConfig', 'zarinpal', 'isSandbox']}
              valuePropName="checked"
              extra="برای تست بدون پرداخت واقعی فعال کنید"
            >
              <Switch checkedChildren="🧪 Sandbox" unCheckedChildren="🔴 Production" />
            </Form.Item>
          </Card>

          <Divider>تنظیمات Sadad</Divider>

          <Card
            title="🏦 سداد (بانک ملی)"
            style={{ marginBottom: 24 }}
            extra={
              <Form.Item
                name={['paymentConfig', 'sadad', 'isActive']}
                valuePropName="checked"
                style={{ margin: 0 }}
              >
                <Switch checkedChildren="فعال" unCheckedChildren="غیرفعال" />
              </Form.Item>
            }
          >
            <Form.Item
              name={['paymentConfig', 'sadad', 'merchantId']}
              label="Merchant ID (کد پذیرنده)"
              extra="کد پذیرنده که از بانک ملی دریافت کرده‌اید"
            >
              <Input.Password
                placeholder="********"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name={['paymentConfig', 'sadad', 'terminalId']}
              label="Terminal ID (شناسه ترمینال)"
              extra="شناسه ترمینال از بانک ملی"
            >
              <Input.Password
                placeholder="********"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name={['paymentConfig', 'sadad', 'terminalKey']}
              label="Terminal Key (کلید ترمینال)"
              extra="کلید رمزنگاری ترمینال"
            >
              <Input.Password
                placeholder="********"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name={['paymentConfig', 'sadad', 'isSandbox']}
              valuePropName="checked"
              extra="برای تست بدون پرداخت واقعی فعال کنید"
            >
              <Switch checkedChildren="🧪 Sandbox" unCheckedChildren="🔴 Production" />
            </Form.Item>
          </Card>

          <Alert
            message="⚠️ نکات مهم"
            description={
              <ul style={{ margin: 0, paddingRight: 20 }}>
                <li>فقط یک درگاه می‌تواند به عنوان درگاه فعال انتخاب شود</li>
                <li>قبل از فعال‌سازی درگاه، حتماً اطلاعات آن را کامل کنید</li>
                <li>در حالت Sandbox می‌توانید بدون پرداخت واقعی تست کنید</li>
                <li>اطلاعات احراز هویت به صورت ایمن در دیتابیس ذخیره می‌شوند</li>
              </ul>
            }
            type="warning"
            showIcon
          />
        </>
      ),
    },
    {
      key: 'notifications',
      label: 'تنظیمات اعلان‌ها',
      children: (
        <>
          <Alert
            message="📱 تنظیمات سرویس پیامک (ملی‌پیامک)"
            description={
              <div>
                <p>برای ارسال پیامک OTP به کاربران، نیاز به اتصال به سرویس ملی‌پیامک دارید.</p>
                <ol style={{ marginRight: 20, marginTop: 10 }}>
                  <li>وارد پنل خود شوید: <a href="https://console.melipayamak.com" target="_blank" rel="noreferrer">console.melipayamak.com</a></li>
                  <li>نام کاربری و رمز عبور پنل خود را در فیلدهای زیر وارد کنید</li>
                  <li>شماره فرستنده (خط اختصاصی یا اشتراکی) را از پنل کپی کنید</li>
                </ol>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form.Item
            name={['notificationSettings', 'smsUsername']}
            label="نام کاربری پنل ملی‌پیامک"
            extra="نام کاربری (username) که با آن وارد پنل می‌شوید"
            rules={[
              {
                required: false,
                message: 'نام کاربری الزامی است'
              }
            ]}
          >
            <Input.Password
              placeholder="نام کاربری پنل (معمولاً شماره موبایل یا ایمیل)"
              dir="ltr"
              autoComplete="new-username"
            />
          </Form.Item>

          <Form.Item
            name={['notificationSettings', 'smsPassword']}
            label="رمز عبور پنل ملی‌پیامک"
            extra="رمز عبوری که برای ورود به پنل استفاده می‌کنید"
            rules={[
              {
                required: false,
                message: 'رمز عبور الزامی است'
              }
            ]}
          >
            <Input.Password
              placeholder="رمز عبور پنل"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name={['notificationSettings', 'smsApiKey']}
            label="توکن / API Key ملی‌پیامک (اختیاری)"
            extra="در برخی سرورها (Render/Railway خارج ایران) استفاده از توکن کنسول می‌تواند پایدارتر باشد. از کنسول ملی‌پیامک > API دریافت کنید."
            rules={[
              {
                required: false,
                message: 'توکن الزامی نیست'
              }
            ]}
          >
            <Input.Password
              placeholder="Console API Key"
              dir="ltr"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name={['notificationSettings', 'smsSenderNumber']}
            label="شماره فرستنده پیامک"
            extra="شماره اختصاصی یا اشتراکی که از پنل دریافت کرده‌اید (مثلاً 5000...، 3000... یا 10 رقمی)"
          >
            <Input placeholder="مثلاً: 50002710012443" dir="ltr" />
          </Form.Item>

          <Divider />

          <Form.Item
            name={['notificationSettings', 'emailFrom']}
            label="ایمیل فرستنده اعلان‌ها"
          >
            <Input placeholder="noreply@example.com" />
          </Form.Item>

          <Alert
            message="⚠️ نکته امنیتی"
            description="اطلاعات حساس شما (نام کاربری، رمز عبور) به صورت رمزنگاری شده در دیتابیس ذخیره می‌شوند و هیچ‌گاه در لاگ‌ها یا پاسخ‌های API نمایش داده نمی‌شوند."
            type="warning"
            showIcon
            style={{ marginTop: 24 }}
          />
        </>
      ),
    },
    {
      key: 'cart',
      label: 'تنظیمات سبد خرید',
      children: (
        <>
          <Alert
            message="تنظیمات مهلت سبد خرید"
            description="این تنظیمات تعیین می‌کند کاربران چقدر زمان دارند تا خریدشان را تکمیل کنند. پس از این مدت، سبدشان خالی می‌شود."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {/* پیش‌نمایش زنده */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) =>
              prev.cartSettings?.cartTTLHours !== curr.cartSettings?.cartTTLHours ||
              prev.cartSettings?.permanentCart !== curr.cartSettings?.permanentCart ||
              prev.cartSettings?.expiryWarningMinutes !== curr.cartSettings?.expiryWarningMinutes ||
              prev.cartSettings?.expiryWarningEnabled !== curr.cartSettings?.expiryWarningEnabled
            }
          >
            {({ getFieldValue }) => {
              const isPermanent = getFieldValue(['cartSettings', 'permanentCart'])
              const ttlHours = getFieldValue(['cartSettings', 'cartTTLHours']) || 1
              const warningMinutes = getFieldValue(['cartSettings', 'expiryWarningMinutes']) || 30
              const warningEnabled = getFieldValue(['cartSettings', 'expiryWarningEnabled'])

              if (isPermanent) {
                return (
                  <Alert
                    message="📌 حالت فعلی: سبد ماندگار"
                    description={
                      <div>
                        <strong>سناریو:</strong> کاربر الان محصولی به سبد اضافه می‌کند → سبد برای همیشه باقی می‌ماند (حتی تا 1 سال بعد!)
                        <br />
                        <strong>مناسب برای:</strong> سایت‌های B2B یا لیست خواسته‌های بلندمدت
                      </div>
                    }
                    type="success"
                    style={{ marginBottom: 24, backgroundColor: '#f6ffed' }}
                  />
                )
              }

              const expiryDate = calculateExpiryPreview(ttlHours)
              const expiryTimeText = formatExpiryTime(expiryDate)
              const warningDate = new Date(expiryDate.getTime() - warningMinutes * 60 * 1000)
              const warningTimeText = formatExpiryTime(warningDate)

              const now = new Date()
              const expiryTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
              const expiryFullTime = expiryDate.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
              const warningFullTime = warningDate.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })

              return (
                <Alert
                  message={`⏱️ پیش‌نمایش: چه اتفاقی می‌افتد؟`}
                  description={
                    <div style={{ lineHeight: '2' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: 8 }}>🎬 سناریو:</div>
                      <div>🕐 <strong>همین الان ({expiryTime}):</strong> کاربر محصولی به سبد اضافه می‌کند</div>

                      {warningEnabled && (
                        <div style={{ color: '#fa8c16', marginTop: 4 }}>
                          🔔 <strong>{warningFullTime} ({warningTimeText} دیگر):</strong> هشدار انقضا به ایمیل/پیامک کاربر ارسال می‌شود
                        </div>
                      )}

                      <div style={{ color: '#cf1322', marginTop: 4 }}>
                        ⏰ <strong>{expiryFullTime} ({expiryTimeText} دیگر):</strong> سبد خرید منقضی می‌شود و آیتم‌ها پاک می‌شوند
                      </div>

                      <Divider style={{ margin: '12px 0' }} />

                      <div style={{ fontSize: '12px', color: '#666' }}>
                        <strong>💡 نکته:</strong> اگر کاربر در این مدت محصول جدیدی اضافه کند یا تعداد را تغییر دهد، تایمر از اول شروع می‌شود.
                      </div>
                    </div>
                  }
                  type="warning"
                  style={{ marginBottom: 24, backgroundColor: '#fffbe6' }}
                />
              )
            }}
          </Form.Item>

          <Form.Item
            name={['cartSettings', 'permanentCart']}
            label="🔒 سبدهای خرید ماندگار (بدون محدودیت زمانی)"
            valuePropName="checked"
            extra={
              <div>
                <div>✅ فعال: سبد هیچ‌وقت پاک نمی‌شود (مثل لیست خواسته‌ها)</div>
                <div>❌ غیرفعال: سبد بعد از مدت تعیین شده پاک می‌شود</div>
              </div>
            }
            tooltip="مناسب برای فروشگاه‌های B2B که مشتریان زمان زیادی برای تصمیم‌گیری نیاز دارند"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.cartSettings?.permanentCart !== currentValues.cartSettings?.permanentCart
            }
          >
            {({ getFieldValue }) => {
              const isPermanent = getFieldValue(['cartSettings', 'permanentCart'])

              return (
                <>
                  <Form.Item
                    name={['cartSettings', 'cartTTLHours']}
                    label="⏰ مهلت سبد خرید (چقدر زمان به کاربر بدهیم؟)"
                    rules={[
                      {
                        required: !isPermanent,
                        message: 'لطفاً مدت زمان را وارد کنید',
                      },
                    ]}
                    extra={
                      <div>
                        <div><strong>مثال‌های رایج:</strong></div>
                        <div>⚡ 0.5 ساعت (30 دقیقه): برای محصولات محدود و پرفروش</div>
                        <div>⭐ 1-2 ساعت: حالت استاندارد (توصیه می‌شود)</div>
                        <div>📦 3-6 ساعت: برای خریدهای سنگین‌تر</div>
                        <div>🏢 24-72 ساعت: برای فروشگاه‌های B2B</div>
                      </div>
                    }
                    tooltip="این مدت از آخرین تغییر سبد (اضافه/حذف محصول) محاسبه می‌شود"
                  >
                    <InputNumber
                      min={0.5}
                      max={168}
                      step={0.5}
                      precision={1}
                      style={{ width: '100%' }}
                      placeholder="1"
                      disabled={isPermanent}
                      onChange={(value) => setPreviewExpiry(calculateExpiryPreview(value))}
                    />
                  </Form.Item>

                  <Form.Item
                    name={['cartSettings', 'autoExpireEnabled']}
                    label="فعال‌سازی انقضای خودکار"
                    valuePropName="checked"
                    extra="اگر فعال باشد، سبدهای خرید پس از مدت تعیین شده به صورت خودکار منقضی می‌شوند"
                  >
                    <Switch disabled={isPermanent} />
                  </Form.Item>

                  <Form.Item
                    name={['cartSettings', 'autoDeleteExpired']}
                    label="حذف خودکار سبدهای منقضی شده"
                    valuePropName="checked"
                    extra="اگر فعال باشد، سبدهای منقضی شده به طور خودکار از دیتابیس حذف می‌شوند (توصیه نمی‌شود)"
                  >
                    <Switch disabled={isPermanent} />
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>

          <Divider />

          <Alert
            message="هشدار انقضای سبد خرید"
            description="سیستم می‌تواند قبل از انقضای سبد، به کاربران هشدار بدهد تا آن‌ها فرصت تکمیل خرید داشته باشند."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.cartSettings?.permanentCart !== currentValues.cartSettings?.permanentCart
            }
          >
            {({ getFieldValue }) => {
              const isPermanent = getFieldValue(['cartSettings', 'permanentCart'])

              return (
                <>
                  <Form.Item
                    name={['cartSettings', 'expiryWarningEnabled']}
                    label="فعال‌سازی هشدار قبل از انقضا"
                    valuePropName="checked"
                    extra="اگر فعال باشد، سیستم قبل از انقضای سبد به کاربران ایمیل و پیامک هشدار می‌دهد"
                  >
                    <Switch disabled={isPermanent} />
                  </Form.Item>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) =>
                      prevValues.cartSettings?.expiryWarningEnabled !== currentValues.cartSettings?.expiryWarningEnabled
                    }
                  >
                    {({ getFieldValue: getFieldValue2 }) => {
                      const isWarningEnabled = getFieldValue2(['cartSettings', 'expiryWarningEnabled'])

                      return (
                        <>
                          <Form.Item
                            name={['cartSettings', 'expiryWarningMinutes']}
                            label="🔔 چه زمانی به کاربر هشدار بدهیم؟"
                            rules={[
                              {
                                required: isWarningEnabled && !isPermanent,
                                message: 'لطفاً زمان هشدار را وارد کنید',
                              },
                              ({ getFieldValue }) => ({
                                validator(_, value) {
                                  const ttlHours = getFieldValue(['cartSettings', 'cartTTLHours']) || 1
                                  const ttlMinutes = ttlHours * 60

                                  if (!value) return Promise.resolve()

                                  if (value >= ttlMinutes) {
                                    return Promise.reject(
                                      new Error(
                                        `زمان هشدار (${value} دقیقه) نمی‌تواند بیشتر از مهلت سبد (${ttlMinutes} دقیقه) باشد!`
                                      )
                                    )
                                  }

                                  if (value < 5) {
                                    return Promise.reject(new Error('حداقل 5 دقیقه قبل هشدار بدهید'))
                                  }

                                  return Promise.resolve()
                                },
                              }),
                            ]}
                            extra={
                              <div>
                                <div><strong>مثال:</strong> اگر سبد 1 ساعت (60 دقیقه) مهلت دارد:</div>
                                <div>• 15 دقیقه قبل: هشدار زودهنگام (45 دقیقه بعد از اضافه کردن)</div>
                                <div>• 30 دقیقه قبل: متعادل و توصیه شده ⭐</div>
                                <div>• 45 دقیقه قبل: هشدار دیرهنگام (فقط 15 دقیقه فرصت)</div>
                              </div>
                            }
                            tooltip="این هشدار به ایمیل و پیامک کاربر ارسال می‌شود تا فرصت تکمیل خرید داشته باشد"
                          >
                            <InputNumber
                              min={5}
                              max={120}
                              step={5}
                              style={{ width: '100%' }}
                              placeholder="30"
                              disabled={!isWarningEnabled || isPermanent}
                            />
                          </Form.Item>

                          <Form.Item
                            name={['cartSettings', 'notificationType']}
                            label="📧 نوع هشدار خودکار"
                            extra={
                              <div>
                                <div>انتخاب کنید که هشدار انقضای سبد از چه طریقی ارسال شود:</div>
                                <div>• فقط ایمیل: مناسب کاربران با ایمیل فعال</div>
                                <div>• فقط پیامک: مناسب کاربران ایرانی</div>
                                <div>• هم ایمیل و هم پیامک: اطمینان بیشتر ⭐</div>
                              </div>
                            }
                            tooltip="تعیین می‌کند هشدار به چه صورت ارسال شود"
                          >
                            <Select
                              disabled={!isWarningEnabled || isPermanent}
                              placeholder="انتخاب نوع هشدار"
                            >
                              <Select.Option value="email">📧 فقط ایمیل</Select.Option>
                              <Select.Option value="sms">📱 فقط پیامک</Select.Option>
                              <Select.Option value="both">📧📱 هم ایمیل و هم پیامک</Select.Option>
                            </Select>
                          </Form.Item>
                        </>
                      )
                    }}
                  </Form.Item>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) =>
                      prevValues.cartSettings?.expiryWarningEnabled !== currentValues.cartSettings?.expiryWarningEnabled
                    }
                  >
                    {({ getFieldValue: getFieldValue3 }) => {
                      const isWarningEnabled = getFieldValue3(['cartSettings', 'expiryWarningEnabled'])

                      if (!isWarningEnabled || isPermanent) return null

                      return (
                        <div style={{ marginBottom: 24 }}>
                          <Button
                            type="default"
                            icon={<BellOutlined />}
                            onClick={handleSendExpiryWarnings}
                            loading={sendingWarnings}
                            block
                          >
                            ارسال دستی هشدارهای انقضا (همین الان)
                          </Button>
                          <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
                            با کلیک بر روی این دکمه، هشدار انقضا برای تمام سبدهای نزدیک به انقضا ارسال می‌شود
                          </div>
                        </div>
                      )
                    }}
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>

          <Alert
            message="نکته مهم"
            description="توصیه می‌شود مدت زمان را بین 1 تا 3 ساعت تنظیم کنید. مدت بیش از حد کوتاه باعث نارضایتی کاربران و مدت بیش از حد طولانی باعث اشغال منابع سرور می‌شود."
            type="warning"
            showIcon
            style={{ marginTop: 24 }}
          />
        </>
      ),
    },



    {
      key: 'ai',
      label: (
        <span>
          <RobotOutlined /> دستیار هوشمند (ekgkala)
        </span>
      ),
      children: (
        <>
          <Alert
            message="🤖 تنظیمات دستیار فروش هوشمند"
            description="این بخش برای اتصال به هوش مصنوعی Groq جهت پاسخگویی به مشتریان استفاده می‌شود. شما می‌توانید بین مدل‌های زبانی مختلف سوییچ کنید."
            type="info"
            showIcon
            icon={<RobotOutlined />}
            style={{ marginBottom: 24 }}
          />

          <Form.Item
            name={['aiConfig', 'enabled']}
            label="فعال‌سازی دستیار"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name={['aiConfig', 'apiKey']}
            label="🔑 API Key (کلید Groq)"
            extra={<a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">دریافت کلید از console.groq.com →</a>}
          >
            <Input.Password placeholder="gsk_..." />
          </Form.Item>

          <Divider><SwapOutlined /> انتخاب مدل زبانی</Divider>

          <Form.Item
            name={['aiConfig', 'groqModel']}
            label="🧠 مدل زبانی فعال"
            extra="مدل زبانی که دستیار هوشمند از آن برای پاسخگویی استفاده می‌کند (هر دو مدل از Groq)"
          >
            <Radio.Group
              buttonStyle="solid"
              style={{ width: '100%' }}
            >
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {/* LLaMA 3.1 8B Model Card */}
                <Card
                  hoverable
                  style={{ flex: 1, minWidth: 250, cursor: 'pointer' }}
                >
                  <Radio value="llama-3.1-8b-instant" style={{ width: '100%' }}>
                    <div style={{ paddingRight: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>⚡</span>
                        <strong style={{ fontSize: 16 }}>LLaMA 3.1 8B</strong>
                        <Tag color="green">Instant</Tag>
                      </div>
                      <div style={{ color: '#666', fontSize: 13, lineHeight: 1.8 }}>
                        <div>🏢 سازنده: Meta</div>
                        <div>📊 اندازه: 8 میلیارد پارامتر</div>
                        <div>⚡ سرعت: بسیار بالا (ارزان)</div>
                        <div>💡 مناسب: سوالات ساده، پاسخ‌های سریع</div>
                      </div>
                    </div>
                  </Radio>
                </Card>

                {/* LLaMA 3.3 70B Model Card */}
                <Card
                  hoverable
                  style={{ flex: 1, minWidth: 250, cursor: 'pointer' }}
                >
                  <Radio value="llama-3.3-70b-versatile" style={{ width: '100%' }}>
                    <div style={{ paddingRight: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>🦙</span>
                        <strong style={{ fontSize: 16 }}>LLaMA 3.3 70B</strong>
                        <Tag color="blue">Versatile</Tag>
                        <Tag color="gold" style={{ marginRight: 'auto' }}>P</Tag>
                      </div>
                      <div style={{ color: '#666', fontSize: 13, lineHeight: 1.8 }}>
                        <div>🏢 سازنده: Meta</div>
                        <div>📊 اندازه: 70 میلیارد پارامتر</div>
                        <div>⚡ سرعت: بالا</div>
                        <div>💡 مناسب: تعادل عالی بین سرعت و هوش</div>
                      </div>
                    </div>
                  </Radio>
                </Card>

                {/* GPT OSS 120B Model Card */}
                <Card
                  hoverable
                  style={{ flex: 1, minWidth: 250, cursor: 'pointer' }}
                >
                  <Radio value="openai/gpt-oss-120b" style={{ width: '100%' }}>
                    <div style={{ paddingRight: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>🧠</span>
                        <strong style={{ fontSize: 16 }}>GPT OSS 120B</strong>
                        <Tag color="purple">Premium</Tag>
                      </div>
                      <div style={{ color: '#666', fontSize: 13, lineHeight: 1.8 }}>
                        <div>🏢 سازنده: OpenAI (on Groq)</div>
                        <div>📊 اندازه: 120 میلیارد پارامتر</div>
                        <div>⚡ سرعت: متوسط</div>
                        <div>💡 مناسب: استدلال پیچیده و دقیق</div>
                      </div>
                    </div>
                  </Radio>
                </Card>
              </div>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.aiConfig?.groqModel !== curr.aiConfig?.groqModel}
          >
            {({ getFieldValue }) => {
              const selectedModel = getFieldValue(['aiConfig', 'groqModel']) || 'llama-3.3-70b-versatile'

              let alertConfig = {
                message: '🦙 مدل فعال: LLaMA 3.3 70B Versatile',
                description: 'مدل استاندارد و قدرتمند با تعادل عالی بین سرعت و هوش.',
                type: 'info',
                icon: <RobotOutlined />
              }

              if (selectedModel === 'llama-3.1-8b-instant') {
                alertConfig = {
                  message: '⚡ مدل فعال: LLaMA 3.1 8B Instant',
                  description: 'مدل سبک و فوق‌سریع. مناسب برای سوالات ساده و کاهش هزینه.',
                  type: 'success',
                  icon: <ThunderboltOutlined />
                }
              } else if (selectedModel === 'openai/gpt-oss-120b') {
                alertConfig = {
                  message: '🧠 مدل فعال: GPT OSS 120B',
                  description: 'مدل قدرتمند با توانایی استدلال بالا. مناسب برای سوالات پیچیده.',
                  type: 'warning', // Purple-ish usually isn't standard, using warning for highlighting
                  icon: <SearchOutlined />
                }
              }

              return (
                <Alert
                  message={alertConfig.message}
                  description={alertConfig.description}
                  type={alertConfig.type}
                  showIcon
                  icon={alertConfig.icon}
                  style={{ marginBottom: 24 }}
                />
              )
            }}
          </Form.Item>

          <Divider>⚙️ تنظیمات پیشرفته</Divider>

          <Form.Item
            name={['aiConfig', 'userDailyLimit']}
            label="📨 محدودیت پیام روزانه کاربر"
            extra="تعداد پیام‌هایی که هر کاربر می‌تواند در روز ارسال کند."
          >
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name={['aiConfig', 'customSystemPrompt']}
            label="📝 دستورالعمل سیستم (System Prompt)"
            extra="شخصیت و رفتار هوش مصنوعی را اینجا تعریف کنید. این متن به عنوان دستور اصلی به مدل ارسال می‌شود."
          >
            <Input.TextArea rows={10} placeholder="شما مشاور فروش حرفه‌ای فروشگاه ای‌کا‌جی کالا هستید..." />
          </Form.Item>

          <Alert
            message="⚠️ نکات مهم"
            description={
              <ul style={{ margin: 0, paddingRight: 20 }}>
                <li>هر دو مدل از سرویس Groq استفاده می‌کنند و نیاز به یک API Key دارند</li>
                <li>API Key را از <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com</a> دریافت کنید</li>
                <li>تغییر مدل بلافاصله اعمال می‌شود (پس از ذخیره تنظیمات)</li>
                <li>مدل بزرگ‌تر (120B) ممکن است زمان پاسخ‌دهی بیشتری داشته باشد</li>
              </ul>
            }
            type="warning"
            showIcon
          />
        </>
      )
    },
    {
      key: 'search',
      label: (
        <span>
          <SearchOutlined /> تنظیمات محبوب‌ترین ها
        </span>
      ),
      children: (
        <>
          <Alert
            message="🔍 مدیریت جستجوهای محبوب"
            description={
              <div>
                این بخش امکان نمایش محبوب‌ترین جستجوهای کاربران را در صفحه جستجو فعال می‌کند.
                <br />
                سیستم به صورت خودکار جستجوهای کاربران را ثبت و تحلیل می‌کند تا محبوب‌ترین‌ها را نمایش دهد.
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          {/* آمار جستجوها */}
          <Card
            title="📊 آمار کلی جستجوها"
            style={{ marginBottom: 24 }}
          >
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="کل جستجوهای ثبت شده"
                  value={0}
                  suffix="جستجو"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="جستجوهای 7 روز اخیر"
                  value={0}
                  suffix="جستجو"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="جستجوهای امروز"
                  value={0}
                  suffix="جستجو"
                />
              </Col>
            </Row>
            <Alert
              message="💡 نکته"
              description="برای نمایش آمار واقعی، لطفاً ابتدا قابلیت ردیابی جستجو را فعال کنید."
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          </Card>

          {/* تنظیمات اصلی */}
          <Form.Item
            name={['searchSettings', 'trackingEnabled']}
            label="🎯 ردیابی جستجوهای کاربران"
            valuePropName="checked"
            extra="اگر فعال باشد، تمام جستجوهای کاربران برای آنالیز و نمایش محبوب‌ترین‌ها ثبت می‌شوند"
            tooltip="این ویژگی هیچ تأثیری بر حریم خصوصی ندارد و فقط عبارات جستجو را ذخیره می‌کند"
          >
            <Switch />
          </Form.Item>

          <Divider />

          <Form.Item
            name={['searchSettings', 'trendingEnabled']}
            label="⭐ نمایش محبوب‌ترین جستجوها"
            valuePropName="checked"
            extra="نمایش محبوب‌ترین جستجوها در صفحه جستجو (فقط زمانی فعال کنید که داده کافی دارید)"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) =>
              prev.searchSettings?.trendingEnabled !== curr.searchSettings?.trendingEnabled ||
              prev.searchSettings?.trackingEnabled !== curr.searchSettings?.trackingEnabled
            }
          >
            {({ getFieldValue }) => {
              const trendingEnabled = getFieldValue(['searchSettings', 'trendingEnabled'])
              const trackingEnabled = getFieldValue(['searchSettings', 'trackingEnabled'])

              if (!trackingEnabled) {
                return (
                  <Alert
                    message="⚠️ ردیابی غیرفعال است"
                    description="برای استفاده از قابلیت محبوب‌ترین جستجوها، ابتدا باید ردیابی جستجو را فعال کنید."
                    type="error"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />
                )
              }

              if (!trendingEnabled) {
                return (
                  <Alert
                    message="✅ آماده فعال‌سازی"
                    description={
                      <div>
                        <div>سیستم در حال جمع‌آوری داده‌های جستجو است.</div>
                        <div style={{ marginTop: 8 }}>
                          <strong>توصیه:</strong> قبل از فعال‌سازی محبوب‌ترین‌ها:
                        </div>
                        <ul style={{ margin: '8px 0', paddingRight: 20 }}>
                          <li>حداقل 100+ کاربر فعال داشته باشید</li>
                          <li>حداقل 500+ جستجو ثبت شده باشد</li>
                          <li>2-4 هفته داده جمع‌آوری کرده باشید</li>
                        </ul>
                      </div>
                    }
                    type="success"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />
                )
              }

              return (
                <>
                  <Alert
                    message="🎉 محبوب‌ترین جستجوها فعال است"
                    description="کاربران اکنون محبوب‌ترین جستجوها را در صفحه جستجو مشاهده می‌کنند."
                    type="success"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />

                  <Form.Item
                    name={['searchSettings', 'trendingLimit']}
                    label="تعداد جستجوهای محبوب نمایشی"
                    extra="حداکثر تعداد جستجوهای محبوبی که به کاربران نمایش داده می‌شود"
                    rules={[
                      { required: true, message: 'این فیلد الزامی است' },
                      { type: 'number', min: 3, max: 20, message: 'باید بین 3 تا 20 باشد' }
                    ]}
                  >
                    <Slider min={3} max={20} marks={{ 3: '3', 8: '8 (پیشنهادی)', 15: '15', 20: '20' }} />
                  </Form.Item>

                  <Form.Item
                    name={['searchSettings', 'trendingPeriodDays']}
                    label="بازه زمانی محاسبه محبوبیت (روز)"
                    extra="جستجوهای این تعداد روز اخیر برای محاسبه محبوب‌ترین‌ها در نظر گرفته می‌شوند"
                    rules={[
                      { required: true, message: 'این فیلد الزامی است' },
                      { type: 'number', min: 1, max: 90, message: 'باید بین 1 تا 90 روز باشد' }
                    ]}
                  >
                    <Slider
                      min={1}
                      max={90}
                      marks={{
                        7: '7 روز',
                        14: '14 روز',
                        30: '30 روز (پیشنهادی)',
                        60: '60 روز',
                        90: '90 روز'
                      }}
                    />
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>

          <Divider />

          <Alert
            message="🛠️ نکات فنی"
            description={
              <ul style={{ margin: 0, paddingRight: 20 }}>
                <li>جستجوها در MongoDB collection به نام <code>search_history</code> ذخیره می‌شوند</li>
                <li>برای بهینه‌سازی سرعت، از Index استفاده کنید</li>
                <li>محبوب‌ترین‌ها هر 30 دقیقه به صورت خودکار cache می‌شوند</li>
                <li>می‌توانید جستجوهای قدیمی‌تر از 90 روز را پاک کنید</li>
              </ul>
            }
            type="info"
            showIcon
          />

          <Divider orientation="left">🏷️ تنظیمات دسته‌بندی‌های محبوب</Divider>

          <Alert
            message="📊 مدیریت دسته‌بندی‌های محبوب"
            description={
              <div>
                این بخش امکان جمع‌آوری داده از بازدید دسته‌بندی‌ها توسط کاربران را فراهم می‌کند.
                <br />
                پس از جمع‌آوری داده کافی، می‌توانید نمایش دسته‌بندی‌های محبوب را بر اساس آمار واقعی فعال کنید.
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form.Item
            name={['popularCategoriesSettings', 'trackingEnabled']}
            label="🎯 ردیابی بازدید دسته‌بندی‌ها"
            valuePropName="checked"
            extra="اگر فعال باشد، بازدید کاربران از دسته‌بندی‌ها برای تحلیل محبوبیت ثبت می‌شود"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name={['popularCategoriesSettings', 'useFallback']}
            label="🔄 استفاده از Fallback (دسته‌بندی‌های دستی)"
            valuePropName="checked"
            extra="اگر فعال باشد، تا زمانی که داده کافی جمع نشده، از دسته‌بندی‌های «محبوب» که به صورت دستی مشخص شده‌اند استفاده می‌شود"
          >
            <Switch />
          </Form.Item>

          <Divider />

          <Form.Item
            name={['popularCategoriesSettings', 'displayEnabled']}
            label="⭐ نمایش دسته‌بندی‌های محبوب (بر اساس آمار واقعی)"
            valuePropName="checked"
            extra="فقط زمانی فعال کنید که داده کافی از بازدید کاربران جمع‌آوری شده باشد"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) =>
              prev.popularCategoriesSettings?.displayEnabled !== curr.popularCategoriesSettings?.displayEnabled ||
              prev.popularCategoriesSettings?.trackingEnabled !== curr.popularCategoriesSettings?.trackingEnabled
            }
          >
            {({ getFieldValue }) => {
              const displayEnabled = getFieldValue(['popularCategoriesSettings', 'displayEnabled'])
              const trackingEnabled = getFieldValue(['popularCategoriesSettings', 'trackingEnabled'])

              if (!trackingEnabled) {
                return (
                  <Alert
                    message="⚠️ ردیابی غیرفعال است"
                    description="برای استفاده از دسته‌بندی‌های محبوب واقعی، ابتدا باید ردیابی بازدید را فعال کنید."
                    type="error"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />
                )
              }

              if (!displayEnabled) {
                return (
                  <Alert
                    message="✅ در حال جمع‌آوری داده"
                    description={
                      <div>
                        <div>سیستم در حال جمع‌آوری داده‌های بازدید دسته‌بندی‌ها است.</div>
                        <div style={{ marginTop: 8 }}>
                          <strong>توصیه:</strong> قبل از فعال‌سازی نمایش واقعی:
                        </div>
                        <ul style={{ margin: '8px 0', paddingRight: 20 }}>
                          <li>حداقل 100+ بازدید دسته‌بندی ثبت شده باشد</li>
                          <li>حداقل 50+ کاربر فعال داشته باشید</li>
                          <li>2-4 هفته داده جمع‌آوری کرده باشید</li>
                        </ul>
                        <div style={{ marginTop: 8, color: '#52c41a' }}>
                          💡 تا آن زمان، از دسته‌بندی‌های «محبوب» که به صورت دستی تعیین کرده‌اید استفاده می‌شود.
                        </div>
                      </div>
                    }
                    type="success"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />
                )
              }

              return (
                <>
                  <Alert
                    message="🎉 نمایش آمار واقعی فعال است"
                    description="کاربران اکنون دسته‌بندی‌های محبوب را بر اساس آمار واقعی بازدیدها مشاهده می‌کنند."
                    type="success"
                    showIcon
                    style={{ marginBottom: 24 }}
                  />

                  <Form.Item
                    name={['popularCategoriesSettings', 'displayLimit']}
                    label="تعداد دسته‌بندی‌های محبوب نمایشی"
                    extra="حداکثر تعداد دسته‌بندی‌های محبوبی که به کاربران نمایش داده می‌شود"
                    rules={[
                      { required: true, message: 'این فیلد الزامی است' },
                      { type: 'number', min: 3, max: 20, message: 'باید بین 3 تا 20 باشد' }
                    ]}
                  >
                    <Slider min={3} max={20} marks={{ 3: '3', 8: '8 (پیشنهادی)', 15: '15', 20: '20' }} />
                  </Form.Item>

                  <Form.Item
                    name={['popularCategoriesSettings', 'periodDays']}
                    label="بازه زمانی محاسبه محبوبیت (روز)"
                    extra="بازدیدهای این تعداد روز اخیر برای محاسبه محبوب‌ترین‌ها در نظر گرفته می‌شوند"
                    rules={[
                      { required: true, message: 'این فیلد الزامی است' },
                      { type: 'number', min: 1, max: 90, message: 'باید بین 1 تا 90 روز باشد' }
                    ]}
                  >
                    <Slider
                      min={1}
                      max={90}
                      marks={{
                        7: '7 روز',
                        14: '14 روز',
                        30: '30 روز (پیشنهادی)',
                        60: '60 روز',
                        90: '90 روز'
                      }}
                    />
                  </Form.Item>

                  <Form.Item
                    name={['popularCategoriesSettings', 'minViews']}
                    label="حداقل تعداد بازدید برای محتسب شدن"
                    extra="دسته‌بندی باید حداقل این تعداد بازدید داشته باشد تا محبوب محسوب شود"
                    rules={[
                      { required: true, message: 'این فیلد الزامی است' },
                      { type: 'number', min: 1, max: 100, message: 'باید بین 1 تا 100 باشد' }
                    ]}
                  >
                    <Slider min={1} max={100} marks={{ 1: '1', 5: '5 (پیشنهادی)', 20: '20', 50: '50', 100: '100' }} />
                  </Form.Item>

                  <Form.Item
                    name={['popularCategoriesSettings', 'minTotalViewsForActivation']}
                    label="حداقل کل بازدیدها برای فعال‌سازی"
                    extra="حداقل تعداد کل بازدیدهای ثبت شده برای نمایش آمار واقعی"
                  >
                    <InputNumber min={10} max={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>
        </>
      )
    },
    {
      key: 'kyc',
      label: 'احراز هویت (ثبت احوال)',
      children: (
        <>
          <Alert
            message="تنظیمات احراز هویت (شاهکار)"
            description={
              <div>
                این بخش برای بررسی تطابق <strong>کد ملی</strong> و <strong>تاریخ تولد</strong> کاربران استفاده می‌شود.
                <br />
                برای استفاده از این قابلیت به صورت واقعی، باید از شرکت‌های واسط (مانند فینوتک) سرویس خریداری کنید.
                <br />
                <strong>نکته:</strong> حالت "تستی (Mock)" رایگان است و فقط صحت الگوریتم کد ملی را بررسی می‌کند.
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form.Item
            name={['kycSettings', 'isActive']}
            label="فعال‌سازی احراز هویت"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.kycSettings?.isActive !== curr.kycSettings?.isActive}
          >
            {({ getFieldValue }) => {
              const isActive = getFieldValue(['kycSettings', 'isActive'])
              if (!isActive) return null

              return (
                <>
                  <Form.Item
                    name={['kycSettings', 'provider']}
                    label="انتخاب سرویس‌دهنده"
                    rules={[{ required: true, message: 'لطفاً سرویس‌دهنده را انتخاب کنید' }]}
                  >
                    <Select>
                      <Select.Option value="mock">تستی (Mock) - رایگان</Select.Option>
                      <Select.Option value="finnotech">فینوتک (Finnotech)</Select.Option>
                      <Select.Option value="jibit">جیبیت (Jibit) - به زودی</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, curr) => prev.kycSettings?.provider !== curr.kycSettings?.provider}
                  >
                    {({ getFieldValue }) => {
                      const provider = getFieldValue(['kycSettings', 'provider'])

                      if (provider === 'mock') {
                        return (
                          <Alert
                            message="حالت تستی فعال است"
                            description="در این حالت، سیستم فقط ساختار ریاضی کد ملی را بررسی می‌کند و استعلام واقعی انجام نمی‌شود."
                            type="success"
                            showIcon
                            style={{ marginBottom: 24 }}
                          />
                        )
                      }

                      return (
                        <div style={{ border: '1px solid #f0f0f0', padding: 16, borderRadius: 8, marginBottom: 24 }}>
                          <div style={{ marginBottom: 16, fontWeight: 'bold', color: '#1890ff' }}>
                            تنظیمات اتصال به {provider === 'finnotech' ? 'فینوتک' : 'سرویس'}
                          </div>

                          <Form.Item
                            name={['kycSettings', 'apiKey']}
                            label="API Key (کلید دسترسی)"
                            rules={[{ required: true, message: 'وارد کردن کلید دسترسی الزامی است' }]}
                            extra="این کلید را از پنل کاربری سرویس‌دهنده دریافت کنید"
                          >
                            <Input.Password placeholder="********" />
                          </Form.Item>

                          {provider === 'finnotech' && (
                            <Form.Item
                              name={['kycSettings', 'clientId']}
                              label="Client ID (شناسه کلاینت)"
                              rules={[{ required: true, message: 'وارد کردن شناسه کلاینت الزامی است' }]}
                            >
                              <Input.Password placeholder="********" />
                            </Form.Item>
                          )}
                        </div>
                      )
                    }}
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>
        </>
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
        <h1>تنظیمات فروشگاه</h1>
        <Space>
          <Button onClick={fetchSettings} disabled={loading || saving}>
            بارگذاری مجدد تنظیمات
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={saving}
            disabled={loading}
          >
            ذخیره تغییرات
          </Button>
        </Space>
      </div>

      <Card loading={loading}>
        <Form form={form} layout="vertical">
          <Tabs defaultActiveKey="general" items={tabs} />
        </Form>
      </Card>
    </div>
  )
}

export default SettingsPage
