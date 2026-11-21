// Pull the actual CSS module rules + per-pill styles for the mega menu
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
    if (r.exceptionDetails) throw new Error("eval: " + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || "").slice(0, 400));
    return r.result.value;
  };
  await cdp.send("Runtime.enable");

  // open menu
  const trig = await evalJs(`(() => { const el=[...document.querySelectorAll('a')].find(e=>e.textContent&&e.textContent.includes('همه دسته')); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: trig.x, y: trig.y });
  await sleep(1200);

  // 1) per-pill styles (first = active, second = default)
  const pills = await evalJs(`(() => {
    const pills = [...document.querySelectorAll('[class*="navigationMenuButton"]')].slice(0, 4).map(el => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      const strong = el.querySelector('strong');
      const scs = strong ? getComputedStyle(strong) : null;
      const svg = el.querySelector('svg');
      const use = svg && svg.querySelector('use');
      return { text: (strong ? strong.textContent : el.textContent).trim(),
        active: el.className.includes('Active'),
        w: Math.round(r.width), h: Math.round(r.height),
        color: cs.color, bg: cs.backgroundColor, border: cs.border, radius: cs.borderRadius,
        padding: cs.padding, margin: cs.margin, font: cs.fontSize + ' / ' + cs.fontWeight + ' / lh ' + cs.lineHeight,
        gap: cs.gap, icon: use ? use.getAttribute('href') : null,
        strongColor: scs ? scs.color : null, strongWeight: scs ? scs.fontWeight : null };
    });
    const li = [...document.querySelectorAll('[role=menu] > li')].slice(0,3).map(el => {
      const cs = getComputedStyle(el);
      return { margin: cs.margin, padding: cs.padding, w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) };
    });
    const ul = document.querySelector('[role=menu]');
    const ucs = getComputedStyle(ul);
    return { pills, li, ul: { display: ucs.display, flex: ucs.flexDirection, wrap: ucs.flexWrap, gap: ucs.gap, h: Math.round(ul.getBoundingClientRect().height), scroll: getComputedStyle(ul.parentElement).overflowY } };
  })()`);
  fs.writeFileSync(path.join(OUT, "megamenu-pills.json"), JSON.stringify(pills, null, 1));
  console.log("pills:", pills.pills.length, JSON.stringify(pills.pills[0] && pills.pills[0].text));

  // 2) fetch stylesheet texts and grep module rules
  const css = await evalJs(`(async () => {
    const hrefs = [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href);
    const out = [];
    for (const h of hrefs) {
      try { const t = await (await fetch(h)).text();
        if (t.includes('AllCategories') || t.includes('NavigationMenu')) out.push({ href: h, len: t.length });
      } catch (e) { out.push({ href: h, err: String(e).slice(0,80) }); }
    }
    return { sheets: [...document.styleSheets].length, hrefs, matched: out };
  })()`);
  fs.writeFileSync(path.join(OUT, "css-sources.json"), JSON.stringify(css, null, 1));
  console.log("stylesheets:", JSON.stringify(css.matched));

  // 3) extract AllCategories + NavigationMenu rules from matched sheets
  const rules = await evalJs(`(async () => {
    const props = ['AllCategories', 'NavigationMenu_module', 'NavigationMenuList'];
    const chunks = [];
    for (const l of ${JSON.stringify((css.matched || []).map(m => m.href))}) {
      const t = await (await fetch(l)).text();
      const lines = t.split('}').filter(r => props.some(p => r.includes(p))).map(r => r.trim() + '}');
      chunks.push({ href: l, rules: lines });
    }
    return chunks;
  })()`);
  fs.writeFileSync(path.join(OUT, "megamenu-css-rules.json"), JSON.stringify(rules, null, 1));
  const total = (rules || []).reduce((a, c) => a + c.rules.length, 0);
  console.log("module rules:", total);

  cdp.close();
  console.log("DONE css-and-pills");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
