import assert from "node:assert/strict";
import test from "node:test";

import { barHeightForOutputHeight, heightWarningSeverity, linearAxisControlsBarHeight, parseGuidedDimension, roundEditableMm } from "../app/dimension-editor.ts";

test("empty inline dimensions restore the previous safe preset", () => {
  assert.deepEqual(parseGuidedDimension("", 29.9, "width"), { action: "restore" });
  assert.deepEqual(parseGuidedDimension("   ", 21, "height"), { action: "restore" });
});

test("inline dimensions reject zero, negative, and malformed values", () => {
  for (const draft of ["0", "-1", "not a number"]) {
    const result = parseGuidedDimension(draft, 29.9, "width");
    assert.equal(result.action, "error");
  }
});

test("inline dimensions allow undersizing but identify it for a warning", () => {
  assert.deepEqual(parseGuidedDimension("1", 29.9, "width"), { action: "apply", value: 1, belowMinimum: true });
  assert.deepEqual(parseGuidedDimension("29.9", 29.9, "width"), { action: "apply", value: 29.9, belowMinimum: false });
  assert.deepEqual(parseGuidedDimension("30,5", 29.9, "width"), { action: "apply", value: 30.5, belowMinimum: false });
});

test("total-height editing preserves the non-bar portion of a linear symbol", () => {
  assert.equal(barHeightForOutputHeight(26.3, 22.85, 21), 17.55);
});

test("linear dimension editing follows the visible axis after rotation", () => {
  assert.equal(linearAxisControlsBarHeight("N", "height"), true);
  assert.equal(linearAxisControlsBarHeight("N", "width"), false);
  assert.equal(linearAxisControlsBarHeight("R", "width"), true);
  assert.equal(linearAxisControlsBarHeight("R", "height"), false);
});

test("bar-height warnings become critical only after severe truncation", () => {
  assert.equal(heightWarningSeverity(22.85, 22.85), null);
  assert.equal(heightWarningSeverity(18, 22.85), "caution");
  assert.equal(heightWarningSeverity(22.85 / 2, 22.85), "caution");
  assert.equal(heightWarningSeverity(11, 22.85), "critical");
});

test("editable millimetre values never expose floating-point noise", () => {
  assert.equal(roundEditableMm(12.257072310405643), 12.26);
  assert.equal(roundEditableMm(15.5), 15.5);
});
