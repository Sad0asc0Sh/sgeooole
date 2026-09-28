import { useState } from 'react'
import { Form, Input, Button, message } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import AuthShell from '../components/auth/AuthShell'
import api from '../api'

function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/admin/forgot-password', {
        email: values.email,
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
