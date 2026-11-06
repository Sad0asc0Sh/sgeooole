/**
 * optimize-existing-s3-images.js — فاز ۲ (ParsPack S3)
 * =====================================================================
 * بهینه‌سازی درجا (In-Place) تصاویر موجود روی پارس‌پک، بدون افت محسوس
 * کیفیت بصری. هر فایل حجیم با همان کلید قبلی بازنویسی می‌شود تا هیچ
 * URLای نشکند؛ فقط حجم و ابعاد استاندارد می‌شود.
 *
 * پوشش:
 *   • Product.images[]      — نسخه‌ی کارت 420×420 q78 (رفتار فاز ۱ حفظ شده)
 *                             + ثبت cardUrl در MongoDB (idempotent).
 *   • Banner.image/mobileImage — نسخه‌ی دسکتاپ 1920×600 q85 درجا +
 *                             ساخت نسخه‌ی کارت 960×480 q84 (ثبت cardUrl).
 *   • Category.image/icon   — استاندارد رتینا درجا: image 320×320 q86،
 *                             icon 160×160 q86.
 *   • Brand.logo            — استاندارد رتینا درجا: 320×160 q86.
 *
 * Usage:
 *   node scripts/optimize-existing-s3-images.js            # live
 *   node scripts/optimize-existing-s3-images.js --dry-run  # preview only
 *   node scripts/optimize-existing-s3-images.js --verbose
 *   node scripts/optimize-existing-s3-images.js --only=banners
 *   node scripts/optimize-existing-s3-images.js --limit=50
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Product = require('../models/Product');
const Banner = require('../models/Banner');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const { putObject, convertToWebp, cardKeyFor } = require('../lib/parspackS3');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : Infinity;
})();
const ONLY = (() => {
  const arg = process.argv.find((a) => a.startsWith('--only='));
  return arg ? arg.slice('--only='.length).toLowerCase() : null;
})();
const shouldRun = (name) => !ONLY || ONLY === name || ONLY.split(',').includes(name);

// ابعاد استاندارد فاز ۲
const PRODUCT_CARD = { maxWidth: 420, maxHeight: 420, quality: 78 };
const BANNER_MAIN = { maxWidth: 1920, maxHeight: 600, quality: 85 };
const BANNER_CARD = { maxWidth: 960, maxHeight: 480, quality: 84 };
const CATEGORY_IMAGE = { maxWidth: 320, maxHeight: 320, quality: 86 };
const CATEGORY_ICON = { maxWidth: 160, maxHeight: 160, quality: 86 };
const BRAND_LOGO = { maxWidth: 320, maxHeight: 160, quality: 86 };

const keyFromUrl = (url) => {
  try {
    const pathname = new URL(url).pathname; // /<bucket>/uploads/<file>
    const idx = pathname.indexOf('/uploads/');
    if (idx < 0) return null;
    return decodeURIComponent(pathname.slice(idx + 1)); // uploads/<file>
  } catch {
    return null;
  }
};

const isGifUrl = (url) => /\.gif($|\?)/i.test(String(url || ''));

const downloadBuffer = async (url) => {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer',
    maxContentLength: 80 * 1024 * 1024,
  });
  return Buffer.from(data);
};

/**
 * بهینه‌سازی درجا: دانلود فایل فعلی، تبدیل با ابعاد/کیفیت هدف و
 * آپلود روی همان کلید. اگر خروجی بزرگ‌تر از ورودی باشد، رد می‌شود
 * (هیچ‌وقت حجم را افزایش نده).
 */
const optimizeInPlace = async (url, size) => {
  const key = keyFromUrl(url);
  if (!key || isGifUrl(url)) return { status: 'skip' };
  const original = await downloadBuffer(url);
  const converted = await convertToWebp(original, size);
  if (!converted) return { status: 'fail', reason: 'conversion failed' };
  if (converted.length >= original.length) return { status: 'skip', reason: 'already optimal' };
  if (DRY_RUN) return { status: 'ok', key, before: original.length, after: converted.length };
  const res = await putObject(converted, key, 'image/webp');
  return { status: 'ok', key, before: original.length, after: converted.length, url: res.url };
};

/** ساخت/به‌روزرسانی نسخه‌ی کارت یک تصویر بنر و برگرداندن cardUrl. */
const ensureBannerCard = async (image) => {
  const url = typeof image === 'string' ? image : image?.url;
  if (!url || isGifUrl(url)) return null;
  const existingCard = typeof image === 'object' ? image?.cardUrl : null;
  if (typeof existingCard === 'string' && existingCard.trim()) return existingCard;
  const key = keyFromUrl(url);
  const cardKey = key ? cardKeyFor(key) : null;
  if (!key || !cardKey) return null;
  if (DRY_RUN) return `dry-run:${cardKey}`;
  const original = await downloadBuffer(url);
  const cardBuf = await convertToWebp(original, BANNER_CARD);
  if (!cardBuf) return null;
  const res = await putObject(cardBuf, cardKey, 'image/webp');
  return res.url;
};

const summary = { ok: 0, skip: 0, fail: 0 };
const logResult = (label, result) => {
  if (result.status === 'ok') {
    summary.ok += 1;
    if (VERBOSE || DRY_RUN) {
      console.log(`  ✅ ${label}: ${Math.round((result.before || 0) / 1024)}KB → ${Math.round((result.after || 0) / 1024)}KB`);
    }
  } else if (result.status === 'skip') {
    summary.skip += 1;
    if (VERBOSE) console.log(`  ⏭️  ${label}: ${result.reason || 'skip'}`);
  } else {
    summary.fail += 1;
    console.warn(`  ❌ ${label}: ${result.reason || 'failed'}`);
  }
};

