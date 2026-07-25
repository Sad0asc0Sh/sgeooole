import { useState, useMemo } from 'react'
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
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import {
  useAuthStore,
  useNotificationStore,
} from '../../stores'
import { PERMISSIONS } from '../../rbac/permissions'
import { hasAnyPermission, hasPermission } from '../../rbac/access'
import './MainLayout.css'

const { Header, Sider, Content } = Layout

function MainLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const location = useLocation()
  const { user, permissions, logout } = useAuthStore()
  const { notifications, markAllAsRead, deleteNotification } = useNotificationStore()

  const unreadCount = notifications.filter((n) => !n.read).length
  const role = user?.role || 'user'
  const isManagerOrSuperAdmin = role === 'manager' || role === 'superadmin'
  const isSuperAdmin = role === 'superadmin'
  const resolvedPermissions = Array.isArray(permissions) ? permissions : []

  const can = (permission) => hasPermission(resolvedPermissions, permission)
  const canNewsletter = ['admin', 'manager', 'superadmin'].includes(role)

  const menuPermissionByKey = {
    '/': PERMISSIONS.DASHBOARD_VIEW,

    '/products': PERMISSIONS.PRODUCT_READ,
    '/products/new': PERMISSIONS.PRODUCT_CREATE,
    '/categories': PERMISSIONS.CATEGORY_READ,
    '/brands': PERMISSIONS.BRAND_READ,
    '/inventory': PERMISSIONS.PRODUCT_MANAGE_STOCK,
    '/reviews': PERMISSIONS.REVIEW_READ,

    '/orders': PERMISSIONS.ORDER_READ_ALL,
    '/abandoned-carts': PERMISSIONS.CART_READ,

    '/customers': PERMISSIONS.USER_READ_ALL,


    '/coupons': PERMISSIONS.COUPON_READ,
    '/sales': PERMISSIONS.SALE_READ,
    '/shipping': PERMISSIONS.SHIPPING_READ,

    '/pages': PERMISSIONS.PAGE_READ,
    '/blog/posts': PERMISSIONS.BLOG_READ,
    '/banners': PERMISSIONS.BANNER_READ,
    '/announcements': PERMISSIONS.ANNOUNCEMENT_READ,

    '/tickets': PERMISSIONS.TICKET_READ_ALL,

    '/reports/sales': PERMISSIONS.REPORT_READ_SALES,
    '/reports/products': PERMISSIONS.REPORT_READ_PRODUCTS,
    '/reports/customers': PERMISSIONS.REPORT_READ_CUSTOMERS,
    '/reports/audit-logs': PERMISSIONS.ADMIN_READ,

    '/settings': PERMISSIONS.SETTINGS_READ,
    '/admins': PERMISSIONS.ADMIN_READ,
  }

  const filterMenuItems = (items = []) =>
    items
      .map((item) => {
        if (Array.isArray(item.children) && item.children.length > 0) {
          const filteredChildren = filterMenuItems(item.children)
          if (filteredChildren.length === 0) return null
          return { ...item, children: filteredChildren }
        }

        if (item.key === '/newsletter') {
          return canNewsletter ? item : null
        }

        const requiredPermission = menuPermissionByKey[item.key]
        if (!requiredPermission) return item

        return can(requiredPermission) ? item : null
      })
      .filter(Boolean)

  // Build menu items based on user role
  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">داشبورد</Link>,
    },
    {
      key: 'products-menu',
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
      key: 'orders-menu',
      icon: <ShoppingCartOutlined />,
      label: 'سفارشات',
      children: [
        {
          key: '/orders',
          label: <Link to="/orders">لیست سفارشات</Link>,
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
          key: '/customers',
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
        {
          key: '/newsletter',
          label: <Link to="/newsletter">خبرنامه</Link>,
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
    // Admins Management - For superadmin and manager (users with admin:read permission)
    ...(can(PERMISSIONS.ADMIN_READ)
      ? [
        {
          key: '/admins',
          icon: <TeamOutlined />,
          label: <Link to="/admins">مدیریت ادمین‌ها</Link>,
        },
      ]
      : []),
  ]
  const filteredMenuItems = filterMenuItems(menuItems)

  // Map pathname to the correct parent menu key for auto-expanding
  const getOpenKeys = useMemo(() => {
    if (collapsed) return []
    const path = location.pathname
    const pathToParent = {
      '/products': 'products-menu',
      '/products/new': 'products-menu',
      '/products/variable': 'products-menu',
      '/categories': 'products-menu',
      '/brands': 'products-menu',
      '/inventory': 'products-menu',
      '/reviews': 'products-menu',
      '/orders': 'orders-menu',
      '/abandoned-carts': 'orders-menu',
      '/customers': '/customers',
      '/coupons': '/finance',
      '/sales': '/finance',
      '/shipping': '/finance',
      '/pages': '/content',
      '/blog/posts': '/content',
      '/banners': '/content',
      '/announcements': '/content',
      '/newsletter': '/content',
      '/reports/sales': '/reports',
      '/reports/products': '/reports',
      '/reports/customers': '/reports',
      '/reports/audit-logs': '/reports',
    }
    // Check for exact match first, then prefix match
    const parentKey = pathToParent[path]
    if (parentKey) return [parentKey]
    // Fallback: try matching by prefix (e.g. /products/edit/123)
    const matchedKey = Object.keys(pathToParent).find(k => path.startsWith(k + '/'))
    return matchedKey ? [pathToParent[matchedKey]] : []
  }, [location.pathname, collapsed])

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
    <Layout className="admin-root-layout">
      {/* ── Desktop Sidebar: fixed + independent scroll ── */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        collapsedWidth={80}
        width={220}
        className="admin-sider"
      >
        <div className="admin-sider-inner">
          <div className="logo">
            {collapsed ? 'مدیر' : 'پنل مدیریت'}
          </div>
          <div className="admin-sider-menu-wrap">
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[location.pathname]}
              defaultOpenKeys={getOpenKeys}
              items={filteredMenuItems}
            />
          </div>
        </div>
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
          defaultOpenKeys={getOpenKeys}
          items={filteredMenuItems}
          onClick={() => setMobileDrawerOpen(false)}
        />
      </Drawer>

      {/* ── Main content area ── */}
      <Layout className="admin-main-layout">
        {/* Sticky Header */}
        <Header className="admin-header">
          <div className="header-left">
            {/* Desktop collapse toggle */}
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="collapse-btn"
            />
            {/* Mobile hamburger */}
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
              <div className="header-user-info">
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

        {/* Scrollable content */}
        <Content className="admin-content-area">
          <div className="admin-content-inner">
            {children}
          </div>
        </Content>
      </Layout>

    </Layout>
  )
}

export default MainLayout
