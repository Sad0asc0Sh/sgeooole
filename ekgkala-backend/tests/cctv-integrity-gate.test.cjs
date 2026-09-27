/**
 * cctv-integrity-gate.test.cjs
 * تست‌های بحرانی: گیت یکپارچگی، حذف فیش از کابل، Fallback رزولوشن/هارد.
 * بدون دیتابیس — فقط توابع خالص موتور.
 */

const assert = require('assert');
const {
  analyzeCableProduct,
  analyzeCameraProduct,
  analyzeHddProduct,
  scoreCable,
  scoreCamera,
  scoreHdd,
  computeRequirements,
  normalizeParams,
  ROLE_CATEGORY_PATTERNS,
} = require('../services/cctvAssemblyEngine');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('cctv integrity / exclusion tests');

/* ---------- فیش/سوزنی هرگز کابل نیست ---------- */

test('فیش سوزنی کابل ترکیبی → isConnectorLike, NOT cable', () => {
  const a = analyzeCableProduct({ name: 'فیش سوزنی کابل ترکیبی RG59' });
  assert.strictEqual(a.isConnectorLike, true);
  assert.strictEqual(a.isTrueCable, false);
});

test('BNC connector title is excluded from cable score', () => {
  const score = scoreCable({ name: 'فیش BNC کابل ترکیبی', stock: 500 }, normalizeParams({ tech: 'ahd' }).value);
  assert.ok(score < -1e5, `BNC must be hard-rejected, got ${score}`);
});

test('کانکتور/سوکت/ترمینال excluded from cable', () => {
  for (const name of [
    'کانکتور شبکه',
    'سوکت RJ45',
    'سری نری کابل',
    'ترمینال کابل ترکیبی',
  ]) {
    const a = analyzeCableProduct({ name });
    assert.strictEqual(a.isConnectorLike, true, `should exclude: ${name}`);
  }
});

test('کابل RG59 واقعی پذیرفته می‌شود', () => {
  const a = analyzeCableProduct({ name: 'کابل ترکیبی RG59 متری', stock: 100 });
  assert.strictEqual(a.isConnectorLike, false);
  assert.strictEqual(a.isTrueCable, true);
  assert.strictEqual(a.kind, 'rg59');
  const score = scoreCable({ name: 'کابل ترکیبی RG59 متری', stock: 100 }, normalizeParams({ tech: 'ahd' }).value);
  assert.ok(score > 50, `true cable should score high, got ${score}`);
});

test('کابل Cat6 واقعی برای IP', () => {
  const a = analyzeCableProduct({ name: 'کابل شبکه Cat6 مس', stock: 50 });
  assert.strictEqual(a.isTrueCable, true);
  assert.strictEqual(a.kind, 'cat6');
});

test('ROLE_CATEGORY_PATTERNS: cable does NOT include فیش', () => {
  const pats = ROLE_CATEGORY_PATTERNS.cable.join(' ');
  assert.ok(!pats.includes('فیش'), 'cable patterns must not contain فیش');
  assert.ok(pats.includes('کابل'));
  // connector must have فیش
  assert.ok(ROLE_CATEGORY_PATTERNS.connector.join(' ').includes('فیش'));
});

/* ---------- Fallback رزولوشن دوربین ---------- */

test('دوربین 2mp برای درخواست 5mp حذف قطعی نمی‌شود (fallback)', () => {
  const params = normalizeParams({ resolution: '5mp', tech: 'ahd', environment: 'outdoor', camerasCount: 4, nightVision: 'ir' }).value;
  const lower = scoreCamera({ name: 'دوربین بولت AHD 2MP مادون قرمز', stock: 10 }, params);
  const exact = scoreCamera({ name: 'دوربین بولت AHD 5MP مادون قرمز', stock: 10 }, params);
  assert.ok(lower > -1e5, `2mp should remain viable for fallback, got ${lower}`);
  assert.ok(exact > lower, `exact 5mp must outrank 2mp (${exact} vs ${lower})`);
});

test('بولت/فلزی برای outdoor اولویت دارد', () => {
  const params = normalizeParams({ environment: 'outdoor', tech: 'ahd', resolution: '5mp', camerasCount: 4, nightVision: 'ir' }).value;
  const bullet = scoreCamera({ name: 'دوربین بولت فلزی AHD 5MP ضدآب', stock: 10 }, params);
  const dome = scoreCamera({ name: 'دوربین دام سقفی AHD 5MP', stock: 10 }, params);
  assert.ok(bullet > dome, `bullet should beat dome for outdoor (${bullet} vs ${dome})`);
});

/* ---------- Fallback هارد ---------- */

test('هارد بزرگ‌تر از هدف بر کوچک‌تر اولویت دارد', () => {
  const plan = computeRequirements(
    normalizeParams({ camerasCount: 4, resolution: '5mp', retentionDays: 20 }).value,
  );
  const storage = plan.calculations.storage;
  const target = storage.hddPlan.drives[0].capacityGb;

  const bigger = scoreHdd({ name: `هارد بنفش ${Math.round((target + 1000) / 1000)}TB نظارتی`, stock: 2 }, storage);
  const smaller = scoreHdd({ name: `هارد بنفش ${Math.max(1, Math.round((target - 1000) / 1000))}TB نظارتی`, stock: 2 }, storage);
  assert.ok(bigger > smaller, `larger HDD should win fallback (${bigger} vs ${smaller})`);
});

test('هارد نظارتی بر هارد معمولی اولویت دارد', () => {
  const storage = computeRequirements(normalizeParams({}).value).calculations.storage;
  const surv = scoreHdd({ name: 'هارد بنفش Purple نظارتی 4TB', stock: 2 }, storage);
  const generic = scoreHdd({ name: 'هارد معمولی 4TB', stock: 2 }, storage);
  assert.ok(surv > generic);
});

/* ---------- تحلیل دوربین ---------- */

test('analyzeCameraProduct detects bullet/outdoor', () => {
  const a = analyzeCameraProduct({ name: 'دوربین بولت فلزی ضدآب IP66' });
  assert.strictEqual(a.form, 'bullet');
  assert.strictEqual(a.isOutdoor, true);
});

test('analyzeHddProduct reads TB capacity', () => {
  const a = analyzeHddProduct({ name: 'هارد بنفش 4 ترابایت' });
  assert.strictEqual(a.capacityGb, 4000);
  assert.strictEqual(a.isSurveillance, true);
});

console.log(process.exitCode ? '\nFAILED' : '\nALL PASSED');
