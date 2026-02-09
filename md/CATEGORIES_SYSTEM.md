# سیستم یکپارچه دسته‌بندی‌ها

## 📋 نمای کلی

سیستم دسته‌بندی‌های فرانت‌اند کاربر اکنون به طور کامل با پنل ادمین و Backend یکپارچه شده است.

## 🏗️ معماری

### Backend (Node.js + MongoDB)

**مدل دیتابیس:** `ekgkala-backend/models/Category.js`
- ساختار درختی (Tree Structure) با parent-child relationship
- پشتیبانی از چندین سطح زیرمجموعه (unlimited nesting)
- آپلود آیکون و تصویر روی Cloudinary
- فیلدهای `isFeatured` و `isPopular` برای نمایش در صفحه اصلی
- تولید slug خودکار از نام دسته‌بندی

**API Endpoints:**
```
GET  /api/categories/tree      → دریافت درخت کامل دسته‌بندی‌ها
GET  /api/categories           → لیست تمام دسته‌بندی‌ها (با فیلترها)
GET  /api/categories/:id       → دریافت یک دسته‌بندی
POST /api/categories           → ایجاد دسته‌بندی جدید (فقط ادمین)
PUT  /api/categories/:id       → ویرایش دسته‌بندی (فقط ادمین)
DELETE /api/categories/:id     → حذف دسته‌بندی (فقط ادمین)
```

### Frontend Services

**فایل:** `frontend/src/services/categoryService.ts`

متدهای موجود:
- `getTree()` - دریافت درخت کامل
- `getPopular()` - دسته‌بندی‌های محبوب
- `getFeatured()` - دسته‌بندی‌های ویژه
- `getAll(params)` - لیست با فیلتر
- `getRootCategories()` - دسته‌بندی‌های سطح ریشه
- `getById(id)` - دریافت یک دسته‌بندی
- `getChildren(parentId)` - زیرمجموعه‌های یک دسته‌بندی

### Frontend UI Components

#### 1. صفحه اصلی دسته‌بندی‌ها
**فایل:** `frontend/src/app/categories/page.tsx`
- یک wrapper ساده برای CategoriesContent

#### 2. کامپوننت محتوای دسته‌بندی‌ها
**فایل:** `frontend/src/components/features/categories/CategoriesContent.tsx`

**ویژگی‌ها:**
- نمایش دسته‌بندی‌های اصلی در سایدبار راست
- نمایش زیرمجموعه‌ها به صورت آکاردئون در سمت چپ
- پشتیبانی از آیکون‌ها و تصاویر از Cloudinary
- انیمیشن‌های روان با Framer Motion
- حالت‌های Loading, Error و Empty State
- لینک‌های مستقیم به صفحه محصولات با slug

#### 3. Sheet دسته‌بندی‌ها
**فایل:** `frontend/src/components/features/categories/CategoriesSheet.tsx`
- نمایش CategoriesContent در یک Sheet از پایین صفحه
- استفاده در Header برای دسترسی سریع

## 🎨 طراحی UI

### سایدبار راست (دسته‌بندی‌های اصلی)
- نمایش آیکون + نام
- Indicator نوار عمودی برای دسته‌بندی فعال
- رنگ‌آمیزی با Kala Theme
- Hover effects

### بخش محتوا (زیرمجموعه‌ها)
- Accordion برای هر زیردسته
- Grid 3 ستونی برای نمایش محصولات
- تصویر دایره‌ای + نام
- لینک به صفحه فیلتر شده محصولات

### حالت‌های خاص
- **Loading:** Spinner با پیام فارسی
- **Error:** آیکون + پیام خطا + دکمه تلاش مجدد
- **Empty:** آیکون + پیام "دسته‌بندی موجود نیست"

## 📱 مسیرهای یکپارچه

```
/categories                    → صفحه دسته‌بندی‌ها
/products?category={slug}      → فیلتر محصولات بر اساس دسته‌بندی
```

## 🔄 جریان داده

```
┌─────────────┐
│   Admin     │ ← ادمین دسته‌بندی‌ها را از پنل مدیریت می‌کند
└──────┬──────┘
       │ POST/PUT/DELETE
       ▼
┌─────────────┐
│  Backend    │ ← ذخیره در MongoDB + آپلود به Cloudinary
└──────┬──────┘
       │ GET
       ▼
┌─────────────┐
│  Frontend   │ ← نمایش در UI کاربر
└─────────────┘
```

