import PageHeader from '../../components/ui/PageHeader'
import { useEffect, useState } from 'react'
import { Card, Row, Col, message } from 'antd'
import ResponsiveTable from '../../components/ResponsiveTable'
import api from '../../api'

function ProductsReports() {
  const [topSelling, setTopSelling] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchReports = async () => {
    setLoading(true)
    try {
      const res = await api.get('/reports/products')
      const data = res?.data?.data || {}
      setTopSelling(Array.isArray(data.topSelling) ? data.topSelling : [])
      setLowStock(Array.isArray(data.lowStock) ? data.lowStock : [])
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'خطا در دریافت گزارش محصولات'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const topSellingColumns = [
    {
      title: 'نام محصول',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
    },
    {
      title: 'تعداد فروش',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
    },
  ]

  const lowStockColumns = [
    {
      title: 'نام محصول',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
    },
    {
      title: 'موجودی فعلی',
      dataIndex: 'stock',
      key: 'stock',
    },
  ]

  return (
    <div>
            <PageHeader title={"گزارش محصولات"} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="پرفروش‌ترین محصولات" loading={loading}>
            <ResponsiveTable
              columns={topSellingColumns}
              dataSource={topSelling}
              rowKey={(r) => r.productId || r.name}
              pagination={false}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="محصولات نیازمند شارژ موجودی" loading={loading}>
            <ResponsiveTable
              columns={lowStockColumns}
              dataSource={lowStock}
              rowKey={(r) => r.productId || r.name}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default ProductsReports

