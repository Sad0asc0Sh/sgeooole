import { useState, useEffect, useCallback } from 'react'
import { Form, Input, Button, message } from 'antd'
import { MailOutlined, ReloadOutlined, SafetyOutlined } from '@ant-design/icons'
import AuthShell from '../components/auth/AuthShell'
import api from '../api'
import { sanitizeCaptchaSvg } from '../utils/htmlSanitizer'

function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [captchaId, setCaptchaId] = useState('')
  const [captchaSvg, setCaptchaSvg] = useState('')
  const [captchaText, setCaptchaText] = useState('')

  const loadCaptcha = useCallback(async () => {
    try {
      const res = await api.get(`/auth/captcha?_t=${Date.now()}`)
      if (res.data?.success && res.data?.captchaId && res.data?.svg) {
        setCaptchaId(res.data.captchaId)
        setCaptchaSvg(sanitizeCaptchaSvg(res.data.svg))
        setCaptchaText('')
      }
    } catch (err) {
      console.error('Failed to load captcha:', err)
    }
  }, [])

  useEffect(() => {
    loadCaptcha()
  }, [loadCaptcha])

  const onFinish = async (values) => {
    if (!captchaId || captchaText.trim().length < 5) {
      message.error('لطفاً کد امنیتی ۵ رقمی را وارد کنید')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/admin/forgot-password', {
        email: values.email,
        captchaId,
        captchaText: captchaText.trim(),
      })

      message.success(
        res.data.message ||
          'ایمیل بازنشانی ارسال شد. لطفاً صندوق ورودی خود را چک کنید.',
      )
      setEmailSent(true)
    } catch (err) {
      const errorMsg =
        err?.response?.data?.message || 'خطا در ارسال ایمیل بازنشانی'
      message.error(errorMsg)
      console.error('Forgot password error:', err)
      loadCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="بازیابی رمز عبور"
      subtitle="ایمیل خود را وارد کنید تا لینک بازنشانی برایتان ارسال شود"
    >
      {emailSent ? (
        <div className="auth-sent">
          <span className="auth-sent-icon" aria-hidden="true">
            <MailOutlined />
          </span>
          <p className="auth-sent-title">ایمیل ارسال شد</p>
          <p className="auth-sent-body">
            لینک بازنشانی رمز عبور به ایمیل شما ارسال شد. لطفاً صندوق ورودی
            خود را بررسی کنید — اگر پیامی نرسید، پوشه هرزنامه ناخواسته را
            هم ببینید.
          </p>
        </div>
      ) : (
        <Form
          name="forgot-password"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          autoComplete="off"
        >
          <Form.Item
            name="email"
            label="ایمیل"
            rules={[
              { required: true, message: 'لطفاً ایمیل خود را وارد کنید' },
              { type: 'email', message: 'فرمت ایمیل نامعتبر است' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="you@example.com"
              dir="ltr"
              style={{ textAlign: 'left' }}
            />
          </Form.Item>

          <Form.Item label="کد امنیتی">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <div
                style={{
                  flex: 1,
                  height: 42,
                  border: '1px solid #d9d9d9',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fafafa',
                  overflow: 'hidden',
                }}
                dangerouslySetInnerHTML={{
                  __html: /<script|on[a-z]+\s*=|javascript:|<foreignObject/i.test(captchaSvg) ? '' : captchaSvg,
                }}
              />
              <Button icon={<ReloadOutlined />} onClick={loadCaptcha} title="کد جدید" />
            </div>
            <Input
              prefix={<SafetyOutlined />}
              placeholder="کد ۵ رقمی را وارد کنید"
              value={captchaText}
              onChange={(e) => setCaptchaText(e.target.value)}
              maxLength={6}
              dir="ltr"
              style={{ textAlign: 'center', letterSpacing: 4 }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 20 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              ارسال لینک بازنشانی
            </Button>
          </Form.Item>
        </Form>
      )}
    </AuthShell>
  )
}

export default ForgotPasswordPage
