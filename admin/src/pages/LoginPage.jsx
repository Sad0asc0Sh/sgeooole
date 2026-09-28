import { useState } from 'react'
import { Form, Input, Button, Alert } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores'
import AuthShell from '../components/auth/AuthShell'
import api from '../api'

function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const onFinish = async (values) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/admin/login', {
        email: values.email,
        password: values.password,
      })
      const user = res?.data?.data?.user
      const permissions = res?.data?.data?.permissions || []
      const token = res?.data?.accessToken || res?.data?.data?.token
      if (!user || !token) throw new Error('ورود ناموفق بود')
      setAuth(user, token, permissions)
      navigate('/')
    } catch (err) {
      console.error('Login error:', err)
      let msg = 'خطا در ورود به سیستم'

      if (err.response) {
        if (err.response.status === 401) {
          msg = 'ایمیل یا رمز عبور اشتباه است'
        } else if (err.response.data && err.response.data.message) {
          msg = err.response.data.message
        }
      } else if (err.message === 'Request failed with status code 401') {
        msg = 'ایمیل یا رمز عبور اشتباه است'
      } else if (err.message) {
        msg = err.message
      }

      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="ورود به پنل ادمین"
      subtitle="برای مدیریت فروشگاه، حساب ادمین خود را وارد کنید"
      footer={
        <Link to="/forgot-password">رمز عبور خود را فراموش کرده‌اید؟</Link>
      }
    >
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => setError('')}
        />
      )}

      <Form name="login" onFinish={onFinish} layout="vertical" size="large">
        <Form.Item
          name="email"
          label="ایمیل"
          rules={[{ required: true, message: 'ایمیل خود را وارد کنید!' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="you@example.com" type="email" autoComplete="username" />
        </Form.Item>

        <Form.Item
          name="password"
          label="رمز عبور"
          rules={[{ required: true, message: 'رمز عبور را وارد کنید!' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 20 }}>
          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            ورود
          </Button>
        </Form.Item>
      </Form>
    </AuthShell>
  )
}

export default LoginPage
