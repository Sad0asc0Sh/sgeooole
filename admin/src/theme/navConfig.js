/**
 * Navigation — the single source of truth for the panel's structure.
 *
 * Organized into 6 clear executive sections so operators can immediately
 * locate Overview, Sales & Support, Catalog & Stock, Marketing & Storefront,
 * Reports & Analytics, and System Administration.
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
  WarningOutlined,
  BulbOutlined,
  FallOutlined,
  RiseOutlined,
  ProfileOutlined,
  LogoutOutlined,
  CloudServerOutlined,
} from '@ant-design/icons'
import { PERMISSIONS } from '../rbac/permissions'

/** Roles allowed into the newsletter area (matches the route guard). */
const NEWSLETTER_ROLES = ['admin', 'manager', 'superadmin']

/**
 * Sections group the rail into scannable bands.
 * Order here defines reading order in both desktop rail and mobile drawer.
 */
export const NAV_SECTIONS = [
  { key: 'overview', label: 'نمای کلی' },
  { key: 'salesOps', label: 'فروش و پشتیبانی' },
  { key: 'catalog', label: 'کاتالوگ و انبار' },
  { key: 'marketing', label: 'تخفیف، مالی و ویترین' },
  { key: 'analytics', label: 'گزارش‌ها و تحلیل' },
  { key: 'system', label: 'مدیریت سیستم' },
]

