# تست عملکرد حذف سبد خرید

## تغییرات انجام شده

### 1. Backend (cartController.js)
✅ اضافه شدن `mongoose` import
✅ validate کردن ObjectId قبل از query
✅ لاگ‌های جامع برای debugging
✅ پیام‌های خطای واضح‌تر

### 2. Frontend (admin/src/api/index.js)
✅ رفع مشکل interceptor که `error.response` را از بین می‌برد
✅ حالا خطای اصلی axios برگردانده می‌شود نه Error جدید

## نحوه تست

### تست 1: حذف سبد موجود

1. برو به پنل ادمین → سفارشات → سبدهای رها شده
2. یک سبد را پیدا کن
3. روی دکمه "حذف" 🗑️ کلیک کن
4. در دیالوگ تایید، "حذف" را انتخاب کن

**نتیجه مورد انتظار:**
```
✅ سبد خرید با موفقیت حذف شد
```

**لاگ سرور:**
```
[DELETE CART] Request received for cartId: 67xxxxx
[DELETE CART] Successfully deleted cart: 67xxxxx for user: 66xxxxx
```

### تست 2: حذف سبد غیر موجود

1. در مرورگر، Console را باز کن
2. این کد را اجرا کن:
```javascript
await axios.delete('http://localhost:5000/api/carts/admin/507f1f77bcf86cd799439011', {
  headers: { Authorization: `Bearer ${yourToken}` }
})
```

**نتیجه مورد انتظار:**
```
❌ سبد خرید یافت نشد
```

**لاگ سرور:**
```
[DELETE CART] Request received for cartId: 507f1f77bcf86cd799439011
[DELETE CART] Cart not found: 507f1f77bcf86cd799439011
```

### تست 3: ID نامعتبر

```javascript
await axios.delete('http://localhost:5000/api/carts/admin/invalid-id-123', {
  headers: { Authorization: `Bearer ${yourToken}` }
})
```

**نتیجه مورد انتظار:**
```
❌ شناسه سبد خرید نامعتبر است
```

**لاگ سرور:**
```
[DELETE CART] Request received for cartId: invalid-id-123
[DELETE CART] Invalid ObjectId: invalid-id-123
```

## خطایابی

### اگر باز هم خطا داد:

1. **بررسی لاگ سرور:**
```bash
# در ترمینال backend
# باید لاگ‌های [DELETE CART] را ببینید
```

2. **بررسی Console مرورگر:**
```javascript
// Network tab → XHR → کلیک روی request حذف
// Response را بررسی کنید
```

3. **بررسی Authorization:**
```javascript
// در Console مرورگر
console.log(localStorage.getItem('auth-storage'))
// باید token ببینید
```

4. **تست دستی با curl:**
```bash
curl -X DELETE http://localhost:5000/api/carts/admin/YOUR_CART_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## مشکلات رایج و راه‌حل

### خطا: "Network Error"
**علت:** سرور Backend روشن نیست
**راه‌حل:**
```bash
cd welfvita-backend
npm start
```

### خطا: "401 Unauthorized"
**علت:** Token نامعتبر یا منقضی شده
**راه‌حل:** خروج و ورود مجدد به پنل ادمین

### خطا: "Cannot read property 'response' of undefined"
**علت:** Interceptor axios مشکل دارد
**راه‌حل:** مطمئن شوید که تغییرات `admin/src/api/index.js` اعمال شده

### خطا: "Cart not found"
**علت:** سبد قبلاً حذف شده یا وجود ندارد
**راه‌حل:** صفحه را refresh کنید و سبد دیگری را امتحان کنید

## تفاوت با نسخه قبل

| قبل | بعد |
|-----|-----|
| `cart.deleteOne()` | `Cart.findByIdAndDelete()` |
| بدون validate ID | با validate ID |
| لاگ ساده | لاگ جامع با prefix |
| خطای generic | خطای مشخص (400/404/500) |
| `Promise.reject(new Error(...))` | `Promise.reject(error)` |

## چک‌لیست تست نهایی

- [ ] حذف سبد موجود کار می‌کند
- [ ] پیام موفقیت نمایش داده می‌شود
- [ ] صفحه بعد از حذف refresh می‌شود
- [ ] سبد از لیست حذف می‌شود
- [ ] لاگ‌های سرور صحیح هستند
- [ ] خطاهای مناسب برای ID نامعتبر
- [ ] خطاهای مناسب برای سبد غیر موجود
