// Mobile emulation: how does snappshop expose categories on mobile?
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
  await cdp.send("Emulation.setUserAgentOverride", {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  await cdp.send("Page.navigate", { url: "https://snappshop.ir/" });
  await sleep(9000);

  const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT, "mobile-home.png"), Buffer.from(shot.data, "base64"));
  console.log("mobile home saved");

  // what's in the bottom area / header on mobile?
  const probe = await evalJs(`(() => {
    const texts = [...document.querySelectorAll('a,button,[role=button],[role=menuitem]')]
      .filter(e => e.offsetParent !== null)
      .map(e => ({ t: (e.textContent||'').trim().slice(0,30), tag: e.tagName, y: Math.round(e.getBoundingClientRect().y) }))
      .filter(x => x.t && x.y > 600);
    const bottomFixed = [...document.querySelectorAll('body *')].filter(e => {
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
      return (cs.position === 'fixed' || cs.position === 'sticky') && r.y > 500 && r.height > 40 && r.width > 200;
    }).map(e => ({ cls: (e.getAttribute('class')||'').slice(0,100), y: Math.round(e.getBoundingClientRect().y), h: Math.round(e.getBoundingClientRect().height), text: (e.textContent||'').trim().slice(0,60) }));
    return { nearBottom: texts.slice(0, 20), bottomFixed };
  })()`);
  console.log("bottom probe:", JSON.stringify(probe, null, 1).slice(0, 2500));

  // try /categories on mobile
  await cdp.send("Page.navigate", { url: "https://snappshop.ir/categories" });
  await sleep(7000);
  const url = await evalJs("location.href");
  console.log("after /categories on mobile:", url);
  const shot2 = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT, "mobile-categories.png"), Buffer.from(shot2.data, "base64"));

  cdp.close();
  console.log("DONE mobile-probe");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
