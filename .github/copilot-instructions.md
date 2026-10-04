# EkgKala E-Commerce Monorepo - AI Agent Guidelines

## 🏗️ Architecture Overview

**Monorepo structure** with three independent deployable apps:
- **Frontend** (`frontend/`) - Next.js 16 server-rendered e-commerce storefront  
- **Admin Panel** (`admin/`) - Vite + React + Ant Design management UI  
- **Backend API** (`ekgkala-backend/`) - Express.js + MongoDB + Redis  

**Data flow**: Frontend/Admin → Backend API (JWT auth) → MongoDB + Redis  
**Deployment**: Vercel (frontend + admin), Render (backend), MongoDB Atlas (DB)

---

## 🔑 Critical Architecture Patterns

### 1. **Service Layer Pattern** (Frontend/Admin)
Each domain has a dedicated service file (e.g., `productService.ts`, `cartService.ts`) that:
- Handles all HTTP communication via `api` axios instance (`frontend/src/lib/api.ts`)
- Includes TypeScript interfaces for request/response contracts
- Is the **only place** client code should call the backend

```typescript
// ✅ Correct: Use service layer
import { productService } from "@/services/productService";
const products = await productService.getProducts({ limit: 10 });

// ❌ Wrong: Direct API calls in components
const products = await fetch(`${API_URL}/products`);
```

### 2. **SSR vs Client Data Fetching** (Frontend only - Next.js 16)
- **Server Components**: Use `productData.ts` (native fetch, no "use client")  
- **Client Components**: Use `productService.ts` (axios, marked "use client")  
- **Never mix**: Don't use axios in server components or native fetch in client components

### 3. **JWT Authentication + Token Blacklist**
Backend uses:
- **JWT tokens** with issuer/audience claims (stored in Redis)
- **Token blacklist** on logout/password change (Redis with TTL)
- **Fail-safe**: If Redis down, tokens treated as valid (fail-open for availability)
- Middleware: `ekgkala-backend/middleware/auth.js` - verifies JWT, attaches `req.user`

Frontend interceptor in `api.ts` auto-injects `Authorization: Bearer {token}` header.

### 4. **Rate Limiting & Proxy Trust**
Backend configured with:
- `app.set('trust proxy', 1)` - **required** for accurate rate limiting behind reverse proxies
- Per-route rate limiters in `rateLimiter.js` 
- Real client IP extracted from X-Forwarded-For headers

### 5. **CORS with Dynamic Origin Validation**
- Allowed origins parsed from `CORS_ALLOWED_ORIGINS`, `CLIENT_URL`, `FRONTEND_URL` env vars
- CSP headers restrict image sources to Cloudinary + self
- SVG uploads blocked (XSS prevention)

---

## 📦 Dependencies & Integrations

### Core Libraries (Consistent across stack)
- **API client**: Axios with request/response interceptors
- **State management**: Zustand (admin + cart logic)  
- **Styling**: Tailwind CSS (frontend), Ant Design (admin)
- **Data validation**: express-validator (backend), Joi for schemas

### Async Operations
- **Frontend**: SWR for data fetching, Framer Motion for animations
- **Admin**: TanStack Query (React Query) for server state
- **Backend**: Winston loggers, PM2 for zero-downtime deployments

### External Services
- **Images**: Cloudinary (configured via environment variables)
- **SMS (Iran)**: Kavenegar for OTP delivery  
- **Payments**: ZarinPal (Iranian payment gateway)
- **AI**: Google Generative AI (Gemini) for some features

---

## 🔐 Security Patterns (Already Implemented)

**Critical fixes already applied** - DO NOT regress:
1. ✅ **No xss-clean**: Replaced with express-validator for input validation
2. ✅ **No SVG uploads**: Blocked at file type validation layer
3. ✅ **Helmet CSP**: Strict Content Security Policy in production
4. ✅ **Production console silencing**: No console.log/warn leaking secrets
5. ✅ **Rate limiting**: User-agent bypass fixed (cannot spoof)
6. ✅ **RBAC**: No hardcoded superadmin bypass in middleware
7. ✅ **Health endpoint**: Sensitive info only for authenticated admins

When adding security features:
- Validate in middleware (auth.js, accessControl.js)
- Log security events to audit logs (AuditLog model)
- Never log PII or tokens - use securityLogger.js with redaction

---

## 🚀 Build & Development Workflows

### Local Development
```bash
# Root level - runs all three apps with hot-reload
pnpm run dev:backend      # Nodemon + Express @ port 5000
pnpm run dev:frontend     # Next.js @ port 3000  
pnpm run dev:admin        # Vite @ port 3001

# Each app has independent scripts (cd app && pnpm run dev)
```

### Production Build
```bash
# Root: Builds frontend + admin (backend deploys separately)
pnpm run build:frontend   # Next build (Turbopack) → .next/
pnpm run build:admin      # Vite build → dist/

# Build output considerations:
# - Frontend: Static export + API routes (revalidation)
# - Admin: SPA bundle (large chunks expected - 389MB for charts library)
# - Backend: No build needed (Node.js runs server.js directly)
```

