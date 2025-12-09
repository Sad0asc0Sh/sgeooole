# 📘 Phase 4 Backend Implementation Guide - OTP Authentication

## 🎯 Overview

This guide documents the backend API endpoints required to support the **OTP-based customer authentication** feature in the WelfVita frontend application.

**Current Status**: The frontend is fully integrated and ready. The backend needs to implement the following customer authentication endpoints.

---

## 🔐 Required Backend Endpoints

### 1. **Send OTP to Mobile Number**

**Endpoint**: `POST /api/auth/send-otp`

**Purpose**: Send a 4-digit OTP code to the customer's mobile number via SMS.

**Request Body**:
```json
{
  "mobile": "09123456789"
}
```

**Validation**:
- `mobile` must be a valid Iranian mobile number (11 digits, starts with `09`)
- Check if mobile number is registered (create user if first time)

**Response (Success)**:
```json
{
  "success": true,
  "message": "کد تایید به شماره موبایل شما ارسال شد",
  "expiresIn": 120
}
```

**Response (Error)**:
```json
{
  "success": false,
  "message": "خطا در ارسال کد تایید"
}
```

**Implementation Requirements**:
1. Generate a random 4-digit OTP code
2. Store OTP in database with expiration time (2 minutes)
3. Send OTP via SMS provider (e.g., Kavenegar, Ghasedak)
4. Limit OTP requests to prevent abuse (max 3 requests per 10 minutes)

**MongoDB Schema for OTP**:
```javascript
{
  mobile: String,
  code: String,          // 4-digit OTP
  expiresAt: Date,       // 2 minutes from creation
  verified: Boolean,     // false by default
  attempts: Number,      // Track verification attempts
  createdAt: Date
}
```

---

### 2. **Verify OTP and Login**

**Endpoint**: `POST /api/auth/verify-otp`

**Purpose**: Verify the OTP code and return JWT authentication token.

**Request Body**:
```json
{
  "mobile": "09123456789",
  "code": "1234"
}
```

**Validation**:
- `mobile` must match an existing OTP request
- `code` must be exactly 4 digits
- OTP must not be expired
- Limit verification attempts (max 3 attempts per OTP)

