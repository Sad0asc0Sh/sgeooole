// Hover the "همه دسته‌بندی‌ها" menu item on snappshop.ir and record the opened panel.
"use strict";
const fs = require("fs");
const path = require("path");
const { findPageTarget, Cdp, sleep } = require("./cdp-lib");

const OUT = "D:/project/sgeooole/_re/snappshop-capture";
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const target = await findPageTarget();
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);

  const evalJs = async (expression) => {
    const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("eval error: " + JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
  };

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  console.log("webdriver:", await evalJs("navigator.webdriver"));
  console.log("url:", await evalJs("location.href"));

  // Locate the mega-menu trigger
  const rect = await evalJs(`(() => {
    const el = [...document.querySelectorAll('[role=menuitem]')].find(e => e.textContent.includes('همه دسته'));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, cls: el.className, tag: el.tagName };
  })()`);
  if (!rect) throw new Error("menuitem not found");
  console.log("trigger:", JSON.stringify(rect));

  // Move mouse in steps to trigger hover
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x + 30, y: rect.y + 5 });
  await sleep(120);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await sleep(2000);

  // Full DOM snapshot with layout + styles
  const snap = await cdp.send("DOMSnapshot.captureSnapshot", { computedStyles: [], includeDOMRects: true, includePaintOrder: false });
  fs.writeFileSync(path.join(OUT, "dom-megamenu.json"), JSON.stringify(snap));
  console.log("dom snapshot strings:", snap.strings.length);

  // Screenshot of the open menu
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, "megamenu-desktop.png"), Buffer.from(shot.data, "base64"));
  console.log("screenshot saved");

  // Identify the panel: visible containers that appeared under the header
  const panels = await evalJs(`(() => {
    const marker = [...document.querySelectorAll('body *')].filter(e =>
      e.offsetParent !== null && e.textContent.includes('لوازم آرایشی') && e.textContent.includes('موبایل'));
    const seen = [];
    for (const e of marker.slice(0, 5)) {
      let node = e;
      for (let i = 0; i < 6 && node.parentElement; i++) node = node.parentElement;
      const r = node.getBoundingClientRect();
      seen.push({ tag: node.tagName, cls: String(node.className).slice(0, 120), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return seen;
  })()`);
  console.log("panel candidates:", JSON.stringify(panels, null, 1));

  // Dump outerHTML of the most likely panel (largest ancestor)
  const html = await evalJs(`(() => {
    const marker = [...document.querySelectorAll('body *')].filter(e =>
      e.offsetParent !== null && e.textContent.includes('لوازم آرایشی') && e.textContent.includes('موبایل'));
    if (!marker.length) return "";
    let node = marker[0];
    for (let i = 0; i < 6 && node.parentElement; i++) node = node.parentElement;
    return node.outerHTML;
  })()`);
  fs.writeFileSync(path.join(OUT, "megamenu-panel.html"), html);
  console.log("panel html bytes:", html.length);

  // Trigger element + header outerHTML for context
  const headerHtml = await evalJs(`(() => {
    const el = [...document.querySelectorAll('[role=menuitem]')].find(e => e.textContent.includes('همه دسته'));
    let node = el; for (let i = 0; i < 4 && node.parentElement; i++) node = node.parentElement;
    return node.outerHTML;
  })()`);
  fs.writeFileSync(path.join(OUT, "megamenu-trigger.html"), headerHtml);
  console.log("trigger html bytes:", headerHtml.length);

  cdp.close();
  console.log("DONE hover-megamenu");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
