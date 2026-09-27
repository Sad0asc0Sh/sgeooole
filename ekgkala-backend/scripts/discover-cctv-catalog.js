/**
 * discover-cctv-catalog.js
 * بازرسی موقت کاتالوگ واقعی Product/Category برای دیباگ موتور اسمبل CCTV.
 *
 * اجرا:  node scripts/discover-cctv-catalog.js
 * (نیازمند MONGODB_URI در .env)
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Category = require('../models/Category');
const Product = require('../models/Product');

const ROLE_QUERIES = {
  camera: /دوربین|camera|cctv|دام|بولت|dome|bullet/i,
  recorder: /dvr|nvr|xvr|ضبط|رکوردر|recorder/i,
  hdd: /هارد|ذخیره|hdd|disk|purple|skyhawk/i,
  cable: /کابل|cable|rg59|cat6|پچ/i,
  power: /آداپتور|تغذیه|پاور|adapter|منبع/i,
  connector: /فیش|اتصالات|سوکت|کانکتور|bnc|rj45/i,
};

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ekgkala';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log('Connected:', mongoose.connection.name);

  const cats = await Category.find({}).select('_id name slug parent isActive').lean();
  console.log('\n=== CATEGORIES (' + cats.length + ') ===');
  for (const c of cats) {
    console.log(JSON.stringify({
      id: String(c._id),
      name: c.name,
      slug: c.slug,
      parent: c.parent ? String(c.parent) : null,
      isActive: c.isActive !== false,
    }));
  }

  const total = await Product.countDocuments({});
  const active = await Product.countDocuments({ isActive: true });
  console.log('\n=== PRODUCTS total=' + total + ' active=' + active + ' ===');

  // فیلد موجودی
  const stockSample = await Product.find({}).select('stock countInStock variants productType').limit(5).lean();
  console.log('stock field samples:', stockSample.map((p) => ({
    stock: p.stock,
    countInStock: p.countInStock,
    variants: Array.isArray(p.variants) ? p.variants.length : 0,
    productType: p.productType,
  })));

  for (const [role, re] of Object.entries(ROLE_QUERIES)) {
    const catHits = cats.filter((c) => re.test(c.name || '') || re.test(c.slug || ''));
    console.log('\n--- role=' + role + ' categories (' + catHits.length + ') ---');
    for (const c of catHits) {
      const inStock = await Product.countDocuments({
        category: c._id,
        isActive: true,
        $or: [{ stock: { $gt: 0 } }, { 'variants.stock': { $gt: 0 } }],
      });
      const any = await Product.countDocuments({ category: c._id, isActive: true });
      console.log(`  cat "${c.name}" active=${any} inStock=${inStock}`);
    }

    const byName = await Product.find({
      isActive: true,
      $or: [{ name: re }, { description: re }],
    }).select('name category stock').limit(8).lean();
    console.log('  name/desc hits (sample):');
    for (const p of byName) {
      const cat = cats.find((c) => String(c._id) === String(p.category));
      console.log(`    • ${p.name} | stock=${p.stock} | cat=${cat ? cat.name : p.category}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('DISCOVERY FAILED:', e.message);
  process.exit(1);
});
