/**
 * cctv-chat-flow.test.cjs
 * تست‌های قطعی Slot-Filling و تشخیص نیت — بدون دیتابیس و بدون LLM.
 */

const assert = require('assert');
const {
  CCTV_STEPS,
  STEP_ORDER,
  detectCctvIntent,
  isCancelCommand,
  isRestartCommand,
  extractSlots,
  matchQuickReplyValue,
  isValidSlotValue,
  createFlow,
  applyMessage,
  applyQuickReply,
  getNextStepKey,
  isComplete,
  buildPrompt,
  toFlowView,
  toAssemblyParams,
  summarizeSlots,
} = require('../services/cctvChatFlow');

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

console.log('cctvChatFlow — slot-filling tests');

/* ---------- structure ---------- */

test('CCTV_STEPS has the 5 required slots with quickReplies', () => {
  assert.deepStrictEqual(STEP_ORDER, [
    'environment',
    'camerasCount',
    'nightVision',
    'retentionDays',
    'cableMetersPerCam',
  ]);
  for (const key of STEP_ORDER) {
    assert.ok(CCTV_STEPS[key].question, `missing question for ${key}`);
    assert.ok(Array.isArray(CCTV_STEPS[key].quickReplies), `missing quickReplies for ${key}`);
    assert.ok(CCTV_STEPS[key].quickReplies.length >= 2, `need ≥2 quickReplies for ${key}`);
    for (const qr of CCTV_STEPS[key].quickReplies) {
      assert.ok(qr.label && qr.value !== undefined, `bad quickReply in ${key}`);
    }
  }
});

test('quickReply values are valid slot values', () => {
  for (const key of STEP_ORDER) {
    for (const qr of CCTV_STEPS[key].quickReplies) {
      assert.ok(isValidSlotValue(key, qr.value), `${key}=${qr.value} invalid`);
    }
  }
});

/* ---------- intent ---------- */

test('detectCctvIntent true for pack+cctv phrases', () => {
  assert.strictEqual(detectCctvIntent('پک دوربین میخوام'), true);
  assert.strictEqual(detectCctvIntent('پکیج دوربین مداربسته برای مغازه'), true);
  assert.strictEqual(detectCctvIntent('سیستم کامل دوربین مداربسته'), true);
  assert.strictEqual(detectCctvIntent('cctv package for my shop'), true);
});

test('detectCctvIntent false for unrelated chat', () => {
  assert.strictEqual(detectCctvIntent('سلام حال شما چطوره'), false);
  assert.strictEqual(detectCctvIntent('قیمت گوشی سامسونگ چنده'), false);
  assert.strictEqual(detectCctvIntent(''), false);
});

test('detectCctvIntent true when flow already active', () => {
  assert.strictEqual(detectCctvIntent('بیرون', true), true);
});

test('cancel and restart commands', () => {
  assert.strictEqual(isCancelCommand('انصراف میدم'), true);
  assert.strictEqual(isCancelCommand('cancel'), true);
  assert.strictEqual(isRestartCommand('از اول شروع کن'), true);
  assert.strictEqual(isRestartCommand('بیرون'), false);
});

/* ---------- extractSlots ---------- */

test('extractSlots multi-slot in one message', () => {
  const found = extractSlots('برای حیاط ۴ دوربین با دید رنگی ۲۰ روز ۲۵ متر');
  assert.strictEqual(found.environment, 'outdoor');
  assert.strictEqual(found.camerasCount, 4);
  assert.strictEqual(found.nightVision, 'warm_light');
  assert.strictEqual(found.retentionDays, 20);
  assert.strictEqual(found.cableMetersPerCam, 25);
});

test('extractSlots mixed environment beats indoor/outdoor', () => {
  const found = extractSlots('هم داخل هم بیرون');
  assert.strictEqual(found.environment, 'mixed');
});

test('extractSlots Persian word numbers', () => {
  const found = extractSlots('چهار دوربین');
  assert.strictEqual(found.camerasCount, 4);
});

