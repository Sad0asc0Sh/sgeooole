# 🚀 چک‌لیست قبل از دیپلوی Production
## EkgKala - Vercel/Render Deployment

---

## ✅ مرحله 1: امنیت کد (CRITICAL)

- [ ] **Secrets Check**
  ```bash
  # بررسی کنید که هیچ secret در git نباشد
  git grep -i password
  git grep -i api_key  
  git grep -i secret
  ```

- [ ] **Environment Files**
  - [ ] `.env` در `.gitignore` است
  - [ ] `.env.example` به‌روز است
  - [ ] هیچ مقدار واقعی در `.env.example` نیست

- [ ] **Security Audit**
  ```bash
  cd ekgkala-backend
  npm audit
  node scripts/audit-logs.js
  node scripts/pre-deploy-check.js
  ```

---

## ✅ مرحله 2: آماده‌سازی Database

- [ ] **MongoDB Atlas**
  - [ ] Cluster ایجاد شد (Free M0)
  - [ ] Database User ساخته شده
  - [ ] IP Whitelist: 0.0.0.0/0 (برای Render)
  - [ ] Connection String تست شد
  - [ ] Database name: `ekgkala`

- [ ] **Test Connection**
  ```bash
  # Test لوکال با Atlas
  MONGODB_URI="mongodb+srv://..." node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('✅ Connected')).catch(e => console.error('❌', e))"
  ```

---

## ✅ مرحله 3: سرویس‌های Third-party

- [ ] **Cloudinary**
  - [ ] Cloud Name: ____________
  - [ ] API Key: ____________
  - [ ] API Secret: ____________
  - [ ] تست upload: ✅/❌

- [ ] **ZarinPal (برای پرداخت)**
  - [ ] Merchant ID: ____________
  - [ ] Sandbox: false (production)
  - [ ] Callback URL تنظیم شده

- [ ] **Kavenegar (برای SMS)**
  - [ ] API Key: ____________
  - [ ] Sender Number: ____________

- [ ] **Redis (اختیاری)**
  - [ ] Upstash Redis URL: ____________

---

## ✅ مرحله 4: تولید Secrets

```bash
cd ekgkala-backend
node scripts/generate-env-secrets.js
```

### کپی کنید و در جای امن ذخیره:

- JWT_SECRET: `_________________________________`
- ADMIN_SETUP_KEY: `_________________________________`

---

## ✅ مرحله 5: Backend (Render)

### Pre-deploy:

- [ ] **Code Ready**
  ```bash
  cd ekgkala-backend
  npm install
  npm audit fix
  node server.js  # تست local
  ```

- [ ] **Git Push**
  ```bash
  git add .
  git commit -m "Production ready"
  git push origin main
  ```

### Render Setup:

- [ ] Web Service ساخته شد
- [ ] Root Directory: `ekgkala-backend`
- [ ] Build Command: `npm install`
- [ ] Start Command: `node server.js`
- [ ] Plan: Free

### Environment Variables در Render:

```
[ ] NODE_ENV=production
[ ] PORT=5000
[ ] MONGODB_URI=mongodb+srv://...
[ ] JWT_SECRET=...
[ ] JWT_ISSUER=ekgkala-api
[ ] JWT_AUDIENCE=ekgkala-clients
[ ] ADMIN_SETUP_KEY=...
[ ] CLOUDINARY_CLOUD_NAME=...
[ ] CLOUDINARY_API_KEY=...
[ ] CLOUDINARY_API_SECRET=...
[ ] CLIENT_URL=https://...vercel.app
[ ] FRONTEND_URL=https://...vercel.app
[ ] ADMIN_URL=https://admin-...vercel.app
[ ] LOG_LEVEL=warn
[ ] ZARINPAL_MERCHANT_ID=...
[ ] ZARINPAL_SANDBOX=false
```

### Deploy:

- [ ] Build موفق: ✅/❌
- [ ] Logs بدون خطا: ✅/❌
- [ ] Health check: `curl https://[your-backend].onrender.com/api/health`

**Backend URL:** `https://_________________.onrender.com`

---

## ✅ مرحله 6: Frontend (Vercel)

### Pre-deploy:

- [ ] **Code Ready**
  ```bash
  cd frontend
  npm install
  npm run build
  ```

### Vercel Setup:

- [ ] Project ساخته شد
- [ ] Root Directory: `frontend`
- [ ] Framework: Next.js
- [ ] Auto-detected build settings: ✅

### Environment Variables در Vercel:

```
[ ] NEXT_PUBLIC_API_URL=https://[backend].onrender.com/api
[ ] NEXT_PUBLIC_SITE_URL=https://[your-domain].vercel.app
[ ] NEXT_PUBLIC_SITE_NAME=EkgKala
[ ] NEXT_PUBLIC_ZARINPAL_MERCHANT_ID=...
```

### Deploy:

- [ ] Build موفق: ✅/❌
- [ ] Preview URL کار می‌کند: ✅/❌
- [ ] Production URL: `https://_________________.vercel.app`

---

## ✅ مرحله 7: Admin (Vercel)

### Pre-deploy:

