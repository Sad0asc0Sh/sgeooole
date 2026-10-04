# 🚀 EkgKala Backend API

Backend API برای پنل مدیریت فروشگاه اینترنتی EkgKala

## 📋 ویژگی‌ها

- ✅ REST API کامل برای دسته‌بندی‌ها
- ✅ آپلود فایل (آیکون و تصویر)
- ✅ ساختار درختی دسته‌بندی‌ها
- ✅ CRUD کامل
- ✅ Validation
- ✅ Error Handling
- ✅ CORS Support

## 🛠 تکنولوژی‌ها

- **Node.js** 16+
- **Express.js** 4.18
- **MongoDB** با Mongoose 7.5
- **Multer** برای آپلود فایل
- **CORS** برای Frontend

## 📦 نصب

### 1. نصب Dependencies

```bash
pnpm install
```

### 2. تنظیم Environment Variables

```bash
# کپی کردن فایل نمونه
cp .env.example .env

# ویرایش .env با تنظیمات خود
nano .env
```

### 3. اجرای MongoDB

```bash
# با Docker:
docker run -d -p 27017:27017 --name mongodb mongo

# یا اگر MongoDB محلی نصب است:
mongod
```

### 4. اجرای سرور

```bash
# Development mode (با nodemon)
pnpm run dev

# Production mode
pnpm start
```

## 🌐 Endpoints

### Health Check
```
GET /api/health
```

### دسته‌بندی‌ها

#### دریافت درخت دسته‌بندی‌ها
```
GET /api/categories/tree
```

**پاسخ:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "الکترونیک",
      "children": [
        {
          "_id": "...",
          "name": "موبایل",
          "children": []
        }
      ]
    }
  ]
}
```

#### دریافت لیست تخت
```
GET /api/categories?limit=100&fields=name,_id
```

#### دریافت یک دسته‌بندی
```
GET /api/categories/:id
```

#### ایجاد دسته‌بندی
```
POST /api/categories
Content-Type: multipart/form-data

Body:
- name: string (required)
- parent: ObjectId (optional)
- description: string (optional)
- icon: File (optional)
- image: File (optional)
- isFeatured: boolean (optional)
```

#### ویرایش دسته‌بندی
```
PUT /api/categories/:id
Content-Type: multipart/form-data

Body: (مشابه POST)
```

#### حذف دسته‌بندی
```
DELETE /api/categories/:id
```

## 📁 ساختار پروژه

```
ekgkala-backend/
├── models/
│   └── Category.js          # مدل Mongoose
├── routes/
│   └── categories.js        # Routes دسته‌بندی‌ها
├── uploads/                 # فایل‌های آپلود شده
│   └── categories/
├── server.js                # فایل اصلی سرور
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 🧪 تست با cURL

### ایجاد دسته‌بندی
```bash
curl -X POST http://localhost:5000/api/categories \
  -F "name=الکترونیک" \
  -F "description=محصولات الکترونیکی" \
  -F "isFeatured=true" \
  -F "icon=@icon.png" \
  -F "image=@banner.jpg"
```

### دریافت درخت
```bash
curl http://localhost:5000/api/categories/tree
```

### حذف دسته‌بندی
```bash
curl -X DELETE http://localhost:5000/api/categories/65abc123...
```

## 🐛 عیب‌یابی

### MongoDB Connection Error
```bash
# بررسی اجرای MongoDB:
mongosh

# یا:
docker ps | grep mongo
```

### Port Already in Use
```bash
# پیدا کردن process:
lsof -i :5000

# Kill کردن:
kill -9 <PID>
```

### Upload Permission Error
```bash
# دادن دسترسی به پوشه uploads:
chmod 755 uploads/
```

## 📝 نکات مهم

1. **Schema**: `icon` و `image` از نوع `String` هستند (نه Array)
2. **File Upload**: حداکثر 5MB برای هر فایل
3. **Children Check**: قبل از حذف، بررسی می‌شود که دسته زیرمجموعه نداشته باشد
4. **File Cleanup**: فایل‌های قدیمی هنگام ویرایش/حذف، پاک می‌شوند

## 🚀 Deploy

### با PM2
```bash
npm install -g pm2
pm2 start server.js --name ekgkala-backend
pm2 save
pm2 startup
```

### با Docker
```bash
docker build -t ekgkala-backend .
docker run -d -p 5000:5000 ekgkala-backend
```

## 📄 License

ISC

## 👤 Author

EkgKala Team