test('extractSlots tech and resolution optional slots', () => {
  const found = extractSlots('پک دوربین تحت شبکه 5mp برای حیاط');
  assert.strictEqual(found.tech, 'ip');
  assert.strictEqual(found.resolution, '5mp');
  assert.strictEqual(found.environment, 'outdoor');
});

test('extractSlots month converts to days', () => {
  const found = extractSlots('یک ماه ضبط');
  assert.strictEqual(found.retentionDays, 30);
});

/* ---------- matchQuickReplyValue ---------- */

test('matchQuickReplyValue environment words', () => {
  assert.strictEqual(matchQuickReplyValue('environment', 'بیرون و حیاط'), 'outdoor');
  assert.strictEqual(matchQuickReplyValue('environment', 'داخل مغازه'), 'indoor');
  assert.strictEqual(matchQuickReplyValue('environment', 'ترکیبی'), 'mixed');
});

test('matchQuickReplyValue nightVision words', () => {
  assert.strictEqual(matchQuickReplyValue('nightVision', 'دید در شب رنگی'), 'warm_light');
  assert.strictEqual(matchQuickReplyValue('nightVision', 'مادون قرمز'), 'ir');
});

test('matchQuickReplyValue numbers and word hints', () => {
  assert.strictEqual(matchQuickReplyValue('camerasCount', '۴'), 4);
  assert.strictEqual(matchQuickReplyValue('retentionDays', 'اقتصادی'), 15);
  assert.strictEqual(matchQuickReplyValue('cableMetersPerCam', 'فاصله زیاد'), 40);
});

/* ---------- flow state machine ---------- */

test('createFlow starts empty at environment', () => {
  const f = createFlow();
  assert.strictEqual(f.active, true);
  assert.strictEqual(f.complete, false);
  assert.strictEqual(getNextStepKey(f), 'environment');
});

test('applyMessage fills one slot per short answer', () => {
  let f = createFlow();
  let r = applyMessage(f, 'بیرون');
  assert.deepStrictEqual(r.filled, ['environment']);
  assert.strictEqual(r.nextStep, 'camerasCount');

  r = applyMessage(r.flow, '۴ دوربین');
  assert.deepStrictEqual(r.filled, ['camerasCount']);
  assert.strictEqual(r.nextStep, 'nightVision');
});

test('applyMessage does not leak number to next slot', () => {
  let f = createFlow();
  f.slots.environment = 'outdoor';
  f.slots.camerasCount = 4;
  f.slots.nightVision = 'warm_light';
  // current is retentionDays — «۳۰ روز» must not also fill cableMetersPerCam
  const r = applyMessage(f, '۳۰ روز');
  assert.deepStrictEqual(r.filled, ['retentionDays']);
  assert.strictEqual(r.flow.slots.retentionDays, 30);
  assert.strictEqual(r.flow.slots.cableMetersPerCam, undefined);
  assert.strictEqual(r.nextStep, 'cableMetersPerCam');
});

test('applyMessage multi-slot completes in one turn', () => {
  const f = createFlow();
  const r = applyMessage(f, 'پک دوربین بیرون ۸ تا دوربین دید رنگی ۴۰ روز ۴۰ متر');
  assert.strictEqual(r.completed, true);
  assert.strictEqual(isComplete(r.flow), true);
  assert.strictEqual(r.flow.slots.camerasCount, 8);
  assert.strictEqual(r.flow.slots.retentionDays, 40);
  assert.strictEqual(r.flow.slots.cableMetersPerCam, 40);
});

test('applyMessage cancel deactivates flow', () => {
  const f = createFlow();
  const r = applyMessage(f, 'انصراف');
  assert.strictEqual(r.cancelled, true);
  assert.strictEqual(r.flow.active, false);
  assert.strictEqual(r.flow.cancelled, true);
});

test('applyMessage restart creates fresh flow', () => {
  let f = createFlow();
  f = applyMessage(f, 'بیرون').flow;
  const r = applyMessage(f, 'از اول شروع کن');
  assert.strictEqual(r.restarted, true);
  assert.strictEqual(getNextStepKey(r.flow), 'environment');
  assert.strictEqual(r.flow.slots.environment, undefined);
});