- [ ] **Code Ready**
  ```bash
  cd admin
  npm install
  npm run build
  ```

### Vercel Setup:

- [ ] Project ساخته شد
- [ ] Root Directory: `admin`
- [ ] Framework: Vite
- [ ] Output Directory: `dist`

### Environment Variables:

```
[ ] VITE_API_BASE_URL=https://[backend].onrender.com/api
```

### Deploy:

- [ ] Build موفق: ✅/❌
- [ ] Admin URL: `https://admin-_________________.vercel.app`

---

## ✅ مرحله 8: اتصال دامنه (اختیاری)

### دامنه اصلی (Frontend):

- [ ] Domain: `_________________.com`
- [ ] DNS CNAME یا A Record تنظیم شد
- [ ] SSL Auto (از Vercel): ✅

### ساب‌دامین Admin:

- [ ] Subdomain: `admin._________________.com`
- [ ] DNS CNAME تنظیم شد

### Backend API:

**Option A: ساب‌دامین**
- [ ] Subdomain: `api._________________.com`
- [ ] Render Custom Domain اضافه شد

**Option B: Vercel Rewrite (توصیه)**
- [ ] `vercel.json` rewrites اضافه شد
- [ ] `/api/*` → backend redirect می‌شود

---

## ✅ مرحله 9: تست Production

### Backend:

```bash
# Health Check
curl https://[backend-url]/api/health

# انتظار:
# {"success":true,"status":"UP","timestamp":"..."}

# CORS Test
curl -H "Origin: https://[frontend-url]" https://[backend-url]/api/products

# انتظار: بدون CORS error
```

### Frontend:

- [ ] صفحه اصلی لود می‌شود
- [ ] تصاویر از Cloudinary لود می‌شوند
- [ ] API calls به backend کار می‌کنند
- [ ] Console بدون error است

### Admin:

- [ ] لاگین صفحه باز می‌شود
- [ ] ثبت‌نام admin (با ADMIN_SETUP_KEY)
- [ ] Dashboard لود می‌شود
- [ ] CRUD عملیات کار می‌کند

---

## ✅ مرحله 10: Monitoring

### UptimeRobot:

- [ ] Monitor برای `/api/health` ساخته شد
- [ ] Interval: 5 minutes
- [ ] Email alert فعال

### Render Cron (برای جلوگیری از sleep):

اگر backend خواب می‌رود:
- [ ] Cron job برای ping هر 10 دقیقه

---

## ✅ مرحله 11: Security Headers

```bash
# بررسی Headers
curl -I https://[frontend-url] | grep -E "X-Content-Type|X-Frame|X-XSS"
```

**انتظار:**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

---

## ✅ مرحله 12: Performance

### Frontend (Vercel Analytics):

- [ ] Vercel Analytics فعال شد (Settings → Analytics)

### Backend (Render Metrics):

- [ ] CPU/Memory usage بررسی شد
- [ ] Response time < 500ms

---

## ⚠️ نکات مهم بعد از Deploy

### 1. ایجاد ادمین اولیه:

```bash
# باید یک POST request به /api/admin/setup بزنید
curl -X POST https://[backend]/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{
    "setupKey": "YOUR_ADMIN_SETUP_KEY",
    "email": "admin@ekgkala.com",
    "password": "AdminPassword123!",
    "name": "Admin"
  }'
```

### 2. Render Free Plan خواب می‌رود:

- بعد از 15 دقیقه بی‌فعالیتی خاموش می‌شود
- اولین request بعد از sleep: 30-50 ثانیه طول می‌کشد
- **راه‌حل:** UptimeRobot ping هر 5 دقیقه

### 3. MongoDB Atlas Limits:

- Storage: 512 MB
- Connections: 500 concurrent
- برای scale: به M10+ آپگرید کنید

### 4. Cloudinary Limits:

- Storage: 25 GB
- Bandwidth: 25 GB/month
- Transformations: 25,000/month

---

## 🐛 Troubleshooting سریع

| مشکل | علت احتمالی | حل |
|------|------------|-----|
| Backend نمی‌ایستد | MongoDB connection | MONGODB_URI را چک کن |
| CORS Error | CLIENT_URL اشتباه | Backend env چک کن |
| 404 در Admin | Routing مشکل | `vercel.json` rewrites چک کن |
| Images لود نمیشن | Cloudinary config | ENV ها را verify کن |
| Backend خیلی کند | Render sleep | UptimeRobot ping فعال کن |

---

## 🎉 موفقیت!

اگر همه ✅ باشند، پروژه شما Production است!

**URLs:**
- Frontend: `https://____________`
- Admin: `https://____________`
- Backend: `https://____________`

---

## 📊 Backup و بعد از Deploy

### Weekly Tasks:

- [ ] MongoDB backup (Atlas auto-backup فعال است)
- [ ] بررسی Logs (Render + Vercel)
- [ ] بررسی Error Tracking

### Monthly Tasks:

- [ ] `npm audit` و update پکیج‌ها
- [ ] بررسی Usage limits (MongoDB, Cloudinary)
- [ ] Performance metrics

---

**تاریخ Deploy:** ___________
**Deploy شده توسط:** ___________
**نسخه:** ___________
