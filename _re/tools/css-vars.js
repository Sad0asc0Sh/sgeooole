// Extract :root design tokens + utility class definitions from snappshop main CSS bundle
"use strict";
const fs = require("fs");
const path = require("path");
const { findPageTarget, Cdp } = require("./cdp-lib");

const OUT = "D:/project/sgeooole/_re/snappshop-capture";

const WANT_VARS = ["--spacing", "--primary", "--gray", "--border-radius", "--animation", "--duration", "--font", "--text", "--body", "--caption", "--title", "--subtitle", "--secondary-color", "--accent"];

(async () => {
  const target = await findPageTarget();
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  const evalJs = async (expression) => {
    const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("eval: " + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || "").slice(0, 300));
    return r.result.value;
  };

  // computed variable values straight from the live page (ground truth)
  const vars = await evalJs(`(() => {
    const cs = getComputedStyle(document.documentElement);
    const out = {};
    for (const name of ['--primary-color','--primary-light-color','--secondary-color','--accent-color',
      '--spacing-xxs','--spacing-xs','--spacing-s','--spacing-m','--spacing-l','--spacing-xl','--spacing-xxl',
      '--border-radius-sm','--border-radius-m','--border-radius-lg','--border-radius-xl',
      '--animation-s','--animation-m','--animation-l','--duration-short','--duration-medium','--duration-long',
      '--font-family','--text-caption-size','--text-caption-line','--text-body-2-size','--text-body-2-line',
      '--text-body-1-size','--text-title-size','--font-weight-bold','--font-weight-medium','--font-weight-regular']) {
      out[name] = cs.getPropertyValue(name).trim();
    }
    // utility classes
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const classes = ['caption','body-2','body-1','text-bold','text-gray-900','text-gray-700','text-gray-500',
      'link-gray-700','border-gray-300','bg-primary-light','hover\\\\:bg-primary-light','px-s','py-s','py-l','mb-m','mb-s','overflow-y-auto','d-flex','align-items-center'];
    const util = {};
    for (const c of classes) { try { probe.className = c; util[c] = { fontSize: getComputedStyle(probe).fontSize === '16px' ? undefined : getComputedStyle(probe).fontSize, fontWeight: getComputedStyle(probe).fontWeight === '400' ? undefined : getComputedStyle(probe).fontWeight, lineHeight: getComputedStyle(probe).lineHeight === 'normal' ? undefined : getComputedStyle(probe).lineHeight, color: getComputedStyle(probe).color === 'rgb(0, 0, 0)' ? undefined : getComputedStyle(probe).color, background: getComputedStyle(probe).backgroundColor === 'rgba(0, 0, 0, 0)' ? undefined : getComputedStyle(probe).backgroundColor, padding: getComputedStyle(probe).padding === '0px' ? undefined : getComputedStyle(probe).padding, margin: getComputedStyle(probe).margin === '0px' ? undefined : getComputedStyle(probe).margin, borderRadius: getComputedStyle(probe).borderRadius === '0px' ? undefined : getComputedStyle(probe).borderRadius, border: getComputedStyle(probe).borderTopWidth !== '0px' ? getComputedStyle(probe).borderTop : undefined }; } catch(e) {} }
    probe.remove();
    return { vars: out, util };
  })()`);
  fs.writeFileSync(path.join(OUT, "design-tokens.json"), JSON.stringify(vars, null, 1));
  console.log("vars:", JSON.stringify(vars.vars, null, 0));

  // gray scale + fonts from the big bundle
  const bundle = await evalJs(`(async () => {
    const links = [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href);
    let best = null;
    for (const h of links) {
      const t = await (await fetch(h)).text();
      if (t.length > (best ? best.len : 20000)) best = { href: h, len: t.length, text: t };
    }
    if (!best) return null;
    const t = best.text;
    const pick = (re) => { const m = t.match(re); return m ? m[0] : null; };
    return {
      href: best.href, len: best.len,
      rootVars: (t.match(/:root\\s*\\{[^}]*\\}/g) || []).slice(0, 2),
      grays: (t.match(/--gray-\\d+:[^;]+;/g) || []).slice(0, 30),
      caption: pick(/\\.caption\\s*\\{[^}]*\\}/),
      body2: pick(/\\.body-2\\s*\\{[^}]*\\}/),
      body1: pick(/\\.body-1\\s*\\{[^}]*\\}/),
      textBold: pick(/\\.text-bold\\s*\\{[^}]*\\}/),
      fontFace: (t.match(/@font-face\\s*\\{[^}]*\\}/g) || []).slice(0, 4),
      fontFamilyBase: pick(/--font-family[^;]+;/),
    };
  })()`);
  fs.writeFileSync(path.join(OUT, "bundle-tokens.json"), JSON.stringify(bundle, null, 1));
  console.log("bundle:", bundle ? (bundle.href || "").split("/").pop() + " len " + bundle.len : "null");
  console.log("grays:", bundle ? JSON.stringify(bundle.grays) : "-");
  console.log("fontFace count:", bundle ? bundle.fontFace.length : 0);

  cdp.close();
  console.log("DONE css-vars");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
