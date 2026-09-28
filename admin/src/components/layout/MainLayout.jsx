import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Layout, Menu, Badge, Dropdown, Avatar, Button, Drawer, Input, Tooltip } from 'antd'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LogoutOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CloseOutlined,
  SearchOutlined,
  UserOutlined,
  SettingOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { useAuthStore, useNotificationStore } from '../../stores'
import { hasPermission } from '../../rbac/access'
import useIsMobile from '../../hooks/useIsMobile'
import { NAV_TREE, trailFor, ROLE_LABELS } from '../../theme/navConfig'
import { GlobalSearch } from './GlobalSearch'
import './MainLayout.css'

const { Header, Sider, Content } = Layout

const COLLAPSE_STORAGE_KEY = 'ekg-admin-sider-collapsed'

/** Read a persisted preference, defaulting when absent or unreadable. */
function readCollapsed() {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY)
    return raw === null ? false : raw === '1'
  } catch {
    return false
  }
}

function MainLayout({ children }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [drawerOpenKeys, setDrawerOpenKeys] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const isDesktopLayout = !useIsMobile(992)
  const drawerButtonRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (isDesktopLayout) setMobileDrawerOpen(false)
  }, [isDesktopLayout])

  // Remember the collapse choice — the rail is a working surface people
  // tune once and expect to keep.
  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* private mode — preference simply won't persist */
    }
  }, [collapsed])

  const { user, permissions, logout } = useAuthStore()
  const { notifications, markAllAsRead, deleteNotification } = useNotificationStore()

  const unreadCount = notifications.filter((n) => !n.read).length
  const role = user?.role || 'user'
  const resolvedPermissions = Array.isArray(permissions) ? permissions : []
  const can = useCallback(
    (permission) => hasPermission(resolvedPermissions, permission),
    [resolvedPermissions]
  )

  /** An entry is visible when it has no permission gate, or the gate passes. */
  const isVisible = useCallback(
    (entry) => {
      if (!entry) return false
      if (entry.roles && !entry.roles.includes(role)) return false
      if (entry.permission && !can(entry.permission)) return false
      return true
    },
    [can, role]
  )

  /** Build antd menu items from the nav tree, dropping what you can't reach. */
  const menuItems = useMemo(
    () =>
      NAV_TREE.map((node) => {
        if (node.children) {
          const children = node.children.filter(isVisible).map((child) => ({
            key: child.path,
            icon: <child.icon />,
            label: <Link to={child.path}>{child.label}</Link>,
          }))
          // A group with nothing left to show shouldn't leave an empty shell.
          if (children.length === 0) return null
          return {
            key: node.key,
            icon: <node.icon />,
            label: node.label,
            children,
          }
        }
        if (!isVisible(node)) return null
        return {
          key: node.path,
          icon: <node.icon />,
          label: <Link to={node.path}>{node.label}</Link>,
        }
      }).filter(Boolean),
    [isVisible]
  )

  /**
   * Open submenu keys. Controlled (not `defaultOpenKeys`) so the rail
   * follows navigation: landing on a nested page expands its section
   * even if you arrived by URL or a search result.
   */
  const trail = useMemo(() => trailFor(location.pathname), [location.pathname])

  const openKeys = useMemo(() => {
    if (collapsed) return []
    if (trail?.parent) return [trail.parent.key]
    return []
  }, [trail, collapsed])

  useEffect(() => {
    setDrawerOpenKeys((prev) => Array.from(new Set([...prev, ...openKeys])))
  }, [openKeys])

  // Breadcrumb: section → group → page. The current page is plain text
  // because you're already there; ancestors stay clickable.
  const breadcrumb = useMemo(() => {
    const items = [{ title: <Link to="/"><HomeOutlined /></Link> }]
    if (!trail) return items
    if (trail.parent) {
      items.push({
        title: <span className="crumb-group">{trail.parent.label}</span>,
      })
    }
    items.push({ title: <span className="crumb-current">{trail.label}</span> })
    return items
  }, [trail])

  // ⌘K / Ctrl-K opens search; Escape closes it. The panel is used all
  // day, so the route in front of you should be one keystroke away.
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Move focus into the drawer when it opens so keyboard and screen
  // reader users land inside the navigation they just asked for.
  useEffect(() => {
    if (mobileDrawerOpen) {
      previouslyFocused.current = document.activeElement
      const t = window.setTimeout(() => drawerButtonRef.current?.focus(), 60)
      return () => window.clearTimeout(t)
    }
    previouslyFocused.current?.focus?.()
    return undefined
  }, [mobileDrawerOpen])

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return ''

    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
    if (diffSec < 60) return 'چند لحظه پیش'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin} دقیقه پیش`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour} ساعت پیش`
    return `${Math.floor(diffHour / 24)} روز پیش`
  }

  const openNotification = (n) => {
    if (!n.read) {
      // Marking read on open is the behaviour people expect from a bell.
      const { markAsRead } = useNotificationStore.getState()
      markAsRead(n.id)
    }
    if (n.link) {
      setMobileDrawerOpen(false)
      navigate(n.link)
    }
  }

  const notificationMenu = {
    items: notifications.length
      ? [
          ...notifications.map((n) => ({
            key: n.id,
            label: (
              <div className="notif-row">
                <button
                  type="button"
                  className={`notif-body${n.read ? '' : ' is-unread'}`}
                  onClick={() => openNotification(n)}
                >
                  <span className="notif-title">{n.title}</span>
                  {n.message && <span className="notif-message">{n.message}</span>}
                  <span className="notif-time">{formatRelativeTime(n.createdAt)}</span>
                </button>
                <button
                  type="button"
                  className="notif-dismiss"
                  aria-label={`حذف اعلان ${n.title}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteNotification(n.id)
                  }}
                >
                  <CloseOutlined />
                </button>
              </div>
            ),
          })),
          { type: 'divider' },
          {
            key: 'mark-all',
            label: (
              <button type="button" className="notif-mark-all" onClick={markAllAsRead}>
                علامت‌گذاری همه به‌عنوان خوانده‌شده
              </button>
            ),
          },
        ]
      : [{ key: 'empty', label: <div className="notif-empty">اعلانی ندارید</div>, disabled: true }],
  }

  const handleUserMenuClick = ({ key }) => {
    if (key === 'logout') logout()
  }

  const isManagerOrSuperAdmin = role === 'manager' || role === 'superadmin'
  const roleLabel = ROLE_LABELS[role] || 'کاربر'

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: <Link to="/profile">پروفایل من</Link>,
      },
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
      { key: 'logout', icon: <LogoutOutlined />, label: 'خروج از حساب' },
    ],
    onClick: handleUserMenuClick,
  }

  return (
    <Layout className="admin-root-layout">
      {/* ── Dark rail: identity bar, nav, operator card ── */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        collapsedWidth={72}
        width={236}
        className="admin-sider"
      >
        <div className="admin-sider-inner">
          <Link to="/" className="admin-brand" aria-label="پنل مدیریت — صفحه اصلی">
            <span className="admin-brand-mark" aria-hidden="true">
              <span className="admin-brand-dot" />
            </span>
            {!collapsed && (
              <span className="admin-brand-text">
                <span className="admin-brand-name">ای‌کا کالا</span>
                <span className="admin-brand-role">پنل مدیریت</span>
              </span>
            )}
          </Link>

          <div className="admin-sider-menu-wrap">
            <Menu
              theme="dark"
              mode="inline"
              className="admin-sider-menu"
              popupClassName="admin-sider-popup"
              selectedKeys={[location.pathname]}
              openKeys={openKeys}
              onOpenChange={setOpenKeys}
              items={menuItems}
            />
          </div>

          {/* Operator card — who you are and how you leave, always in view. */}
          <div className="admin-sider-foot">
            <Dropdown menu={userMenu} trigger={['click']} placement="topRight">
              <button type="button" className="admin-operator" aria-label="حساب کاربری">
                <Avatar
                  size={collapsed ? 34 : 30}
                  src={user?.avatar?.url}
                  icon={!user?.avatar?.url && <UserOutlined />}
                />
                {!collapsed && (
                  <span className="admin-operator-meta">
                    <span className="admin-operator-name">{user?.name || 'کاربر'}</span>
                    <span className="admin-operator-role">{roleLabel}</span>
                  </span>
                )}
              </button>
            </Dropdown>
          </div>
        </div>
      </Sider>

      {/* ── Mobile drawer ── */}
      <Drawer
        placement="right"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        className="mobile-drawer"
        width={288}
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        <div className="mobile-drawer-header">
          <span className="admin-brand-mark" aria-hidden="true">
            <span className="admin-brand-dot" />
          </span>
          <span className="mobile-drawer-title">ای‌کا کالا</span>
          <button
            type="button"
            className="mobile-drawer-close"
            onClick={() => setMobileDrawerOpen(false)}
            aria-label="بستن منو"
            ref={drawerButtonRef}
          >
            <CloseOutlined />
          </button>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          className="mobile-drawer-menu"
          selectedKeys={[location.pathname]}
          openKeys={drawerOpenKeys}
          onOpenChange={setDrawerOpenKeys}
          items={menuItems}
          onClick={() => setMobileDrawerOpen(false)}
        />

        <div className="mobile-drawer-footer">
          <Avatar
            size={34}
            src={user?.avatar?.url}
            icon={!user?.avatar?.url && <UserOutlined />}
          />
          <span className="user-meta">
            <span className="u-name">{user?.name || 'کاربر'}</span>
            <span className="u-role">{roleLabel}</span>
          </span>
          <Tooltip title="خروج از حساب" placement="left">
            <Button
              type="text"
              danger
              icon={<LogoutOutlined />}
              onClick={() => {
                setMobileDrawerOpen(false)
                logout()
              }}
              aria-label="خروج از حساب"
            />
          </Tooltip>
        </div>
      </Drawer>

      {/* ── Main column ── */}
      <Layout className="admin-main-layout">
        <Header className="admin-header">
          <div className="header-left">
            <button
              type="button"
              className="header-icon-btn collapse-btn"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'باز کردن منوی کناری' : 'بستن منوی کناری'}
              aria-expanded={!collapsed}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>

            <button
              type="button"
              className="header-icon-btn mobile-menu-btn"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="باز کردن منو"
              aria-expanded={mobileDrawerOpen}
            >
              <MenuOutlined />
            </button>

            {/* On wide screens the rail has no room for a title, so the
                trail lives in the header. Below that it moves into the
                content area where it has room to wrap. */}
            <nav className="header-trail" aria-label="مسیر صفحه">
              {breadcrumb.map((item, i) => (
                <span key={i} className="crumb-node">
                  {i > 0 && <span className="crumb-sep" aria-hidden="true">/</span>}
                  {item.title}
                </span>
              ))}
            </nav>
          </div>

          <div className="header-right">
            <button
              type="button"
              className="header-search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="جستجو در پنل"
            >
              <SearchOutlined />
              <span className="header-search-label">جستجو</span>
              <kbd className="header-search-kbd">Ctrl K</kbd>
            </button>

            <Dropdown menu={notificationMenu} trigger={['click']} placement="bottomLeft">
              <button
                type="button"
                className="header-icon-btn"
                aria-label={unreadCount ? `اعلان‌ها (${unreadCount} خوانده‌نشده)` : 'اعلان‌ها'}
              >
                <Badge count={unreadCount} size="small" offset={[4, -2]}>
                  <span className="header-bell-glyph" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </Badge>
              </button>
            </Dropdown>

            <Dropdown menu={userMenu} trigger={['click']} placement="bottomLeft">
              <button type="button" className="header-user" aria-label="حساب کاربری">
                <Avatar
                  size={30}
                  src={user?.avatar?.url}
                  icon={!user?.avatar?.url && <UserOutlined />}
                />
                <span className="header-user-name">{user?.name}</span>
                <span className="header-user-role">{roleLabel}</span>
              </button>
            </Dropdown>
          </div>
        </Header>

        <Content className="admin-content-area">
          <div className="admin-content-inner">
            {/* Trail repeats below 992px, where the header drops it. */}
            <nav className="content-trail" aria-label="مسیر صفحه">
              {breadcrumb.map((item, i) => (
                <span key={i} className="crumb-node">
                  {i > 0 && <span className="crumb-sep" aria-hidden="true">/</span>}
                  {item.title}
                </span>
              ))}
            </nav>
            {children}
          </div>
        </Content>
      </Layout>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </Layout>
  )
}

export default MainLayout