test('applyMessage reasks when answer does not match current slot', () => {
  const f = createFlow();
  const r = applyMessage(f, 'بله');
  assert.strictEqual(r.needReask, true);
  assert.strictEqual(r.nextStep, 'environment');
});

test('applyQuickReply sets exact value', () => {
  const f = createFlow();
  const r = applyQuickReply(f, 'environment', 'indoor');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.flow.slots.environment, 'indoor');
  assert.strictEqual(r.nextStep, 'camerasCount');
});

test('applyQuickReply rejects invalid slot', () => {
  const f = createFlow();
  const r = applyQuickReply(f, 'environment', 'spaceship');
  assert.strictEqual(r.ok, false);
  assert.ok(r.error);
});

test('full quickReply walk completes and maps to assembly params', () => {
  let f = createFlow();
  f = applyQuickReply(f, 'environment', 'outdoor').flow;
  f = applyQuickReply(f, 'camerasCount', 4).flow;
  f = applyQuickReply(f, 'nightVision', 'warm_light').flow;
  f = applyQuickReply(f, 'retentionDays', 25).flow;
  const last = applyQuickReply(f, 'cableMetersPerCam', 15);
  assert.strictEqual(last.completed, true);

  const params = toAssemblyParams(last.flow);
  assert.strictEqual(params.environment, 'outdoor');
  assert.strictEqual(params.camerasCount, 4);
  assert.strictEqual(params.nightVision, 'warm_light');
  assert.strictEqual(params.retentionDays, 25);
  assert.strictEqual(params.cableMetersPerCam, 15);
  // defaults for unasked slots
  assert.strictEqual(params.tech, 'ahd');
  assert.strictEqual(params.resolution, '5mp');
});

test('buildPrompt returns fixed question and quickReplies', () => {
  const f = createFlow();
  const p = buildPrompt(f);
  assert.strictEqual(p.done, false);
  assert.strictEqual(p.stepKey, 'environment');
  assert.strictEqual(p.message, CCTV_STEPS.environment.question);
  assert.strictEqual(p.quickReplies.length, CCTV_STEPS.environment.quickReplies.length);
});

test('toFlowView shape is API-friendly and deterministic', () => {
  const f = createFlow();
  f.slots.environment = 'outdoor';
  const v = toFlowView(f);
  assert.strictEqual(v.active, true);
  assert.strictEqual(v.complete, false);
  assert.strictEqual(v.step, 'camerasCount');
  assert.strictEqual(v.totalSteps, 5);
  assert.strictEqual(v.stepIndex, 1);
  assert.strictEqual(v.question, CCTV_STEPS.camerasCount.question);
  assert.ok(Array.isArray(v.quickReplies));
});

test('toAssemblyParams is pure (same slots → same params)', () => {
  const slots = {
    environment: 'mixed',
    camerasCount: 8,
    nightVision: 'ir',
    retentionDays: 40,
    cableMetersPerCam: 40,
  };
  const a = toAssemblyParams({ slots });
  const b = toAssemblyParams({ slots });
  assert.deepStrictEqual(a, b);
});

test('summarizeSlots builds a short Persian summary', () => {
  const s = summarizeSlots({
    environment: 'outdoor',
    camerasCount: 4,
    nightVision: 'warm_light',
    retentionDays: 20,
    cableMetersPerCam: 25,
  });
  assert.ok(s.includes('فضای باز'));
  assert.ok(s.includes('4 دوربین'));
  assert.ok(s.includes('رنگی'));
});

/* ---------- determinism ---------- */

test('same messages produce identical flow state', () => {
  const msgs = ['پک دوربین حیاط', '۴ دوربین', 'مادون قرمز', '۲۵ روز', '۲۰ متر'];
  const run = () => {
    let f = createFlow();
    for (const m of msgs) f = applyMessage(f, m).flow;
    return JSON.stringify({ slots: f.slots, complete: f.complete });
  };
  assert.strictEqual(run(), run());
});

console.log(process.exitCode ? '\nFAILED' : '\nALL PASSED');
