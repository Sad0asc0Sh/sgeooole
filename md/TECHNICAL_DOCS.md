# Welfvita Store - Technical Documentation

## 🔧 Technical Issues Fixed

### 1. **Admin Panel API Connection**
- **Problem**: Admin panel was using hardcoded `http://localhost:5000/api` which caused CORS issues
- **Solution**: Updated to use Next.js proxy `/proxy-api` configured in `next.config.mjs`
- **File Fixed**: `admin/lib/api-fixed.js`

### 2. **Environment Configuration**
- **Problem**: Missing environment files for all three components
- **Solution**: Created `.env` files for Backend, Frontend, and Admin panel
- **Files Created**:
  - `Backend/.env` and `Backend/.env.example`
  - `Frontend/.env`
  - `admin/.env.local`

### 3. **CORS Configuration**
- **Problem**: Backend CORS not configured for all frontend URLs
- **Solution**: Updated `CLIENT_URL` in Backend `.env` to include all three frontend ports:
  ```
  CLIENT_URL=http://localhost:5173,http://localhost:3000,http://localhost:3001
  ```

### 4. **Authentication Flow**
- **Problem**: Inconsistent token management between components
- **Solution**: Added interceptors in admin API client for automatic token attachment and 401 handling

### 5. **Admin Login Endpoint**
- **Problem**: Admin panel was trying to use non-existent `/auth/admin/login` endpoint
- **Solution**: Backend already has this endpoint at `/api/auth/admin/login`

## 📁 Project Architecture

```
origin-main/
├── Backend/           # Node.js + Express API
│   ├── config/       # Configuration files
│   ├── controllers/  # Business logic
│   ├── middleware/   # Express middleware
│   ├── models/       # MongoDB schemas
│   ├── routes/       # API routes
│   ├── services/     # Service layer
│   ├── utils/        # Utility functions
│   └── server.js     # Main server file
├── Frontend/          # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/    # Zustand state management
│   │   └── lib/      # API client
│   └── vite.config.ts
└── admin/             # Next.js Admin Panel
    ├── app/          # Next.js 13+ app directory
    ├── components/   
    ├── lib/          # API client
    └── next.config.mjs
```

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+
- MongoDB 4.4+
- npm or yarn

### Installation

1. **Run the setup script:**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

2. **Configure MongoDB:**
   - Make sure MongoDB is running on port 27017
   - Or update `MONGO_URI` in `Backend/.env`

3. **Start all services:**

   **Backend (Terminal 1):**
   ```bash
   cd Backend
   npm run dev
   # Runs on http://localhost:5000
   ```

   **Frontend (Terminal 2):**
   ```bash
   cd Frontend
   npm run dev
   # Runs on http://localhost:5173
   ```

   **Admin Panel (Terminal 3):**
   ```bash
   cd admin
   npm run dev
   # Runs on http://localhost:3000
   ```

## 🔐 Authentication System

### User Roles
- `user` - Regular customer
- `admin` - Store administrator
- `manager` - Store manager
- `superadmin` - Super administrator

### Token Management
- **Access Token**: 15 minutes (sent in Authorization header)
- **Refresh Token**: 7 days (stored in httpOnly cookie)

### Creating Admin User
1. Register a regular user via Frontend
2. Access MongoDB:
   ```bash
   mongosh
   use welfvita-store
   db.users.updateOne(
     {email: 'your-email@example.com'},
     {$set: {role: 'admin'}}
   )
   ```
3. Login to admin panel with the same credentials

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/admin/login` - Admin login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (Admin)
- `PUT /api/products/:id` - Update product (Admin)
- `DELETE /api/products/:id` - Delete product (Admin)

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/tree` - Get category tree
- `POST /api/categories` - Create category (Admin)
- `PUT /api/categories/:id` - Update category (Admin)
- `DELETE /api/categories/:id` - Delete category (Admin)

### Cart
- `GET /api/cart` - Get user cart
- `POST /api/cart/add` - Add to cart
- `PUT /api/cart/update` - Update cart item
- `DELETE /api/cart/remove/:productId` - Remove from cart
- `DELETE /api/cart/clear` - Clear cart

### Orders
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create order
- `PUT /api/orders/:id/cancel` - Cancel order