**Response (Success)**:
```json
{
  "success": true,
  "message": "ورود با موفقیت انجام شد",
  "data": {
    "user": {
      "_id": "673cc2ae8f4b1234567890ab",
      "name": "کاربر نمونه",
      "mobile": "09123456789",
      "email": "user@example.com",
      "wallet": 0,
      "role": "user",
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Error - Invalid Code)**:
```json
{
  "success": false,
  "message": "کد تایید نامعتبر است"
}
```

**Response (Error - Expired Code)**:
```json
{
  "success": false,
  "message": "کد تایید منقضی شده است. لطفا دوباره درخواست دهید"
}
```

**Implementation Requirements**:
1. Verify OTP code matches and is not expired
2. Create or update user record in database
3. Generate JWT token with user ID and role
4. Mark OTP as verified
5. Return user data and token

**JWT Token Payload**:
```javascript
{
  userId: "673cc2ae8f4b1234567890ab",
  mobile: "09123456789",
  role: "user",
  iat: 1234567890,
  exp: 1234567890  // 30 days expiration
}
```

---

### 3. **Get User Profile**

**Endpoint**: `GET /api/auth/profile`

**Purpose**: Fetch authenticated user's profile data.

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (Success)**:
```json
{
  "success": true,
  "data": {
    "_id": "673cc2ae8f4b1234567890ab",
    "name": "کاربر نمونه",
    "mobile": "09123456789",
    "email": "user@example.com",
    "wallet": 5400000,
    "role": "user",
    "isActive": true,
    "createdAt": "2024-11-19T10:30:00.000Z",
    "updatedAt": "2024-11-24T14:20:00.000Z"
  }
}
```

**Response (Error - Unauthorized)**:
```json
{
  "success": false,
  "message": "لطفا ابتدا وارد حساب کاربری خود شوید"
}
```
**Status Code**: `401 Unauthorized`

**Implementation Requirements**:
1. Verify JWT token in Authorization header
2. Extract user ID from token
3. Fetch user from database
4. Return user data

---

## 📊 MongoDB User Schema

```javascript
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    default: "کاربر ویلف‌ویتا"
  },
  mobile: {
    type: String,
    required: true,
    unique: true,
    match: /^09\d{9}$/  // Iranian mobile format
  },
  email: {
    type: String,
    sparse: true,        // Optional, but unique if provided
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  wallet: {
    type: Number,
    default: 0,
    min: 0
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // For future use
  addresses: [{
    title: String,
    address: String,
    postalCode: String,
    isDefault: Boolean
  }],
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update `updatedAt` on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const User = mongoose.model("User", userSchema);
```

---

## 🔒 Security Considerations

### 1. **OTP Security**
- **Rate Limiting**: Max 3 OTP requests per mobile per 10 minutes
- **Expiration**: OTP expires after 2 minutes
- **Verification Attempts**: Max 3 verification attempts per OTP
- **Code Generation**: Use crypto-secure random number generator
- **Storage**: Hash OTP codes before storing (optional but recommended)

### 2. **JWT Token Security**
- **Secret Key**: Use strong, environment-variable-based secret key
- **Expiration**: 30 days (configurable)
- **Algorithm**: HS256 or RS256
- **Refresh Tokens**: Consider implementing refresh tokens for better security

### 3. **API Security**
- **CORS**: Configure CORS to allow only frontend origin
- **HTTPS**: Use HTTPS in production
- **Input Validation**: Validate all input data
- **SQL Injection**: Use parameterized queries (Mongoose does this by default)

### 4. **SMS Security**
- **Provider Credentials**: Store SMS provider API keys in environment variables
- **Cost Management**: Implement daily SMS sending limits
- **Logging**: Log all OTP requests for audit trail

---

## 📦 Required NPM Packages

```bash
npm install jsonwebtoken bcryptjs express-rate-limit
```

**Optional** (for SMS):
```bash
npm install axios  # If using Kavenegar/Ghasedak API
```

---

## 🧪 Example Backend Implementation

### OTP Controller

```javascript
const crypto = require('crypto');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { sendSMS } = require('../services/smsService');

// Send OTP
exports.sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    // Validate mobile number
    if (!mobile || !/^09\d{9}$/.test(mobile)) {
      return res.status(400).json({
        success: false,
        message: "شماره موبایل نامعتبر است"
      });
    }

    // Check rate limit
    const recentOtps = await OTP.countDocuments({
      mobile,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
    });

    if (recentOtps >= 3) {
      return res.status(429).json({
        success: false,
        message: "تعداد درخواست‌های شما بیش از حد مجاز است. لطفا 10 دقیقه دیگر تلاش کنید"
      });
    }

    // Generate 4-digit OTP
    const code = crypto.randomInt(1000, 9999).toString();

    // Save OTP to database
    const otp = new OTP({
      mobile,
      code,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes
      verified: false,
      attempts: 0
    });
    await otp.save();

    // Send SMS (implement this based on your SMS provider)
    await sendSMS(mobile, `کد تایید شما: ${code}`);

    res.json({
      success: true,
      message: "کد تایید به شماره موبایل شما ارسال شد",
      expiresIn: 120
    });

  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({
      success: false,
      message: "خطا در ارسال کد تایید"
    });
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { mobile, code } = req.body;

    // Validate input
    if (!mobile || !code || code.length !== 4) {
      return res.status(400).json({
        success: false,
        message: "اطلاعات وارد شده نامعتبر است"
      });
    }

    // Find OTP
    const otp = await OTP.findOne({
      mobile,
      code,
      verified: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "کد تایید نامعتبر یا منقضی شده است"
      });
    }

    // Check attempts
    if (otp.attempts >= 3) {
      return res.status(400).json({
        success: false,
        message: "تعداد تلاش‌های شما بیش از حد مجاز است. لطفا کد جدید درخواست دهید"
      });
    }

    // Update attempts
    otp.attempts += 1;
    await otp.save();

    // Find or create user
    let user = await User.findOne({ mobile });
    if (!user) {
      user = new User({
        mobile,
        name: "کاربر ویلف‌ویتا",
        wallet: 0,
        role: "user",
        isActive: true
      });
      await user.save();
    }

    // Mark OTP as verified
    otp.verified = true;
    await otp.save();

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        userId: user._id,
        mobile: user.mobile,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: "ورود با موفقیت انجام شد",
      data: {
        user: {
          _id: user._id,
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          wallet: user.wallet,
          role: user.role,
          isActive: user.isActive
        },
        token
      },
      token
    });

  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({
      success: false,
      message: "خطا در تایید کد"
    });
  }
};

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    // User ID is added by auth middleware
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "کاربر یافت نشد"
      });
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        wallet: user.wallet,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "خطا در دریافت اطلاعات کاربر"
    });
  }
};
```

### Auth Middleware

```javascript
const jwt = require('jsonwebtoken');

