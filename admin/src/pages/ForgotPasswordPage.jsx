import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Form, Input, Button, Card, message } from 'antd'
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons'
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
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background:
          'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #312e81 100%)',
        padding: '20px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 450,
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}
      >
        {!emailSent ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
                فراموشی رمز عبور
              </h1>
              <p style={{ color: '#666', fontSize: 14 }}>
                ایمیل خود را وارد کنید تا لینک بازنشانی رمز عبور برای شما ارسال شود
              </p>
            </div>

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
                  {
                    required: true,
                    message: 'لطفاً ایمیل خود را وارد کنید',
                  },
                  {
                    type: 'email',
                    message: 'فرمت ایمیل نامعتبر است',
                  },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="example@domain.com"
                  dir="ltr"
                  style={{ textAlign: 'left' }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 16 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  style={{
                    height: 45,
                    fontSize: 16,
                    fontWeight: 'bold',
                  }}
                >
                  ارسال لینک بازنشانی
                </Button>
              </Form.Item>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Link
                  to="/login"
                  style={{
                    color: '#4f46e5',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <ArrowLeftOutlined />
                  بازگشت به صفحه ورود
                </Link>
              </div>
            </Form>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: '#52c41a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <MailOutlined style={{ fontSize: 40, color: 'white' }} />
            </div>
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>ایمیل ارسال شد!</h2>
            <p style={{ color: '#666', marginBottom: 24 }}>
              لینک بازنشانی رمز عبور به ایمیل شما ارسال شد.
              <br />
              لطفاً صندوق ورودی خود را بررسی کنید.
            </p>
            <p style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>
              اگر ایمیل را دریافت نکردید، پوشه spam خود را نیز چک کنید.
            </p>
            <Link to="/login">
              <Button type="primary" size="large">
                بازگشت به صفحه ورود
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  )
}

export default ForgotPasswordPage
