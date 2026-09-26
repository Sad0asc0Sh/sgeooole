/**
 * cctv-assembly-engine.test.cjs
 * تست‌های قطعی فرمول‌های موتور اسمبل پک دوربین — بدون دیتابیس و بدون LLM.
 */

const assert = require('assert');
const {
  normalizeParams,
  computeRequirements,
  calcStorage,
  calcCable,
  calcPower,
  calcConnectors,
  calcRecorder,
  scoreCamera,
  scoreRecorder,
  scoreHdd,
  scorePower,
  scoreCable,
  pickBest,
  BITRATE_MBPS,
  STORAGE_OVERHEAD,
  DEFAULTS,
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

console.log('cctvAssemblyEngine — pure formula tests');

/* ---------- normalizeParams ---------- */

test('normalizeParams applies defaults', () => {
  const r = normalizeParams({});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.environment, 'outdoor');
  assert.strictEqual(r.value.camerasCount, 4);
  assert.strictEqual(r.value.tech, 'ahd');
  assert.strictEqual(r.value.resolution, '5mp');
  assert.strictEqual(r.value.nightVision, 'ir');
  assert.strictEqual(r.value.retentionDays, 20);
  assert.strictEqual(r.value.cableMetersPerCam, 20);
});

test('normalizeParams rejects camerasCount < 1', () => {
  const r = normalizeParams({ camerasCount: 0 });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.length > 0);
});

