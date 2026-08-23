import { useEffect, useState } from 'react'
import { Card, message } from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
import api from '../../api'

function CustomersReports() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchReports = async () => {
    setLoading(true)
    try {
      const res = await api.get('/reports/customers')
      const list = res?.data?.data || []
      setData(Array.isArray(list) ? list : [])
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'خطا در دریافت گزارش مشتریان'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const columns = [
    {
      title: 'نام مشتری',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'ایمیل',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'تعداد سفارشات',
      dataIndex: 'ordersCount',
      key: 'ordersCount',
    },
    {
      title: 'مجموع خرید (تومان)',
      dataIndex: 'totalSpent',
      key: 'totalSpent',
      render: (val) =>
        new Intl.NumberFormat('fa-IR').format(val || 0),
    },
  ]

  return (
    <div>
      <h1>گزارش مشتریان</h1>
      <Card>
        <ResponsiveTable
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey={(r) => r.userId || r.email}
        />
      </Card>
    </div>
  )
}

export default CustomersReports