### Monorepo Package Management
- **Root `package.json`**: Only build/dev orchestration scripts
- **Each app**: Independent `package.json` with full dependency list
- **Lockfiles**: pnpm creates `pnpm-lock.yaml` per app (managed separately; apps are standalone pnpm projects, NOT a single workspace — admin is React 18, frontend is React 19). pnpm settings (overrides, allowBuilds) live in each app's `pnpm-workspace.yaml`, not in package.json.
- **Installation**: `pnpm run install:all` or manual `cd app && pnpm install --frozen-lockfile` (requires pnpm 12.8.1, see `packageManager`)

---

## 📁 File Organization Conventions

### Frontend (`frontend/src/`)
```
app/              # Next.js 13+ app directory (pages + layouts)
  ├── page.tsx    # Route pages
  ├── layout.tsx  # Shared layouts
  └── [slug]/     # Dynamic routes
components/       # React components (split by domain)
  ├── layout/     # Header, Footer, Sidebar
  ├── features/   # Domain-specific (products, cart, auth)
  └── ui/         # Generic UI components
services/         # API integration layer (ONLY place to call backend)
lib/              # Utilities + SSR-safe data fetching
  ├── api.ts      # Axios instance (CLIENT-ONLY)
  ├── productData.ts  # SSR-safe fetching (server components)
  └── mock/       # Static test data
```

### Admin (`admin/src/`)
```
pages/            # Vite-router pages (mimics Next.js structure)
components/       # React components + Ant Design wrappers
stores/           # Zustand stores (auth, data, UI state)
api/              # Service layer (axios calls to backend)
```

### Backend (`ekgkala-backend/`)
```
middleware/       # Express middleware (auth, validation, logging)
controllers/      # Business logic (exports req handlers)
routes/           # Express routes (RESTful endpoints)
models/           # MongoDB/Mongoose schemas + methods
services/         # Shared business logic (not route-specific)
validators/       # Input validation rules (Joi schemas)
utils/            # Redis client, logger, email, etc.
jobs/             # Background jobs (cron, queue workers)
```

---

## 🧪 Testing & Debugging

### Debugging Guides Exist
- `reproduce_cart_bug.js` - Cart synchronization test scenario
- `test-connections.sh` - Connectivity check for all services
- Debug scripts: `debug_*.js` files for specific features

### When to Use Debug Scripts
```bash
cd ekgkala-backend
node debug_carts.js        # Cart state inspection
node debug_cats.js         # Category tree debugging
node debug_notifications.js # Notification system trace
```

### Build Issues
- Frontend build warnings about large chunks (389MB) are expected (charts library)
- Admin Vite dynamic import warning is intentional (reduced circular deps)
- Build fails on missing `.env` files - provide env template or actual env vars

---

## 🔄 Cross-Component Communication

### Frontend → Backend
1. Component calls `serviceLayer.ts` method  
2. Service uses `api` axios instance (auto-injects JWT)  
3. Backend middleware validates token, attaches `req.user`  
4. Controller processes request, returns JSON

### Admin → Backend
- Identical pattern using Ant Design components + axios

### Caching Strategy
- **Redis** (backend): Token blacklist, session cache, rate limit counters
- **Browser localStorage**: JWT token, session ID
- **SWR/React Query**: Client-side cache with revalidation
- **Next.js ISR**: `revalidate` time in page-level exports

### State Management
- **Cart**: Zustand store (frontend) + Redis backend sync
- **Auth**: JWT tokens + localStorage
- **UI State**: Component state (React) or Zustand (complex flows)

---

## 🌐 Environment Variables

### Backend Critical Vars
- `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` - Auth token settings
- `MONGODB_URI` - Database connection (Atlas)
- `REDIS_URL` - Cache/session store (Upstash)
- `CORS_ALLOWED_ORIGINS` - Comma-separated client URLs
- `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY` - Image hosting
- `NODE_ENV=production` - Enables security hardening

### Frontend Critical Vars
- `NEXT_PUBLIC_API_URL` - Backend API base (must be public)
- All other sensitive vars stay in `.env.local` (never shipped)

### Admin Critical Vars
- `VITE_API_URL` - Backend API endpoint
- Vite requires `VITE_` prefix for browser vars

---

## 🚨 Common Pitfalls to Avoid

1. **Direct API calls in components** → Use service layer instead
2. **Mixing server/client data fetching** → Use correct lib for context
3. **Hardcoded API URLs** → Always use env vars
4. **Bypassing auth middleware** → Never skip middleware checks
5. **Logging secrets** → Use `securityLogger.js` with redaction
6. **Token stored in cookies** → Currently localStorage (acceptable for SPA)
7. **Assuming Redis always available** → Implement fail-safe patterns
8. **Frontend bundle size** → Use dynamic imports for heavy libs (charts, editors)

---

## 📚 Reference Documentation

- `deploy/DEPLOYMENT_GUIDE.md` - Complete deployment steps
- `md/CATEGORIES_SYSTEM.md` - Category hierarchy & tree rendering
- `frontend/docs/URL_ARCHITECTURE.md` - URL handling + SSR patterns
- `SECURITY-IMPLEMENTATION-GUIDE.md` - Security hardening details
- `admin/COMPLETE_ADMIN_GUIDE.md` - Admin panel feature checklist

---

**Last Updated**: February 2026 | **Stack**: Next.js 16, Vite, Express.js, MongoDB
