import assert from "node:assert/strict";
import test from "node:test";
import { BARCODE_TYPES, GUIDANCE, renderBarcode, validateValue } from "../app/barcode.ts";
import { getBarcodeFacts } from "../app/barcode-facts.ts";

const factsFor = (kind, value) => getBarcodeFacts(kind, validateValue(kind, value).encoded);

test("all supported formats have distinct facts and primary source links", () => {
  const hooks = new Set();
  for (const type of BARCODE_TYPES) {
    const facts = getBarcodeFacts(type.id);
    hooks.add(facts.hook);
    assert.ok(facts.details.length >= 2, type.id);
    assert.ok(facts.sources.length, type.id);
    for (const source of facts.sources) assert.equal(new URL(source.url).protocol, "https:");
  }
  assert.equal(hooks.size, BARCODE_TYPES.length);
});

test("EAN-13 annotates the current allocation without inventing a manufacturer split", () => {
  for (const [prefix, organisation] of [["590", "Poland"], ["859", "Czechia"], ["400", "Germany"], ["440", "Germany"], ["690", "China"]]) {
    const input = `${prefix}123456789`;
    const facts = factsFor("ean13", input);
    assert.match(facts.insight.title, new RegExp(organisation));
    assert.deepEqual(facts.segments.map((segment) => segment.value), [prefix, "123456789", validateValue("ean13", input).checkDigit]);
    assert.match(facts.insight.text, /anywhere in the world/);
    assert.match(facts.details[1].text, /length varies/);
  }
});

test("publication, circulation, reserved and unknown prefixes stay distinct", () => {
  for (const [base, expected, prefixLength] of [
    ["200123456789", /Regional circulation/, 2],
    ["952123456789", /Demonstrations/, 3],
    ["978123456789", /Publication/, 3],
    ["979012345678", /music \(ISMN\)/, 4],
    ["000000012345", /Internal circulation/, 7],
    ["000009912345", /Unused allocation/, 7],
    ["000091234567", /GS1 US/, 5],
    ["000912345678", /GS1 US/, 4],
    ["050123456789", /Reserved/, 3],
    ["990123456789", /Coupons/, 2],
  ]) {
    const facts = factsFor("ean13", base);
    assert.match(facts.insight.title, expected, base);
    assert.equal(facts.segments[0].value.length, prefixLength);
    assert.equal(facts.segments.map((segment) => segment.value).join(""), validateValue("ean13", base).encoded);
  }
  const unknown = factsFor("ean13", "623123456789");
  assert.match(unknown.insight.text, /not in this app's short offline prefix list/);
  assert.equal(unknown.segments.length, 2);
  assert.ok(factsFor("ean13", "979012345678").sources.some((source) => source.url.includes("ismn-international.org")));
});

test("UPC allocation lookup adds the implicit zero, not a made-up country mapping", () => {
  const facts = factsFor("upca", "61414123456");
  assert.match(facts.insight.text, /prefix is 061: GS1 US/);
  assert.match(facts.insight.title, /0614141234561/);
  assert.equal(facts.segments.map((segment) => segment.value).join(""), "614141234561");
});

test("EAN-8 does not reuse the EAN-13 country lookup", () => {
  const facts = factsFor("ean8", "9638507");
  assert.equal(facts.insight, undefined);
  assert.equal(facts.segments[0].value, "9638507");
});

test("ITF-14 differentiates padding, grouping indicators and variable measure", () => {
  for (const [indicator, meaning] of [["0", /padded/], ["1", /Packaging indicator/], ["8", /Packaging indicator/], ["9", /Variable measure/]]) {
    const facts = factsFor("itf14", `${indicator}001234567890`);
    assert.match(facts.insight.title, meaning);
    assert.equal(facts.segments[0].value, indicator);
  }
});

test("invalid input has no inferred allocation or check-digit success", () => {
  for (const input of [undefined, "", "590", "5901234123458", "ABC5901234123", "0000000000001"]) {
    const facts = getBarcodeFacts("ean13", input);
    assert.equal(facts.segments, undefined);
    assert.equal(facts.insight, undefined);
    assert.equal(facts.checksum, undefined);
  }
  assert.match(factsFor("ean13", "590123412345").checksum, /83 \+ 7 = 90/);
  assert.match(factsFor("ean13", "000000000000").checksum, /0 \+ 0 = 0/);
});

test("QR-family version labels match the actual rendered module grids", () => {
  for (const kind of ["qr", "microqr", "rmqr", "datamatrix", "aztec"]) {
    const value = "12345";
    const rendered = renderBarcode({ kind, value, preset: "target", customX: GUIDANCE[kind].targetX, customHeight: 15, rotation: "N", includeText: true, errorCorrection: "M" });
    const facts = getBarcodeFacts(kind, value, rendered);
    if (kind === "qr") assert.match(facts.badge, /^V1 · 21 × 21$/);
    else if (kind === "microqr") assert.match(facts.badge, /^M2 · 13 × 13$/);
    else if (kind === "rmqr") assert.equal(facts.badge, rendered.symbolVersion);
    else assert.ok(facts.badge.includes(`${rendered.moduleColumns} × ${rendered.moduleRows}`));
  }
});