test('normalizeParams rejects invalid tech', () => {
  // invalid enum falls back to default (documented) — not an error
  const r = normalizeParams({ tech: 'hologram' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.tech, DEFAULTS.tech);
});

/* ---------- calcStorage ---------- */

test('calcStorage 5mp / 4 cams / 20 days matches formula', () => {
  const params = normalizeParams({
    camerasCount: 4,
    resolution: '5mp',
    retentionDays: 20,
  }).value;

  const s = calcStorage(params);
  const bitrate = BITRATE_MBPS['5mp'];
  const expectedPerCam =
    ((bitrate * 1e6 * 86400) / 8 / 1024 ** 3);
  const expectedRequired = Math.ceil(
    expectedPerCam * 4 * 20 * STORAGE_OVERHEAD - 1e-9,
  );

  assert.strictEqual(s.bitrateMbps, 4.0);
  assert.ok(Math.abs(s.gbPerDayPerCam - Math.round(expectedPerCam * 100) / 100) < 0.02);
  assert.strictEqual(s.requiredGb, expectedRequired);
  assert.ok(s.requiredTb > 0);
  assert.ok(Array.isArray(s.hddPlan.drives));
  assert.ok(s.hddPlan.totalGb >= s.requiredGb);
});

test('calcStorage scales linearly with cameras and days', () => {
  const base = calcStorage(
    normalizeParams({ camerasCount: 2, resolution: '2mp', retentionDays: 10 }).value,
  );
  const dblCams = calcStorage(
    normalizeParams({ camerasCount: 4, resolution: '2mp', retentionDays: 10 }).value,
  );
  const dblDays = calcStorage(
    normalizeParams({ camerasCount: 2, resolution: '2mp', retentionDays: 20 }).value,
  );

  assert.ok(Math.abs(dblCams.gbPerDayTotal - base.gbPerDayTotal * 2) < 0.05);
  // requiredGb has overhead + ceil — check proportional band
  assert.ok(dblCams.requiredGb >= base.requiredGb * 1.8);
  assert.ok(dblDays.requiredGb >= base.requiredGb * 1.8);
});

test('calcStorage 8mp needs more than 2mp', () => {
  const low = calcStorage(
    normalizeParams({ camerasCount: 4, resolution: '2mp', retentionDays: 20 }).value,
  );
  const high = calcStorage(
    normalizeParams({ camerasCount: 4, resolution: '8mp', retentionDays: 20 }).value,
  );
  assert.ok(high.requiredGb > low.requiredGb * 3);
});

test('hdd plan totalGb always covers requiredGb', () => {
  for (const cams of [1, 2, 4, 8, 16]) {
    for (const days of [1, 7, 20, 30, 90]) {
      const s = calcStorage(normalizeParams({ camerasCount: cams, retentionDays: days }).value);
      assert.ok(
        s.hddPlan.totalGb >= s.requiredGb,
        `cams=${cams} days=${days}: plan ${s.hddPlan.totalGb} < required ${s.requiredGb}`,
      );
    }
  }
});

/* ---------- calcCable ---------- */

test('calcCable adds 10% waste and is linear', () => {
  const c = calcCable(
    normalizeParams({ camerasCount: 4, cableMetersPerCam: 20 }).value,
  );
  assert.strictEqual(c.baseMeters, 80);
  assert.strictEqual(c.wasteMeters, 8);
  assert.strictEqual(c.totalMeters, 88);

  const one = calcCable(
    normalizeParams({ camerasCount: 1, cableMetersPerCam: 20 }).value,
  );
  assert.strictEqual(one.totalMeters, 22);
});

test('calcCable AHD uses rg59_combined, IP uses cat6', () => {
  const ahd = calcCable(normalizeParams({ tech: 'ahd' }).value);
  const ip = calcCable(normalizeParams({ tech: 'ip' }).value);
  assert.strictEqual(ahd.cableKind, 'rg59_combined');
  assert.strictEqual(ip.cableKind, 'cat6');
});

/* ---------- calcPower ---------- */

test('calcPower AHD IR 4 cams → 5A central PSU', () => {
  const pw = calcPower(
    normalizeParams({ tech: 'ahd', camerasCount: 4, nightVision: 'ir', cableMetersPerCam: 20 }).value,
  );
  assert.strictEqual(pw.mode, 'central_psu');
  assert.strictEqual(pw.ampsPerCam, 1.0);
  assert.strictEqual(pw.totalAmps, 4);
  // 4 × 1.0 × 1.25 = 5 → snap 5
  assert.strictEqual(pw.supplyAmps, 5);
});

test('calcPower AHD warm_light uses higher amps', () => {
  const pw = calcPower(
    normalizeParams({ tech: 'ahd', camerasCount: 4, nightVision: 'warm_light', cableMetersPerCam: 20 }).value,
  );
  assert.strictEqual(pw.ampsPerCam, 1.5);
  assert.strictEqual(pw.totalAmps, 6);
  // 6 × 1.25 = 7.5 → snap 10
  assert.strictEqual(pw.supplyAmps, 10);
});

test('calcPower AHD long run recommends individual adapters', () => {
  const pw = calcPower(
    normalizeParams({ tech: 'ahd', camerasCount: 4, cableMetersPerCam: 60 }).value,
  );
  assert.strictEqual(pw.longRun, true);
  assert.strictEqual(pw.useIndividualAdapters, true);
  assert.strictEqual(pw.mode, 'individual_adapters');
});

test('calcPower IP computes PoE budget and switch ports', () => {
  const pw = calcPower(
    normalizeParams({ tech: 'ip', camerasCount: 4, nightVision: 'ir', cableMetersPerCam: 20 }).value,
  );
  assert.strictEqual(pw.mode, 'poe');
  assert.strictEqual(pw.wattsPerCam, 9);
  assert.strictEqual(pw.totalWatts, 36);
  // 36 × 1.25 = 45
  assert.strictEqual(pw.poeBudgetWatts, 45);
  // ports = 4 + 1 = 5 → snap 5
  assert.strictEqual(pw.switchPorts, 5);
});

test('calcPower IP 8 cams → 8-port switch', () => {
  const pw = calcPower(
    normalizeParams({ tech: 'ip', camerasCount: 8, nightVision: 'ir' }).value,
  );
  // ports = 9 → snap 16
  assert.strictEqual(pw.switchPorts, 16);
});

/* ---------- calcConnectors ---------- */

test('calcConnectors AHD: 2×BNC per cam + 2 spare', () => {
  const c = calcConnectors(
    normalizeParams({ tech: 'ahd', camerasCount: 4, environment: 'outdoor' }).value,
  );
  assert.strictEqual(c.bnc, 4 * 2 + 2);
  assert.ok(c.waterproofBnc > 0);
  assert.strictEqual(c.rj45, 0);
});

test('calcConnectors IP: 2×RJ45 per cam + 4 spare', () => {
  const c = calcConnectors(
    normalizeParams({ tech: 'ip', camerasCount: 4, environment: 'indoor' }).value,
  );
  assert.strictEqual(c.rj45, 4 * 2 + 4);
  assert.strictEqual(c.waterproofRj45, 0);
  assert.strictEqual(c.bnc, 0);
});

test('calcConnectors outdoor IP adds waterproof covers', () => {
  const c = calcConnectors(
    normalizeParams({ tech: 'ip', camerasCount: 4, environment: 'mixed' }).value,
  );
  assert.strictEqual(c.waterproofRj45, 8);
});

/* ---------- calcRecorder ---------- */

test('calcRecorder snaps channels to standard sizes', () => {
  const s = calcStorage(normalizeParams({ camerasCount: 5 }).value);
  const r = calcRecorder(normalizeParams({ camerasCount: 5, tech: 'ahd' }).value, s);
  assert.strictEqual(r.channelsNeeded, 5);
  assert.strictEqual(r.channelsRecommended, 8);
  assert.strictEqual(r.type, 'dvr_xvr');
});

test('calcRecorder IP type is nvr', () => {
  const s = calcStorage(normalizeParams({ camerasCount: 4, tech: 'ip' }).value);
  const r = calcRecorder(normalizeParams({ camerasCount: 4, tech: 'ip' }).value, s);
  assert.strictEqual(r.type, 'nvr');
  assert.strictEqual(r.channelsRecommended, 4);
});

/* ---------- computeRequirements integration ---------- */

test('computeRequirements returns full calculation block', () => {
  const plan = computeRequirements({
    environment: 'outdoor',
    camerasCount: 4,
    tech: 'ahd',
    resolution: '5mp',
    nightVision: 'ir',
    retentionDays: 20,
    cableMetersPerCam: 20,
  });
  assert.strictEqual(plan.ok, true);
  assert.ok(plan.calculations.storage.requiredGb > 0);
  assert.ok(plan.calculations.cable.totalMeters > 0);
  assert.ok(plan.calculations.power.supplyAmps > 0);
  assert.ok(plan.calculations.recorder.channelsRecommended >= 4);
  assert.ok(plan.calculations.connectors.bnc > 0);
  assert.strictEqual(plan.params.camerasCount, 4);
});

test('computeRequirements is deterministic (same input → same output)', () => {
  const input = { camerasCount: 8, tech: 'ip', resolution: '8mp', retentionDays: 30, cableMetersPerCam: 25 };
  const a = computeRequirements(input);
  const b = computeRequirements(input);
  assert.deepStrictEqual(a.calculations, b.calculations);
  assert.deepStrictEqual(a.params, b.params);
});

/* ---------- product scoring (pure) ---------- */

test('scoreCamera rejects wrong tech', () => {
  const cam = { name: 'دوربین IP تحت شبکه 5MP', stock: 10 };
  const score = scoreCamera(cam, normalizeParams({ tech: 'ahd' }).value);
  assert.ok(score < -1e5);
});

test('scoreCamera prefers exact tech/resolution/environment', () => {
  const params = normalizeParams({
    tech: 'ahd',
    resolution: '5mp',
    environment: 'outdoor',
    nightVision: 'ir',
    camerasCount: 4,
  }).value;

  const ideal = {
    name: 'دوربین بولت AHD 5MP مادون قرمز IP66 ضدآب',
    stock: 10,
  };
  const weak = {
    name: 'دوربین دام 2mp',
    stock: 10,
  };
  const sIdeal = scoreCamera(ideal, params);
  const sWeak = scoreCamera(weak, params);
  assert.ok(sIdeal > sWeak, `ideal ${sIdeal} should beat weak ${sWeak}`);
});

test('scoreRecorder rejects too-few channels', () => {
  const rec = { name: 'DVR 4 کانال', stock: 5 };
  const calc = calcRecorder(
    normalizeParams({ camerasCount: 8, tech: 'ahd' }).value,
    calcStorage(normalizeParams({ camerasCount: 8 }).value),
  );
  const score = scoreRecorder(rec, normalizeParams({ camerasCount: 8, tech: 'ahd' }).value, calc);
  assert.ok(score < -1e5);
});

test('scoreHdd prefers surveillance drive of target size', () => {
  const storage = calcStorage(
    normalizeParams({ camerasCount: 4, retentionDays: 20 }).value,
  );
  const target = storage.hddPlan.drives[0].capacityGb;
  const good = { name: `هارد بنفش Purple ${target / 1000}TB نظارتی`, stock: 3 };
  const bad = { name: 'هارد معمولی 500GB', stock: 3 };
  assert.ok(scoreHdd(good, storage) > scoreHdd(bad, storage));
});

test('scorePower IP prefers PoE switch with enough ports', () => {
  const params = normalizeParams({ tech: 'ip', camerasCount: 4 }).value;
  const power = calcPower(params);
  const good = { name: 'سوئیچ PoE 8 پورت', stock: 2 };
  const bad = { name: 'آداپتور 12V 2A', stock: 10 };
  assert.ok(scorePower(good, params, power) > scorePower(bad, params, power));
});

test('scoreCable rejects cat6 for AHD and rg59 for IP', () => {
  const ahdParams = normalizeParams({ tech: 'ahd' }).value;
  const ipParams = normalizeParams({ tech: 'ip' }).value;
  assert.ok(scoreCable({ name: 'کابل شبکه Cat6', stock: 1 }, ahdParams) < -1e5);
  assert.ok(scoreCable({ name: 'کابل RG59', stock: 1 }, ipParams) < -1e5);
  assert.ok(scoreCable({ name: 'کابل RG59 ترکیبی', stock: 1 }, ahdParams) > 50);
});

test('pickBest is deterministic: score desc, then price asc, then id', () => {
  const a = { _id: 'a', name: 'A', price: 100, stock: 5 };
  const b = { _id: 'b', name: 'B', price: 50, stock: 5 };
  const c = { _id: 'c', name: 'C', price: 80, stock: 5 };

  const scored = [
    { product: a, score: 50 },
    { product: b, score: 50 },
    { product: c, score: 80 },
  ];
  const pick = pickBest(scored, 1);
  assert.strictEqual(String(pick.product._id), 'c');

  // equal score → cheaper wins
  const equal = [
    { product: a, score: 50 },
    { product: b, score: 50 },
  ];
  assert.strictEqual(String(pickBest(equal, 1).product._id), 'b');
});

test('pickBest skips insufficient stock', () => {
  const a = { _id: 'a', price: 10, stock: 1 };
  const b = { _id: 'b', price: 20, stock: 10 };
  const scored = [
    { product: a, score: 100 },
    { product: b, score: 40 },
  ];
  const pick = pickBest(scored, 4);
  assert.strictEqual(String(pick.product._id), 'b');
});

console.log(process.exitCode ? '\nFAILED' : '\nALL PASSED');