const nav = {
  dashboard: {
    path: '/',
    label: 'داشبورد',
    icon: DashboardOutlined,
    section: 'overview',
    permission: PERMISSIONS.DASHBOARD_VIEW,
    keywords: 'home overview داشبورد آمار خلاصه مدیریت',
  },

  orders: {
    key: 'orders',
    label: 'سفارش‌ها',
    icon: ShoppingCartOutlined,
    section: 'salesOps',
    children: [
      {
        path: '/orders',
        label: 'لیست سفارش‌ها',
        icon: FileDoneOutlined,
        permission: PERMISSIONS.ORDER_READ_ALL,
        keywords: 'order سفارش خرید لیست پیگیری',
      },
      {
        path: '/orders/create',
        label: 'ثبت سفارش دستی',
        icon: PlusCircleOutlined,
        permission: PERMISSIONS.ORDER_CREATE,
        keywords: 'new create ثبت دستی سفارش',
      },
      {
        path: '/abandoned-carts',
        label: 'سبدهای رهاشده',
        icon: WarningOutlined,
        permission: PERMISSIONS.CART_READ,
        keywords: 'cart abandoned سبد رها شده ریزش',
      },
    ],
  },

  customers: {
    path: '/customers',
    label: 'مشتریان',
    icon: UserOutlined,
    section: 'salesOps',
    permission: PERMISSIONS.USER_READ_ALL,
    keywords: 'customer user کاربر خریدار مشتریان پروفایل',
  },

  tickets: {
    path: '/tickets',
    label: 'پشتیبانی و تیکت‌ها',
    icon: CustomerServiceOutlined,
    section: 'salesOps',
    permission: PERMISSIONS.TICKET_READ_ALL,
    keywords: 'ticket support تیکت پشتیبانی مشتری پیام',
  },

  products: {
    key: 'products',
    label: 'محصولات و انبار',
    icon: ShoppingOutlined,
    section: 'catalog',
    children: [
      {
        path: '/products',
        label: 'همه محصولات',
        icon: AppstoreOutlined,
        permission: PERMISSIONS.PRODUCT_READ,
        keywords: 'کالا list همه محصولات قیمت تخفیف',
      },
      {
        path: '/products/variable',
        label: 'محصولات متغیر',
        icon: TagsOutlined,
        permission: PERMISSIONS.PRODUCT_READ,
        keywords: 'variable واریانت تنوع مدل',
      },
      {
        path: '/products/new',
        label: 'افزودن محصول',
        icon: PlusCircleOutlined,
        permission: PERMISSIONS.PRODUCT_CREATE,
        keywords: 'new create ثبت کالا جدید',
      },
      {
        path: '/inventory',
        label: 'موجودی و انبار',
        icon: ThunderboltOutlined,
        permission: PERMISSIONS.PRODUCT_MANAGE_STOCK,
        keywords: 'stock انبار موجودی کم ناموجود',
      },
      {
        path: '/categories',
        label: 'دسته‌بندی‌ها',
        icon: DatabaseOutlined,
        permission: PERMISSIONS.CATEGORY_READ,
        keywords: 'category گروه درخت دسته',
      },
      {
        path: '/brands',
        label: 'برندها',
        icon: StarOutlined,
        permission: PERMISSIONS.BRAND_READ,
        keywords: 'brand سازنده تولیدکننده',
      },
      {
        path: '/reviews',
        label: 'دیدگاه و نظرات',
        icon: EditOutlined,
        permission: PERMISSIONS.REVIEW_READ,
        keywords: 'review comment دیدگاه امتیاز نظر',
      },
    ],
  },

  finance: {
    key: 'finance',
    label: 'تخفیف و ارسال',
    icon: GiftOutlined,
    section: 'marketing',
    children: [
      {
        path: '/sales',
        label: 'تخفیف‌های زمان‌دار و کمپین‌ها',
        icon: FallOutlined,
        permission: PERMISSIONS.SALE_READ,
        keywords: 'sale flash campaign تخفیف زمان دار حراج کمپین لیبل',
      },
      {
        path: '/coupons',
        label: 'کدهای تخفیف',
        icon: PercentageOutlined,
        permission: PERMISSIONS.COUPON_READ,
        keywords: 'coupon discount کد تخفیف کوپن',
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
    label: 'محتوا و ویترین',
    icon: FileTextOutlined,
    section: 'marketing',
    children: [
      {
        path: '/banners',
        label: 'بنرها و اسلایدر',
        icon: PictureOutlined,
        permission: PERMISSIONS.BANNER_READ,
        keywords: 'banner اسلایدر تصویر ویترین',
      },
      {
        path: '/announcements',
        label: 'اعلان‌ها',
        icon: NotificationOutlined,
        permission: PERMISSIONS.ANNOUNCEMENT_READ,
        keywords: 'announcement اعلان اطلاعیه نوار',
      },
      {
        path: '/blog/posts',
        label: 'مقالات وبلاگ',
        icon: EditOutlined,
        permission: PERMISSIONS.BLOG_READ,
        keywords: 'blog post مقاله وبلاگ',
      },
      {
        path: '/pages',
        label: 'صفحات و سئو',
        icon: FileTextOutlined,
        permission: PERMISSIONS.PAGE_READ,
        keywords: 'page صفحه سئو لندینگ',
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

  reports: {
    key: 'reports',
    label: 'گزارش‌ها',
    icon: BarChartOutlined,
    section: 'analytics',
    children: [
      {
        path: '/reports/sales',
        label: 'فروش و درآمد',
        icon: RiseOutlined,
        permission: PERMISSIONS.REPORT_READ_SALES,
        keywords: 'report sales فروش درآمد نمودار',
      },
      {
        path: '/reports/products',
        label: 'محصولات و انبار',
        icon: ShoppingOutlined,
        permission: PERMISSIONS.REPORT_READ_PRODUCTS,
        keywords: 'report product گزارش کالا پرفروش موجودی',
      },
      {
        path: '/reports/customers',
        label: 'مشتریان و وفاداری',
        icon: UserOutlined,
        permission: PERMISSIONS.REPORT_READ_CUSTOMERS,
        keywords: 'report customer مشتری خریداران',
      },
      {
        path: '/reports/delivered-items',
        label: 'اقلام تحویل‌شده',
        icon: TruckOutlined,
        permission: PERMISSIONS.REPORT_READ_DELIVERED,
        keywords: 'report delivered تحویل تاریخچه',
      },
      {
        path: '/reports/audit-logs',
        label: 'گزارش سیستم',
        icon: ProfileOutlined,
        permission: PERMISSIONS.ADMIN_READ,
        keywords: 'audit log فعالیت سیستم رویداد',
      },
    ],
  },

  settings: {
    path: '/settings',
    label: 'تنظیمات فروشگاه',
    icon: SettingOutlined,
    section: 'system',
    permission: PERMISSIONS.SETTINGS_READ,
    keywords: 'settings تنظیمات فروشگاه',
  },

  backup: {
    path: '/settings/backup',
    label: 'بکاپ و بازیابی',
    icon: CloudServerOutlined,
    section: 'system',
    roles: ['superadmin'],
    permission: PERMISSIONS.BACKUP_READ,
    keywords: 'backup restore بکاپ پشتیبان بازیابی دیتابیس ذخیره',
  },

  aiProviders: {
    path: '/settings/ai-providers',
    label: 'هوش مصنوعی',
    icon: BulbOutlined,
    section: 'system',
    permission: PERMISSIONS.SETTINGS_UPDATE,
    keywords: 'ai provider chat gpt مدل هوشمند',
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

const NODE_ORDER = [
  'dashboard',
  'orders',
  'customers',
  'tickets',
  'products',
  'finance',
  'content',
  'reports',
  'settings',
  'backup',
  'aiProviders',
  'admins',
]

/** Flat list of every node, in executive reading order. */
export const NAV_TREE = NODE_ORDER.map((k) => nav[k])

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
 * still resolves to "همه محصولات" and `/orders/123` to "لیست سفارش‌ها".
 */
export function findTrail(pathname) {
  let best = null
  for (const page of NAV_PAGES) {
    if (page.path === pathname) {
      return { page, exact: true }
    }
    if (pathname.startsWith(`${page.path}/`)) {
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
  support: 'پشتیبان',
  editor: 'ویرایشگر',
  user: 'کاربر',
}

export { LogoutOutlined }
