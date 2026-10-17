#!/usr/bin/env node
/**
 * audit-live-assets.mjs — post-deploy check of the LIVE site's static assets.
 *
 * Why this exists (2026-10 unstyled-homepage incident): the homepage HTML
 * kept serving 200 from the ISR cache while the origin answered its main
 * /_next/static/*.css bundle with plain-text 500s — and one chunk as a
 * 1-byte empty 200. Every affected visitor saw raw unstyled HTML. Nothing
 * in the deploy flow noticed, because the pages themselves "were up".
 *
 * This script closes that gap: it fetches real pages, extracts every
 * /_next/static asset they reference, and requests each asset 3 times.
 * An asset FAILS if any attempt returns a non-200 status or a body of
 * < 2 bytes (the empty-chunk signature). Intermittent failures count as
 * failures — a stylesheet that only sometimes loads is still broken.
 *
 * Usage (from /frontend, after every deploy):
 *   node scripts/audit-live-assets.mjs [baseUrl] [path ...]
 *   pnpm audit:live
 *   pnpm audit:live https://www.ekgkala.ir / /products /cart
 *
 * Exit code 0 = every referenced asset served correctly on every try.
 * Zero dependencies; requires Node >= 18 (global fetch).
 */

const base = (process.argv[2] && process.argv[2].startsWith("http"))
  ? process.argv[2].replace(/\/$/, "")
  : "https://www.ekgkala.ir";
const paths = process.argv.slice(3).filter((a) => a.startsWith("/"));
const pagePaths = paths.length ? paths : ["/", "/products"];
const TRIES = 3;

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  return { status: res.status, body: await res.text() };
}

async function probe(url) {
  const attempts = [];
  for (let i = 0; i < TRIES; i++) {
    try {
      const { status, body } = await fetchText(url);
      attempts.push({ status, bytes: Buffer.byteLength(body) });
    } catch (err) {
      attempts.push({ status: 0, bytes: 0, error: String(err && err.message || err) });
    }
  }
  return attempts;
}

const ok = (a) => a.status === 200 && a.bytes >= 2;

let failures = 0;
const assets = new Map(); // url -> Set of pages referencing it

for (const p of pagePaths) {
  const pageUrl = base + p;
  let page;
  try {
    page = await fetchText(pageUrl);
  } catch (err) {
    console.error(`✗ page ${pageUrl} unreachable: ${err && err.message || err}`);
    process.exit(1);
  }
  if (page.status !== 200) {
    console.error(`✗ page ${pageUrl} -> HTTP ${page.status}`);
    failures++;
    continue;
  }
  const refs = page.body.match(/\/_next\/static\/[A-Za-z0-9_.\/-]+\.(?:css|js)/g) || [];
  for (const ref of new Set(refs)) {
    const url = base + ref;
    if (!assets.has(url)) assets.set(url, new Set());
    assets.get(url).add(p);
  }
  console.log(`page ${p}: HTTP 200, ${new Set(refs).size} static assets referenced`);
}

if (!assets.size) {
  console.error("✗ no /_next/static assets found in any page — build or extraction is broken.");
  process.exit(1);
}

console.log(`\nprobing ${assets.size} assets x${TRIES} tries ...`);
for (const [url, from] of assets) {
  const attempts = await probe(url);
  const bad = attempts.filter((a) => !ok(a));
  if (bad.length) {
    failures++;
    console.error(`✗ ${url}  (from: ${[...from].join(", ")})`);
    attempts.forEach((a, i) =>
      console.error(`    try ${i + 1}: HTTP ${a.status || "ERR"}, ${a.bytes} bytes${a.error ? " — " + a.error : ""}`));
  }
}

if (failures) {
  console.error(`\n✗ ${failures} problem(s): the deployed static bundle is NOT serving cleanly.`);
  console.error("  Do not leave this deploy live: rebuild cleanly (rm -rf .next && pnpm build),");
  console.error("  restart the frontend process once, check `df -h` for a full disk, then re-run this audit.");
  process.exit(1);
}
console.log(`\n✓ all ${assets.size} static assets served 200 with content on every try.`);
