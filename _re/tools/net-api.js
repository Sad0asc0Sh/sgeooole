// Record network while reloading snappshop.ir, find category APIs, save JSON bodies
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
  await cdp.send("Network.enable");
  const requests = [];
  cdp.on((msg) => {
    if (msg.method === "Network.requestWillBeSent") {
      const r = msg.params.request;
      requests.push({ url: r.url, method: r.method, type: msg.params.type, initiator: (msg.params.initiator || {}).type });
    }
  });

  await cdp.send("Page.navigate", { url: "https://snappshop.ir/" });
  await sleep(9000);

  fs.writeFileSync(path.join(OUT, "network-requests.json"), JSON.stringify(requests, null, 1));
  const api = requests.filter(r => /apix\.|\/api\/|graphql|category/i.test(r.url));
  console.log("total requests:", requests.length, "| api-ish:", api.length);
  api.slice(0, 40).forEach(r => console.log(" ", r.method, r.url.slice(0, 140)));

  // try fetching the most likely category endpoints with page credentials
  const candidates = api
    .map(r => r.url)
    .filter(u => /categor/i.test(u));
  const saved = [];
  for (const u of candidates.slice(0, 3)) {
    try {
      const body = await evalJs(`(async () => { const r = await fetch(${JSON.stringify(u)}, {credentials:'include'}); const t = await r.text(); return t.slice(0, 3000000); })()`);
      const file = path.join(OUT, "api-" + Buffer.from(u).toString("base64url").slice(0, 40) + ".json");
      fs.writeFileSync(file, body);
      saved.push({ url: u, file, bytes: body.length });
    } catch (e) { saved.push({ url: u, err: e.message.slice(0, 100) }); }
  }
  console.log("saved:", JSON.stringify(saved, null, 1));

  cdp.close();
  console.log("DONE net-api");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
