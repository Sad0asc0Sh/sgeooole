import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, Card, message } from 'antd'
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons'
import api from '../api'

function ResetPasswordPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const { token } = useParams()
  const navigate = useNavigate()

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const res = await api.put(`/auth/admin/reset-password/${token}`, {
        password: values.password,
      })

      message.success(
        res.data.message || 'رمز عبور با موفقیت تغییر کرد. اکنون می‌توانید وارد شوید.',
      )
      setResetSuccess(true)

      // بعد از 2 ثانیه به صفحه لاگین برود
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      const errorMsg =
        err?.response?.data?.message || 'خطا در بازنشانی رمز عبور'
      message.error(errorMsg)
      console.error('Reset password error:', err)
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
        {!resetSuccess ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: '#4f46e5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <LockOutlined style={{ fontSize: 40, color: 'white' }} />
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>
                بازنشانی رمز عبور
              </h1>
              <p style={{ color: '#666', fontSize: 14 }}>
                لطفاً رمز عبور جدید خود را وارد کنید
              </p>
            </div>

            <Form
              form={form}
              name="reset-password"
              onFinish={onFinish}
              layout="vertical"
              size="large"
              autoComplete="off"
            >
              <Form.Item
                name="password"
                label="رمز عبور جدید"
                rules={[
                  {
                    required: true,
                    message: 'لطفاً رمز عبور جدید را وارد کنید',
                  },
                  {
                    min: 6,
                    message: 'رمز عبور باید حداقل ۶ کاراکتر باشد',
                  },
                ]}
                hasFeedback
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="حداقل ۶ کاراکتر"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="تکرار رمز عبور جدید"
                dependencies={['password']}
                hasFeedback
                rules={[
                  {
                    required: true,
                    message: 'لطفاً رمز عبور را دوباره وارد کنید',
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve()
                      }
                      return Promise.reject(
                        new Error('رمز عبور و تکرار آن یکسان نیستند'),
                      )
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="تکرار رمز عبور"
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
                  تغییر رمز عبور
                </Button>
              </Form.Item>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Link
                  to="/login"
                  style={{
                    color: '#4f46e5',
                    textDecoration: 'none',
                  }}
                >
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
              <CheckCircleOutlined style={{ fontSize: 40, color: 'white' }} />
            </div>
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>
              رمز عبور تغییر کرد!
            </h2>
            <p style={{ color: '#666', marginBottom: 24 }}>
              رمز عبور شما با موفقیت تغییر کرد.
              <br />
              در حال انتقال به صفحه ورود...
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

export default ResetPasswordPage
