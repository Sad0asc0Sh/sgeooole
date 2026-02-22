// ===================================
// داده‌های Mock برای تمام ماژول‌ها
// ===================================

// دسته‌بندی‌ها (ساختار درختی)
export const mockCategories = [
  {
    id: '1',
    name: 'الکترونیک',
    key: '1',
    parent: null,
    isFeatured: true,
    icon: 'laptop',
    image: 'https://via.placeholder.com/150',
    description: 'محصولات الکترونیکی',
    children: [
      {
        id: '1-1',
        key: '1-1',
        name: 'موبایل و تبلت',
        parent: '1',
        isFeatured: true,
        children: [
          { id: '1-1-1', key: '1-1-1', name: 'گوشی موبایل', parent: '1-1', isFeatured: false },
          { id: '1-1-2', key: '1-1-2', name: 'تبلت', parent: '1-1', isFeatured: false },
        ],
      },
      {
        id: '1-2',
        key: '1-2',
        name: 'لپتاپ و کامپیوتر',
        parent: '1',
        children: [
          { id: '1-2-1', key: '1-2-1', name: 'لپتاپ', parent: '1-2' },
          { id: '1-2-2', key: '1-2-2', name: 'کامپیوتر دسکتاپ', parent: '1-2' },
        ],
      },
    ],
  },
  {
    id: '2',
    key: '2',
    name: 'پوشاک',
    parent: null,
    isFeatured: true,
    icon: 'skin',
    children: [
      { id: '2-1', key: '2-1', name: 'پوشاک مردانه', parent: '2' },
      { id: '2-2', key: '2-2', name: 'پوشاک زنانه', parent: '2' },
      { id: '2-3', key: '2-3', name: 'پوشاک بچگانه', parent: '2' },
    ],
  },
  {
    id: '3',
    key: '3',
    name: 'خانه و آشپزخانه',
    parent: null,
    children: [
      { id: '3-1', key: '3-1', name: 'لوازم آشپزخانه', parent: '3' },
      { id: '3-2', key: '3-2', name: 'دکوراسیون', parent: '3' },
    ],
  },
]

// برندها
export const mockBrands = [
  { id: '1', name: 'سامسونگ', logo: 'https://via.placeholder.com/80', description: 'برند کره‌ای' },
  { id: '2', name: 'اپل', logo: 'https://via.placeholder.com/80', description: 'برند آمریکایی' },
  { id: '3', name: 'شیائومی', logo: 'https://via.placeholder.com/80', description: 'برند چینی' },
  { id: '4', name: 'ال جی', logo: 'https://via.placeholder.com/80', description: 'برند کره‌ای' },
]

// محصولات
export const mockProducts = Array.from({ length: 50 }, (_, i) => ({
  id: `${i + 1}`,
  name: `محصول ${i + 1}`,
  sku: `PRD-${String(i + 1).padStart(4, '0')}`,
  category: mockCategories[i % 3].id,
  categoryName: mockCategories[i % 3].name,
  brand: mockBrands[i % 4].id,
  brandName: mockBrands[i % 4].name,
  price: Math.floor(Math.random() * 10000000) + 100000,
  discountPrice: Math.random() > 0.5 ? Math.floor(Math.random() * 8000000) + 80000 : null,
  stock: Math.floor(Math.random() * 100),
  weight: Math.floor(Math.random() * 5000) + 100,
  status: Math.random() > 0.2 ? 'active' : 'inactive',
  image: `https://via.placeholder.com/200?text=Product${i + 1}`,
  images: [
    { uid: `img1-${i}`, url: `https://via.placeholder.com/600?text=Img1-${i}`, isPrimary: true },
    { uid: `img2-${i}`, url: `https://via.placeholder.com/600?text=Img2-${i}`, isPrimary: false },
    { uid: `img3-${i}`, url: `https://via.placeholder.com/600?text=Img3-${i}`, isPrimary: false },
  ],
  shortDescription: `توضیحات کوتاه محصول ${i + 1}`,
  description: `<p>توضیحات کامل محصول ${i + 1}</p><p>این یک محصول فوق‌العاده است.</p>`,
  seoTitle: `محصول ${i + 1} - خرید آنلاین`,
  seoDescription: `خرید محصول ${i + 1} با بهترین قیمت`,
  slug: `product-${i + 1}`,
  relatedProducts: [(i + 1) % 50 + 1, (i + 2) % 50 + 1],
  variants: [],
  createdAt: new Date(2024, 0, Math.floor(Math.random() * 28) + 1).toISOString(),
}))

