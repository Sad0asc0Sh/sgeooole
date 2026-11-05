/**
 * optimize-existing-s3-images.js
 * ساخت نسخه‌ی فوق‌سبک کارت (`<uuid>-card.webp`, حداکثر 420×420، کیفیت 78)
 * برای تصاویر موجود محصولات قدیمی در پارس‌پک و ثبت `cardUrl` در MongoDB.
 *
 * برای هر تصویر WebP قدیمی که هنوز `cardUrl` ندارد:
 *   1. تصویر اصلی از روی URL عمومی خوانده می‌شود (HEAD/GET روی پارس‌پک).
 *   2. با همان `convertToWebp` مسیر آپلود (sharp یا ImageMagick) به
 *      اندازه‌ی کارت تبدیل می‌شود.
 *   3. با `putObject` روی کلید `<uuid>-card.webp` آپلود و `cardUrl` در
 *      داکیومنت محصول ذخیره می‌شود (idempotent — اجراهای بعدی رد می‌کنند).
 *
 * Usage:
 *   node scripts/optimize-existing-s3-images.js            # live
 *   node scripts/optimize-existing-s3-images.js --dry-run  # preview only
 *   node scripts/optimize-existing-s3-images.js --verbose
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Product = require('../models/Product');
const { putObject, convertToWebp, cardKeyFor, getPublicUrl } = require('../lib/parspackS3');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  const n = i >= 0 ? Number(process.argv[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : Infinity;
})();

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

const main = async () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  🖼️  S3 Card-variant Backfill                  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE RUN'}`);

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala';
  await mongoose.connect(mongoUri);
  console.log(`✅ Connected: ${mongoose.connection.host}`);

  const products = await Product.find({}).lean();
  console.log(`📊 Total products: ${products.length}`);

  let scanned = 0, created = 0, skipped = 0, failed = 0;

  for (const product of products) {
    const images = Array.isArray(product.images) ? product.images : [];
    if (images.length === 0) continue;

    let changed = false;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img || typeof img !== 'object' || typeof img.url !== 'string') continue;
      if (typeof img.cardUrl === 'string' && img.cardUrl.trim()) continue; // already done

      scanned++;
      if (scanned > LIMIT) { console.log('⏹  --limit reached'); break; }

      const key = keyFromUrl(img.url);
      const cardKey = key ? cardKeyFor(key) : null;
      if (!key || !cardKey) { skipped++; continue; }

      try {
        if (VERBOSE || DRY_RUN) console.log(`  [${product._id}] ${String(product.name).slice(0, 40)} → ${cardKey}`);
        if (DRY_RUN) { created++; continue; }

        const { data } = await axios.get(img.url, { responseType: 'arraybuffer', maxContentLength: 50 * 1024 * 1024 });
        const cardBuf = await convertToWebp(Buffer.from(data), { maxWidth: 420, maxHeight: 420, quality: 78 });
        if (!cardBuf) { failed++; console.warn(`  ⚠️  conversion failed for ${key}`); continue; }

        const res = await putObject(cardBuf, cardKey, 'image/webp');
        images[i] = { ...img, cardUrl: res.url };
        changed = true;
        created++;
      } catch (err) {
        failed++;
        console.error(`  ❌ ${key}: ${err.message}`);
      }
    }

    if (changed) {
      await Product.updateOne({ _id: product._id }, { $set: { images } });
    }
    if (scanned > LIMIT) break;
  }

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  📊 Summary                                     ║');
  console.log(`║  ✅ Card variants created: ${created}`);
  console.log(`║  ⏭️  Skipped (already had cardUrl): ${skipped}`);
  console.log(`║  ❌ Failed: ${failed}`);
  console.log('╚══════════════════════════════════════════════╝');
  if (DRY_RUN) console.log('🔍 DRY RUN — no changes were made.');

  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error('❌ Migration failed:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
