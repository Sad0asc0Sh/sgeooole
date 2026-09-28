import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Form, Input, Button, message } from 'antd'
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons'
import AuthShell from '../components/auth/AuthShell'
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
    <AuthShell
      title="بازنشانی رمز عبور"
      subtitle="رمز عبور جدید خود را انتخاب کنید"
    >
      {resetSuccess ? (
        <div className="auth-sent">
          <span className="auth-sent-icon auth-sent-icon-ok" aria-hidden="true">
            <CheckCircleOutlined />
          </span>
          <p className="auth-sent-title">رمز عبور تغییر کرد</p>
          <p className="auth-sent-body">
            در حال انتقال به صفحه ورود…
          </p>
        </div>
      ) : (
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
              { required: true, message: 'لطفاً رمز عبور جدید را وارد کنید' },
              { min: 6, message: 'رمز عبور باید حداقل ۶ کاراکتر باشد' },
            ]}
            hasFeedback
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="حداقل ۶ کاراکتر"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="تکرار رمز عبور جدید"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: 'لطفاً رمز عبور را دوباره وارد کنید' },
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
              autoComplete="new-password"
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
              تغییر رمز عبور
            </Button>
          </Form.Item>
        </Form>
      )}
    </AuthShell>
  )
}

export default ResetPasswordPage
