const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/torob_acceptance_test';
if (!MONGODB_URI.includes('127.0.0.1') && !MONGODB_URI.includes('localhost') && !MONGODB_URI.includes('mongodb:27017')) {
  console.error("FATAL: MONGODB_URI does not point to local service container! Refusing to run acceptance test.");
  process.exit(1);
}

const PORT = 54321;
const BASE_URL = `http://127.0.0.1:${PORT}/api/torob`;
const TEST_AUDIENCE = '127.0.0.1';

async function fetchJSON(url, options = {}) {
  const res = await global.fetch(url, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { data = text; }
  return { status: res.status, data };
}

function signEdDsaJwt(payload, privateKey, header = { alg: 'EdDSA', typ: 'JWT', v: 1 }) {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = crypto.sign(null, signingInput, privateKey).toString('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const { computeItemPricing } = require('../services/pricingService');

async function runTests() {
  let serverProcess;
  try {
    const keys = crypto.generateKeyPairSync('ed25519');
    const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' });
    const otherKeys = crypto.generateKeyPairSync('ed25519');

    await mongoose.connect(MONGODB_URI);
    await mongoose.connection.db.dropDatabase();
    console.log("Connected to ephemeral DB & dropped.");

    const Product = require('../models/Product.js');
    const Category = require('../models/Category.js');

    const cat = await Category.create({ name: 'Synthetic Cat' });

    const p1 = await Product.create({
      name: 'P1-Simple-Normal', productType: 'simple', price: 1000.6, stock: 10,
      images: [{ url: 'http://i.com/1' }], category: cat._id, isActive: true
    });
    const p2 = await Product.create({
      name: 'P2-Simple-Discount', productType: 'simple', price: 1000.6, discount: 15, stock: 10,
      images: [{ url: 'http://i.com/2' }], category: cat._id, isActive: true
    });
    const p3 = await Product.create({
      name: 'P3-Simple-Flash', productType: 'simple', price: 1000.6, isFlashDeal: true, discount: 20,
      flashDealEndTime: new Date(Date.now() + 86400000), stock: 10,
      images: [{ url: 'http://i.com/3' }], category: cat._id, isActive: true
    });
    const p4 = await Product.create({
      name: 'P4-Variable', productType: 'variable', category: cat._id,
      images: [{ url: 'http://i.com/4' }],
      isActive: true,
      variants: [
        { price: 1000, stock: 10, options: [{ name: 'Color', value: 'Red' }] },
        { price: 2000, stock: 0, options: [{ name: 'Color', value: 'Blue' }] }
      ]
    });
    const p5 = await Product.create({
      name: 'P5-Simple-NoImage', productType: 'simple', price: 1000, stock: 10,
      images: [], category: cat._id, isActive: true
    });

    console.log("Seeded 5 products.");

    serverProcess = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        MONGODB_URI,
        FRONTEND_URL: process.env.FRONTEND_URL || 'https://www.ekgkala.ir',
        TOROB_PUBLIC_KEY: publicKey,
      }
    });

    await new Promise((resolve, reject) => {
      serverProcess.stdout.on('data', d => {
        const output = d.toString();
        process.stdout.write(output);
        if(output.includes(`🚀 Server running on port ${PORT}`)) resolve();
      });
      serverProcess.stderr.on('data', d => console.error('SERVER ERR:', d.toString()));
      setTimeout(() => reject(new Error("Timeout waiting for server")), 15000);
    });
    console.log("Server is running.");

    const now = Math.floor(Date.now() / 1000);
    const token = signEdDsaJwt({ aud: TEST_AUDIENCE, exp: now + 3600, nbf: now - 60 }, keys.privateKey);
    const wrongToken = signEdDsaJwt({ aud: TEST_AUDIENCE, exp: now + 3600, nbf: now - 60 }, otherKeys.privateKey);
    const wrongAudienceToken = signEdDsaJwt({ aud: 'other.example.com', exp: now + 3600, nbf: now - 60 }, keys.privateKey);

    const results = [];
    let allPassed = true;

    const runScenario = async (name, payload, tokenToUse, validator) => {
      console.log(`Running: ${name}`);
      const headers = { 'Content-Type': 'application/json', 'X-Torob-Token-Version': '1' };
      if (tokenToUse) headers['X-Torob-Token'] = tokenToUse;
      const res = await fetchJSON(`${BASE_URL}/products`, {
        method: 'POST', headers, body: JSON.stringify(payload)
      });
      let passed = false;
      let error = null;
      try { await validator(res); passed = true; } catch (e) {
        console.error(`FAIL ${name}: ${e.message}`);
        error = e.message;
        allPassed = false;
      }
      results.push({ name, request: payload, response: res, passed, error });
      return res;
    };

    const resPageSort = await runScenario('1. page+sort', { page: 1, sort: 'date_added_desc' }, token, res => {
      if(res.status !== 200) throw new Error('Status not 200');
      if(res.data.total !== 5) throw new Error(`Expected total 5 (no P5), got ${res.data.total}`);
      if(res.data.products.some(p => p.page_unique.includes(p5.productCode))) throw new Error("P5 is present");
    });

    await runScenario('2. page_urls', { page_urls: [`https://www.ekgkala.ir/product/${p1.productCode}/${p1.slug}`] }, token, res => {
      if(res.status !== 200) throw new Error('Status not 200');
      if(res.data.products[0].page_unique !== p1.productCode) throw new Error('Mismatched product code');
    });

    await runScenario('3. page_uniques', { page_uniques: [p1.productCode] }, token, res => {
      if(res.status !== 200) throw new Error('Status not 200');
      if(res.data.products[0].page_unique !== p1.productCode) throw new Error('Mismatched product code');
    });

    await runScenario('4. page_uniques fake', { page_uniques: ['KY-9999999'] }, token, res => {
      if(res.status !== 200) throw new Error('Status not 200');
      if(res.data.products.length !== 0) throw new Error('Expected empty products');
      if(res.data.total !== 0) throw new Error('Expected total 0');
    });

    await runScenario('5. body ناقص', { page: 1 }, token, res => {
      if(res.status !== 400) throw new Error('Expected 400');
      if(res.data.error !== 'sort parameter is not provided') throw new Error('Wrong error message');
    });

    await runScenario('6. no X-Torob-Token', { page: 1, sort: 'date_added_desc' }, null, res => {
      if(res.status !== 401) throw new Error('Expected 401');
    });

    await runScenario('7. wrong key', { page: 1, sort: 'date_added_desc' }, wrongToken, res => {
      if(res.status !== 401) throw new Error('Expected 401');
    });

    await runScenario('8. variable', { page_uniques: [p4.productCode, `${p4.productCode}_${p4.variants[0]._id}`] }, token, res => {
      if(res.status !== 200) throw new Error('Status not 200');
      // فقط شناسه‌ی ثابت productCode پاسخ می‌گیرد؛ شناسه‌ی ترکیبی قدیمی دیگر منتشر نمی‌شود
      if(res.data.products.length !== 1) throw new Error('Expected exactly 1 product');
      if(res.data.products[0].page_unique !== p4.productCode) throw new Error('Variable product must keep the stable productCode');
    });

    await runScenario('9. wrong audience', { page: 1, sort: 'date_added_desc' }, wrongAudienceToken, res => {
      if(res.status !== 401) throw new Error('Expected 401');
    });

    const pricingTable = [];
    const torobProducts = resPageSort?.data?.products || [];
    
    for (const p of [p1, p2, p3]) {
      const cartPrice = computeItemPricing({ product: p }, new Date()).finalPrice;
      const torobP = torobProducts.find(x => x.page_unique === p.productCode);
      const torobPrice = torobP ? torobP.current_price : null;
      pricingTable.push({
        name: p.name,
        cart_finalPrice: cartPrice,
        torob_current_price: torobPrice,
        match: torobPrice === Math.round(cartPrice)
      });
    }
    
    console.table(pricingTable);

    const reportPath = path.join(__dirname, '..', 'torob-acceptance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ results, pricingTable, allPassed }, null, 2));

    if(serverProcess) serverProcess.kill('SIGKILL');
    await mongoose.connection.close();
    process.exit(allPassed ? 0 : 1);

  } catch(e) {
    console.error("FATAL ERROR:", e);
    if(serverProcess) serverProcess.kill('SIGKILL');
    if(mongoose.connection.readyState !== 0) await mongoose.connection.close();
    process.exit(1);
  }
}

runTests();
