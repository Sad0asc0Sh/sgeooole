import { Button } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import BackupSection from '../../components/settings/BackupSection'

export default function BackupPage() {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        title="بکاپ و بازیابی کامل"
        subtitle="تهیه نسخه پشتیبان یکپارچه از تمام محصولات، سفارش‌ها، کاربران، تنظیمات و ایندکس‌ها و بازیابی دقیق در هر زمان"
        actions={
          <Button icon={<ArrowRightOutlined />} onClick={() => navigate('/settings')}>
            بازگشت به تنظیمات
          </Button>
        }
      />
      <BackupSection />
    </div>
  )
}
