# ArvanCloud Object Storage Integration Setup Guide

## Overview
This document provides setup instructions for migrating the ekgkala project from local/Cloudinary storage to ArvanCloud Object Storage (S3-compatible).

## Prerequisites
- ArvanCloud account with Object Storage enabled
- Access key and secret key generated from ArvanCloud dashboard
- Bucket created with public read access

## Installation Steps

### 1. Install AWS SDK for JavaScript
```bash
cd /home/ubuntu/ekgkala-project/ekgkala-backend
npm install @aws-sdk/client-s3
```

**If experiencing network issues**, try one of these alternatives:

```bash
# Using npm mirror
npm install @aws-sdk/client-s3 --registry=https://registry.npmmirror.com/

# Or use yarn
yarn add @aws-sdk/client-s3

# Or use pnpm
pnpm add @aws-sdk/client-s3
```

### 2. Configure Environment Variables

Create or update `.env` file in `/home/ubuntu/ekgkala-project/ekgkala-backend/`:

```env
# ArvanCloud Object Storage Configuration
ARVAN_ENDPOINT=https://s3.ir-thr-at1.arvanstorage.ir
ARVAN_BUCKET_NAME=ekgkala-media
ARVAN_ACCESS_KEY=YOUR_ACCESS_KEY_HERE
ARVAN_SECRET_KEY=YOUR_SECRET_KEY_HERE
ARVAN_REGION=ir-thr-at1

# Other existing variables
UPLOAD_MAX_FILE_SIZE_MB=10
BASE_URL=http://localhost:5000
```

**To get ArvanCloud credentials:**
1. Login to [ArvanCloud Dashboard](https://console.arvancloud.ir/)
2. Navigate to Object Storage section
3. Create a new bucket (e.g., `ekgkala-media`)
4. Generate Access Key and Secret Key
5. Set bucket permissions to "Public Read" for all objects

### 3. Update Frontend Environment Variables

Create or update `.env` file in `/home/ubuntu/ekgkala-project/frontend/`:

```env
NEXT_PUBLIC_ARVAN_ENDPOINT=https://s3.ir-thr-at1.arvanstorage.ir
NEXT_PUBLIC_ARVAN_BUCKET_NAME=ekgkala-media
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SITE_URL=https://ekgkala.ir
```

### 4. Verify Installation

Create a test file `test-s3.js` in the backend:

```javascript
const { S3Client } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  endpoint: process.env.ARVAN_ENDPOINT,
  region: process.env.ARVAN_REGION,
  credentials: {
    accessKeyId: process.env.ARVAN_ACCESS_KEY,
    secretAccessKey: process.env.ARVAN_SECRET_KEY,
  },
});

console.log("S3 Client initialized successfully!");
console.log("Endpoint:", process.env.ARVAN_ENDPOINT);
console.log("Bucket:", process.env.ARVAN_BUCKET_NAME);

// Test connection
s3Client.send(new ListBucketsCommand({}))
  .then(data => console.log("Connection successful!"))
  .catch(err => console.error("Connection failed:", err));
```

### 5. Migration Checklist

- [ ] Install `@aws-sdk/client-s3`
- [ ] Create ArvanCloud bucket
- [ ] Generate access credentials
- [ ] Update backend `.env` file
- [ ] Update frontend `.env` file
- [ ] Test upload endpoint: `POST /api/uploads/image`
- [ ] Test banner upload: `POST /api/uploads/banner`
- [ ] Verify images load from ArvanCloud
- [ ] Monitor for any 403/404 errors
- [ ] Gradually migrate existing images to ArvanCloud

## Files Modified

### Backend
- `/ekgkala-backend/lib/arvanS3.js` - NEW: ArvanCloud S3 utility
- `/ekgkala-backend/routes/uploads.js` - UPDATED: S3 upload endpoints
- `/ekgkala-backend/.env` - UPDATED: ArvanCloud credentials

### Frontend
- `/frontend/src/lib/image.ts` - UPDATED: ArvanCloud URL resolution
- `/frontend/next.config.ts` - UPDATED: Remote patterns
- `/frontend/src/app/layout.tsx` - UPDATED: DNS preconnect
- `/frontend/src/components/home/HeroSection.tsx` - UPDATED: Hybrid rendering

## Performance Improvements

### LCP Optimization
1. **First Slide SSR**: Primary banner now rendered server-side
2. **Priority Loading**: `fetchPriority="high"` and `priority` prop
3. **DNS Prefetch**: Added preconnect for ArvanCloud endpoint
4. **Blur Placeholders**: Visual stability during image load

### Bundle Size Reduction
1. **Lazy Swiper.js**: Dynamic import after hydration
2. **No render-blocking**: Swiper loads only when needed
3. **Tree-shaking**: Unused code eliminated

### Expected Performance Gains
- **LCP**: 14.79s → <2.0s (90%+ reduction)
- **Total Blocking Time (TBT)**: ~50% reduction
- **First Contentful Paint (FCP)**: ~40% reduction
- **Bundle size**: ~30% reduction from lazy-loaded Swiper

## Troubleshooting

### Upload fails with 500 error
- Check ArvanCloud credentials in `.env`
- Verify bucket name matches exactly
- Ensure bucket has public read access

### Images not loading (403/404)
- Check `remotePatterns` in `next.config.ts`
- Verify bucket is public or CORS configured
- Clear Next.js cache: `rm -rf .next`

### Network timeout during npm install
- Use mirror registry (see Installation Steps)
- Check proxy settings
- Try offline mode with previously cached packages

## Support

For issues or questions, check:
- ArvanCloud documentation: https://www.arvancloud.ir/en/object-storage
- AWS SDK docs: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/