## 🔒 Security Features

### Implemented Security Measures
1. **Helmet.js** - Sets security headers
2. **CORS** - Configured for specific origins
3. **Rate Limiting** - API and Auth specific limits
4. **MongoDB Sanitization** - Prevents NoSQL injection
5. **XSS Clean** - Sanitizes user input
6. **HPP** - Prevents HTTP Parameter Pollution
7. **JWT Authentication** - Secure token-based auth
8. **Password Hashing** - Bcrypt with 12 salt rounds
9. **Input Validation** - Express-validator on all routes

### Rate Limits
- General API: 100 requests per 15 minutes
- Authentication: 5 requests per 15 minutes
- Password Reset: 3 requests per hour

## 🎨 Frontend Features

### Tech Stack
- React 18
- TypeScript
- Vite
- Zustand (State Management)
- React Query (Server State)
- React Router v6
- Tailwind CSS
- Shadcn UI Components

### Key Features
- Product browsing and search
- Shopping cart
- User authentication
- Order management
- Password reset
- Responsive design

## 👨‍💼 Admin Panel Features

### Tech Stack
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- React Query

### Key Features
- Dashboard with statistics
- Product management (CRUD)
- Category management
- Order management
- User management
- Sales reports

## 🗃️ Database Schema

### User Schema
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: String (user/admin/manager/superadmin),
  avatar: String,
  isEmailVerified: Boolean,
  isActive: Boolean,
  addresses: [AddressSchema],
  createdAt: Date,
  updatedAt: Date
}
```

### Product Schema
```javascript
{
  name: String,
  slug: String (unique),
  description: String,
  price: Number,
  compareAtPrice: Number,
  category: String,
  brand: String,
  images: [String],
  stock: Number,
  rating: Number,
  numReviews: Number,
  isFeatured: Boolean,
  isOnSale: Boolean,
  specifications: Object,
  createdAt: Date,
  updatedAt: Date
}
```

## 🐛 Troubleshooting

### Common Issues and Solutions

1. **MongoDB Connection Error**
   - Ensure MongoDB is running: `sudo systemctl start mongod`
   - Check connection string in `Backend/.env`

2. **CORS Error**
   - Verify `CLIENT_URL` in Backend `.env` includes your frontend URL
   - Check proxy settings in `vite.config.ts` and `next.config.mjs`

3. **Authentication Failed**
   - Clear browser cookies and localStorage
   - Ensure JWT_SECRET is set in Backend `.env`
   - Check token expiration times

4. **Admin Panel Can't Connect to API**
   - Use the fixed `admin/lib/api-fixed.js` file
   - Ensure Backend is running on port 5000
   - Check Next.js proxy configuration

5. **Port Already in Use**
   - Backend: Change `PORT` in `.env`
   - Frontend: Change port in `vite.config.ts`
   - Admin: Change port with `npm run dev -- -p 3001`

## 📝 Environment Variables Reference

### Backend (.env)
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/welfvita-store
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
CLIENT_URL=http://localhost:5173,http://localhost:3000
CLOUDINARY_CLOUD_NAME=optional
CLOUDINARY_API_KEY=optional
CLOUDINARY_API_SECRET=optional
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=optional
EMAIL_PASS=optional
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000
VITE_APP_NAME=Welfvita Store
```

### Admin (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_APP_NAME=Welfvita Admin
```

## 🚢 Production Deployment

### Backend Deployment
1. Set `NODE_ENV=production`
2. Use strong JWT secrets
3. Configure real MongoDB instance
4. Set up Cloudinary for image uploads
5. Configure email service
6. Use PM2 or similar for process management

### Frontend Deployment
1. Build: `npm run build`
2. Deploy `dist` folder to CDN/hosting
3. Update `VITE_API_URL` to production API

### Admin Panel Deployment
1. Build: `npm run build`
2. Deploy with `npm start`
3. Update `NEXT_PUBLIC_API_URL` to production API

## 📧 Contact & Support

For issues or questions:
- Create an issue in the repository
- Email: support@welfvita.com
- Documentation: https://docs.welfvita.com

## 📄 License

MIT License - See LICENSE file for details

---

**Last Updated**: November 2024
**Version**: 1.0.0
