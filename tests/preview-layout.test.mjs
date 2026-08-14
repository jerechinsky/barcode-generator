import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("preview reserves enough symmetric space for the complete bottom ruler badge", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const numberFrom = (pattern, label) => {
    const match = css.match(pattern);
    assert.ok(match, `missing ${label} measurement`);
    return Number(match[1]);
  };

  const topClearance = numberFrom(/--preview-ruler-top-clearance:\s*(\d+)px/, "preview top clearance");
  const clearance = numberFrom(/--preview-ruler-bottom-clearance:\s*(\d+)px/, "preview bottom ruler clearance");
  const guideBottom = numberFrom(/\.dimension-guide-x\s*\{[^}]*bottom:\s*-(\d+)px/, "horizontal guide bottom");
  const guideHeight = numberFrom(/\.dimension-guide-x\s*\{[^}]*height:\s*(\d+)px/, "horizontal guide height");
  const badgeTop = numberFrom(/\.dimension-guide-x \.dimension-total\s*\{[^}]*top:\s*(\d+)px/, "width badge top");
  const badgeFont = numberFrom(/\.dimension-guide \.dimension-total\s*\{[^}]*font-size:\s*(\d+)px/, "dimension badge font size");
  const badgePaddingY = numberFrom(/\.dimension-guide \.dimension-total\s*\{[^}]*padding:\s*(\d+)px/, "dimension badge vertical padding");
  const badgeBorders = 2;
  const guideTopBeyondArtwork = guideBottom - guideHeight;
  const requiredBottomSpace = guideTopBeyondArtwork + badgeTop + badgeFont + badgePaddingY * 2 + badgeBorders;

  assert.ok(
    clearance >= requiredBottomSpace,
    `preview reserves ${clearance}px but the bottom ruler badge reaches ${requiredBottomSpace}px`,
  );
  assert.ok(topClearance < clearance, "top clearance should be smaller because the width badge occupies the bottom clearance");
  assert.match(css, /padding:\s*var\(--preview-ruler-top-clearance\) 46px var\(--preview-ruler-bottom-clearance\)/);
  assert.match(css, /padding:\s*var\(--preview-ruler-top-clearance\) 32px var\(--preview-ruler-bottom-clearance\)/);
  assert.match(css, /padding:\s*var\(--preview-ruler-top-clearance\) 24px var\(--preview-ruler-bottom-clearance\)/);
});

test("bar-height input is absent until the limit is enabled", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const studio = await readFile(new URL("../app/BarcodeStudio.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(css, /\.height-limit-placeholder/);
  assert.doesNotMatch(css, /\.height-limit-field\.inactive/);
  assert.match(studio, /\{limitHeight && \(\s*<label className="height-limit-field">/);
  assert.doesNotMatch(studio, /Current bar height|from the selected preset/);
});

test("both ruler tick sets point inward toward the artwork", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.dimension-guide-x \.ruler-tick\s*\{[^}]*top:\s*-5px;[^}]*height:\s*5px;/);
  assert.match(css, /\.dimension-guide-x \.ruler-tick\.major\s*\{[^}]*top:\s*-9px;[^}]*height:\s*9px;/);
  assert.match(css, /\.dimension-guide-x \.ruler-tick b\s*\{[^}]*top:\s*calc\(100% \+ 11px\);/);
  assert.match(css, /\.dimension-guide-y \.ruler-tick\s*\{[^}]*left:\s*-1px;[^}]*width:\s*5px;/);
});

test("horizontal and vertical ruler baselines have equal clearance from the artwork", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const numberFrom = (pattern, label) => {
    const match = css.match(pattern);
    assert.ok(match, `missing ${label} measurement`);
    return Number(match[1]);
  };

  const horizontalBottom = numberFrom(/\.dimension-guide-x\s*\{[^}]*bottom:\s*-(\d+)px/, "horizontal guide bottom");
  const horizontalHeight = numberFrom(/\.dimension-guide-x\s*\{[^}]*height:\s*(\d+)px/, "horizontal guide height");
  const verticalLeft = numberFrom(/\.dimension-guide-y\s*\{[^}]*left:\s*-(\d+)px/, "vertical guide left");

  assert.equal(horizontalBottom - horizontalHeight, verticalLeft);
});

test("mobile layout keeps the headline within the screen width", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /@media \(max-width:\s*580px\)[\s\S]*?\.app-shell\s*\{\s*padding:\s*0 8px 18px;/);
  assert.match(css, /@media \(max-width:\s*580px\)[\s\S]*?\.hero h1\s*\{[^}]*font-size:\s*clamp\(40px, 12\.5vw, 52px\);/);
});

test("the preview scale note uses desktop whitespace and returns to normal flow on phones", async () => {
  const [css, studio] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/BarcodeStudio.tsx", import.meta.url), "utf8"),
  ]);

  const noteIndex = studio.indexOf('<p className="preview-scale-note">');
  const artboardIndex = studio.indexOf('<div className="artboard">');
  assert.ok(noteIndex > -1 && noteIndex < artboardIndex, "scale note should remain a sibling before the artboard");
  assert.match(css, /\.preview-scale-note\s*\{[^}]*position:\s*absolute;[^}]*top:\s*10px;[^}]*right:\s*14px;[^}]*left:\s*14px;/);
  assert.match(css, /@media \(max-width:\s*580px\)[\s\S]*?\.preview-scale-note\s*\{[^}]*position:\s*static;[^}]*margin:\s*0 0 10px;[^}]*border-left:\s*3px solid var\(--acid\);/);
});
