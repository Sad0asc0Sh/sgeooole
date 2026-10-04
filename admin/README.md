# 🎯 پنل مدیریت جامع فروشگاه (UI-Only)

یک پنل ادمین **کامل و حرفه‌ای** با **React + Vite + Ant Design**

## ✨ ویژگی‌ها

### ✅ پیاده‌سازی شده

- ✅ **Layout کامل**: Sidebar + Header + Responsive
- ✅ **احراز هویت**: Login با Zustand
- ✅ **داشبورد**: 8 ویجت + نمودار فروش (Recharts)
- ✅ **لیست محصولات**: جدول پیشرفته با فیلتر و bulk actions
- ✅ **داده‌های Mock کامل**: 50 محصول، 100 سفارش، 100 مشتری، و بیشتر
- ✅ **10 ماژول اصلی**: محصولات، سفارشات، مشتریان، مالی، محتوا، تیکت‌ها، گزارشات، تنظیمات، ادمین‌ها
- ✅ **Routing کامل**: تمام مسیرها تعریف شده
- ✅ **RTL Support**: پشتیبانی کامل از فارسی

### ⏳ نیاز به توسعه

تمام صفحات به صورت placeholder ایجاد شده‌اند و آماده توسعه هستند:
- ProductForm (با 6 تب)
- CategoriesPage (با Tree)
- ProductVariants
- تمام صفحات سفارشات، مشتریان، و سایر ماژول‌ها

## 🚀 نصب و اجرا

### پیش‌نیازها
- Node.js 18+
- pnpm 12.8.1 (see `packageManager` in package.json)

### مراحل نصب

```bash
# 1. نصب وابستگی‌ها
pnpm install

# 2. اجرای پروژه
pnpm run dev

# 3. مشاهده در مرورگر
# http://localhost:3000
```

### ورود به پنل

```
ایمیل: admin@example.com
رمز عبور: password
```

## 📦 تکنولوژی‌ها

- **React 18.3** - کتابخانه UI
- **Vite 5** - Build Tool
- **Ant Design 5** - کامپوننت‌های UI
- **React Router v6** - مسیریابی
- **Zustand** - State Management
- **Recharts** - نمودارها
- **React Quill** - ویرایشگر HTML
- **React Beautiful DnD** - Drag & Drop (آماده استفاده)

## 📁 ساختار پروژه

```
admin-panel/
├── src/
│   ├── components/
│   │   └── layout/              # Layout اصلی
│   ├── pages/
│   │   ├── LoginPage.jsx        # ✅ آماده
│   │   ├── Dashboard.jsx        # ✅ آماده
│   │   ├── products/            # 📦 ماژول محصولات
│   │   ├── orders/              # 🛒 ماژول سفارشات
│   │   ├── customers/           # 👥 ماژول مشتریان
│   │   ├── finance/             # 💰 ماژول مالی
│   │   ├── content/             # 📄 ماژول محتوا
│   │   ├── tickets/             # 🎫 پشتیبانی
│   │   ├── reports/             # 📊 گزارشات
│   │   ├── settings/            # ⚙️ تنظیمات
│   │   └── admins/              # 👨‍💼 ادمین‌ها
│   ├── stores/
│   │   └── index.js             # Zustand Stores
│   ├── data/
│   │   └── mockData.js          # داده‌های Mock
│   ├── App.jsx                  # Router اصلی
│   └── main.jsx
├── package.json
└── README.md
```

## 🎯 10 ماژول اصلی

### 1. داشبورد
- 8 کارت آماری
- نمودار فروش هفتگی
- لیست محصولات با موجودی کم
- آخرین سفارشات

### 2. محصولات
- لیست محصولات (✅ کامل)
- افزودن/ویرایش محصول (⏳ نیاز به توسعه)
  - 6 تب: اطلاعات اصلی، تصاویر، Variants، توضیحات، سئو، محصولات مرتبط
- دسته‌بندی‌ها (⏳ با Tree و Drag & Drop)
- برندها (⏳)
- مدیریت موجودی (⏳)

### 3. سفارشات
- لیست سفارشات (⏳)
- جزئیات سفارش (⏳)
- بازگشت کالا - RMA (⏳)
- سبدهای رها شده (⏳)

### 4. مشتریان
- لیست مشتریان (⏳)
- پروفایل مشتری (⏳)
  - 5 تب: اطلاعات، آدرس‌ها، سفارشات، تیکت‌ها، کیف پول

### 5. مالی و تخفیف
- کوپن‌های تخفیف (⏳)
- هزینه ارسال (⏳)

### 6. محتوا و سئو
- صفحات ثابت (⏳)
- بلاگ (⏳)
- بنرها (⏳)

