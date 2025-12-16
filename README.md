# 🚀 Welfvita E-Commerce Platform
## Production Deployment: Vercel + Render + MongoDB Atlas

---

## 📦 ساختار پروژه

```
welfvita/
├── welfvita-backend/     # Express.js API (→ Render)
├── frontend/             # Next.js 15 App (→ Vercel)
├── admin/                # Vite React Admin Panel (→ Vercel)
└── deploy/               # 📋 تمام فایل‌های Deploy
```

---

## 🎯 Quick Start برای Deploy

### 1️⃣ خواندن راهنما (5 دقیقه)
```bash
cat deploy/DEPLOYMENT_GUIDE.md
```

### 2️⃣ آماده‌سازی Secrets (2 دقیقه)
```bash
cd welfvita-backend
node scripts/generate-env-secrets.js
```

### 3️⃣ بررسی امنیت (2 دقیقه)
```bash
npm audit
node scripts/pre-deploy-check.js
node scripts/audit-logs.js
```

### 4️⃣ دنبال کردن چک‌لیست
```bash
cat deploy/PRE_DEPLOY_CHECKLIST.md
```

---

## 🏗️ معماری Production

```
┌─────────────────────────────────────────────────────────┐
│                        User                             │
└────────────────┬────────────────────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
    ┌────▼─────┐    ┌────▼──────┐
    │ Frontend │    │   Admin   │
    │ (Vercel) │    │ (Vercel)  │
    │ Next.js  │    │   Vite    │
    └────┬─────┘    └────┬──────┘
         │               │
         └───────┬───────┘
                 │
          ┌──────▼───────┐
          │   Backend    │
          │   (Render)   │
          │  Express.js  │
          └──────┬───────┘
                 │
     ┌───────────┼──────────────┐
     │           │              │
┌────▼────┐ ┌───▼────┐  ┌──────▼────────┐
│ MongoDB │ │ Redis  │  │  Cloudinary   │
│  Atlas  │ │Upstash │  │ Image Storage │
│  (Free) │ │ (Free) │  │    (Free)     │
└─────────┘ └────────┘  └───────────────┘
```

---

## ✅ آنچه انجام شده (تغییرات امنیتی)

### 🔒 امنیت:

- ✅ **Rate Limiting Security Fix** - حذف user-agent bypass قابل جعل
- ✅ **Trust Proxy** - برای عملکرد صحیح پشت proxy
- ✅ **xss-clean Removed** - جایگزینی با express-validator
- ✅ **Password Policy** - حداقل 8 کاراکتر + ترکیب حروف و اعداد
- ✅ **SVG Upload Blocked** - جلوگیری از XSS
- ✅ **Helmet CSP** - Content Security Policy سخت‌گیرانه
- ✅ **RBAC No Bypass** - حذف hardcoded superadmin bypass
- ✅ **Health Endpoint Secured** - اطلاعات حساس فقط برای admin
- ✅ **Logger Production-Ready** - Redaction اطلاعات حساس
- ✅ **Console Silencing** - console.log در production خاموش

### 🚀 زیرساخت:

- ✅ **PM2 Ready Signal** - برای zero-downtime deployment
- ✅ **Graceful Shutdown** - برای قطع امن connection
- ✅ **Environment Templates** - برای backend, frontend, admin
- ✅ **Vercel Configs** - با security headers
- ✅ **Build Scripts** - برای CI/CD

---

## 📚 مستندات

| فایل | توضیح |
|------|-------|
| `deploy/DEPLOYMENT_GUIDE.md` | **راهنمای کامل Deploy** (مرحله به مرحله) |
| `deploy/PRE_DEPLOY_CHECKLIST.md` | **چک‌لیست قبل و بعد Deploy** |
| `deploy/env.production.template` | Template ENV برای Backend |
| `deploy/frontend.env.template` | Template ENV برای Frontend |
| `deploy/admin.env.template` | Template ENV برای Admin |
| `welfvita-backend/.env.example` | نمونه کامل ENV Backend |

