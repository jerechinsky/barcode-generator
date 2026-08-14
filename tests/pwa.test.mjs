import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("ships an installable mobile PWA with platform-aware guidance", async () => {
  const [layout, studio, stylesheet, manifestSource, serviceWorker] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/BarcodeStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);

  assert.match(layout, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(layout, /apple-mobile-web-app-capable/);
  assert.match(studio, /beforeinstallprompt/);
  assert.match(studio, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(studio, /Install as PWA/);
  assert.match(studio, /Tap Share, choose Add to Home Screen/);
  assert.match(stylesheet, /@media \(max-width: 880px\) and \(pointer: coarse\)/);
  assert.match(stylesheet, /@media \(display-mode: standalone\)/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.deepEqual(manifest.icons.map(({ sizes }) => sizes), ["192x192", "512x512"]);
  assert.match(serviceWorker, /self\.addEventListener\("install"/);
  assert.match(serviceWorker, /self\.addEventListener\("fetch"/);

  await Promise.all([
    access(new URL("../public/pwa-icon-192.png", import.meta.url)),
    access(new URL("../public/pwa-icon-512.png", import.meta.url)),
  ]);
});