exports.protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "لطفا ابتدا وارد حساب کاربری خود شوید"
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add user ID to request
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({
      success: false,
      message: "توکن نامعتبر است"
    });
  }
};
```

### Routes

```javascript
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);

// Protected routes
router.get('/profile', protect, authController.getProfile);

module.exports = router;
```

---

## 🔗 Frontend Integration Status

✅ **Completed**:
- [authService.ts](frontend/src/services/authService.ts) - Ready to call backend endpoints
- [Login Page](frontend/src/app/login/page.tsx) - Integrated with authService
- [Profile Page](frontend/src/app/profile/page.tsx) - Fetches real user data
- [API Client](frontend/src/lib/api.ts) - Axios interceptors configured

⏳ **Waiting for Backend**:
- POST /api/auth/send-otp
- POST /api/auth/verify-otp
- GET /api/auth/profile

---

## 🧪 Testing the Integration

### 1. Test OTP Send (using Postman/cURL)

```bash
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"mobile": "09123456789"}'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "کد تایید به شماره موبایل شما ارسال شد",
  "expiresIn": 120
}
```

### 2. Test OTP Verify

```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"mobile": "09123456789", "code": "1234"}'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "ورود با موفقیت انجام شد",
  "data": {
    "user": {...},
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. Test Get Profile

```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "_id": "673cc2ae8f4b1234567890ab",
    "name": "کاربر نمونه",
    "mobile": "09123456789",
    ...
  }
}
```

---

## 📋 Checklist for Backend Developer

- [ ] Create User model with mobile field (unique)
- [ ] Create OTP model with expiration
- [ ] Implement POST /api/auth/send-otp endpoint
- [ ] Implement POST /api/auth/verify-otp endpoint
- [ ] Implement GET /api/auth/profile endpoint
- [ ] Add JWT authentication middleware
- [ ] Integrate SMS provider (Kavenegar/Ghasedak)
- [ ] Add rate limiting for OTP requests
- [ ] Add attempt limiting for OTP verification
- [ ] Test all endpoints with Postman
- [ ] Update CORS settings to allow frontend origin
- [ ] Add environment variables for JWT_SECRET and SMS API keys

---

## 🎯 Next Steps After Backend Implementation

1. **Update Frontend .env**:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   ```

2. **Test Full Flow**:
   - User enters mobile number → OTP sent
   - User enters OTP code → User logged in
   - User redirected to profile page → Real data displayed

3. **Remove Mock Implementations**:
   - Once backend is ready, the frontend will automatically use real API
   - No changes needed to frontend code (it's already integrated!)

---

**Status**: 🚀 **Frontend Ready, Waiting for Backend**

**Contact**: If you have questions about the frontend integration or expected data formats, refer to:
- [authService.ts](frontend/src/services/authService.ts:63-91) - Send OTP implementation
- [authService.ts](frontend/src/services/authService.ts:101-169) - Verify OTP implementation
- [authService.ts](frontend/src/services/authService.ts:177-233) - Get Profile implementation