---

## 🛠️ Scripts مفید

### Backend:
```bash
cd welfvita-backend

# تولید Secrets امن
node scripts/generate-env-secrets.js

# بررسی قبل از Deploy
node scripts/pre-deploy-check.js

# اسکن لاگ‌های حساس
node scripts/audit-logs.js

# چک امنیتی
npm audit
```

### Frontend:
```bash
cd frontend

# Build تستی
npm run build

# Preview
npm run start
```

### Admin:
```bash
cd admin

# Build
npm run build

# Preview
npm run preview
```

---

## 🌍 URLs بعد از Deploy

بعد از deploy موفق، این URLها را خواهید داشت:

- **Frontend (Public):** `https://your-project.vercel.app`
- **Admin Panel:** `https://admin-your-project.vercel.app`
- **Backend API:** `https://your-backend.onrender.com`

با دامنه شخصی:
- **Frontend:** `https://welfvita.com`
- **Admin:** `https://admin.welfvita.com`
- **API:** `https://welfvita.com/api` (via Vercel rewrite)

---

## 💡 نکات مهم

### ⚠️ Render Free Plan:
- Backend بعد از 15 دقیقه inactivity خواب می‌رود
- اولین request بعد از sleep: ~30 ثانیه
- **راه‌حل:** UptimeRobot ping هر 5 دقیقه

### ⚠️ MongoDB Atlas:
- Storage limit: 512 MB
- یک Cluster رایگان per project

### ⚠️ Vercel:
- Bandwidth: 100 GB/month (کافی برای اکثر پروژه‌ها)
- Build time: 6000 دقیقه/ماه

### ⚠️ Cloudinary:
- Storage: 25 GB
- Bandwidth: 25 GB/month
- Transformations: 25,000/month

---

## 🔄 Workflow بعد از Deploy

### برای تغییرات:

```bash
# تغییرات کد
git add .
git commit -m "Feature: XYZ"
git push origin main

# ✨ Auto-deploy:
# Vercel و Render خودکار build و deploy می‌کنند
```

### برای Rollback:

**Vercel:**
- Dashboard → Deployments → انتخاب نسخه قبل → Promote

**Render:**
- Dashboard → Manual Deploy → انتخاب commit قبل

---

## 📊 Monitoring

### Uptime:
```
UptimeRobot (رایگان)
→ Ping /api/health هر 5 دقیقه
```

### Errors:
```
1. Render Logs
2. Vercel Logs
3. MongoDB Atlas Metrics
```

### Analytics:
```
Vercel Analytics (رایگان)
Settings → Analytics → Enable
```

---

## 🆘 Support

### مشکل داری؟

1. **Logs را ببین:**
   - Render: Dashboard → Logs
   - Vercel: Dashboard → Deployments → Details

2. **Troubleshooting:**
   - راهنما: `deploy/DEPLOYMENT_GUIDE.md` بخش Troubleshooting

3. **Health Check:**
   ```bash
   curl https://your-backend.onrender.com/api/health
   ```

---

## 📈 بعد از Deploy موفق

1. ✅ **ایجاد ادمین اولیه** (با ADMIN_SETUP_KEY)
2. ✅ **Test کامل** (frontend + admin + backend)
3. ✅ **Setup Monitoring** (UptimeRobot)
4. ✅ **Backup Strategy** (MongoDB auto-backup)
5. ✅ **Security Headers Test**
6. ✅ **Performance Baseline**

---

## 🎉 موفق باشید!

**تاریخ آخرین آپدیت:** 2025-12-16

**Contributors:**
- Backend Security: ✅ Complete
- Frontend Optimization: ✅ Complete
- Admin Panel: ✅ Complete
- Deploy Infrastructure: ✅ Complete

---

## 📝 License

این پروژه تحت لایسنس ISC است.

---

**نکته:** برای هر سوالی درباره deploy، ابتدا `deploy/DEPLOYMENT_GUIDE.md` را بخوانید.
