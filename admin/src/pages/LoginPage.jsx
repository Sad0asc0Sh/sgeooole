import { useState } from 'react'
import { Form, Input, Button, Card, Alert } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../stores'
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card
        style={{ width: 400, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 'bold', color: '#1890ff', margin: 0 }}>
            ورود به پنل ادمین
          </h1>
          <p style={{ color: '#999', marginTop: 8 }}>لطفاً وارد حساب ادمین شوید</p>
        </div>

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
            rules={[{ required: true, message: 'ایمیل خود را وارد کنید!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="ایمیل" type="email" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'رمز عبور را وارد کنید!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="رمز عبور" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              ورود
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link
              to="/forgot-password"
              style={{
                color: '#1890ff',
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              رمز عبور خود را فراموش کرده‌اید؟
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default LoginPage
