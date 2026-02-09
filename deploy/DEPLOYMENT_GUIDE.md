# 🚀 راهنمای کامل دیپلوی EkgKala
## Vercel (Frontend/Admin) + Render (Backend) + MongoDB Atlas

---

## 📋 فهرست مطالب
1. [پیش‌نیازها](#پیش‌نیازها)
2. [آماده‌سازی سرویس‌های Free](#آماده‌سازی-سرویس‌های-free)
3. [دیپلوی Backend روی Render](#دیپلوی-backend-روی-render)
4. [دیپلوی Frontend روی Vercel](#دیپلوی-frontend-روی-vercel)
5. [دیپلوی Admin روی Vercel](#دیپلوی-admin-روی-vercel)
6. [اتصال دامنه](#اتصال-دامنه)
7. [تست و Verification](#تست-و-verification)
8. [Troubleshooting](#troubleshooting)

---

## 🔰 پیش‌نیازها

### اکانت‌های مورد نیاز:
- [ ] **GitHub Account** (برای کد)
- [ ] **MongoDB Atlas** (Database - Free)
- [ ] **Render.com** (Backend - Free)
- [ ] **Vercel.com** (Frontend & Admin - Free)
- [ ] **Cloudinary** (تصاویر - Free)
- [ ] **دامنه** (از هر رجیسترار)

### سرویس‌های اختیاری:
- [ ] **Upstash Redis** (Cache - Free tier)
- [ ] **ZarinPal** (پرداخت ایرانی)
- [ ] **Kavenegar** (SMS ایرانی)

---

## 🗄️ آماده‌سازی سرویس‌های Free

### 1️⃣ MongoDB Atlas (Database)

#### مرحله 1: ایجاد Cluster
```
1. برو به: https://www.mongodb.com/cloud/atlas/register
2. ثبت‌نام کن (با Google یا Email)
3. "Create a New Cluster" کلیک کن
4. انتخاب کن:
   - Provider: AWS
   - Region: N. Virginia (us-east-1) - نزدیک‌ترین به Render
   - Tier: M0 Sandbox (FREE)
5. Cluster Name: ekgkala-db
6. "Create Cluster" کلیک کن (5-10 دقیقه طول می‌کشد)
```

#### مرحله 2: ایجاد Database User
```
1. Security → Database Access
2. "Add New Database User"
3. Username: ekgkala_user
4. Password: [یک پسورد قوی تولید کن و یادداشت کن]
5. Built-in Role: Read and Write to any database
6. "Add User"
```

#### مرحله 3: تنظیم IP Whitelist
```
1. Security → Network Access
2. "Add IP Address"
3. "Allow Access from Anywhere" (0.0.0.0/0)
4. ⚠️ این برای Render ضروری است (IP آن‌ها dynamic است)
5. "Confirm"
```

#### مرحله 4: دریافت Connection String
```
1. برگرد به Clusters
2. "Connect" کلیک کن
3. "Connect your application" انتخاب کن
4. Driver: Node.js
5. Version: 4.1 or later
6. Connection String کپی کن:
   mongodb+srv://ekgkala_user:<password>@ekgkala-db.xxxxx.mongodb.net/?retryWrites=true&w=majority
7. <password> را با پسورد واقعی جایگزین کن
8. بعد از mongodb.net/ اسم دیتابیس را اضافه کن: /ekgkala
```

**✅ Connection String نهایی:**
```
mongodb+srv://ekgkala_user:YOUR_PASSWORD@ekgkala-db.xxxxx.mongodb.net/ekgkala?retryWrites=true&w=majority
```

---

### 2️⃣ Cloudinary (Image Storage)

```
1. برو به: https://cloudinary.com/users/register/free
2. ثبت‌نام کن
3. Dashboard → Account Details
4. یادداشت کن:
   - Cloud Name
   - API Key
   - API Secret
```

---

### 3️⃣ Upstash Redis (اختیاری)

```
1. برو به: https://upstash.com/
2. ثبت‌نام با GitHub
3. "Create Database"
4. Name: ekgkala-cache
5. Region: US East (Virginia) - نزدیک Render
6. Type: Regional
7. "Create"
8. URL کپی کن: redis://default:PASSWORD@ENDPOINT:6379
```

---

## 🖥️ دیپلوی Backend روی Render

### مرحله 1: آماده‌سازی کد

#### ایجاد secrets برای .env
```bash
cd ekgkala-backend
node scripts/generate-env-secrets.js
```

خروجی را کپی کن و نگه دار.

#### بررسی نهایی
```bash
node scripts/pre-deploy-check.js
npm audit
```

### مرحله 2: Push به GitHub

```bash
# اطمینان از commit همه تغییرات
git status
git add .
git commit -m "Production ready: Security fixes + deploy configs"
git push origin main
```

### مرحله 3: ایجاد Web Service در Render

```
1. برو به: https://dashboard.render.com/
2. ثبت‌نام یا لاگین با GitHub
3. "New +" → "Web Service"
4. Connect Repository: frontend-now3-google یا repo شما
5. تنظیمات:
   - Name: ekgkala-backend
   - Region: Oregon (US West) یا Frankfurt (اروپا)
   - Branch: main
   - Root Directory: ekgkala-backend
   - Runtime: Node
   - Build Command: npm install
   - Start Command: node server.js
   - Plan: Free
```

### مرحله 4: Environment Variables در Render

```
Settings → Environment → Add Environment Variable

کپی کن از ekgkala-backend/.env.example و مقادیر را جایگزین کن:
```

#### **متغیرهای حیاتی (MUST SET):**

```env
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb+srv://ekgkala_user:YOUR_PASSWORD@ekgkala-db.xxxxx.mongodb.net/ekgkala?retryWrites=true&w=majority

# JWT (از خروجی generate-env-secrets.js)
JWT_SECRET=<64_char_hex_from_script>
JWT_EXPIRES_IN=7d
JWT_ISSUER=ekgkala-api
JWT_AUDIENCE=ekgkala-clients

# Admin Setup (از خروجی generate-env-secrets.js)
ADMIN_SETUP_KEY=<32_char_hex_from_script>

# Cloudinary
CLOUDINARY_CLOUD_NAME=<از_dashboard>
CLOUDINARY_API_KEY=<از_dashboard>
CLOUDINARY_API_SECRET=<از_dashboard>

# URLs (فعلاً با دامنه موقت Render)
CLIENT_URL=https://ekgkala.vercel.app
FRONTEND_URL=https://ekgkala.vercel.app
ADMIN_URL=https://ekgkala-admin.vercel.app

# Logging
LOG_LEVEL=warn
DEBUG_CONSOLE=false
```

#### **متغیرهای اختیاری (بعداً):**

```env
# Email (اگر دارید)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_SECURE=false
FROM_EMAIL=noreply@ekgkala.com

# Payment
ZARINPAL_MERCHANT_ID=your-merchant-id
ZARINPAL_SANDBOX=false

# SMS
KAVENEGAR_API_KEY=your-key
KAVENEGAR_SENDER=your-number

# Redis
REDIS_URL=redis://default:password@endpoint:6379
```

### مرحله 5: Deploy

```
1. "Create Web Service" کلیک کن
2. Render شروع به build می‌کند (5-10 دقیقه)
3. لاگ‌ها را ببین: 
   - "Installing dependencies..."
   - "🚀 Server running on port 5000"
   - "✅ MongoDB Connected"
4. بعد از موفقیت، URL می‌گیری:
   https://ekgkala-backend.onrender.com
```

### مرحله 6: تست Backend

```bash
curl https://ekgkala-backend.onrender.com/api/health
```

انتظار داری:
```json
{
  "success": true,
  "status": "UP",
  "timestamp": "2025-..."
}
```

---

## 🌐 دیپلوی Frontend روی Vercel

### مرحله 1: آماده‌سازی

```bash
cd frontend
npm install
npm run build  # تست لوکال
```

### مرحله 2: Push به GitHub (اگر نکردی)

```bash
git add .
git commit -m "Frontend production ready"
git push origin main
```

### مرحله 3: Import به Vercel

```
1. برو به: https://vercel.com/new
2. "Import Git Repository"
3. انتخاب کن: frontend-now3-google
4. Configure Project:
   - Project Name: ekgkala (یا هر اسمی)
   - Framework Preset: Next.js (خودکار تشخیص می‌دهد)
   - Root Directory: frontend
   - Build Command: npm run build (پیش‌فرض)
   - Output Directory: .next (پیش‌فرض)
   - Install Command: npm install (پیش‌فرض)
```

### مرحله 4: Environment Variables

```
Settings → Environment Variables

از deploy/frontend.env.template کپی کن:
```

```env
NEXT_PUBLIC_API_URL=https://ekgkala-backend.onrender.com/api
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SITE_NAME=EkgKala
NEXT_PUBLIC_SITE_DESCRIPTION=فروشگاه آنلاین
```

برای هر متغیر:
- Environment: Production, Preview, Development (هر سه را تیک بزن)

### مرحله 5: Deploy

```
1. "Deploy" کلیک کن
2. Vercel شروع به build می‌کند (3-5 دقیقه)
3. بعد از موفقیت URL می‌گیری:
   https://ekgkala.vercel.app
```

---

## 🔧 دیپلوی Admin روی Vercel

**دقیقاً مثل Frontend:**

```
1. Vercel → New Project
2. Same Repository
3. Root Directory: admin
4. Framework: Vite
5. Environment Variables از deploy/admin.env.template
6. Deploy
7. URL: https://ekgkala-admin.vercel.app
```

---

## 🌍 اتصال دامنه

###Frontend (ekgkala.com):

```
1. Vercel Project (frontend) → Settings → Domains
2. Add Domain: ekgkala.com
3. Add CNAME:
   - Type: CNAME
   - Name: @ (or www)
   - Value: cname.vercel-dns.com
4. یا A Record:
   - Type: A
   - Name: @
   - Value: 76.76.21.21
```

### Backend (api.ekgkala.com):

**Option 1: ساب‌دامین مستقل**
```
1. Render → Settings → Custom Domain
2. Add: api.ekgkala.com
3. DNS Provider:
   - Type: CNAME
   - Name: api
   - Value: ekgkala-backend.onrender.com
```

**Option 2: Vercel Rewrite (توصیه می‌شود)**
```
در frontend/vercel.json اضافه کن:
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://ekgkala-backend.onrender.com/api/:path*"
    }
  ]
}
```
این باعث می‌شود `ekgkala.com/api` به backend اشاره کند.

### Admin (admin.ekgkala.com):

```
1. Vercel Project (admin) → Settings → Domains
2. Add: admin.ekgkala.com
3. CNAME:
   - Name: admin
   - Value: cname.vercel-dns.com
```

---

## ✅ تست و Verification

### چک‌لیست نهایی:

```bash
# ✅ Backend Health
curl https://api.ekgkala.com/health

# ✅ Frontend Loading
curl -I https://ekgkala.com

# ✅ Admin Loading
curl -I https://admin.ekgkala.com

# ✅ CORS Test
curl -H "Origin: https://ekgkala.com" https://api.ekgkala.com/api/products

# ✅ Security Headers
curl -I https://ekgkala.com | grep "X-Content-Type-Options"
```

### تست Functional:

1. **Frontend:**
   - [ ] صفحه اصلی لود می‌شود
   - [ ] محصولات نمایش داده می‌شوند
   - [ ] تصاویر Cloudinary لود می‌شوند
   - [ ] ثبت‌نام/لاگین کار می‌کند

2. **Backend:**
   - [ ] /api/health پاسخ می‌دهد
   - [ ] /api/products لیست برمی‌گرداند
   - [ ] MongoDB متصل است

3. **Admin:**
   - [ ] لاگین ادمین کار می‌کند
   - [ ] CRUD محصولات کار می‌کند

---

## 🐛 Troubleshooting

### Backend روی Render نمی‌ایستد

**علت:** معمولاً MongoDB connection یا Environment Variable

**حل:**
```
1. Render Logs ببین:
   - "MongoServerError"? → MONGODB_URI اشتباه است
   - "JWT_SECRET"? → ENV ها را دوباره چک کن
2. Health check: curl https://your-backend.onrender.com/api/health
```

### Frontend به Backend وصل نمیشه

**علت:** CORS یا NEXT_PUBLIC_API_URL

**حل:**
```
1. بررسی کن CLIENT_URL در backend env درست است
2. NEXT_PUBLIC_API_URL را در Vercel env دوباره چک کن
3. Redeploy frontend بعد از تغییر env
```

### Render Free Plan خواب می‌رود

**علت:** بعد از 15 دقیقه inactivity خاموش می‌شود

**حل:**
```
1. استفاده از UptimeRobot (رایگان):
   - هر 5 دقیقه ping به /api/health
2. یا استفاده از Render Cron Job (رایگان):
   - هر 10 دقیقه یک request
```

---

## 📊 مانیتورینگ

### UptimeRobot (رایگان):

```
1. https://uptimerobot.com/signUp
2. Add Monitor:
   - Type: HTTPS
   - URL: https://api.ekgkala.com/health
   - Interval: 5 minutes
3. Email Alert فعال کن
```

---

## 🔄 Update و Rollback

### آپدیت کد:

```bash
# تغییرات local
git add .
git commit -m "Feature XYZ"
git push origin main

# Auto-deploy:
# - Render خودکار backend را build می‌کند
# - Vercel خودکار frontend را build می‌کند
```

### Rollback:

**Vercel:**
```
1. Dashboard → Deployments
2. انتخاب deployment قبلی
3. "..." → Promote to Production
```

**Render:**
```
1. Dashboard → Manual Deploy
2. انتخاب commit قبلی
3. Deploy
```

---

## 💰 هزینه‌ها (Free Tier Limits)

| سرویس | Free Tier | محدودیت |
|------|-----------|---------|
| **MongoDB Atlas** | 512 MB | کافی برای 10k+ محصول |
| **Render** | 750 ساعت/ماه | 1 web service رایگان |
| **Vercel** | 100 GB bandwidth | Unlimited deployments |
| **Cloudinary** | 25 GB storage | 25k transformations/month |
| **Upstash Redis** | 10k commands/day | 256 MB |

---

## 🎯 بهینه‌سازی‌های بعدی

1. **CDN:** Cloudflare جلوی دامنه (رایگان)
2. **Monitoring:** Sentry برای error tracking (رایگان)
3. **Analytics:** Vercel Analytics (رایگان)
4. **Database Backups:** MongoDB Atlas auto-backup (رایگان)

---

## 📞 پشتیبانی

مشکل داری؟
- Render Status: https://status.render.com/
- Vercel Status: https://www.vercel-status.com/
- MongoDB Atlas Status: https://status.mongodb.com/

🎉 **تبریک! پروژه شما Production است!**