## 🎯 مزایای سیستم یکپارچه

### 1. **Single Source of Truth**
- تمام دسته‌بندی‌ها از Backend می‌آیند
- هیچ Mock Data در فرانت‌اند وجود ندارد

### 2. **Auto-Sync با ادمین**
- هر تغییر در پنل ادمین فوراً در سایت کاربر اعمال می‌شود
- بدون نیاز به دیپلوی مجدد

### 3. **Scalable**
- پشتیبانی از نامحدود سطح زیرمجموعه
- Pagination برای دسته‌بندی‌های زیاد

### 4. **SEO Friendly**
- استفاده از slug‌های منحصربه‌فرد
- URL‌های تمیز و قابل فهم

### 5. **Performance**
- تصاویر از CDN Cloudinary
- Tree structure برای بارگذاری سریع
- Caching در سمت Backend

## 📝 نحوه استفاده در کامپوننت‌ها

### مثال 1: نمایش دسته‌بندی‌های محبوب

```tsx
import { categoryService } from "@/services/categoryService";

export default function PopularCategories() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    categoryService.getPopular().then(setCategories);
  }, []);

  return (
    <div>
      {categories.map(cat => (
        <Link key={cat._id} href={`/products?category=${cat.slug}`}>
          {cat.icon?.url && <img src={cat.icon.url} alt={cat.name} />}
          <span>{cat.name}</span>
        </Link>
      ))}
    </div>
  );
}
```

### مثال 2: نمایش درخت کامل

```tsx
import { categoryService } from "@/services/categoryService";

export default function CategoryTree() {
  const [tree, setTree] = useState([]);

  useEffect(() => {
    categoryService.getTree().then(setTree);
  }, []);

  const renderCategory = (category) => (
    <div key={category._id}>
      <h3>{category.name}</h3>
      {category.children?.map(renderCategory)}
    </div>
  );

  return <div>{tree.map(renderCategory)}</div>;
}
```

## 🔧 تنظیمات مورد نیاز

### 1. Cloudinary Domain
در `next.config.ts` باید اضافه شود:

```typescript
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "res.cloudinary.com",
    },
  ],
}
```

✅ **در حال حاضر اضافه شده است**

### 2. Backend URL
در `frontend/src/lib/api.ts` باید baseURL صحیح باشد:

```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
});
```

## 🎨 Customization

### تغییر رنگ‌ها
رنگ‌های استفاده شده:
- `kala-500`, `kala-600`, `kala-700` → رنگ اصلی
- `gray-50`, `gray-100`, ... → رنگ‌های خنثی

برای تغییر، `tailwind.config.js` را ویرایش کنید.

### تغییر Layout
- عرض سایدبار: `w-[28%]` در CategoriesContent
- تعداد ستون‌های grid: `grid-cols-3`

## 🚀 آینده (پیشنهادات)

1. **Search در دسته‌بندی‌ها**
   - اضافه کردن جستجو در بالای صفحه

2. **Breadcrumb**
   - نمایش مسیر دسته‌بندی فعال

3. **Product Count**
   - نمایش تعداد محصولات هر دسته‌بندی

4. **Filtering**
   - فیلتر بر اساا `isFeatured`, `isPopular`

5. **Caching**
   - استفاده از React Query یا SWR برای cache کردن

## ✅ تست سیستم

برای تست کامل:

1. **در پنل ادمین:**
   - دسته‌بندی جدید ایجاد کنید
   - آیکون و تصویر آپلود کنید
   - زیرمجموعه اضافه کنید
   - Featured/Popular را فعال کنید

2. **در سایت کاربر:**
   - `/categories` را باز کنید
   - باید دسته‌بندی جدید نمایش داده شود
   - روی آن کلیک کنید
   - زیرمجموعه‌ها باید نمایش داده شوند

3. **تست Error Handling:**
   - Backend را خاموش کنید
   - صفحه باید Error State نمایش دهد
   - دکمه "تلاش مجدد" باید کار کند

---

**ساخته شده با ❤️ برای ای‌کا‌جی کالا**
