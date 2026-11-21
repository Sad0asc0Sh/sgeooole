// Lightweight mock of ekgkala-backend for visual verification of the categories UI.
// Serves /api/categories/tree built from the REA-captured snappshop megamenu JSON,
// plus colored SVG placeholder media for every node.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const CAPTURED = "D:/project/sgeooole/_re/snappshop-capture/api-megamenu-v2.json";
const PORT = 5000;

const raw = JSON.parse(fs.readFileSync(CAPTURED, "utf8"));
const roots = raw.data.items;

const PALETTE = ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#f87171", "#facc15", "#4ade80", "#22d3ee", "#fb923c", "#e879f9", "#93c5fd", "#fca5a5"];

let seq = 0;
function dataUri(color, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="20" fill="${color}" opacity="0.85"/><text x="80" y="90" font-size="30" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function toCategory(snapp, depth) {
  const id = `mock-${++seq}`;
  const slug = (snapp.href || "/x").split("/").filter(Boolean).slice(0, 3).join("-") || id;
  const color = PALETTE[seq % PALETTE.length];
  const label = snapp.title.slice(0, 6).replace(/[<>&"]/g, "");
  const media = dataUri(color, label);
  return {
    _id: id,
    name: snapp.title,
    slug,
    parent: null,
    icon: { url: media, cardUrl: media, public_id: id, width: 160, height: 160 },
    image: { url: media, cardUrl: media, public_id: id, width: 320, height: 320 },
    showOnHomepage: depth === 0,
    homepageOrder: seq,
    order: seq,
    isActive: true,
    children: (snapp.items || []).slice(0, 12).map((child) => toCategory(child, depth + 1)),
  };
}

const tree = roots.map((root) => toCategory(root, 0));
console.log(`mock tree: ${tree.length} roots, ${tree.reduce((a, r) => a + (r.children || []).length, 0)} groups (images = data URIs)`);

function svgFor(query) {
  const params = new URLSearchParams(query);
  const color = params.get("c") || "#ccc";
  const text = params.get("t") || "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="20" fill="${color}" opacity="0.85"/><text x="80" y="90" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif">${text}</text></svg>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (url.pathname === "/api/categories/tree") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ success: true, data: tree, count: tree.length }));
    return;
  }
  if (url.pathname.startsWith("/media/")) {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.end(svgFor(url.search));
    return;
  }
  res.statusCode = 404;
  res.end("{}");
});

server.listen(PORT, () => console.log(`mock backend on http://localhost:${PORT}`));
