import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Layout, Menu, Badge, Dropdown, Avatar, Button, Drawer, Tooltip } from 'antd'
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
  PushpinOutlined,
  PushpinFilled,
  CalendarOutlined,
} from '@ant-design/icons'
import { useAuthStore, useNotificationStore } from '../../stores'
import { hasPermission } from '../../rbac/access'
import useIsMobile from '../../hooks/useIsMobile'
import { NAV_SECTIONS, NAV_TREE, trailFor, ROLE_LABELS } from '../../theme/navConfig'
import { formatRelativeTime, getTodayJalaliLabel } from '../../utils/dateUtils'
import { GlobalSearch } from './GlobalSearch'
import './MainLayout.css'

const { Header, Sider, Content } = Layout

const PIN_STORAGE_KEY = 'ekg-admin-sider-pinned'

/** Read persisted pin preference; defaults to false (auto hover-expandable icon rail). */
function readPinned() {
  try {
    const raw = window.localStorage.getItem(PIN_STORAGE_KEY)
    return raw === '1'
  } catch {
    return false
  }
}

function MainLayout({ children }) {
  const [pinned, setPinned] = useState(readPinned)
  const [hovered, setHovered] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const [operatorMenuOpen, setOperatorMenuOpen] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [drawerOpenKeys, setDrawerOpenKeys] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()
  const isDesktopLayout = !useIsMobile(992)
  const drawerButtonRef = useRef(null)
  const previouslyFocused = useRef(null)
  const hoverCloseTimer = useRef(null)

  useEffect(() => {
    if (isDesktopLayout) setMobileDrawerOpen(false)
  }, [isDesktopLayout])

  useEffect(() => {
    try {
      window.localStorage.setItem(PIN_STORAGE_KEY, pinned ? '1' : '0')
    } catch {
      /* private mode — preference simply won't persist */
    }
  }, [pinned])

  useEffect(() => {
    return () => {
      if (hoverCloseTimer.current) window.clearTimeout(hoverCloseTimer.current)
    }
  }, [])

  // Collapse floating hover state when navigating if not pinned (keeps mobile/desktop clean)
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [location.pathname])

  const { user, permissions, logout } = useAuthStore()
  const { notifications, markAllAsRead, deleteNotification } = useNotificationStore()

  const unreadCount = notifications.filter((n) => !n.read).length
  const role = user?.role || 'user'
  const resolvedPermissions = Array.isArray(permissions) ? permissions : []
  const can = useCallback(
    (permission) => hasPermission(resolvedPermissions, permission),
    [resolvedPermissions],
  )

  const isVisible = useCallback(
    (entry) => {
      if (!entry) return false
      if (entry.roles && !entry.roles.includes(role)) return false
      if (entry.permission && !can(entry.permission)) return false
      return true
    },
    [can, role],
  )

  const isExpanded = pinned || hovered || focusWithin || operatorMenuOpen

  const buildMenuItems = useCallback(
    (expandedMode) => {
      const items = []
      NAV_SECTIONS.forEach((section, sectionIdx) => {
        const sectionNodes = NAV_TREE.filter((n) => n.section === section.key)
        const childrenItems = []

        for (const node of sectionNodes) {
          if (node.children) {
            const visibleChildren = node.children.filter(isVisible).map((child) => ({
              key: child.path,
              icon: <child.icon />,
              label: <Link to={child.path}>{child.label}</Link>,
            }))
            if (visibleChildren.length > 0) {
              childrenItems.push({
                key: node.key,
                icon: <node.icon />,
                label: node.label,
                children: visibleChildren,
              })
            }
          } else if (isVisible(node)) {
            childrenItems.push({
              key: node.path,
              icon: <node.icon />,
              label: <Link to={node.path}>{node.label}</Link>,
            })
          }
        }

        if (childrenItems.length === 0) return

        if (expandedMode) {
          items.push({
            type: 'group',
            key: `section-${section.key}`,
            label: section.label,
            children: childrenItems,
          })
        } else {
          if (sectionIdx > 0 && items.length > 0) {
            items.push({ type: 'divider', key: `div-${section.key}` })
          }
          items.push(...childrenItems)
        }
      })
      return items
    },
    [isVisible],
  )

  const desktopMenuItems = useMemo(
    () => buildMenuItems(isExpanded),
    [buildMenuItems, isExpanded],
  )
  const mobileMenuItems = useMemo(() => buildMenuItems(true), [buildMenuItems])

  const trail = useMemo(() => trailFor(location.pathname), [location.pathname])
  const selectedKey = trail?.path || location.pathname

  const [manualOpenKeys, setManualOpenKeys] = useState([])

  const routeOpenKeys = useMemo(() => {
    if (trail?.parent) return [trail.parent.key]
    return []
  }, [trail])

  const openKeys = useMemo(() => {
    if (!isExpanded) return []
    return Array.from(new Set([...manualOpenKeys, ...routeOpenKeys]))
  }, [manualOpenKeys, routeOpenKeys, isExpanded])

  useEffect(() => {
    if (routeOpenKeys.length > 0) {
      setDrawerOpenKeys((prev) => Array.from(new Set([...prev, ...routeOpenKeys])))
    }
  }, [routeOpenKeys])

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

  // Hover handlers for desktop auto-expandable rail
  const handleSiderMouseEnter = () => {
    if (!isDesktopLayout) return
    if (hoverCloseTimer.current) {
      window.clearTimeout(hoverCloseTimer.current)
      hoverCloseTimer.current = null
    }
    setHovered(true)
  }

  const handleSiderMouseLeave = () => {
    if (!isDesktopLayout) return
    if (hoverCloseTimer.current) window.clearTimeout(hoverCloseTimer.current)
    hoverCloseTimer.current = window.setTimeout(() => {
      setHovered(false)
    }, 180)
  }

  const handleSiderFocus = () => {
    if (!isDesktopLayout) return
    if (hoverCloseTimer.current) {
      window.clearTimeout(hoverCloseTimer.current)
      hoverCloseTimer.current = null
    }
    setFocusWithin(true)
  }

  const handleSiderBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setFocusWithin(false)
    }
  }

  // Ctrl+K / Cmd+K search palette
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

  // Focus management for mobile drawer
  useEffect(() => {
    if (mobileDrawerOpen) {
      previouslyFocused.current = document.activeElement
      const t = window.setTimeout(() => drawerButtonRef.current?.focus(), 60)
      return () => window.clearTimeout(t)
    }
    previouslyFocused.current?.focus?.()
    return undefined
  }, [mobileDrawerOpen])

  const todayJalali = useMemo(() => getTodayJalaliLabel(), [])

  const openNotification = (n) => {
    if (!n.read) {
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

  const isHoverOverlay = isExpanded && !pinned

  return (
    <Layout className={`admin-root-layout${pinned ? ' is-sider-pinned' : ''}`}>
      {/* ── Dark rail: auto-expands on hover, optional pin ── */}
      <Sider
        trigger={null}
        collapsible
        collapsed={!isExpanded}
        collapsedWidth={68}
        width={256}
        className={`admin-sider${isHoverOverlay ? ' is-hover-expanded' : ''}${pinned ? ' is-pinned' : ''}`}
        onMouseEnter={handleSiderMouseEnter}
        onMouseLeave={handleSiderMouseLeave}
        onFocus={handleSiderFocus}
        onBlur={handleSiderBlur}
      >
        <div className="admin-sider-inner">
          <div className="admin-brand-row">
            <Link to="/" className="admin-brand" aria-label="پنل مدیریت — صفحه اصلی">
              <span className="admin-brand-mark" aria-hidden="true">
                <span className="admin-brand-dot" />
              </span>
              {isExpanded && (
                <span className="admin-brand-text">
                  <span className="admin-brand-name">ای‌کا کالا</span>
                  <span className="admin-brand-role">پنل مدیریت سازمانی</span>
                </span>
              )}
            </Link>

            {isExpanded && (
              <Tooltip
                title={pinned ? 'بازشدن خودکار با ماوس (رها کردن منو)' : 'ثابت نگه‌داشتن منو'}
                placement="left"
              >
                <button
                  type="button"
                  className={`sider-pin-btn${pinned ? ' is-active' : ''}`}
                  onClick={() => setPinned((v) => !v)}
                  aria-label={pinned ? 'آزاد کردن منوی کناری' : 'ثابت کردن منوی کناری'}
                  aria-pressed={pinned}
                >
                  {pinned ? <PushpinFilled /> : <PushpinOutlined />}
                </button>
              </Tooltip>
            )}
          </div>

          <div className="admin-sider-menu-wrap">
            <Menu
              theme="dark"
              mode="inline"
              className="admin-sider-menu"
              popupClassName="admin-sider-popup"
              selectedKeys={[selectedKey]}
              openKeys={openKeys}
              onOpenChange={setManualOpenKeys}
              items={desktopMenuItems}
            />
          </div>

          <div className="admin-sider-foot">
            <Dropdown
              menu={userMenu}
              trigger={['click']}
              placement="topRight"
              onOpenChange={setOperatorMenuOpen}
            >
              <button type="button" className="admin-operator" aria-label="حساب کاربری">
                <Avatar
                  size={isExpanded ? 32 : 34}
                  src={user?.avatar?.url}
                  icon={!user?.avatar?.url && <UserOutlined />}
                />
                {isExpanded && (
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
        width={296}
        closable={false}
        styles={{ body: { padding: 0 } }}
      >
        <div className="mobile-drawer-header">
          <span className="admin-brand-mark" aria-hidden="true">
            <span className="admin-brand-dot" />
          </span>
          <div className="mobile-drawer-brand-text">
            <span className="mobile-drawer-title">ای‌کا کالا</span>
            <span className="mobile-drawer-sub">پنل مدیریت</span>
          </div>
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

        <div className="mobile-drawer-search-wrap">
          <button
            type="button"
            className="mobile-drawer-search-btn"
            onClick={() => {
              setMobileDrawerOpen(false)
              setSearchOpen(true)
            }}
          >
            <SearchOutlined />
            <span>جستجوی سریع صفحات…</span>
          </button>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          className="mobile-drawer-menu"
          selectedKeys={[selectedKey]}
          openKeys={drawerOpenKeys}
          onOpenChange={setDrawerOpenKeys}
          items={mobileMenuItems}
          onClick={() => setMobileDrawerOpen(false)}
        />

        <div className="mobile-drawer-footer">
          <Link
            to="/profile"
            className="mobile-drawer-profile-link"
            onClick={() => setMobileDrawerOpen(false)}
          >
            <Avatar
              size={34}
              src={user?.avatar?.url}
              icon={!user?.avatar?.url && <UserOutlined />}
            />
            <span className="user-meta">
              <span className="u-name">{user?.name || 'کاربر'}</span>
              <span className="u-role">{roleLabel}</span>
            </span>
          </Link>
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
            <Tooltip title={pinned ? 'جمع کردن منوی ثابت' : 'ثابت کردن منوی کناری'}>
              <button
                type="button"
                className="header-icon-btn collapse-btn"
                onClick={() => setPinned((v) => !v)}
                aria-label={pinned ? 'آزاد کردن منوی کناری' : 'ثابت کردن منوی کناری'}
                aria-pressed={pinned}
              >
                {pinned ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
              </button>
            </Tooltip>

            <button
              type="button"
              className="header-icon-btn mobile-menu-btn"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="باز کردن منو"
              aria-expanded={mobileDrawerOpen}
            >
              <MenuOutlined />
            </button>

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
            {todayJalali && (
              <span className="header-date-chip" title="تاریخ امروز">
                <CalendarOutlined />
                <span>{todayJalali}</span>
              </span>
            )}

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
                <Badge count={unreadCount} overflowCount={99} size="small" offset={[-2, 2]}>
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
