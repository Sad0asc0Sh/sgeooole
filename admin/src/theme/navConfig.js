/**
 * Navigation — the single source of truth for the panel's structure.
 *
 * This replaces three hand-maintained maps that had to be kept in sync
 * by hand (menu items, menu→permission, path→parent-group). Because
 * they drifted, several pages had to be special-cased: `/customers`
 * alone appeared as both a group and an item, and the parent lookup
 * for it pointed at itself.
 *
 * One entry now describes a destination completely: its path, label,
 * icon, the permission that reveals it, and where it sits in the tree.
 * The rail, the mobile drawer and the breadcrumb trail all read from
 * this one structure, so adding a page is a single edit.
 */
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
  AppstoreOutlined,
  TagsOutlined,
  DatabaseOutlined,
  StarOutlined,
  PlusCircleOutlined,
  ThunderboltOutlined,
  PictureOutlined,
  NotificationOutlined,
  MailOutlined,
  FileDoneOutlined,
  EditOutlined,
  PercentageOutlined,
  TruckOutlined,
  UserSwitchOutlined,
  WarningOutlined,
  BulbOutlined,
  FallOutlined,
  RiseOutlined,
  ProfileOutlined,
  LogoutOutlined,
  HomeOutlined,
} from '@ant-design/icons'
import { PERMISSIONS } from '../rbac/permissions'

/** Roles allowed into the newsletter area (matches the route guard). */
const NEWSLETTER_ROLES = ['admin', 'manager', 'superadmin']

/**
 * Sections group the rail into scannable bands. `key` links a section
 * to the nav entries it contains; the order here is the reading order.
 */
export const NAV_SECTIONS = [
  { key: 'main', label: 'اصلی' },
  { key: 'trade', label: 'فروش' },
  { key: 'contentGroup', label: 'محتوا' },
  { key: 'system', label: 'سیستم' },
]

