import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const PORT = 31991;

async function waitForService() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/summary`);
      if (response.ok) return;
    } catch {
      // The service may still be opening its local socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error("Analytics service did not start");
}

test("stores only anonymous visit and barcode-format analytics", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeform-analytics-test-"));
  const child = spawn("python3", ["analytics/server.py"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      CODEFORM_ANALYTICS_DATABASE: join(directory, "analytics.sqlite3"),
      CODEFORM_ANALYTICS_PORT: String(PORT),
    },
    stdio: "ignore",
  });

  try {
    await waitForService();
    const visit = await fetch(`http://127.0.0.1:${PORT}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "visit", barcodeKind: null, country: "CZ" }),
    });
    assert.equal(visit.status, 204);

    const generation = await fetch(`http://127.0.0.1:${PORT}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "generation",
        barcodeKind: "qr",
        country: "DE",
        value: "must not be stored",
      }),
    });
    assert.equal(generation.status, 204);

    const invalid = await fetch(`http://127.0.0.1:${PORT}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "generation", barcodeKind: "raw-secret", country: "US" }),
    });
    assert.equal(invalid.status, 400);

    const summary = await fetch(`http://127.0.0.1:${PORT}/summary`).then((response) => response.json());
    assert.deepEqual(summary.totals, { visits: 1, generations: 1 });
    assert.deepEqual(summary.formats, [{ barcodeKind: "qr", count: 1 }]);
    assert.equal(summary.visits[0].country, "CZ");

    const databaseBytes = await readFile(join(directory, "analytics.sqlite3"));
    assert.equal(databaseBytes.includes(Buffer.from("must not be stored")), false);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test("the public generator has no analytics navigation", async () => {
  const studio = await readFile(new URL("../app/BarcodeStudio.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(studio, /href=["']\/owner\/analytics/);
  assert.match(studio, /recordAnalyticsEvent\("visit"\)/);
  assert.match(studio, /recordAnalyticsEvent\("generation", kind\)/);
  assert.match(studio, /intendedKindsRef\.current\.has\(kind\)/);
});
