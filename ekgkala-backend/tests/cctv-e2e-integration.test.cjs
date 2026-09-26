/**
 * cctv-e2e-integration.test.cjs
 * تست یکپارچگی نهایی فاز ۱–۳ — سناریوهای واقعی کاربر، بدون دیتابیس و بدون LLM.
 *
 * پوشش:
 *  ۱) ورودی چندگانه در یک پیام → کارت پکیج بلافاصله (بدون سوال اضافه)
 *  ۲) انصراف / شروع مجدد در میانه مسیر
 *  ۳) عدم تداخل با سوالات تک‌محصول (General RAG)
 *  ۴) سازگاری نقشه خروجی با ChatPackageCard / addBundleToCart
 */

const assert = require('assert');
const {
  detectCctvIntent,
  createFlow,
  applyMessage,
  toAssemblyParams,
  toFlowView,
  buildPrompt,
  getNextStepKey,
  isCancelCommand,
  isRestartCommand,
  CCTV_STEPS,
  STEP_ORDER,
} = require('../services/cctvChatFlow');
const {
  computeRequirements,
  assembleCCTVPackage,
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

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('cctv E2E integration tests');

/* ==========================================================================
 * ۱) سناریوی ورودی چندگانه
 * ========================================================================== */

const MULTI_MSG =
  'پکیج ۸ تا دوربین دید در شب رنگی واسه سوله میخوام با ۳۰ روز ضبط و فاصله هر دوربین ۳۰ متر';

test('SCENARIO 1: multi-slot message is a package request', () => {
  assert.strictEqual(detectCctvIntent(MULTI_MSG), true);
});

test('SCENARIO 1: one message fills ALL slots — zero extra questions', () => {
  const flow = createFlow();
  const result = applyMessage(flow, MULTI_MSG);

  assert.strictEqual(result.completed, true, `not completed, next=${result.nextStep}`);
  assert.strictEqual(result.nextStep, null, `should have no next step, got ${result.nextStep}`);
  assert.strictEqual(result.needReask, false);

  const slots = result.flow.slots;
  assert.strictEqual(slots.environment, 'outdoor', `env=${slots.environment} (سوله → outdoor)`);
  assert.strictEqual(slots.camerasCount, 8);
  assert.strictEqual(slots.nightVision, 'warm_light');
  assert.strictEqual(slots.retentionDays, 30);
  assert.strictEqual(slots.cableMetersPerCam, 30);
});

test('SCENARIO 1: engineering calcs match expected numbers', () => {
  const flow = createFlow();
  const result = applyMessage(flow, MULTI_MSG);
  const params = toAssemblyParams(result.flow);
  const plan = computeRequirements(params);

  assert.strictEqual(plan.ok, true);
  const c = plan.calculations;

  // دستگاه ۸ کانال
  assert.strictEqual(c.recorder.channelsNeeded, 8);
  assert.strictEqual(c.recorder.channelsRecommended, 8);

  // کابل: 8 × 30 × 1.1 = 264
  assert.strictEqual(c.cable.baseMeters, 240);
  assert.strictEqual(c.cable.wasteMeters, 24);
  assert.strictEqual(c.cable.totalMeters, 264, `cable=${c.cable.totalMeters}`);

  // هارد متناسب ۸ دوربین 5MP سی‌روزه
  assert.ok(c.storage.requiredGb > 8000, `storage too small: ${c.storage.requiredGb}`);
  assert.ok(c.storage.hddPlan.totalGb >= c.storage.requiredGb);
  assert.ok(c.storage.hddPlan.drives.length >= 1);

  // پاور مرکزی (warm_light → 1.5A × 8 × 1.25 = 15A)
  assert.strictEqual(c.power.mode, 'central_psu');
  assert.strictEqual(c.power.supplyAmps, 15);
  assert.ok(String(c.power.recommendedSupply).includes('15'));

  // اتصالات AHD
  assert.strictEqual(c.connectors.bnc, 8 * 2 + 2);
});

test('SCENARIO 1: no prompt is issued when complete', () => {
  const flow = createFlow();
  const result = applyMessage(flow, MULTI_MSG);
  const prompt = buildPrompt(result.flow);
  assert.strictEqual(prompt.done, true);
});

test('SCENARIO 1: flow view reports complete with all answered', () => {
  const flow = createFlow();
  const result = applyMessage(flow, MULTI_MSG);
  const view = toFlowView(result.flow);
  assert.strictEqual(view.complete, true);
  assert.strictEqual(view.answered.length, STEP_ORDER.length);
  assert.strictEqual(view.quickReplies.length, 0);
});

test('SCENARIO 1: assembly params are stable for the same message', () => {
  const a = toAssemblyParams(applyMessage(createFlow(), MULTI_MSG).flow);
  const b = toAssemblyParams(applyMessage(createFlow(), MULTI_MSG).flow);
  assert.deepStrictEqual(a, b);
});

/* ==========================================================================
 * ۲) انصراف / شروع مجدد
 * ========================================================================== */

test('SCENARIO 2: لغو mid-flow cancels and deactivates', () => {
  let flow = createFlow();
  flow = applyMessage(flow, 'پک دوربین برای حیاط').flow;
  assert.strictEqual(getNextStepKey(flow), 'camerasCount');

  const r = applyMessage(flow, 'لغو');
  assert.strictEqual(r.cancelled, true);
  assert.strictEqual(r.flow.cancelled, true);
  assert.strictEqual(r.flow.active, false);
});

test('SCENARIO 2: انصراف mid-flow cancels', () => {
  let flow = createFlow();
  flow = applyMessage(flow, 'بیرون ۴ دوربین').flow;
  const r = applyMessage(flow, 'انصراف میدم');
  assert.strictEqual(isCancelCommand('انصراف میدم'), true);
  assert.strictEqual(r.cancelled, true);
});

test('SCENARIO 2: شروع مجدد resets slots and restarts from step 1', () => {
  let flow = createFlow();
  flow = applyMessage(flow, 'بیرون ۴ دوربین وارم لایت').flow;
  assert.ok(flow.slots.environment);
  assert.ok(flow.slots.camerasCount);

  for (const word of ['شروع مجدد', 'از اول', 'دوباره شروع کن']) {
    assert.strictEqual(isRestartCommand(word), true, `restart word not detected: ${word}`);
    const r = applyMessage(flow, word);
    assert.strictEqual(r.restarted, true, `restart failed for: ${word}`);
    assert.strictEqual(getNextStepKey(r.flow), 'environment');
    assert.strictEqual(r.flow.slots.environment, undefined);
    assert.strictEqual(r.flow.slots.camerasCount, undefined);
    assert.strictEqual(r.flow.active, true);
  }
});

test('SCENARIO 2: after restart, a new multi-slot message can complete again', () => {
  let flow = createFlow();
  flow = applyMessage(flow, 'بیرون ۲ دوربین').flow;
  flow = applyMessage(flow, 'از اول').flow;
  const r = applyMessage(flow, 'پکیج ۴ دوربین برای داخل مغازه دید رنگی ۱۵ روز ۲۰ متر');
  assert.strictEqual(r.completed, true);
  assert.strictEqual(r.flow.slots.camerasCount, 4);
  assert.strictEqual(r.flow.slots.environment, 'indoor');
  assert.strictEqual(r.flow.slots.cableMetersPerCam, 20);
});

test('SCENARIO 2: cancel words and restart words are distinct', () => {
  assert.strictEqual(isCancelCommand('شروع مجدد'), false);
  assert.strictEqual(isRestartCommand('لغو'), false);
});

/* ==========================================================================
 * ۳) عدم تداخل با سوالات تک‌محصول (General RAG)
 * ========================================================================== */

const RAG_QUERIES = [
  'قیمت هارد ۲ ترابایت بنفش چنده؟',
  'دوربین بولت چی موجود دارید؟',
  'قیمت دوربین ۵ مگاپیکسل چنده',
  'هارد بنفش ۴ ترابایت موجوده؟',
  'دوربین مداربسته دارید؟',
  'DVR 8 کانال چنده؟',
  'قیمت کابل RG59 چقدره',
  'دوربین ۲ مگاپیکسل چی دارید؟',
];

const PACKAGE_QUERIES = [
  'پک دوربین میخوام',
  'پکیج دوربین مداربسته برای مغازه',
  'سیستم کامل دوربین مداربسته',
  'کیت دوربین میخوام',
  MULTI_MSG,
];

test('SCENARIO 3: product Q&A never enters CCTV package tree', () => {
  for (const q of RAG_QUERIES) {
    assert.strictEqual(
      detectCctvIntent(q),
      false,
      `RAG query wrongly entered package flow: ${q}`,
    );
  }
});

test('SCENARIO 3: package requests still enter the flow', () => {
  for (const q of PACKAGE_QUERIES) {
    assert.strictEqual(
      detectCctvIntent(q),
      true,
      `package request not detected: ${q}`,
    );
  }
});

test('SCENARIO 3: active flow absorbs follow-ups, but idle chat does not', () => {
  assert.strictEqual(detectCctvIntent('بیرون', true), true);
  assert.strictEqual(detectCctvIntent('قیمت هارد چنده', false), false);
});

/* ==========================================================================
 * ۴) سازگاری payload با فرانت (ChatPackageCard / addBundleToCart)
 * ========================================================================== */

test('SCENARIO 4: engine items map to cart bundle lines', () => {
  // بدون DB نمی‌توان assembleCCTVPackage زد؛ ولی plan → params → calculations
  // همان داده‌ای است که ChatPackageCard از requirements/calculations می‌خواند
  const flow = createFlow();
  const result = applyMessage(flow, MULTI_MSG);
  const params = toAssemblyParams(result.flow);
  const plan = computeRequirements(params);

  // فیلدهایی که buildBadges در ChatPackageCard می‌خواند
  assert.ok(plan.params.camerasCount > 0);
  assert.ok(plan.calculations.storage.hddPlan.drives[0].capacityGb > 0);
  assert.ok(plan.calculations.cable.totalMeters > 0);
  assert.ok(plan.calculations.power.supplyAmps > 0);
  assert.ok(plan.calculations.recorder.channelsRecommended > 0);

  // qty هایی که addBundleToCart باید بگیرد
  const expectedQtys = {
    camera: plan.params.camerasCount,
    recorder: 1,
    hdd: plan.calculations.storage.hddPlan.drives[0].qty,
    cable: plan.calculations.cable.totalMeters, // متری
    bnc: plan.calculations.connectors.bnc,
  };
  assert.strictEqual(expectedQtys.camera, 8);
  assert.strictEqual(expectedQtys.recorder, 1);
  assert.ok(expectedQtys.hdd >= 1);
  assert.strictEqual(expectedQtys.cable, 264);
  assert.strictEqual(expectedQtys.bnc, 18);
});

test('SCENARIO 4: quickReplies always come from the fixed tree (not free text)', () => {
  const prompt = buildPrompt({ slots: {}, active: true, complete: false });
  assert.deepStrictEqual(
    prompt.quickReplies.map((q) => q.value),
    CCTV_STEPS.environment.quickReplies.map((q) => q.value),
  );
});

/* ==========================================================================
 * ۵) خود موتور اسمبل — یکپارچگی ورودی چندگانه
 * ========================================================================== */

test('SCENARIO 5: computeRequirements is deterministic for the E2E message', () => {
  const params = toAssemblyParams(applyMessage(createFlow(), MULTI_MSG).flow);
  const a = computeRequirements(params);
  const b = computeRequirements(params);
  assert.deepStrictEqual(a.calculations, b.calculations);
  assert.deepStrictEqual(a.params, b.params);
});

(async () => {
  await testAsync('SCENARIO 5: assembleCCTVPackage rejects invalid input without DB/LLM', async () => {
    const bad = await assembleCCTVPackage({ camerasCount: 0 });
    assert.strictEqual(bad.ok, false);
    assert.ok(Array.isArray(bad.errors));
    assert.ok(bad.errors.length > 0);
    assert.strictEqual(bad.items.length, 0);
    assert.strictEqual(bad.totalPrice, 0);
  });

  await testAsync('SCENARIO 5: assembleCCTVPackage rejects invalid camerasCount', async () => {
    const bad = await assembleCCTVPackage({ camerasCount: -1 });
    assert.strictEqual(bad.ok, false);
    assert.ok(bad.errors.some((e) => /camerasCount/.test(e)));
  });

  console.log(process.exitCode ? '\nFAILED' : '\nALL PASSED');
})();