const nav = {
  dashboard: {
    path: '/',
    label: 'داشبورد',
    icon: DashboardOutlined,
    section: 'main',
    permission: PERMISSIONS.DASHBOARD_VIEW,
    keywords: 'home overview آمار خلاصه',
  },

  products: {
    key: 'products',
    label: 'محصولات',
    icon: ShoppingOutlined,
    section: 'trade',
    children: [
      {
        path: '/products',
        label: 'لیست محصولات',
        icon: AppstoreOutlined,
        permission: PERMISSIONS.PRODUCT_READ,
        keywords: 'کالا list همه محصولات',
      },
      {
        path: '/products/variable',
        label: 'محصولات متغیر',
        icon: TagsOutlined,
        permission: PERMISSIONS.PRODUCT_READ,
        keywords: 'variable واریانت تنوع',
      },
      {
        path: '/products/new',
        label: 'افزودن محصول',
        icon: PlusCircleOutlined,
        permission: PERMISSIONS.PRODUCT_CREATE,
        keywords: 'new create ثبت کالا',
      },
      {
        path: '/categories',
        label: 'دسته‌بندی‌ها',
        icon: DatabaseOutlined,
        permission: PERMISSIONS.CATEGORY_READ,
        keywords: 'category گروه درخت',
      },
      {
        path: '/brands',
        label: 'برندها',
        icon: StarOutlined,
        permission: PERMISSIONS.BRAND_READ,
        keywords: 'brand سازنده',
      },
      {
        path: '/inventory',
        label: 'موجودی',
        icon: ThunderboltOutlined,
        permission: PERMISSIONS.PRODUCT_MANAGE_STOCK,
        keywords: 'stock انبار کم',
      },
      {
        path: '/reviews',
        label: 'نظرات',
        icon: EditOutlined,
        permission: PERMISSIONS.REVIEW_READ,
        keywords: 'review comment دیدگاه امتیاز',
      },
    ],
  },

  orders: {
    key: 'orders',
    label: 'سفارش‌ها',
    icon: ShoppingCartOutlined,
    section: 'trade',
    children: [
      {
        path: '/orders',
        label: 'لیست سفارش‌ها',
        icon: FileDoneOutlined,
        permission: PERMISSIONS.ORDER_READ_ALL,
        keywords: 'order سفارش خرید',
      },
      {
        path: '/orders/create',
        label: 'ثبت سفارش',
        icon: PlusCircleOutlined,
        permission: PERMISSIONS.ORDER_CREATE,
        keywords: 'new create ثبت دستی',
      },
      {
        path: '/abandoned-carts',
        label: 'سبدهای رهاشده',
        icon: WarningOutlined,
        permission: PERMISSIONS.CART_READ,
        keywords: 'cart abandoned رها شده ریزش',
      },
    ],
  },

  customers: {
    key: 'customers',
    label: 'مشتریان',
    icon: UserOutlined,
    section: 'trade',
    children: [
      {
        path: '/customers',
        label: 'لیست مشتریان',
        icon: UserSwitchOutlined,
        permission: PERMISSIONS.USER_READ_ALL,
        keywords: 'customer user کاربر خریدار',
      },
    ],
  },

  finance: {
    key: 'finance',
    label: 'مالی',
    icon: GiftOutlined,
    section: 'trade',
    children: [
      {
        path: '/coupons',
        label: 'کدهای تخفیف',
        icon: PercentageOutlined,
        permission: PERMISSIONS.COUPON_READ,
        keywords: 'coupon discount کد تخفیف',
      },
      {
        path: '/sales',
        label: 'تخفیف‌های زمان‌دار',
        icon: FallOutlined,
        permission: PERMISSIONS.SALE_READ,
        keywords: 'sale flash تخفیف موقت حراج',
      },
      {
        path: '/shipping',
        label: 'ارسال و تحویل',
        icon: TruckOutlined,
        permission: PERMISSIONS.SHIPPING_READ,
        keywords: 'shipping delivery ارسال تحویل پست',
      },
    ],
  },

  content: {
    key: 'content',
    label: 'محتوا و سئو',
    icon: FileTextOutlined,
    section: 'contentGroup',
    children: [
      {
        path: '/pages',
        label: 'صفحات',
        icon: FileTextOutlined,
        permission: PERMISSIONS.PAGE_READ,
        keywords: 'page صفحه سئو لندینگ',
      },
      {
        path: '/blog/posts',
        label: 'مقالات',
        icon: EditOutlined,
        permission: PERMISSIONS.BLOG_READ,
        keywords: 'blog post مقاله وبلاگ',
      },
      {
        path: '/banners',
        label: 'بنرها',
        icon: PictureOutlined,
        permission: PERMISSIONS.BANNER_READ,
        keywords: 'banner اسلایدر تصویر',
      },
      {
        path: '/announcements',
        label: 'اعلان‌ها',
        icon: NotificationOutlined,
        permission: PERMISSIONS.ANNOUNCEMENT_READ,
        keywords: 'announcement اعلان اطلاعیه نوار',
      },
      {
        path: '/newsletter',
        label: 'خبرنامه',
        icon: MailOutlined,
        roles: NEWSLETTER_ROLES,
        keywords: 'newsletter ایمیل بازاریابی',
      },
    ],
  },

  tickets: {
    path: '/tickets',
    label: 'پشتیبانی',
    icon: CustomerServiceOutlined,
    section: 'trade',
    permission: PERMISSIONS.TICKET_READ_ALL,
    keywords: 'ticket support تیکت پشتیبانی مشتری',
  },

  reports: {
    key: 'reports',
    label: 'گزارش‌ها',
    icon: BarChartOutlined,
    section: 'contentGroup',
    children: [
      {
        path: '/reports/sales',
        label: 'فروش',
        icon: RiseOutlined,
        permission: PERMISSIONS.REPORT_READ_SALES,
        keywords: 'report sales فروش درآمد',
      },
      {
        path: '/reports/products',
        label: 'محصولات',
        icon: ShoppingOutlined,
        permission: PERMISSIONS.REPORT_READ_PRODUCTS,
        keywords: 'report product گزارش کالا',
      },
      {
        path: '/reports/customers',
        label: 'مشتریان',
        icon: UserOutlined,
        permission: PERMISSIONS.REPORT_READ_CUSTOMERS,
        keywords: 'report customer مشتری',
      },
      {
        path: '/reports/delivered-items',
        label: 'تحویل‌شده‌ها',
        icon: TruckOutlined,
        permission: PERMISSIONS.REPORT_READ_DELIVERED,
        keywords: 'report delivered تحویل تاریخچه',
      },
      {
        path: '/reports/audit-logs',
        label: 'گزارش سیستم',
        icon: ProfileOutlined,
        permission: PERMISSIONS.ADMIN_READ,
        keywords: 'audit log فعالیت سیستم',
      },
    ],
  },

  settings: {
    path: '/settings',
    label: 'تنظیمات',
    icon: SettingOutlined,
    section: 'system',
    permission: PERMISSIONS.SETTINGS_READ,
    keywords: 'settings تنظیمات فروشگاه',
  },

  aiProviders: {
    path: '/settings/ai-providers',
    label: 'سرویس‌های هوش مصنوعی',
    icon: BulbOutlined,
    section: 'system',
    permission: PERMISSIONS.SETTINGS_UPDATE,
    keywords: 'ai provider chat gpt مدل',
  },

  admins: {
    path: '/admins',
    label: 'ادمین‌ها و دسترسی',
    icon: TeamOutlined,
    section: 'system',
    permission: PERMISSIONS.ADMIN_READ,
    keywords: 'admin user role دسترسی نقش تیم',
  },
}