// سفارشات
export const mockOrders = Array.from({ length: 100 }, (_, i) => ({
  id: `${i + 1}`,
  orderNumber: `ORD-${String(i + 1).padStart(6, '0')}`,
  customer: {
    id: `${(i % 30) + 1}`,
    name: `مشتری ${(i % 30) + 1}`,
    phone: `0912${String(i).padStart(7, '0')}`,
    email: `customer${(i % 30) + 1}@example.com`,
  },
  items: [
    {
      product: mockProducts[i % 50].id,
      name: mockProducts[i % 50].name,
      image: mockProducts[i % 50].image,
      price: mockProducts[i % 50].price,
      qty: Math.floor(Math.random() * 3) + 1,
    },
  ],
  shippingAddress: {
    fullName: `مشتری ${(i % 30) + 1}`,
    address: `تهران، خیابان ${i + 1}، پلاک ${i + 10}`,
    city: 'تهران',
    postalCode: `${String(i).padStart(10, '0')}`,
    phone: `0912${String(i).padStart(7, '0')}`,
  },
  status: ['pending', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled'][i % 6],
  paymentStatus: Math.random() > 0.3 ? 'paid' : 'pending',
  totalAmount: Math.floor(Math.random() * 5000000) + 500000,
  shippingCost: 50000,
  discount: Math.random() > 0.7 ? Math.floor(Math.random() * 500000) : 0,
  notes: Math.random() > 0.7 ? 'یادداشت داخلی برای این سفارش' : '',
  trackingNumber: Math.random() > 0.5 ? `TRK-${String(i).padStart(10, '0')}` : null,
  createdAt: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
  timeline: [
    { status: 'pending', date: new Date(2024, 10, 1).toISOString(), note: 'سفارش ثبت شد' },
    { status: 'processing', date: new Date(2024, 10, 2).toISOString(), note: 'در حال پردازش' },
  ],
}))

// مشتریان
export const mockCustomers = Array.from({ length: 100 }, (_, i) => ({
  id: `${i + 1}`,
  name: `مشتری ${i + 1}`,
  email: `customer${i + 1}@example.com`,
  phone: `0912${String(i).padStart(7, '0')}`,
  totalOrders: Math.floor(Math.random() * 20),
  totalSpent: Math.floor(Math.random() * 50000000) + 1000000,
  walletBalance: Math.floor(Math.random() * 5000000),
  status: Math.random() > 0.1 ? 'active' : 'inactive',
  registeredAt: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
  addresses: [
    {
      id: '1',
      fullName: `مشتری ${i + 1}`,
      address: `تهران، خیابان ${i + 1}`,
      city: 'تهران',
      postalCode: `${String(i).padStart(10, '0')}`,
      phone: `0912${String(i).padStart(7, '0')}`,
      isDefault: true,
    },
  ],
}))

// کوپن‌ها
export const mockCoupons = Array.from({ length: 20 }, (_, i) => ({
  id: `${i + 1}`,
  code: `COUPON${i + 1}`,
  type: i % 2 === 0 ? 'percentage' : 'fixed',
  value: i % 2 === 0 ? Math.floor(Math.random() * 50) + 5 : Math.floor(Math.random() * 500000) + 50000,
  minPurchase: Math.floor(Math.random() * 1000000) + 100000,
  maxDiscount: i % 2 === 0 ? Math.floor(Math.random() * 500000) + 100000 : null,
  usageLimit: Math.floor(Math.random() * 100) + 10,
  usageCount: Math.floor(Math.random() * 50),
  validFrom: new Date(2024, 0, 1).toISOString(),
  validUntil: new Date(2024, 11, 31).toISOString(),
  status: Math.random() > 0.2 ? 'active' : 'inactive',
}))

// تیکت‌ها
export const mockTickets = Array.from({ length: 50 }, (_, i) => ({
  id: `${i + 1}`,
  ticketNumber: `TKT-${String(i + 1).padStart(5, '0')}`,
  subject: `موضوع تیکت ${i + 1}`,
  customer: mockCustomers[i % 30],
  category: ['فنی', 'مالی', 'محصول', 'ارسال'][i % 4],
  priority: ['low', 'medium', 'high', 'urgent'][i % 4],
  status: ['open', 'replied', 'closed'][i % 3],
  messages: [
    {
      id: '1',
      sender: 'customer',
      senderName: mockCustomers[i % 30].name,
      message: 'سلام، من یک مشکل با محصول دارم',
      createdAt: new Date(2024, 10, 1, 10, 0).toISOString(),
    },
  ],
  createdAt: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
}))

// RMA (بازگشت کالا)
export const mockRMA = Array.from({ length: 30 }, (_, i) => ({
  id: `${i + 1}`,
  rmaNumber: `RMA-${String(i + 1).padStart(5, '0')}`,
  order: mockOrders[i % 50],
  customer: mockCustomers[i % 30],
  reason: ['نقص فنی', 'تفاوت با توضیحات', 'ارسال اشتباه', 'تغییر نظر مشتری'][i % 4],
  status: ['pending', 'approved', 'rejected', 'completed'][i % 4],
  images: [`https://via.placeholder.com/300?text=RMA-${i}`],
  description: `توضیحات مشتری برای درخواست بازگشت کالا`,
  createdAt: new Date(2024, 10, Math.floor(Math.random() * 28) + 1).toISOString(),
}))

// سبدهای رها شده
export const mockAbandonedCarts = Array.from({ length: 40 }, (_, i) => ({
  id: `${i + 1}`,
  customer: mockCustomers[i % 30],
  items: [
    {
      product: mockProducts[i % 50],
      qty: Math.floor(Math.random() * 3) + 1,
    },
  ],
  totalAmount: Math.floor(Math.random() * 3000000) + 500000,
  abandonedAt: new Date(2024, 10, Math.floor(Math.random() * 28) + 1).toISOString(),
  reminderSent: Math.random() > 0.5,
}))

// صفحات ثابت
export const mockPages = [
  { id: '1', title: 'درباره ما', slug: 'about', content: '<h1>درباره ما</h1><p>محتوای صفحه درباره ما</p>', status: 'published' },
  { id: '2', title: 'تماس با ما', slug: 'contact', content: '<h1>تماس با ما</h1><p>شماره تماس: ...</p>', status: 'published' },
  { id: '3', title: 'قوانین و مقررات', slug: 'terms', content: '<h1>قوانین</h1>', status: 'published' },
]

// پست‌های بلاگ
export const mockBlogPosts = Array.from({ length: 30 }, (_, i) => ({
  id: `${i + 1}`,
  title: `پست بلاگ ${i + 1}`,
  slug: `post-${i + 1}`,
  category: ['فناوری', 'مد و پوشاک', 'سبک زندگی'][i % 3],
  image: `https://via.placeholder.com/600x400?text=Blog${i + 1}`,
  excerpt: `خلاصه پست ${i + 1}`,
  content: `<h2>پست بلاگ ${i + 1}</h2><p>محتوای کامل پست</p>`,
  status: Math.random() > 0.2 ? 'published' : 'draft',
  createdAt: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
}))

// بنرها
export const mockBanners = Array.from({ length: 10 }, (_, i) => ({
  id: `${i + 1}`,
  title: `بنر ${i + 1}`,
  image: `https://via.placeholder.com/1200x400?text=Banner${i + 1}`,
  link: `/products/${i + 1}`,
  position: ['home-slider', 'home-top', 'sidebar'][i % 3],
  status: Math.random() > 0.3 ? 'active' : 'inactive',
  order: i + 1,
}))

// ادمین‌ها
export const mockAdmins = [
  { id: '1', name: 'ادمین اصلی', email: 'admin@example.com', role: 'superadmin', status: 'active', createdAt: '2024-01-01' },
  { id: '2', name: 'پشتیبان 1', email: 'support1@example.com', role: 'support', status: 'active', createdAt: '2024-02-01' },
  { id: '3', name: 'انباردار 1', email: 'warehouse1@example.com', role: 'warehouse', status: 'active', createdAt: '2024-03-01' },
]

// تاریخچه موجودی
export const mockInventoryHistory = Array.from({ length: 100 }, (_, i) => ({
  id: `${i + 1}`,
  product: mockProducts[i % 50],
  type: i % 2 === 0 ? 'in' : 'out',
  quantity: Math.floor(Math.random() * 50) + 1,
  reason: i % 2 === 0 ? 'خرید از تامین‌کننده' : 'فروش به مشتری',
  admin: mockAdmins[0],
  createdAt: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
}))

// آمار داشبورد
export const mockDashboardStats = {
  todaySales: 45000000,
  todaySalesChange: 12.5,
  pendingOrders: 23,
  lowStockProducts: [
    { ...mockProducts[0], stock: 3 },
    { ...mockProducts[1], stock: 5 },
    { ...mockProducts[2], stock: 2 },
    { ...mockProducts[3], stock: 1 },
    { ...mockProducts[4], stock: 4 },
  ],
  abandonedCarts: 15,
  newCustomers: 47,
  conversionRate: 3.8,
  salesChart: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(2024, 10, i + 1).toLocaleDateString('fa-IR'),
    sales: Math.floor(Math.random() * 50000000) + 10000000,
  })),
  recentOrders: mockOrders.slice(0, 5),
}

