// Extract pills rail + verify hover-switch between roots on snappshop mega menu
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
  await cdp.send("Page.enable");

  // open mega menu on first root
  const trig = await evalJs(`(() => {
    const el = [...document.querySelectorAll('a')].find(e => e.textContent && e.textContent.includes('همه دسته'));
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: trig.x, y: trig.y });
  await sleep(1200);

  // 1) rail container + pill markup (active vs inactive)
  const rail = await evalJs(`(() => {
    const rail = document.querySelector('[class*="all-categories__column"][class*="overflow-y-auto"]');
    if (!rail) return null;
    const pills = [...rail.children].map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { tag: el.tagName, text: (el.textContent||'').trim().slice(0,40), cls: el.getAttribute('class'),
               href: el.getAttribute && el.getAttribute('href'),
               w: Math.round(r.width), h: Math.round(r.height),
               color: cs.color, bg: cs.backgroundColor, border: cs.border, radius: cs.borderRadius,
               font: cs.fontSize + '/' + cs.fontWeight, margin: cs.margin, padding: cs.padding };
    });
    return { railCls: rail.getAttribute('class'), railStyle: rail.getAttribute('style'),
             railCS: (({display,width,height,padding,margin,background,boxShadow,gap}) => ({display,width,height,padding,margin,background,boxShadow,gap}))(getComputedStyle(rail)),
             pills };
  })()`);
  fs.writeFileSync(path.join(OUT, "megamenu-rail.json"), JSON.stringify(rail, null, 1));
  console.log("rail pills:", rail ? rail.pills.length : 0);

  // 2) hover second root (دیجیتال) and confirm switching
  const dig = rail && rail.pills.find(p => p.text === "دیجیتال");
  if (dig) {
    // need viewport coords: re-query the pill element
    const pt = await evalJs(`(() => {
      const rail = document.querySelector('[class*="all-categories__column"][class*="overflow-y-auto"]');
      const el = [...rail.children].find(e => e.textContent.trim() === 'دیجیتال');
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pt.x, y: pt.y });
    await sleep(900);
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, "megamenu-digital.png"), Buffer.from(shot.data, "base64"));
    const active = await evalJs(`(() => {
      const ls = [...document.querySelectorAll('[class*="left-side"]')].map(e => ({
        visible: e.getAttribute('class').includes('--visible'),
        cls: e.getAttribute('class'),
        first: e.textContent.trim().slice(0, 60),
        childCount: e.children.length,
        wrapperH: e.firstElementChild ? e.firstElementChild.getAttribute('style') : null,
      }));
      const rail = document.querySelector('[class*="all-categories__column"][class*="overflow-y-auto"]');
      const digPill = [...rail.children].find(e => e.textContent.trim() === 'دیجیتال');
      const cs = getComputedStyle(digPill);
      return { activeLeftSides: ls.filter(l => l.visible).length, leftSides: ls, digPill: { color: cs.color, bg: cs.backgroundColor, border: cs.border } };
    })()`);
    fs.writeFileSync(path.join(OUT, "megamenu-switch.json"), JSON.stringify(active, null, 1));
    console.log("switch evidence saved; visible panels:", active.activeLeftSides);
  }

  // 3) outer wrapper of whole menu
  const wrap = await evalJs(`(() => {
    const root = document.querySelector('[class*="AllCategories_all-categories__"][class*="py-l"], [class*="all-categories__4dziR"]')
      || [...document.querySelectorAll('div')].find(e => e.getAttribute('class') && e.getAttribute('class').includes('AllCategories_all-categories__4dziR'));
    if (!root) return null;
    const cs = getComputedStyle(root);
    return { cls: root.getAttribute('class'), style: root.getAttribute('style'),
      cs: { display: cs.display, position: cs.position, top: cs.top, right: cs.right, left: cs.left, width: cs.width,
            background: cs.backgroundColor, boxShadow: cs.boxShadow, padding: cs.padding, zIndex: cs.zIndex, inset: cs.inset },
      parentCls: root.parentElement.getAttribute('class'), html: root.outerHTML.slice(0, 500) };
  })()`);
  fs.writeFileSync(path.join(OUT, "megamenu-wrapper.json"), JSON.stringify(wrap, null, 1));
  console.log("wrapper:", wrap ? (wrap.cls || "").slice(0, 80) : "null");

  cdp.close();
  console.log("DONE rail-and-switch");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