// Order the top-level groups as they appear in the rail.
const GROUP_ORDER = ['products', 'orders', 'customers', 'finance', 'content', 'tickets', 'reports']
const LEAF_ORDER = ['dashboard', 'settings', 'aiProviders', 'admins']

/** Flat list of every node, in rail order. */
export const NAV_TREE = [
  ...LEAF_ORDER.filter((k) => k === 'dashboard').map((k) => nav[k]),
  ...GROUP_ORDER.map((k) => nav[k]),
  ...LEAF_ORDER.filter((k) => k !== 'dashboard').map((k) => nav[k]),
]

/** Every leaf (a real page) with its owning group attached. */
export const NAV_PAGES = (() => {
  const out = []
  for (const node of NAV_TREE) {
    if (node.children) {
      for (const child of node.children) out.push({ ...child, parent: node })
    } else {
      out.push({ ...node, parent: null })
    }
  }
  return out
})()

/**
 * Longest-prefix match for the current path, so `/products/edit/123`
 * still resolves to the "لیست محصولات" trail.
 */
export function findTrail(pathname) {
  let best = null
  for (const page of NAV_PAGES) {
    if (page.path === pathname) {
      return { page, exact: true }
    }
    if (pathname.startsWith(`${page.path}/`)) {
      // Prefer the most specific path so detail pages inherit the right
      // parent instead of a shorter sibling.
      if (!best || page.path.length > best.page.path.length) {
        best = { page, exact: false }
      }
    }
  }
  return best
}

/** Short fallback for paths with no nav entry (e.g. /profile). */
const EXTRA_TRAILS = {
  '/profile': { label: 'پروفایل من', parent: null, icon: UserOutlined },
}

export function trailFor(pathname) {
  const match = findTrail(pathname)
  if (match) return match.page
  return EXTRA_TRAILS[pathname] || null
}

export const ROLE_LABELS = {
  superadmin: 'مدیر ارشد',
  manager: 'مدیر',
  admin: 'ادمین',
  staff: 'کارشناس',
  user: 'کاربر',
}

export { LogoutOutlined }