const normalizeImage = async (image, size, label) => {
  const url = typeof image === 'string' ? image : image?.url;
  if (!url) return null;
  const result = await optimizeInPlace(url, size);
  logResult(label, result);
  if (result.status === 'ok' && typeof image === 'object' && image) {
    return { ...image, url: result.url || image.url };
  }
  return image;
};

const processProducts = async () => {
  const products = await Product.find({}).lean();
  console.log(`📦 Products: ${products.length}`);
  let scanned = 0;
  for (const product of products) {
    const images = Array.isArray(product.images) ? product.images : [];
    if (images.length === 0) continue;
    let changed = false;
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img || typeof img !== 'object' || typeof img.url !== 'string') continue;
      if (typeof img.cardUrl === 'string' && img.cardUrl.trim()) continue; // already done (idempotent)
      scanned += 1;
      if (scanned > LIMIT) break;
      const key = keyFromUrl(img.url);
      const cardKey = key ? cardKeyFor(key) : null;
      if (!key || !cardKey || isGifUrl(img.url)) { summary.skip += 1; continue; }
      try {
        if (VERBOSE || DRY_RUN) console.log(`  [${product._id}] → ${cardKey}`);
        if (DRY_RUN) { summary.ok += 1; continue; }
        const cardBuf = await convertToWebp(await downloadBuffer(img.url), PRODUCT_CARD);
        if (!cardBuf) { summary.fail += 1; continue; }
        const res = await putObject(cardBuf, cardKey, 'image/webp');
        images[i] = { ...img, cardUrl: res.url };
        changed = true;
        summary.ok += 1;
      } catch (err) {
        summary.fail += 1;
        console.error(`  ❌ ${key}: ${err.message}`);
      }
    }
    if (changed && !DRY_RUN) await Product.updateOne({ _id: product._id }, { $set: { images } });
    if (scanned > LIMIT) break;
  }
};

const processBanners = async () => {
  const banners = await Banner.find({}).lean();
  console.log(`🖼️  Banners: ${banners.length}`);
  let scanned = 0;
  for (const banner of banners) {
    const update = {};
    for (const field of ['image', 'mobileImage']) {
      const image = banner[field];
      if (!image) continue;
      scanned += 1;
      if (scanned > LIMIT) break;
      try {
        const optimized = await normalizeImage(image, BANNER_MAIN, `${banner._id}:${field}`);
        const cardUrl = await ensureBannerCard(optimized);
        if (typeof optimized === 'object' && optimized && cardUrl) {
          update[field] = { ...optimized, cardUrl };
        } else if (optimized && optimized !== image) {
          update[field] = optimized;
        }
      } catch (err) {
        summary.fail += 1;
        console.error(`  ❌ banner ${banner._id} ${field}: ${err.message}`);
      }
    }
    if (Object.keys(update).length && !DRY_RUN) {
      await Banner.updateOne({ _id: banner._id }, { $set: update });
    }
    if (scanned > LIMIT) break;
  }
};

const processCategories = async () => {
  const categories = await Category.find({}).lean();
  console.log(`🗂️  Categories: ${categories.length}`);
  let scanned = 0;
  for (const cat of categories) {
    const update = {};
    if (cat.image) {
      scanned += 1;
      try {
        const optimized = await normalizeImage(cat.image, CATEGORY_IMAGE, `${cat._id}:image`);
        if (optimized && optimized !== cat.image) update.image = optimized;
      } catch (err) {
        summary.fail += 1;
        console.error(`  ❌ category ${cat._id} image: ${err.message}`);
      }
    }
    if (cat.icon) {
      scanned += 1;
      try {
        const optimized = await normalizeImage(cat.icon, CATEGORY_ICON, `${cat._id}:icon`);
        if (optimized && optimized !== cat.icon) update.icon = optimized;
      } catch (err) {
        summary.fail += 1;
        console.error(`  ❌ category ${cat._id} icon: ${err.message}`);
      }
    }
    if (Object.keys(update).length && !DRY_RUN) {
      await Category.updateOne({ _id: cat._id }, { $set: update });
    }
    if (scanned > LIMIT) break;
  }
};

const processBrands = async () => {
  const brands = await Brand.find({}).lean();
  console.log(`🏷️  Brands: ${brands.length}`);
  let scanned = 0;
  for (const brand of brands) {
    if (!brand.logo || !brand.logo.url) continue;
    scanned += 1;
    if (scanned > LIMIT) break;
    try {
      const optimized = await normalizeImage(brand.logo, BRAND_LOGO, `${brand._id}:logo`);
      if (optimized && optimized !== brand.logo && !DRY_RUN) {
        await Brand.updateOne({ _id: brand._id }, { $set: { logo: optimized } });
      }
    } catch (err) {
      summary.fail += 1;
      console.error(`  ❌ brand ${brand._id} logo: ${err.message}`);
    }
  }
};

const main = async () => {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  🖼️  ParsPack In-Place Image Optimizer — Phase 2            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE RUN'}${ONLY ? ` (--only=${ONLY})` : ''}`);

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala';
  await mongoose.connect(mongoUri);
  console.log(`✅ Connected: ${mongoose.connection.host}`);

  if (shouldRun('products')) await processProducts();
  if (shouldRun('banners')) await processBanners();
  if (shouldRun('categories')) await processCategories();
  if (shouldRun('brands')) await processBrands();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  📊 Summary                                                ║');
  console.log(`║  ✅ Optimized/created: ${summary.ok}`);
  console.log(`║  ⏭️  Skipped (already optimal / no card needed): ${summary.skip}`);
  console.log(`║  ❌ Failed: ${summary.fail}`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  if (DRY_RUN) console.log('🔍 DRY RUN — no changes were made.');

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error('❌ Migration failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
