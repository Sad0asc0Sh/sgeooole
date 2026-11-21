// Visual verification of the local categories clone vs snappshop captures.
"use strict";
const fs = require("fs");
const path = require("path");
const { findPageTarget, Cdp, sleep } = require("./cdp-lib");

const OUT = "D:/project/sgeooole/_re/snappshop-capture";

(async () => {
  const target = await findPageTarget("about:blank", 9222).catch(() => findPageTarget("", 9222));
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  const evalJs = async (expression) => {
    const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("eval: " + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || "").slice(0, 300));
    return r.result.value;
  };
  const shot = async (name) => {
    const s = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(s.data, "base64"));
    console.log("saved", name);
  };
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // ── Desktop page ──
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: "http://localhost:3000/categories" });
  await sleep(6000);
  console.log("desktop url:", await evalJs("location.href"));
  await shot("clone-categories-desktop.png");

  // ── Desktop mega menu hover ──
  const trig = await evalJs(`(() => {
    const el = [...document.querySelectorAll('div')].find(e => e.textContent.trim().startsWith('همه دسته') && e.children.length <= 2 && e.querySelector('svg'));
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  console.log("trigger:", JSON.stringify(trig));
  if (trig) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: trig.x, y: trig.y });
    await sleep(1800);
    await shot("clone-megamenu.png");
    // hover second pill (دیجیتال) inside the panel
    const pill = await evalJs(`(() => {
      const el = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === 'دیجیتال' && e.closest('[class*="rail"]'));
      if (!el) return null; const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    console.log("digital pill:", JSON.stringify(pill));
    if (pill) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pill.x, y: pill.y });
      await sleep(900);
      await shot("clone-megamenu-digital.png");
    }
  }

  // ── Mobile page ──
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Page.navigate", { url: "http://localhost:3000/categories" });
  await sleep(5000);
  await shot("clone-categories-mobile.png");

  // tap the third rail item (خانه و آشپزخانه) to verify switching
  const railItem = await evalJs(`(() => {
    const el = [...document.querySelectorAll('button')].find(e => e.textContent.includes('خانه و آشپزخانه') && e.closest('[class*="rail"]'));
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (railItem) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: railItem.x, y: railItem.y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: railItem.x, y: railItem.y, button: "left", clickCount: 1 });
    await sleep(1200);
    await shot("clone-categories-mobile-switched.png");
  }

  cdp.close();
  console.log("DONE verify-visual");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
