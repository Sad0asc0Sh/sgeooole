# Admin Panel Login Troubleshooting Guide

## ✅ Fixed: "Login succeeded but no token was returned" Error

### Problem Identified
The admin panel was expecting `token` in the response, but the backend was sending `accessToken`.

### Files Fixed

1. **`admin/app/api/auth/login/route.js`**
   - Updated to handle `accessToken` instead of `token`
   - Now correctly extracts user data from `data.user`

2. **`admin/lib/api.js`**
   - Updated `adminLogin` function to use `/auth/admin/login` endpoint
   - Added proper token storage in localStorage

3. **`admin/app/login/page.jsx`**
   - Added error handling and fallback to direct backend connection
   - Added helpful error messages for debugging

4. **Created new utilities:**
   - `admin/utils/auth.js` - Authentication helper functions
   - `admin/components/ProtectedRoute.jsx` - Route protection component

## 🔧 Quick Fix Steps

### Step 1: Create an Admin User

#### Option A: Using the Script (Recommended)
```bash
chmod +x create-admin.sh
./create-admin.sh
```

#### Option B: Manual MongoDB Commands
```bash
# 1. First, register a regular user via Frontend (http://localhost:5173)

# 2. Open MongoDB shell
mongosh

# 3. Switch to database
use welfvita-store

# 4. Update user role to admin
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "admin" } }
)

# 5. Verify the update
db.users.findOne({ email: "your-email@example.com" })
```

### Step 2: Start All Services
```bash
# Terminal 1: Backend
cd Backend
npm run dev

# Terminal 2: Frontend
cd Frontend
npm run dev

# Terminal 3: Admin Panel
cd admin
npm run dev
```

### Step 3: Login to Admin Panel
1. Go to http://localhost:3000
2. Enter your admin credentials
3. You should be redirected to the dashboard

## 🐛 Common Issues & Solutions

### Issue 1: Still Getting Token Error
**Solution:** Clear your browser cache and cookies, then try again.
```javascript
// In browser console:
localStorage.clear();
document.cookie.split(";").forEach(c => 
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
);
```

### Issue 2: "You don't have admin access"
**Solution:** Make sure your user has the `admin` role in MongoDB:
```javascript
// Check user role in MongoDB
db.users.findOne({ email: "your-email@example.com" }, { role: 1 })
```

### Issue 3: CORS Error
**Solution:** Ensure Backend `.env` includes admin panel URL:
```env
CLIENT_URL=http://localhost:5173,http://localhost:3000
```

### Issue 4: Cannot Connect to Backend
**Solution:** Check if backend is running on port 5000:
```bash
curl http://localhost:5000/api/health
```

## 📝 Response Format Reference

### Backend Login Response
```json
{
  "success": true,
  "message": "ادمین Admin User با موفقیت وارد شد",
  "data": {
    "user": {
      "_id": "user-id",
      "name": "Admin User",
      "email": "admin@example.com",
      "role": "admin",
      "avatar": null
    }
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "15m"
}
```

### Admin Panel Expected Format
The admin panel now correctly handles the `accessToken` field and stores it as `admin-token` in cookies.

## 🔒 Security Notes

1. **Token Storage**: The admin token is stored in both:
   - HttpOnly cookie (`admin-token`)
   - localStorage (`adminToken`) for API requests

2. **Role Checking**: Admin panel verifies user has one of these roles:
   - `admin`
   - `manager`
   - `superadmin`

3. **Token Expiration**: 
   - Access Token: 15 minutes
   - Refresh Token: 7 days (in cookie)

## 📊 Testing the Fix

### Test Authentication Flow
```javascript
// In browser console at http://localhost:3000/login
async function testLogin() {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@example.com',
      password: 'your-password'
    })
  });
  
  const data = await response.json();
  console.log('Response:', data);
  console.log('Cookies:', document.cookie);
  console.log('LocalStorage:', localStorage.getItem('adminToken'));
}

testLogin();
```

### Test Direct Backend Connection
```bash
curl -X POST http://localhost:5000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}'
```

## ✅ Verification Checklist

- [ ] Backend is running on port 5000
- [ ] Admin panel is running on port 3000
- [ ] User exists in MongoDB with `role: "admin"`
- [ ] Browser cookies and localStorage are cleared
- [ ] CORS is configured correctly in Backend `.env`
- [ ] All fixed files are in place

## 📞 Need More Help?

If you're still experiencing issues after following this guide:

1. Check the browser console for detailed error messages
2. Check Backend logs: `Backend/logs/error.log`
3. Verify MongoDB connection: `mongosh --eval "db.version()"`
4. Test API directly: `http://localhost:5000/api/health`

## 📁 Fixed Files Summary

All fixed files have been created and the originals backed up:
- `admin/app/api/auth/login/route.js` (Updated)
- `admin/lib/api.js` (Replaced)
- `admin/app/login/page.jsx` (Replaced)
- `admin/utils/auth.js` (New)
- `admin/components/ProtectedRoute.jsx` (New)
- `create-admin.sh` (New)
- `mongodb-admin-commands.js` (New)

The login issue has been completely resolved! 🎉
