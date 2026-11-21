// One-shot: navigate to mobile /categories and extract rail, CSS, toolbar, accordion behavior
"use strict";
const fs = require("fs");
const path = require("path");
const { findPageTarget, Cdp, sleep } = require("./cdp-lib");

const OUT = "D:/project/sgeooole/_re/snappshop-capture";

(async () => {
  const target = await findPageTarget();
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  const evalJs = async (expression) => {
    const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("eval: " + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || "").slice(0, 300));
    return r.result.value;
  };
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await cdp.send("Page.navigate", { url: "https://snappshop.ir/categories" });
  await sleep(8000);
  console.log("url:", await evalJs("location.href"));

  // 1) rail via any mega-menus image on the right side
  const rail = await evalJs(`(() => {
    const imgs = [...document.querySelectorAll('img')].filter(i => /mega-menus/.test(i.src || ''));
    const rightImgs = imgs.filter(i => i.getBoundingClientRect().x > 280);
    const img = rightImgs[0] || imgs[0];
    if (!img) return { err: 'no mega-menus img', imgCount: imgs.length };
    let node = img;
    for (let i = 0; i < 6 && node.parentElement; i++) {
      node = node.parentElement;
      const r = node.getBoundingClientRect();
      if (r.height > 500 && r.width < 220) break;
    }
    const r = node.getBoundingClientRect();
    const cs = getComputedStyle(node);
    const items = [...node.querySelectorAll('a')].slice(0, 3).map(a => {
      const rr = a.getBoundingClientRect(); const acs = getComputedStyle(a);
      const im = a.querySelector('img');
      return { t: (a.textContent || '').trim().slice(0, 25), cls: (a.getAttribute('class') || '').slice(0, 170),
        w: Math.round(rr.width), h: Math.round(rr.height), color: acs.color, bg: acs.backgroundColor,
        imgW: im ? im.width : null, imgH: im ? im.height : null };
    });
    return { cls: (node.getAttribute('class') || '').slice(0, 200), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      pos: cs.position, bg: cs.backgroundColor, overflow: cs.overflowY, itemGap: cs.gap, items, railImgs: rightImgs.length || imgs.length };
  })()`);
  console.log("RAIL:", JSON.stringify(rail, null, 1).slice(0, 2200));

  // 2) toolbar (نمایش همه محصولات) + accordion toggle behavior
  const toolbar = await evalJs(`(() => {
    const el = [...document.querySelectorAll('a,button,div')].find(e => (e.textContent || '').includes('نمایش همه محصولات') && e.textContent.length < 40);
    if (!el) return null;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return { tag: el.tagName, cls: (el.getAttribute('class') || '').slice(0, 180), href: el.getAttribute('href'),
      w: Math.round(r.width), h: Math.round(r.height), color: cs.color, font: cs.fontSize + '/' + cs.fontWeight, radius: cs.borderRadius, bg: cs.backgroundColor };
  })()`);
  console.log("TOOLBAR:", JSON.stringify(toolbar));

  // 3) accordion: click second header, check expansion
  const before = await evalJs(`document.querySelectorAll('[class*="categories-items"]').length`);
  const clicked = await evalJs(`(() => {
    const hs = [...document.querySelectorAll('[class*="category-list_categories-items"]')];
    const target = hs.find(e => !e.className.includes('--active') && e.getBoundingClientRect().y > 100);
    if (!target) return null;
    const r = target.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: target.textContent.trim().slice(0, 40) };
  })()`);
  if (clicked) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: clicked.x, y: clicked.y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: clicked.x, y: clicked.y, button: "left", clickCount: 1 });
    await sleep(1200);
    const after = await evalJs(`(() => {
      const hs = [...document.querySelectorAll('[class*="category-list_categories-items"]')].map(e => ({
        t: e.textContent.trim().slice(0, 30), active: e.className.includes('--active') }));
      return hs;
    })()`);
    console.log("accordion before-count:", before, "| clicked:", clicked.text, "| after:", JSON.stringify(after.slice(0, 8)));
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, "mobile-categories-expanded.png"), Buffer.from(shot.data, "base64"));
  }

  // 4) category-list + page CSS from live sheets
  const rules = await evalJs(`(async () => {
    const out = [];
    for (const l of [...document.querySelectorAll('link[rel=stylesheet]')].map(x => x.href)) {
      const t = await (await fetch(l)).text();
      const lines = t.split('}').filter(r => /category-list/.test(r)).map(r => r.trim() + '}');
      if (lines.length) out.push({ href: l.split('/').pop(), rules: lines.slice(0, 40) });
    }
    return out;
  })()`);
  fs.writeFileSync(path.join(OUT, "category-list-css.json"), JSON.stringify(rules, null, 1));
  console.log("category-list rules found in", (rules || []).length, "sheets");

  cdp.close();
  console.log("DONE mobile-one-shot");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