// گزارشات فروش
export const mockSalesReports = {
  daily: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(2024, 10, i + 1).toLocaleDateString('fa-IR'),
    orders: Math.floor(Math.random() * 50) + 10,
    revenue: Math.floor(Math.random() * 100000000) + 10000000,
  })),
  monthly: Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2024, i, 1).toLocaleDateString('fa-IR', { month: 'long', year: 'numeric' }),
    orders: Math.floor(Math.random() * 500) + 100,
    revenue: Math.floor(Math.random() * 1000000000) + 100000000,
  })),
}

// تنظیمات
export const mockSettings = {
  general: {
    siteName: 'EKGKala',
    logo: 'https://via.placeholder.com/200x80?text=Logo',
    favicon: 'https://via.placeholder.com/32',
    currency: 'تومان',
    language: 'fa',
  },
  payment: {
    zarinpal: {
      enabled: true,
      merchantId: 'xxxx-xxxx-xxxx-xxxx',
    },
    idpay: {
      enabled: false,
      apiKey: '',
    },
  },
  shipping: {
    postPishtaz: { enabled: true, cost: 50000 },
    postSefareshi: { enabled: true, cost: 80000 },
    tipax: { enabled: true, cost: 120000 },
  },
  notifications: {
    emailOrderConfirmation: { enabled: true, template: 'سفارش شما با موفقیت ثبت شد...' },
    smsOrderShipped: { enabled: true, template: 'سفارش شما ارسال شد...' },
  },
  seo: {
    googleAnalyticsId: 'UA-XXXXXXXXX-X',
    googleTagManagerId: 'GTM-XXXXXXX',
  },
}
