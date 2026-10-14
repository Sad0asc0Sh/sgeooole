#!/usr/bin/env node
/**
 * audit-legacy-css.mjs — read-only check of the PRODUCTION css (run after `next build`)
 * Usage (from /frontend):  node scripts/audit-legacy-css.mjs
 * Exit code 1 if the safety-net is missing from the build output.
 */
import fs from "node:fs";
import path from "node:path";

const roots = [".next/static/css", ".next/static/chunks"].map((p) => path.join(process.cwd(), p));
const files = [];
(function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (p.endsWith(".css")) files.push(p);
  }
})(roots[0]); walk2(roots[1]);
function walk2(d) { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk2(p); else if (p.endsWith(".css") && !files.includes(p)) files.push(p); } }

if (!files.length) { console.error("✗ no CSS found — run `pnpm build` first."); process.exit(2); }
const css = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
// the safety-net's own @supports conditions must not be counted as "problems"
const cssNoGuards = css.replace(/@supports not \([^{]*\{/g, "{");
const count = (re) => (cssNoGuards.match(re) || []).length;

const checks = [
  ["oklch(            (palette colours)", /oklch\(/g, "needs (a)"],
  ["color-mix(        (/NN opacity)", /color-mix\(/g, "needs (c)"],
  ["in oklab          (gradients)", /in oklab/g, "needs (b)"],
  ["@property         (Safari<16.4 / FF<128, Tailwind polyfills)", /@property/g, "info"],
  ["@layer            (Chrome<99 / Safari<15.4 / FF<97 drop ALL css)", /@layer/g, "info"],
];
console.log(`CSS files: ${files.length}, ${(css.length / 1024).toFixed(0)} KB\n`);
for (const [label, re, note] of checks) console.log(`${String(count(re)).padStart(6)}  ${label}   ${note}`);

const m = css.match(/\.bg-gradient-to-r\{[^}]*\}(?:@supports[^{]*\{[^}]*\})?/);
console.log("\nHow Tailwind emitted .bg-gradient-to-r in YOUR build:\n  " + (m ? m[0].slice(0, 300) : "(class not found)"));

const okA = /@supports not \(color: ?oklch\(0% 0 0\)\)/.test(css);
const okB = /@supports not \(background-image: ?linear-gradient\(in oklab, ?red, ?red\)\)/.test(css);
const okC = /@supports not \(color: ?color-mix\(in srgb, ?red 50%, ?transparent\)\)/.test(css);
const okD = /\.legacy-grad-timed/.test(css);
console.log("\nSafety-net present in build:");
console.log(`  (a) palette→hex ${okA ? "✓" : "✗"}   (b) gradient direction ${okB ? "✓" : "✗"}   (c) /NN→rgba ${okC ? "✓" : "✗"}   (d) legacy-grad-* ${okD ? "✓" : "✗"}`);
if (!(okA && okB && okC && okD)) { console.error("\n✗ safety-net missing — import it in layout.tsx and rebuild (see guide, step 4)."); process.exit(1); }
console.log("\n✓ OK");
