// Extract the mobile /categories page structure, styles and API calls
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
  await cdp.send("Network.enable");

  const requests = [];
  cdp.on((msg) => {
    if (msg.method === "Network.requestWillBeSent") {
      const r = msg.params.request;
      if (/apix|cdn\.snappshop/.test(r.url)) requests.push(r.url);
    }
  });

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await cdp.send("Page.navigate", { url: "https://snappshop.ir/categories" });
  await sleep(9000);

  const page = await evalJs(`(() => {
    const norm = (s) => (s||'').replace(/\\s+/g,' ').trim();
    // rail items
    const railItem = (el) => {
      const img = el.querySelector('img');
      return { text: norm(el.textContent).slice(0,40), tag: el.tagName,
        cls: (el.getAttribute('class')||'').slice(0,160),
        img: img ? (img.src||'').slice(0,120) : null, imgCls: img ? (img.getAttribute('class')||'').slice(0,80) : null,
        w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) };
    };
    // find the rail: rightmost column with ~13 items
    const candidates = [...document.querySelectorAll('div,ul,nav,aside')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.x > 250 && r.width < 160 && r.height > 600 && e.querySelectorAll('img').length >= 8;
    });
    const rail = candidates[candidates.length - 1];
    // content groups: accordion headers
    const headers = [...document.querySelectorAll('button,[role=button],div')].filter(e => {
      const r = e.getBoundingClientRect();
      if (e.children.length === 0 || e.offsetParent === null) return false;
      return /براساس|محبوب|پرفروش/.test(e.textContent) && e.textContent.length < 60 && r.width > 200;
    }).slice(0, 8).map(e => {
      const r = e.getBoundingClientRect();
      const svg = e.querySelector('svg');
      return { text: norm(e.textContent).slice(0,50), cls: (e.getAttribute('class')||'').slice(0,140), tag: e.tagName,
        w: Math.round(r.width), h: Math.round(r.height), hasSvg: !!svg, svgCls: svg ? (svg.getAttribute('class')||'').slice(0,80) : null };
    });
    // expanded grid cards
    const cards = [...document.querySelectorAll('a')].filter(a => a.offsetParent !== null && a.querySelector('img')).slice(0, 6).map(a => {
      const img = a.querySelector('img');
      const r = a.getBoundingClientRect();
      const cs = getComputedStyle(a);
      return { text: norm(a.textContent).slice(0,40), href: (a.getAttribute('href')||'').slice(0,60),
        cls: (a.getAttribute('class')||'').slice(0,140),
        imgSrc: (img.src||'').slice(0,130), imgSize: img.width + 'x' + img.height,
        w: Math.round(r.width), h: Math.round(r.height), display: cs.display, radius: cs.borderRadius };
    });
    // rail container styles
    const railCS = rail ? (() => { const cs = getComputedStyle(rail); return { w: cs.width, bg: cs.backgroundColor, overflow: cs.overflowY, pos: cs.position }; })() : null;
    // page main container
    const main = document.querySelector('main') || document.body;
    const cs = getComputedStyle(main);
    return { railFound: !!rail, railCls: rail ? (rail.getAttribute('class')||'').slice(0,180) : null, railCS,
      railItems: rail ? [...rail.querySelectorAll('a,li,div')].filter(e => e.querySelector('img')).slice(0,4).map(railItem) : [],
      headers, cards, mainBg: cs.backgroundColor };
  })()`);
  fs.writeFileSync(path.join(OUT, "mobile-categories-structure.json"), JSON.stringify(page, null, 1));
  console.log("rail found:", page.railFound, "| headers:", page.headers.length, "| cards:", page.cards.length);
  console.log("railCls:", page.railCls);
  console.log("headers[0..1]:", JSON.stringify(page.headers.slice(0,2)));
  console.log("cards[0..1]:", JSON.stringify(page.cards.slice(0,2)));

  // unique API calls for this page
  const apis = [...new Set(requests)].filter(u => /apix/.test(u));
  console.log("apis on categories page:", apis.slice(0, 10));
  fs.writeFileSync(path.join(OUT, "mobile-categories-apis.json"), JSON.stringify(apis, null, 1));

  // full-page screenshot
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  fs.writeFileSync(path.join(OUT, "mobile-categories-full.png"), Buffer.from(shot.data, "base64"));

  cdp.close();
  console.log("DONE mobile-extract");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
