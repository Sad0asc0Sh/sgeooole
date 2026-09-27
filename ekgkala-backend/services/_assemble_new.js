/**
 * assembleCCTVPackage — نسخه اصلاح‌شده (Category-First + Integrity Gate)
 * این فایل جایگزین بدنه assembleCCTVPackage در cctvAssemblyEngine.js می‌شود.
 */

async function assembleCCTVPackage(params = {}) {
  const plan = computeRequirements(params);
  if (!plan.ok) {
    return {
      ok: false,
      success: false,
      error: 'INVALID_PARAMS',
      errors: plan.errors,
      missingRoles: [],
      message: 'پارامترهای ورودی نامعتبر است.',
      items: [],
      totalPrice: 0,
      calculations: null,
    };
  }

  const { params: p, calculations: calc } = plan;
  const items = [];
  const missing = [];
  const warnings = [];
  const notes = [];

  // --- دسته‌ها (Category-First + زیردسته‌ها) ---
  const [camCatIds, recCatIds, hddCatIds, powerCatIds, cableCatIds, connCatIds] = await Promise.all([
    resolveCategoryIds(ROLE_CATEGORY_PATTERNS.camera),
    resolveCategoryIds(ROLE_CATEGORY_PATTERNS.recorder),
    resolveCategoryIds(ROLE_CATEGORY_PATTERNS.hdd),
    resolveCategoryIds(ROLE_CATEGORY_PATTERNS.power),
    resolveCategoryIds(ROLE_CATEGORY_PATTERNS.cable),
    resolveCategoryIds(ROLE_CATEGORY_PATTERNS.connector),
  ]);

  // --- دوربین (با Fallback رزولوشن و محیط) ---
  let camPool = camCatIds.length ? await loadPool(camCatIds) : [];
  if (!camPool.length) {
    camPool = await loadPoolByPhrases(['دوربین مداربسته', 'دوربین', 'دام', 'بولت', 'cctv']);
  }

  let camScored = camPool.map((prod) => ({ product: prod, score: scoreCamera(prod, p) }));
  let camPick = pickBest(camScored, p.camerasCount);

  // Fallback رزولوشن: اگر هیچ دوربینی نبود، pool را بازتر امتیاز بده
  if (!camPick && camPool.length) {
    const relaxed = { ...p, resolution: '2mp', environment: 'mixed' };
    camScored = camPool.map((prod) => ({ product: prod, score: scoreCamera(prod, relaxed) }));
    camPick = pickBest(camScored, p.camerasCount);
    if (camPick) {
      const got = analyzeCameraProduct(camPick.product);
      notes.push(
        `رزولوشن درخواستی ${p.resolution.toUpperCase()} موجود نبود؛ نزدیک‌ترین دوربین موجود (${(got.resolution || 'نامشخص').toUpperCase()}) انتخاب شد.`,
      );
    }
  }

  if (camPick) {
    const camInfo = analyzeCameraProduct(camPick.product);
    if (camInfo.resolution && camInfo.resolution !== p.resolution) {
      notes.push(
        `رزولوشن دوربین انتخابی ${camInfo.resolution.toUpperCase()} است (درخواست: ${p.resolution.toUpperCase()}).`,
      );
    }
    items.push(
      lineItem('camera', 'دوربین مداربسته', camPick.product, p.camerasCount, {
        why: `سازگار با ${p.tech === 'ip' ? 'تحت شبکه' : 'آنالوگ'} · ${p.environment === 'indoor' ? 'داخلی' : p.environment === 'outdoor' ? 'بیرونی' : 'ترکیبی'}${camInfo.form ? ' · ' + camInfo.form : ''}`,
        form: calc.camera.form,
      }),
    );
  } else {
    missing.push(
      missingItem(
        'camera',
        'دوربین مداربسته',
        `دوربین ${p.tech === 'ip' ? 'IP' : 'AHD'} با موجودی ≥ ${p.camerasCount} در انبار یافت نشد.`,
      ),
    );
  }

  // --- رکوردر ---
  let recPool = recCatIds.length ? await loadPool(recCatIds) : [];
  if (!recPool.length) {
    recPool = await loadPoolByPhrases(['dvr', 'nvr', 'xvr', 'دستگاه ضبط', 'رکوردر']);
  }

  let recScored = recPool.map((prod) => ({ product: prod, score: scoreRecorder(prod, p, calc.recorder) }));
  let recPick = pickBest(recScored, 1);
  if (!recPick && recPool.length) {
    // Fallback: کانال بیشتر یا رزولوشن پایین‌تر
    const relaxedCalc = { ...calc.recorder, channelsNeeded: Math.max(1, Math.floor(calc.recorder.channelsNeeded / 2)) };
    recScored = recPool.map((prod) => ({ product: prod, score: scoreRecorder(prod, p, relaxedCalc) }));
    recPick = pickBest(recScored, 1);
    if (recPick) notes.push('دستگاه ضبط با ظرفیت کانال نزدیک به نیاز انتخاب شد.');
  }

  if (recPick) {
    items.push(
      lineItem('recorder', p.tech === 'ip' ? 'NVR (دستگاه ضبط شبکه)' : 'DVR/XVR (دستگاه ضبط)', recPick.product, 1, {
        why: `کانال ≥ ${calc.recorder.channelsNeeded}`,
      }),
    );
  } else {
    missing.push(
      missingItem(
        'recorder',
        p.tech === 'ip' ? 'NVR' : 'DVR/XVR',
        `دستگاه ضبط ${p.tech === 'ip' ? 'شبکه NVR' : 'آنالوگ DVR/XVR'} با ${calc.recorder.channelsNeeded} کانال یافت نشد.`,
      ),
    );
  }

  // --- هارد (Fallback ظرفیت بزرگ‌تر) ---
  let hddPool = hddCatIds.length ? await loadPool(hddCatIds) : [];
  if (!hddPool.length) {
    hddPool = await loadPoolByPhrases(['هارد', 'هارددیسک', 'purple', 'skyhawk', 'بنفش']);
  }

  const hddNeed = calc.storage.hddPlan.drives[0].qty;
  const hddTargetGb = calc.storage.hddPlan.drives[0].capacityGb;
  let hddScored = hddPool.map((prod) => ({ product: prod, score: scoreHdd(prod, calc.storage) }));
  let hddPick = pickBest(hddScored, hddNeed);

  if (!hddPick && hddPool.length) {
    // اسنپ به نزدیک‌ترین ظرفیت موجود
    hddPick = pickBest(hddScored, 1);
    if (hddPick) {
      const info = analyzeHddProduct(hddPick.product);
      notes.push(
        `هارد دقیقاً ${Math.round(hddTargetGb / 1000)} ترابایت موجود نبود؛ نزدیک‌ترین ظرفیت موجود (${info.capacityGb ? Math.round(info.capacityGb / 1000) + 'TB' : 'نامشخص'}) انتخاب شد.`,
      );
    }
  }

  if (hddPick) {
    items.push(
      lineItem('hdd', 'هارددیسک نظارتی', hddPick.product, hddNeed, {
        why: `نیاز ضبط ${calc.storage.retentionDays} روز ≈ ${calc.storage.requiredTb}TB`,
      }),
    );
  } else {
    missing.push(
      missingItem(
        'hdd',
        'هارددیسک نظارتی',
        `هارد نظارتی با ظرفیت ≥ ${hddTargetGb}GB یافت نشد.`,
      ),
    );
  }

  // --- برق ---
  let powerPool = powerCatIds.length ? await loadPool(powerCatIds) : [];
  if (!powerPool.length) {
    powerPool = await loadPoolByPhrases(['منبع تغذیه', 'آداپتور', 'پاور', 'پاور صنعتی']);
  }
  if (p.tech === 'ip') {
    const swCatIds = await resolveCategoryIds(ROLE_CATEGORY_PATTERNS.switch);
    if (swCatIds.length) {
      powerPool = [...powerPool, ...(await loadPool(swCatIds))];
    }
  }
  const seenP = new Set();
  powerPool = powerPool.filter((x) => {
    const id = String(x._id);
    if (seenP.has(id)) return false;
    seenP.add(id);
    return true;
  });

  const powScored = powerPool.map((prod) => ({ product: prod, score: scorePower(prod, p, calc.power) }));
  const powPick = pickBest(powScored, 1);
  if (powPick) {
    const powerQty = p.tech === 'ip' ? 1 : calc.power.useIndividualAdapters ? p.camerasCount : 1;
    items.push(
      lineItem('power', p.tech === 'ip' ? 'سوئیچ PoE / منبع شبکه' : 'منبع تغذیه', powPick.product, powerQty, {
        why: calc.power.recommendedSupply,
      }),
    );
  } else {
    missing.push(missingItem('power', 'منبع تغذیه', `تجهیز برق مناسب (${calc.power.recommendedSupply}) یافت نشد.`));
  }

  // --- کابل (فقط کابل واقعی — نه فیش/سوزنی) ---
  let cablePool = cableCatIds.length ? await loadPool(cableCatIds) : [];
  if (!cablePool.length) {
    cablePool = await loadPoolByPhrases(['کابل RG59', 'کابل شبکه', 'کابل ترکیبی', 'cat6']);
  }
  // فیلتر سخت: هر محصولی که فیش/کانکتور است حذف می‌شود
  cablePool = cablePool.filter((prod) => {
    const a = analyzeCableProduct(prod);
    return !a.isConnectorLike;
  });

  const cableScored = cablePool.map((prod) => ({ product: prod, score: scoreCable(prod, p) }));
  const cablePick = pickBest(cableScored, 1);
  if (cablePick) {
    const ca = analyzeCableProduct(cablePick.product);
    // تعداد: کلاف/باکس → تعداد کلاف؛ متری → متراژ واقعی
    let qty;
    let unit;
    if (ca.boxMeters && ca.boxMeters >= 50) {
      qty = ceilInt(calc.cable.totalMeters / ca.boxMeters);
      unit = 'box';
    } else {
      qty = calc.cable.totalMeters;
      unit = 'meter';
    }
    items.push(
      lineItem('cable', p.tech === 'ip' ? 'کابل شبکه Cat6' : 'کابل ترکیبی RG59', cablePick.product, qty, {
        why: `${calc.cable.totalMeters} متر (با ۱۰٪ هدر) · واحد: ${unit === 'box' ? 'کلاف' : 'متر'}`,
        unit,
      }),
    );
  } else {
    missing.push(missingItem('cable', 'کابل', `کابل ${p.tech === 'ip' ? 'Cat6' : 'RG59'} (نه فیش/اتصال) یافت نشد.`));
  }

  // --- اتصالات (فیش) ---
  const connPool = connCatIds.length ? await loadPool(connCatIds) : [];
  const connectors = calc.connectors;

  if (p.tech === 'ahd' && connectors.bnc > 0) {
    const bncScored = connPool.map((prod) => ({ product: prod, score: scoreConnector(prod, p, 'bnc') }));
    const bncPick = pickBest(bncScored, 1);
    if (bncPick) {
      items.push(lineItem('connector_bnc', 'فیش BNC', bncPick.product, connectors.bnc, { why: connectors.details[0] }));
    } else {
      missing.push(missingItem('connector_bnc', 'فیش BNC', `به ${connectors.bnc} عدد فیش BNC نیاز است و موجود نیست.`));
    }

    const dcScored = connPool.map((prod) => ({ product: prod, score: scoreConnector(prod, p, 'dc') }));
    const dcPick = pickBest(dcScored, 1);
    if (dcPick) {
      items.push(lineItem('connector_dc', 'جک / فیش برق DC', dcPick.product, connectors.dcJacks, { why: `تعداد: ${connectors.dcJacks}` }));
    } else {
      warnings.push(`جک DC (${connectors.dcJacks} عدد) جداگانه یافت نشد؛ در صورت پاور صنعتی، ترمینال کافی است.`);
    }
  }

  if (p.tech === 'ip' && connectors.rj45 > 0) {
    const rjScored = connPool.map((prod) => ({ product: prod, score: scoreConnector(prod, p, 'rj45') }));
    const rjPick = pickBest(rjScored, 1);
    if (rjPick) {
      items.push(lineItem('connector_rj45', 'سوکت RJ45', rjPick.product, connectors.rj45, { why: connectors.details[0] }));
    } else {
      missing.push(missingItem('connector_rj45', 'سوکت RJ45', `به ${connectors.rj45} عدد سوکت RJ45 نیاز است.`));
    }
  }

  // --- هشدارها ---
  if (calc.power.longRun) {
    warnings.push(
      `متراژ کابل هر دوربین (${p.cableMetersPerCam}m) بیشتر از ${MAX_SHARED_POWER_RUN_M}m است؛ ${calc.power.recommendedSupply}.`,
    );
  }
  if (p.nightVision === 'warm_light') {
    warnings.push('دوربین وارم‌لایت مصرف برق بالاتری دارد؛ ظرفیت پاور با ضریب ۱٫۲۵ محاسبه شده است.');
  }

  /* ============================================================
   * گیت اجباری یکپارچگی پکیج (Strict Integrity Gate)
   * پک بدون دوربین یا رکوردر بی‌معنی است — نباید صادر شود.
   * ============================================================ */
  const CORE_ROLES = ['camera', 'recorder'];
  const presentRoles = new Set(items.map((it) => it.role));
  const missingRoles = CORE_ROLES.filter((r) => !presentRoles.has(r));

  if (missingRoles.length > 0) {
    return {
      success: false,
      ok: false,
      error: 'MISSING_CORE_ITEMS',
      missingRoles,
      message: 'متأسفانه در حال حاضر دوربین یا دستگاه متناسب با این مشخصات در انبار موجود نیست.',
      items: [],
      totalPrice: 0,
      params: p,
      calculations: calc,
      missing,
      warnings,
      notes,
      meta: {
        engine: 'cctvAssemblyEngine',
        version: '1.1.0',
        deterministic: true,
        llmUsed: false,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  const totalPrice = items.reduce((s, it) => s + (it.lineTotal || 0), 0);
  const incomplete = missing.length > 0;

  return {
    success: true,
    ok: !incomplete,
    incomplete,
    params: p,
    calculations: calc,
    items,
    totalPrice,
    missing,
    warnings,
    notes,
    meta: {
      engine: 'cctvAssemblyEngine',
      version: '1.1.0',
      deterministic: true,
      llmUsed: false,
      generatedAt: new Date().toISOString(),
    },
  };
}
