import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

function workerHarness() {
  const listeners = new Map();
  const stores = new Map();
  let networkStatus = 200;
  let networkCalls = 0;
  const key = (request) => new URL(typeof request === "string" ? request : request.url, "https://barcode.test").href;
  const fetch = async (request) => {
    networkCalls++;
    if (!networkStatus) throw new Error("Offline");
    return new Response(`network:${key(request)}`, { status: networkStatus });
  };
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(urls) { for (const url of urls) store.set(key(url), await fetch(url)); },
        async put(request, response) { store.set(key(request), response.clone()); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(request) {
      for (const store of stores.values()) {
        const response = store.get(key(request));
        if (response) return response.clone();
      }
    },
  };
  vm.runInNewContext(source.replace("const BUILD_ASSETS = [];", 'const BUILD_ASSETS = ["/assets/app-123.js", "/assets/app-123.css"];'), {
    self: { location: { origin: "https://barcode.test" }, addEventListener: (type, fn) => listeners.set(type, fn), skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches, fetch, URL, Response,
  });
  return {
    caches,
    setNetwork: (status) => { networkStatus = status; },
    calls: () => networkCalls,
    async lifecycle(type) { let completion; listeners.get(type)({ waitUntil(promise) { completion = promise; } }); await completion; },
    request(path, mode = "navigate", destination = "document") {
      let response;
      listeners.get("fetch")({ request: { method: "GET", url: key(path), mode, destination }, respondWith(promise) { response = promise; } });
      return response;
    },
  };
}

test("a first installation includes the scripts needed for an offline deep link", async () => {
  const worker = workerHarness();
  await worker.lifecycle("install");
  worker.setNetwork(0);
  assert.equal((await worker.request("/?type=rmqr")).status, 200);
  const calls = worker.calls();
  assert.equal((await worker.request("/assets/app-123.js", "cors", "script")).status, 200);
  assert.equal((await worker.request("/assets/app-123.css", "cors", "style")).status, 200);
  assert.equal(worker.calls(), calls, "cached assets must not start an unhandled offline fetch");
});

test("failed navigation cannot replace the working offline page with an error", async () => {
  const worker = workerHarness();
  await worker.lifecycle("install");
  worker.setNetwork(503);
  assert.equal((await worker.request("/")).status, 200);
  worker.setNetwork(0);
  assert.equal((await worker.request("/")).status, 200);
});

test("activation removes only this application's obsolete caches", async () => {
  const worker = workerHarness();
  await worker.caches.open("other-application");
  await worker.caches.open("barcode-generator-pwa-v2");
  await worker.lifecycle("install");
  await worker.lifecycle("activate");
  assert.deepEqual(await worker.caches.keys(), ["other-application", "barcode-generator-pwa-v3"]);
});

test("production offline manifest includes every built script and its build version", async () => {
  const worker = await readFile(new URL("../dist/client/sw.js", import.meta.url), "utf8");
  const { version } = JSON.parse(await readFile(new URL("../dist/client/version.json", import.meta.url), "utf8"));
  assert.ok(worker.includes(`barcode-generator-pwa-${version}`));
  const assets = JSON.parse(worker.match(/const BUILD_ASSETS = (\[[^;]+\]);/)[1]);
  assert.ok(assets.some((asset) => asset.endsWith(".js")));
  assert.ok(assets.some((asset) => asset.endsWith(".css")));
  assert.ok(assets.some((asset) => asset.endsWith(".woff2")));
  for (const asset of assets) await readFile(new URL(`../dist/client${asset}`, import.meta.url));
});
