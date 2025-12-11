import { useState, useEffect } from 'react'
import { Layout, Menu, Badge, Dropdown, Avatar, Button, Drawer } from 'antd'
import { Link, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  GiftOutlined,
  FileTextOutlined,
  CustomerServiceOutlined,
  SettingOutlined,
  BarChartOutlined,
  TeamOutlined,
  BellOutlined,
  LogoutOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import {
  useAuthStore,
  useNotificationStore,
} from '../../stores'
import ProfileModal from './ProfileModal'
import './MainLayout.css'

const { Header, Sider, Content } = Layout

function MainLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { notifications, markAllAsRead, deleteNotification } = useNotificationStore()

  const unreadCount = notifications.filter((n) => !n.read).length
  const role = user?.role || 'user'
  const isManagerOrSuperAdmin = role === 'manager' || role === 'superadmin'
  const isSuperAdmin = role === 'superadmin'

  // Build menu items based on user role
  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">داشبورد</Link>,
    },
    {
      key: '/products',
      icon: <ShoppingOutlined />,
      label: 'محصولات',
      children: [
        { key: '/products', label: <Link to="/products">لیست محصولات</Link> },
        {
          key: '/products/new',
          label: <Link to="/products/new">افزودن محصول جدید</Link>,
        },
        {
          key: '/categories',
          label: <Link to="/categories">دسته‌بندی‌ها</Link>,
        },
        {
          key: '/brands',
          label: <Link to="/brands">برندها</Link>,
        },
        {
          key: '/inventory',
          label: <Link to="/inventory">مدیریت موجودی</Link>,
        },
        {
          key: '/reviews',
          label: <Link to="/reviews">مدیریت نظرات</Link>,
        },
      ],
    },
    {
      key: '/orders',
      icon: <ShoppingCartOutlined />,
      label: 'سفارشات',
      children: [
        {
          key: '/orders',
          label: <Link to="/orders">لیست سفارشات</Link>,
        },
        {
          key: '/rma',
          label: <Link to="/rma">مرجوعی‌ها (RMA)</Link>,
        },
        {
          key: '/abandoned-carts',
          label: <Link to="/abandoned-carts">سبدهای رها شده</Link>,
        },
      ],
    },
    {
      key: '/customers',
      icon: <UserOutlined />,
      label: 'مشتریان',
      children: [
        {
          key: '/customers-list',
          label: <Link to="/customers">لیست مشتریان</Link>,
        },
      ],
    },
    {
      key: '/finance',
      icon: <GiftOutlined />,
      label: 'مالی و تخفیف',
      children: [
        {
          key: '/coupons',
          label: <Link to="/coupons">کدهای تخفیف</Link>,
        },
        {
          key: '/sales',
          label: <Link to="/sales">تخفیف‌های زمان‌دار</Link>,
        },
        {
          key: '/shipping',
          label: <Link to="/shipping">تنظیمات ارسال</Link>,
        },
      ],
    },
    {
      key: '/content',
      icon: <FileTextOutlined />,
      label: 'محتوا و سئو',
      children: [
        {
          key: '/pages',
          label: <Link to="/pages">مدیریت صفحات</Link>,
        },
        {
          key: '/blog/posts',
          label: <Link to="/blog/posts">مقالات وبلاگ</Link>,
        },
        {
          key: '/banners',
          label: <Link to="/banners">بنرها</Link>,
        },
        {
          key: '/announcements',
          label: <Link to="/announcements">اعلانات سایت</Link>,
        },
      ],
    },
    {
      key: '/tickets',
      icon: <CustomerServiceOutlined />,
      label: <Link to="/tickets">پشتیبانی (تیکت‌ها)</Link>,
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: 'گزارشات',
      children: [
        {
          key: '/reports/sales',
          label: <Link to="/reports/sales">گزارش فروش</Link>,
        },
        {
          key: '/reports/products',
          label: <Link to="/reports/products">گزارش محصولات</Link>,
        },
        {
          key: '/reports/customers',
          label: <Link to="/reports/customers">گزارش مشتریان</Link>,
        },
        {
          key: '/reports/audit-logs',
          label: <Link to="/reports/audit-logs">گزارش عملکرد سیستم</Link>,
        },
      ],
    },
    // Settings - Only for manager and superadmin
    ...(isManagerOrSuperAdmin
      ? [
        {
          key: '/settings',
          icon: <SettingOutlined />,
          label: <Link to="/settings">تنظیمات</Link>,
        },
      ]
      : []),
    // Admins Management - Only for superadmin
    ...(isSuperAdmin
      ? [
        {
          key: '/admins',
          icon: <TeamOutlined />,
          label: <Link to="/admins">مدیریت ادمین‌ها</Link>,
        },
      ]
      : []),
  ]

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return ''

    const diffMs = Date.now() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'چند لحظه پیش'

    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin} دقیقه پیش`

    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour} ساعت پیش`

    const diffDay = Math.floor(diffHour / 24)
    return `${diffDay} روز پیش`
  }

  const notificationMenu = {
    items: notifications
      .map((n) => ({
        key: n.id,
        label: (
          <div
            style={{
              width: 260,
              padding: '8px 0',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Link
              to={n.link || '/orders'}
              style={{ color: 'inherit', textDecoration: 'none', flex: 1 }}
            >
              <div>
                <div style={{ fontWeight: n.read ? 'normal' : 'bold' }}>
                  {n.title}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>{n.message}</div>
                <div
                  style={{ fontSize: 11, color: '#999', marginTop: 4 }}
                >
                  {formatRelativeTime(n.createdAt)}
                </div>
              </div>
            </Link>
            <Button
              type="text"
              size="small"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                deleteNotification(n.id)
              }}
            >
              ×
            </Button>
          </div>
        ),
      }))
      .concat([
        { type: 'divider' },
        {
          key: 'mark-all',
          label: (
            <Button type="link" size="small" onClick={markAllAsRead} block>
              علامت‌گذاری همه به‌عنوان خوانده‌شده
            </Button>
          ),
        },
      ]),
  }

  const handleUserMenuClick = ({ key }) => {
    if (key === 'logout') {
      logout()
    }
  }

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: <Link to="/profile">پروفایل</Link>,
      },
      // Settings - Only for manager and superadmin
      ...(isManagerOrSuperAdmin
        ? [
          {
            key: 'settings',
            icon: <SettingOutlined />,
            label: <Link to="/settings">تنظیمات</Link>,
          },
        ]
        : []),
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'خروج',
      },
    ],
    onClick: handleUserMenuClick,
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Desktop Sidebar */}
      <Sider
        breakpoint="lg"
        collapsedWidth="80"
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className="desktop-sider"
      >
        <div className="logo">
          {collapsed ? 'مدیر' : 'پنل مدیریت'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['/' + location.pathname.split('/')[1]]}
          items={menuItems}
        />
      </Sider>

      {/* Mobile Drawer */}
      <Drawer
        title="منوی ناوبری"
        placement="right"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        className="mobile-drawer"
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['/' + location.pathname.split('/')[1]]}
          items={menuItems}
          onClick={() => setMobileDrawerOpen(false)}
        />
      </Drawer>

      <Layout>
        <Header className="site-header">
          <div className="header-left">
            <Button
              type="text"
              icon={<MenuOutlined />}
              className="mobile-menu-btn"
              onClick={() => setMobileDrawerOpen(true)}
            />
          </div>

          <div className="header-right">
            <Dropdown menu={notificationMenu} trigger={['click']}>
              <Badge count={unreadCount} style={{ marginLeft: 24 }}>
                <BellOutlined style={{ fontSize: 20, cursor: 'pointer' }} />
              </Badge>
            </Dropdown>

            <Dropdown menu={userMenu} trigger={['click']}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  marginRight: 16,
                }}
              >
                <Avatar
                  src={user?.avatar?.url}
                  icon={!user?.avatar?.url && <UserOutlined />}
                  style={{ marginLeft: 8 }}
                />
                <span>{user?.name}</span>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="site-content">{children}</Content>
      </Layout>

      {/* Profile Modal */}
      <ProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </Layout>
  )
}

export default MainLayout