### 7. پشتیبانی (تیکت‌ها)
- لیست تیکت‌ها (⏳)
- جزئیات تیکت (⏳)
  - نمای چت‌مانند

### 8. تنظیمات
- تنظیمات عمومی (⏳)
- پرداخت (⏳)
- اعلان‌ها (⏳)
- سئو (⏳)

### 9. گزارشات
- گزارش فروش (⏳)
- گزارش محصولات (⏳)
- گزارش مشتریان (⏳)

### 10. مدیریت ادمین‌ها
- لیست ادمین‌ها (⏳)
- نقش‌ها (⏳)

## 📚 داده‌های Mock

تمام داده‌های لازم در فایل `src/data/mockData.js` موجود است:

```javascript
import { 
  mockCategories,      // دسته‌بندی‌های درختی
  mockProducts,        // 50 محصول
  mockOrders,          // 100 سفارش
  mockCustomers,       // 100 مشتری
  mockCoupons,         // 20 کوپن
  mockTickets,         // 50 تیکت
  mockBrands,          // برندها
  mockRMA,             // بازگشت کالا
  mockAbandonedCarts,  // سبدهای رها شده
  mockPages,           // صفحات ثابت
  mockBlogPosts,       // پست‌های بلاگ
  mockBanners,         // بنرها
  mockAdmins,          // ادمین‌ها
  mockDashboardStats,  // آمار داشبورد
} from '../data/mockData'
```

## 🔧 نحوه توسعه صفحات

برای تکمیل صفحات placeholder:

### مثال 1: ProductForm

```jsx
import { Tabs, Form, Input, TreeSelect } from 'antd'
import { mockCategories } from '../../data/mockData'

function ProductForm() {
  const items = [
    {
      key: '1',
      label: 'اطلاعات اصلی',
      children: (
        <Form layout="vertical">
          <Form.Item name="name" label="نام محصول">
            <Input />
          </Form.Item>
          <Form.Item name="category" label="دسته‌بندی">
            <TreeSelect
              treeData={mockCategories}
              placeholder="انتخاب دسته‌بندی"
            />
          </Form.Item>
          {/* سایر فیلدها */}
        </Form>
      ),
    },
    // تب‌های دیگر
  ]

  return (
    <div>
      <h1>افزودن/ویرایش محصول</h1>
      <Tabs items={items} />
    </div>
  )
}

export default ProductForm
```

### مثال 2: CategoriesPage با Tree

```jsx
import { Tree, Button, Modal } from 'antd'
import { mockCategories } from '../../data/mockData'

function CategoriesPage() {
  return (
    <div>
      <Button type="primary">افزودن دسته‌بندی</Button>
      <Tree
        draggable
        treeData={mockCategories}
        onDrop={(info) => console.log('مرتب‌سازی', info)}
      />
    </div>
  )
}
```

## 📖 مستندات کامل

مستندات جامع در فایل `COMPLETE_ADMIN_GUIDE.md` موجود است.

## 🎨 طراحی

- **رنگ اصلی**: آبی (#1890ff)
- **فونت**: System fonts با پشتیبانی RTL
- **Responsive**: کاملاً موبایل‌سازگار
- **Dark Mode**: آماده برای پیاده‌سازی

## 🚧 To-Do List

- [ ] تکمیل ProductForm (6 تب)
- [ ] CategoriesPage با Tree & Drag & Drop
- [ ] ProductVariants (ایجاد خودکار variants)
- [ ] تمام صفحات سفارشات
- [ ] صفحات مشتریان با Tabs
- [ ] صفحات مالی
- [ ] صفحات محتوا
- [ ] تیکت‌ها با Chat UI
- [ ] گزارشات با نمودار
- [ ] صفحه تنظیمات
- [ ] مدیریت ادمین‌ها

## 💡 نکات مهم

1. **همه داده‌ها Mock هستند** - بدون API
2. **Zustand** برای state management
3. **Ant Design RTL** فعال است
4. **React Router** برای routing
5. **Responsive** - Drawer برای موبایل

## 🤝 مشارکت

برای افزودن صفحات جدید:

1. فایل را در پوشه مربوطه بسازید
2. از داده‌های mock استفاده کنید
3. Route را در App.jsx اضافه کنید
4. آیتم منو را در MainLayout.jsx اضافه کنید

## 📞 پشتیبانی

مشکل دارید؟ به فایل `COMPLETE_ADMIN_GUIDE.md` مراجعه کنید.

---

**پروژه آماده برای توسعه است! 🚀**

تمام infrastructure آماده است. فقط کافی است صفحات را تکمیل کنید.

## 📝 License

MIT
