# 📦 راهنمای نصب Backend

## 🎯 پیش‌نیازها

قبل از شروع، مطمئن شوید این‌ها را نصب کرده‌اید:

- [x] **Node.js** 16+ ([دانلود](https://nodejs.org/))
- [x] **MongoDB** 5+ ([دانلود](https://www.mongodb.com/try/download/community))
- [x] **Git** (اختیاری)

بررسی نسخه‌ها:
```bash
node --version   # باید v16.0.0 یا بالاتر باشد
pnpm --version   # باید v12.8.1 باشد
mongod --version # باید v5.0.0 یا بالاتر باشد
```

---

## 🚀 نصب (5 دقیقه)

### مرحله 1: استخراج فایل

```bash
# استخراج
tar -xzf ekgkala-backend.tar.gz

# ورود به پوشه
cd ekgkala-backend
```

### مرحله 2: نصب Dependencies

```bash
pnpm install
```

**خروجی مورد انتظار:**
```
added 150 packages in 30s
```

### مرحله 3: تنظیم Environment Variables

```bash
# کپی کردن فایل .env.example
cp .env.example .env
```

**ویرایش فایل .env:**
```bash
# با ویرایشگر دلخواه خود باز کنید:
nano .env
# یا
vim .env
# یا
code .env
```

**محتوای .env:**
```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/ekgkala

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
```

### مرحله 4: راه‌اندازی MongoDB

#### گزینه A: MongoDB محلی

```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
# از Services → MongoDB → Start
```

#### گزینه B: Docker

```bash
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:latest
```

**بررسی اتصال:**
```bash
mongosh

# باید وارد MongoDB Shell شوید
# خروج با: exit
```

### مرحله 5: اجرای Backend

```bash
# Development mode (توصیه می‌شود)
pnpm run dev
```

**خروجی موفق:**
```
╔════════════════════════════════════════╗
║     EkgKala Backend Server            ║
╚════════════════════════════════════════╝
✅ MongoDB متصل شد
📍 Database: ekgkala
🚀 Server running on port 5000
📍 API: http://localhost:5000/api
📁 Uploads: http://localhost:5000/uploads
🌍 Environment: development
═══════════════════════════════════════════
```

---

## ✅ تست نصب

### تست 1: Health Check

```bash
curl http://localhost:5000/api/health
```

**پاسخ موفق:**
```json
{
  "success": true,
  "message": "Backend is running",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "database": "connected"
}
```

### تست 2: دریافت درخت دسته‌بندی‌ها

```bash
curl http://localhost:5000/api/categories/tree
```

**پاسخ (خالی در ابتدا):**
```json
{
  "success": true,
  "data": [],
  "count": 0
}
```

### تست 3: ایجاد دسته‌بندی

با **Postman** یا **cURL**:

```bash
curl -X POST http://localhost:5000/api/categories \
  -F "name=الکترونیک" \
  -F "description=محصولات الکترونیکی" \
  -F "isFeatured=true"
```

**پاسخ موفق:**
```json
{
  "success": true,
  "data": {
    "_id": "65abc123...",
    "name": "الکترونیک",
    "description": "محصولات الکترونیکی",
    "isFeatured": true,
    "parent": null,
    "isActive": true,
    "createdAt": "2024-01-01T12:00:00.000Z"
  },
  "message": "دسته‌بندی با موفقیت ایجاد شد"
}
```

---

## 🔧 رفع مشکلات رایج

### مشکل 1: MongoDB Connection Refused

**خطا:**
```
❌ خطا در اتصال به MongoDB: connect ECONNREFUSED 127.0.0.1:27017
```

**راه‌حل:**
```bash
# بررسی اجرای MongoDB:
mongosh

# اگر خطا داد، MongoDB را اجرا کنید:
# macOS:
brew services start mongodb-community

# Linux:
sudo systemctl start mongod

# Docker:
docker start mongodb
```

---

### مشکل 2: Port 5000 Already in Use

**خطا:**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**راه‌حل:**
```bash
# پیدا کردن process:
lsof -i :5000

# Kill کردن:
kill -9 <PID>

# یا تغییر PORT در .env:
PORT=5001
```

---

### مشکل 3: Permission Denied (uploads)

**خطا:**
```
Error: EACCES: permission denied, mkdir 'uploads/categories'
```

**راه‌حل:**
```bash
# دادن دسترسی:
chmod -R 755 uploads/

# یا ایجاد دستی:
mkdir -p uploads/categories
```

---

### مشکل 4: Module Not Found

**خطا:**
```
Error: Cannot find module 'express'
```

**راه‌حل:**
```bash
# حذف و نصب مجدد:
rm -rf node_modules package-lock.json
pnpm install
```

---

## 📊 ساختار نهایی

بعد از نصب، ساختار باید این شکلی باشد:

```
ekgkala-backend/
├── models/
│   └── Category.js              ✅
├── routes/
│   └── categories.js            ✅
├── uploads/
│   └── categories/
│       └── .gitkeep             ✅
├── node_modules/                ✅ (بعد از pnpm install)
├── server.js                    ✅
├── package.json                 ✅
├── pnpm-lock.yaml              ✅ (بعد از pnpm install)
├── .env                         ✅ (کپی از .env.example)
├── .env.example                 ✅
├── .gitignore                   ✅
├── README.md                    ✅
└── INSTALLATION.md              ✅
```

---

## 🎯 مراحل بعدی

1. ✅ Backend نصب و اجرا شد
2. ⬜ نصب و اجرای Frontend
3. ⬜ اتصال Frontend به Backend
4. ⬜ تست کامل سیستم

---

## 📞 نیاز به کمک؟

- بررسی کنید `pnpm run dev` بدون خطا اجرا شود
- بررسی کنید `curl http://localhost:5000/api/health` پاسخ `200 OK` بدهد
- Log‌های Console را بررسی کنید

**موفق باشید! 🚀**
