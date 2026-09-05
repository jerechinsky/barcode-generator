import assert from "node:assert/strict";
import test from "node:test";
import { BARCODE_TYPES, GUIDANCE, renderBarcode, scaleLinearBarcode, validateValue } from "../app/barcode.ts";
import { pngExportError } from "../app/png.ts";
import { buildRulerScale } from "../app/ruler.ts";
import { readStoredValue, writeStoredValue, removeStoredValue } from "../app/browser-storage.ts";

const inputFor = (type) => ({
  kind: type.id, value: type.example, preset: "target",
  customX: GUIDANCE[type.id].targetX, customHeight: GUIDANCE[type.id].targetHeight ?? 15,
  rotation: "N", includeText: true, errorCorrection: "M",
});

test("linked resizing preserves both visible dimensions of every linear format in either rotation", () => {
  for (const type of BARCODE_TYPES.filter((type) => type.linear)) {
    for (const rotation of ["N", "R"]) {
      for (const includeText of [true, false]) {
        const input = { ...inputFor(type), rotation, includeText };
        const current = renderBarcode(input);
        for (const factor of [0.6, 1.05]) {
          const resized = scaleLinearBarcode(input, factor);
          assert.ok(Math.abs(resized.widthMm - current.widthMm * factor) < 0.08, `${type.id} ${rotation} width`);
          assert.ok(Math.abs(resized.heightMm - current.heightMm * factor) < 0.08, `${type.id} ${rotation} height`);
        }
      }
    }
  }
});

test("unreachable total widths fail instead of exporting a different size", () => {
  const input = { ...inputFor(BARCODE_TYPES.find((type) => type.id === "ean13")), preset: "custom" };
  for (const targetWidth of [0.01, 1000]) {
    assert.throws(() => renderBarcode({ ...input, targetWidth }), /outside the renderer's range/);
  }
});

test("invalid bar heights and extreme matrix sizes fail before export", () => {
  const linear = inputFor(BARCODE_TYPES.find((type) => type.id === "ean13"));
  for (const barHeightOverride of [0, -1, NaN, Infinity]) {
    assert.throws(() => renderBarcode({ ...linear, barHeightOverride }), /Bar height must be greater/);
  }
  assert.throws(() => renderBarcode({ ...inputFor(BARCODE_TYPES[0]), preset: "custom", targetWidth: 1e12 }), /must not exceed/);
  assert.match(validateValue("qr", "a".repeat(8193)).error, /too long/);
});

test("Code 128 keeps at least 10X of blank space on each side", () => {
  for (const customX of [0.15, 0.264, 0.33, 0.495]) {
    const output = renderBarcode({ ...inputFor(BARCODE_TYPES.find((type) => type.id === "code128")), preset: "custom", customX, includeText: false });
    const viewWidth = Number(output.svg.match(/viewBox="0 0 ([\d.]+)/)[1]);
    let firstBar = Infinity;
    let lastBar = 0;
    for (const path of output.svg.matchAll(/<path stroke="[^"]+" stroke-width="([\d.]+)" d="([^"]+)"/g)) {
      for (const point of path[2].matchAll(/M([\d.]+) /g)) {
        firstBar = Math.min(firstBar, Number(point[1]) - Number(path[1]) / 2);
        lastBar = Math.max(lastBar, Number(point[1]) + Number(path[1]) / 2);
      }
    }
    assert.ok(firstBar / 28.35 >= customX * 10, `left at ${customX}`);
    assert.ok((viewWidth - lastBar) / 28.35 >= customX * 10, `right at ${customX}`);
  }
});

test("PNG export rejects unsafe canvas allocations while allowing normal print sizes", () => {
  assert.equal(pngExportError(1770, 1243), null);
  for (const dimensions of [[0, 1], [Infinity, 10], [1.5, 10], [9000, 100], [5000, 5000]]) {
    assert.ok(pngExportError(...dimensions));
  }
});

test("rulers keep bounded work for large physical sizes", () => {
  assert.ok(buildRulerScale(1e12, 1e12).ticks.length <= 202);
});

test("blocked or full browser storage never throws, and normal drafts still round-trip", () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {
      get localStorage() { throw new Error("Storage blocked"); },
    } });
    assert.equal(readStoredValue("draft"), null);
    assert.equal(writeStoredValue("draft", "text"), false);
    assert.doesNotThrow(() => removeStoredValue("draft"));
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
      setItem() { throw new Error("Quota exceeded"); },
    } } });
    assert.equal(writeStoredValue("draft", "text"), false);
    const saved = new Map();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
      removeItem: (key) => saved.delete(key),
    } } });
    assert.equal(writeStoredValue("draft", "exact text"), true);
    assert.equal(readStoredValue("draft"), "exact text");
    removeStoredValue("draft");
    assert.equal(readStoredValue("draft"), null);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else delete globalThis.window;
  }
});
