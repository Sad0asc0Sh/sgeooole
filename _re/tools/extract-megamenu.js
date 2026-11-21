// Extract mega-menu structure (roots -> groups -> links) + computed styles from snappshop.ir
"use strict";
const fs = require("fs");
const path = require("path");
const { findPageTarget, Cdp, sleep } = require("./cdp-lib");

const OUT = "D:/project/sgeooole/_re/snappshop-capture";
fs.mkdirSync(OUT, { recursive: true });

const STYLE_PROPS = [
  "color", "background-color", "border", "border-radius", "box-shadow",
  "font-family", "font-size", "font-weight", "line-height",
  "padding", "margin", "width", "height", "position", "direction",
  "display", "grid-template-columns", "column-gap", "row-gap", "text-align",
];

// In-page helpers, injected into every eval
const HELPERS = `
  const panelOf = (marker) => {
    const chain = [];
    let n = marker;
    while (n && n !== document.body) { chain.push(n); n = n.parentElement; }
    for (const el of chain.reverse()) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width < window.innerWidth * 0.98) return el;
    }
    return chain[chain.length - 1] || marker;
  };
  const findPanel = () => {
    const marker = [...document.querySelectorAll('body *')].find(e =>
      e.offsetParent !== null && e.textContent && e.textContent.includes('لوازم آرایشی') && e.textContent.includes('موبایل'));
    return marker ? panelOf(marker) : null;
  };
  const cls = (el) => el && ((el.getAttribute && el.getAttribute('class')) || '').slice(0, 200);
`;

(async () => {
  const target = await findPageTarget();
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  const evalJs = async (expression) => {
    const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("eval: " + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || "").slice(0, 400));
    return r.result.value;
  };
  await cdp.send("Runtime.enable");

  // ensure menu is open
  const rect = await evalJs(`(() => {
    const el = [...document.querySelectorAll('[role=menuitem], a')].find(e => e.textContent && e.textContent.includes('همه دسته'));
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!rect) throw new Error("trigger not found");
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await sleep(1500);

  const panelInfo = await evalJs(`(() => { ${HELPERS}
    const p = findPanel(); if (!p) return null;
    const r = p.getBoundingClientRect();
    return { cls: cls(p), tag: p.tagName, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top),
             parentCls: cls(p.parentElement) };
  })()`);
  console.log("panel:", JSON.stringify(panelInfo));

  const tree = await evalJs(`(() => { ${HELPERS}
    const norm = (s) => (s||'').replace(/\\s+/g,' ').trim();
    const panel = findPanel(); if (!panel) return null;
    const pillEls = [...panel.querySelectorAll('*')].filter(e => e.offsetParent !== null && e.children.length === 0 &&
      /موبایل|دیجیتال|زیبایی و سلامت|خانه و آشپزخانه|لوازم خانگی برقی|مد و پوشاک|طلا و نقره|فرهنگ و هنر|ورزش و سفر|ابزارآلات|سوپرمارکت|کتاب|خودرو/.test(norm(e.textContent)));
    const links = [...panel.querySelectorAll('a')].filter(a => a.offsetParent !== null).map(a => {
      const r = a.getBoundingClientRect();
      return { text: norm(a.textContent), href: a.getAttribute('href') || '',
        bold: Number(getComputedStyle(a).fontWeight) >= 600,
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    const pillRects = pillEls.slice(0,14).map(e => { const r = e.getBoundingClientRect();
      return { t: norm(e.textContent), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cls: cls(e) }; });
    return { panelCls: cls(panel), links, pillRects };
  })()`);
  fs.writeFileSync(path.join(OUT, "megamenu-tree.json"), JSON.stringify(tree, null, 1));
  console.log("links:", tree.links.length, "| pills:", tree.pillRects.length);

  const styles = await evalJs(`(() => { ${HELPERS}
    const props = ${JSON.stringify(STYLE_PROPS)};
    const pick = (el) => { if (!el) return null; const cs = getComputedStyle(el); const o = {};
      for (const p of props) o[p] = cs.getPropertyValue(p); return o; };
    const panel = findPanel(); if (!panel) return null;
    const trigger = [...document.querySelectorAll('[role=menuitem], a')].find(e => e.textContent && e.textContent.includes('همه دسته'));
    const pill = [...panel.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'موبایل');
    const groupTitle = [...panel.querySelectorAll('a')].find(a => a.offsetParent && Number(getComputedStyle(a).fontWeight) >= 700);
    const link = [...panel.querySelectorAll('a')].find(a => a.offsetParent && Number(getComputedStyle(a).fontWeight) < 600);
    return { panel: pick(panel), trigger: pick(trigger), pill: pick(pill), groupTitle: pick(groupTitle), link: pick(link) };
  })()`);
  fs.writeFileSync(path.join(OUT, "megamenu-styles.json"), JSON.stringify(styles, null, 1));
  console.log("styles:", Object.keys(styles).map(k => k + "=" + (styles[k] ? "ok" : "null")).join(" "));

  const html = await evalJs(`(() => { ${HELPERS}
    const p = findPanel(); return p ? p.outerHTML : "";
  })()`);
  fs.writeFileSync(path.join(OUT, "megamenu-panel.html"), html);
  console.log("panel html bytes:", html.length);

  cdp.close();
  console.log("DONE extract-megamenu");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
