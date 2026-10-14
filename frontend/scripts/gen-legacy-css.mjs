#!/usr/bin/env node
/**
 * gen-legacy-css.mjs  —  zero-dependency generator (Node >= 18)
 *
 * Writes  src/app/legacy-compat.generated.css  : an ADDITIVE safety-net that is
 * wrapped in @supports guards, so modern browsers skip it completely.
 *
 *   (a) hex copies of every Tailwind v4 palette variable the source uses
 *       (v4 ships them as oklch(), unknown to Chrome<111 / Safari<15.4 / Firefox<113)
 *   (b) plain-direction gradients (v4 emits `in oklab`, unknown to Chrome<111 / Safari<16.2 / Firefox<127)
 *   (c) static rgba() copies of every  `bg-xxx/NN`-style class used in the source
 *       (v4 emits color-mix(), unknown to Chrome<111 / Safari<16.2 / Firefox<113)
 *
 * Run from the /frontend folder:   node scripts/gen-legacy-css.mjs
 * Options:  --theme <path>   (default: node_modules/tailwindcss/theme.css)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const OUT = path.join(SRC, "app", "legacy-compat.generated.css");
const argTheme = process.argv.includes("--theme") ? process.argv[process.argv.indexOf("--theme") + 1] : null;
const THEME = argTheme || path.join(ROOT, "node_modules", "tailwindcss", "theme.css");

// ---------------------------------------------------------------- colour maths
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [r, g, bl].map((v) => Math.round(clamp01(toSrgb(clamp01(v))) * 255));
}
const hex2 = (n) => n.toString(16).padStart(2, "0");
const rgbToHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
function parseColor(v) {
  v = v.trim();
  let m = v.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/i);
  if (m) return oklchToRgb(m[2] ? +m[1] / 100 : +m[1], +m[3], +m[4]);
  m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  return null; // not a static colour (hsl(var(..)), keywords, …)
}

// ---------------------------------------------------------------- read theme colours
const themeVars = new Map(); // "--color-amber-400" -> [r,g,b]
function readThemeCss(file) {
  if (!fs.existsSync(file)) return false;
  const css = fs.readFileSync(file, "utf8");
  for (const m of css.matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const rgb = parseColor(m[2]);
    if (rgb) themeVars.set(m[1], { rgb, oklch: /oklch/i.test(m[2]) });
  }
  return true;
}
if (!readThemeCss(THEME)) {
  console.error(`✗ Tailwind theme file not found: ${THEME}\n  Run "pnpm install" first, or pass --theme <path>.`);
  process.exit(1);
}
// project's own @theme colours (hex, so they are already safe — we only need their RGB for /NN)
const globals = fs.readFileSync(path.join(SRC, "app", "globals.css"), "utf8");
for (const m of globals.matchAll(/(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,6})\s*;/gi)) {
  themeVars.set(m[1], { rgb: parseColor(m[2]), oklch: false });
}
themeVars.set("--color-white", { rgb: [255, 255, 255], oklch: false });
themeVars.set("--color-black", { rgb: [0, 0, 0], oklch: false });

// ---------------------------------------------------------------- scan source
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?|mdx?)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(SRC);

const PROP = {
  bg: ["background-color"], text: ["color"], border: ["border-color"],
  "border-t": ["border-top-color"], "border-b": ["border-bottom-color"],
  "border-l": ["border-left-color"], "border-r": ["border-right-color"],
  "border-x": ["border-left-color", "border-right-color"],
  "border-y": ["border-top-color", "border-bottom-color"],
  from: ["--tw-gradient-from"], via: ["--tw-gradient-via"], to: ["--tw-gradient-to"],
  ring: ["--tw-ring-color"], shadow: ["--tw-shadow-color"],
  fill: ["fill"], stroke: ["stroke"], outline: ["outline-color"],
};
const PRE = Object.keys(PROP).sort((a, b) => b.length - a.length).join("|");
const VARIANTS = {
  hover: (s) => ({ sel: `${s}:hover`, media: "(hover:hover)", order: 1 }),
  focus: (s) => ({ sel: `${s}:focus`, order: 1 }),
  "focus-visible": (s) => ({ sel: `${s}:focus-visible`, order: 1 }),
  active: (s) => ({ sel: `${s}:active`, order: 2 }),
  sm: (s) => ({ sel: s, media: "(min-width:40rem)", order: 10 }),
  md: (s) => ({ sel: s, media: "(min-width:48rem)", order: 20 }),
  lg: (s) => ({ sel: s, media: "(min-width:64rem)", order: 30 }),
  xl: (s) => ({ sel: s, media: "(min-width:80rem)", order: 40 }),
};
// class token:  [variants:]prefix-colorname[-shade]/NN   or   prefix-[#hex]/NN
const TOKEN = new RegExp(
  String.raw`(?<![\w\-:/\[\]#.%!])((?:[a-z0-9\-]+:)*)(${PRE})-(?:([a-z]+(?:-\d{2,3})?)|\[(#[0-9a-fA-F]{3,6})\])\/(\d{1,3})(?![\w\-/])`, "g");
const GRAD_DIR = /(?<![\w\-:])bg-(?:gradient-to|linear-to)-(t|tr|r|br|b|bl|l|tl)(?![\w\-])/g;
const VARPRE = PRE + "|divide|placeholder|decoration|accent|caret|ring-offset|border-s|border-e";
// vars referenced from globals.css itself (e.g. the v4 border-colour compat shim)
const usedVars = new Set(["--color-gray-200"]), rules = new Map(), skipped = new Map(), dirs = new Set();
const unsupportedVariant = new Set();

for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(GRAD_DIR)) dirs.add(m[1]);
  // palette variables used anywhere (with or without /NN)
  for (const m of s.matchAll(new RegExp(String.raw`(?<![\w\-])(?:${VARPRE})-([a-z]+-\d{2,3})(?![\w\-])`, "g"))) usedVars.add(`--color-${m[1]}`);
  for (const m of s.matchAll(TOKEN)) {
    const [raw, variants, prefix, name, arbHex, alpha] = m;
    const vlist = variants ? variants.slice(0, -1).split(":") : [];
    if (vlist.some((v) => !VARIANTS[v])) { vlist.forEach((v) => !VARIANTS[v] && unsupportedVariant.add(v)); skipped.set(raw, f); continue; }
    if (vlist.length > 2) { skipped.set(raw, f); continue; }
    let rgb;
    if (arbHex) rgb = parseColor(arbHex);
    else { const t = themeVars.get(`--color-${name}`); rgb = t && t.rgb; if (t && t.oklch) usedVars.add(`--color-${name}`); }
    if (!rgb) { skipped.set(raw, f); continue; }
    const a = Math.min(100, +alpha) / 100;
    const value = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${+a.toFixed(3)})`;
    // build selector + wrappers
    let sel = "." + raw.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
    let media = [], order = 0;
    // the escaped class is the base; variants wrap it
    for (const v of vlist.slice().reverse()) {
      const r = VARIANTS[v](sel);
      sel = r.sel; if (r.media) media.push(r.media); order += r.order;
    }
    const decl = PROP[prefix].map((p) => `${p}:${value}`).join(";");
    rules.set(raw, { sel, media, order, decl });
  }
}

// ---------------------------------------------------------------- emit
const out = [];
out.push(`/* AUTO-GENERATED by scripts/gen-legacy-css.mjs — DO NOT EDIT BY HAND.
 * Safety-net for old engines. Every block is guarded by @supports, so
 * Chrome>=111 / Safari>=16.4 / Firefox>=128 never apply any of it.
 * Re-generate after adding new colour / gradient classes: node scripts/gen-legacy-css.mjs */`);

// (a) palette variables → hex
const palette = [...usedVars].filter((v) => themeVars.get(v)?.oklch).sort();
out.push(`\n/* (a) oklch() palette → hex  [needs: Chrome<111, Safari<15.4, Firefox<113] */`);
out.push(`@supports not (color: oklch(0% 0 0)) {\n  :root, :host {`);
for (const v of palette) out.push(`    ${v}: ${rgbToHex(themeVars.get(v).rgb)};`);
out.push(`  }\n}`);

// (b) gradient direction without "in oklab"
const DIR = { t: "to top", tr: "to top right", r: "to right", br: "to bottom right", b: "to bottom", bl: "to bottom left", l: "to left", tl: "to top left" };
out.push(`\n/* (b) gradient direction without "in oklab"  [needs: Chrome<111, Safari<16.2, Firefox<127] */`);
out.push(`@supports not (background-image: linear-gradient(in oklab, red, red)) {`);
for (const d of [...dirs].sort()) {
  out.push(`  .bg-gradient-to-${d}, .bg-linear-to-${d} { --tw-gradient-position: ${DIR[d]}; }`);
}
out.push(`}`);


// (d) plan-B presets for the promotion textures: plain linear-gradient + solid colour.
//     Add the class (e.g. "legacy-grad-timed") NEXT TO the existing Tailwind classes.
const PRESETS = {
  timed:       { dir: "to right",        stops: ["amber-400", "orange-500", "red-600"], solid: "orange-500" },
  gold:        { dir: "to right",        stops: ["amber-400", "orange-500"],            solid: "amber-400" },
  fire:        { dir: "to right",        stops: ["rose-500", "purple-700"],             solid: "rose-500" },
  lime:        { dir: "to right",        stops: ["lime-400", "green-500"],              solid: "lime-400" },
  blue:        { dir: "to right",        stops: ["blue-400", "indigo-500"],             solid: "blue-400" },
  amazing:     { dir: "to right",        stops: ["yellow-400", "red-600"],              solid: "orange-500" },
  "lime-orange": { dir: "to right",      stops: ["lime-500", "orange-400"],             solid: "lime-500" },
  section:     { dir: "to left",         stops: ["ekg-50@0.8", "white", "kala-50@0.6"], solid: "ekg-50" },
};
function stopCss(spec) {
  const [name, alpha] = spec.split("@");
  const t = themeVars.get(`--color-${name}`);
  if (!t) return null;
  return alpha ? `rgba(${t.rgb.join(",")},${alpha})` : rgbToHex(t.rgb);
}
out.push(`\n/* (d) plan-B presets — plain gradients with a solid fallback  [guard = same as (b)] */`);
out.push(`@supports not (background-image: linear-gradient(in oklab, red, red)) {`);
for (const [name, p] of Object.entries(PRESETS)) {
  const stops = p.stops.map(stopCss);
  const solid = stopCss(p.solid);
  if (stops.includes(null) || !solid) { console.log(`  ⚠ preset "${name}" skipped (colour missing in theme)`); continue; }
  out.push(`  .legacy-grad-${name} { background-color: ${solid}; background-image: linear-gradient(${p.dir}, ${stops.join(", ")}); }`);
}
out.push(`}`);

// (c) /NN opacity colours
const byMedia = new Map();
for (const r of rules.values()) {
  const key = r.media.length ? r.media.join(" and ") : "";
  if (!byMedia.has(key)) byMedia.set(key, []);
  byMedia.get(key).push(r);
}
const ordered = [...byMedia.entries()].sort((a, b) => (a[0] === "" ? -1 : b[0] === "" ? 1 : a[0].localeCompare(b[0])));
out.push(`\n/* (c) color-mix() opacity modifiers → rgba()  [needs: Chrome<111, Safari<16.2, Firefox<113] */`);
out.push(`@supports not (color: color-mix(in srgb, red 50%, transparent)) {`);
for (const [key, list] of ordered) {
  list.sort((a, b) => a.order - b.order || a.sel.localeCompare(b.sel));
  const body = list.map((r) => `${r.sel}{${r.decl}}`).join("\n");
  if (!key) out.push(body);
  else out.push(`@media ${key.split(" and ").map((m) => m).join(" and ")}{\n${body}\n}`);
}
out.push(`}\n`);

fs.writeFileSync(OUT, out.join("\n"));
console.log(`✓ wrote ${path.relative(ROOT, OUT)}`);
console.log(`  palette vars → hex : ${palette.length}`);
console.log(`  gradient directions: ${[...dirs].sort().join(", ") || "-"}`);
console.log(`  /NN classes        : ${rules.size}`);
if (unsupportedVariant.size) console.log(`  ⚠ variants not handled: ${[...unsupportedVariant].join(", ")}`);
if (skipped.size) {
  console.log(`  ⚠ skipped ${skipped.size} token(s) (unsupported variant / non-static colour) — review manually:`);
  for (const [t, f] of [...skipped].slice(0, 25)) console.log(`     ${t}   (${path.relative(ROOT, f)})`);
}
