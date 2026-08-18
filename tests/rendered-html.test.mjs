import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the complete Barcode Generator workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Barcode Generator · Print-ready barcode maker<\/title>/i);
  assert.match(html, /Print-ready/);
  assert.match(html, /barcodes\./);
  assert.match(html, /class="product-category">Print-ready barcode maker/);
  assert.match(html, /favicon\.svg\?v=barcode-generator1/);
  assert.match(html, /favicon\.ico\?v=barcode-generator1/);
  assert.match(html, /apple-touch-icon\.png\?v=barcode-generator1/);
  assert.ok(html.indexOf('class="brand hero-brand"') < html.indexOf("<h1>Print-ready"));
  assert.doesNotMatch(html, /Private by design/);
  assert.match(html, /GS1-aware/);
  assert.doesNotMatch(html, /Artwork fit check/);
  assert.match(html, /EAN-13/);
  assert.match(html, /ITF-14/);
  assert.match(html, /Data Matrix/);
  assert.match(html, /rMQR/);
  assert.match(html, /Aztec/);
  assert.match(html, /PDF417/);
  assert.match(html, /Matrix/);
  assert.match(html, /Stacked/);
  assert.match(html, /Linear/);
  assert.doesNotMatch(html, /store data in cells across rows and columns/);
  assert.match(html, /Download PNG/);
  assert.match(html, /Copy PNG/);
  assert.match(html, /PNG resolution \(DPI\)/);
  assert.match(html, /Copy SVG/);
  assert.match(html, /dimension-guide-x/);
  assert.match(html, /dimension-guide-y/);
  assert.match(html, /\* Preview always scaled to fit\. The white rectangle is the complete export/);
  assert.match(html, /Why the extra digit/);
  assert.match(html, /weighted 3, 1, 3, 1/);
  assert.match(html, /Which size should I use/);
  assert.match(html, /QR, Micro QR, rMQR, or iQR/);
  assert.match(html, /No DENSO fee/);
  assert.match(html, /registered trademark of DENSO WAVE INCORPORATED/);
  assert.match(html, /Vibe coded with ❤️ by Alex in Prague 🇨🇿/);
  assert.match(html, /Everything is generated in your browser\./);
  assert.match(html, /https:\/\/github\.com\/jerechinsky\/barcode-generator/);
  assert.match(html, /Reset examples/);
  assert.doesNotMatch(html, /FC minimum|Fulfillment-center minimum|OPS NOTE/);
  assert.match(html, /https:\/\/ref\.gs1\.org\/standards\/genspecs\//);
  assert.match(html, /content="http:\/\/localhost(?::3000)?\/og-v2.png"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("favicon reuses the four-bar Barcode Generator brand mark", async () => {
  const favicon = await readFile(new URL("../public/favicon.svg", import.meta.url), "utf8");

  assert.match(favicon, /<rect x="9" y="12" width="4" height="40"\/>/);
  assert.match(favicon, /<rect x="17" y="12" width="10" height="40"\/>/);
  assert.match(favicon, /<rect x="31" y="12" width="4" height="40"\/>/);
  assert.match(favicon, /<rect x="39" y="12" width="16" height="40"\/>/);
  assert.doesNotMatch(favicon, /<path/);
});

test("ships production assets and self-hosting files", async () => {
  const [packageJson, dockerfile, readme, studio, stylesheet] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../app/BarcodeStudio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"name": "barcode-generator"/);
  assert.match(packageJson, /"@bwip-js\/browser"/);
  assert.match(studio, /analyzeBarcodeCapacity/);
  assert.match(studio, /Micro QR capacity exceeded/);
  assert.match(studio, /validation\.generatedCheckDigit &&/);
  assert.match(studio, /Human-readable digits/);
  assert.doesNotMatch(studio, /preview-type[\s\S]{0,160}\{type\.label\}/);
  assert.match(studio, /<span>Error correction<\/span><b>\{errorCorrection\} · about \{ERROR_CORRECTION_PERCENT\[errorCorrection\]\}%<\/b>/);
  assert.doesNotMatch(studio, /`Error correction: \$\{errorCorrection\}`/);
  assert.doesNotMatch(studio, /recommended-format/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(dockerfile, /npm run build/);
  assert.match(readme, /docker compose up -d --build/);
  assert.doesNotMatch(studio, /FC minimum|fulfillmentApplies|Fulfillment-center minimum|OPS NOTE/);
  assert.match(studio, /Module size \(X\)/);
  assert.match(studio, /hasSquareOutput \? "Total output size" : "Total output width"/);
  assert.match(studio, /min="0\.1" max=\{kind === "itf14" \? 138 : 250\}/);
  assert.match(studio, /Total output height/);
  assert.match(studio, /beginDimensionEdit\("width"\)/);
  assert.match(studio, /beginDimensionEdit\("height"\)/);
  assert.match(studio, /commitDimensionEdit\("width"\)/);
  assert.match(studio, /commitDimensionEdit\("height"\)/);
  assert.match(studio, /dimensionInputRef\.current\?\.focus\(\)/);
  assert.match(studio, /dimensionInputRef\.current\?\.select\(\)/);
  assert.match(studio, /parseGuidedDimension/);
  assert.match(studio, /below the GS1 retail POS minimum size reference/);
  assert.match(studio, /below the Tight space reference/);
  assert.match(studio, /below the GS1 Small pack reference/);
  assert.match(studio, /severity: "critical" as const/);
  assert.match(studio, /className=\{`warning-note \$\{physicalWarning\.severity\}`\}/);
  assert.doesNotMatch(studio, /editPreviewDimension/);
  assert.doesNotMatch(studio, /Current bar height|from the selected preset/);
  assert.doesNotMatch(studio, /height-limit-field \$\{limitHeight \? "" : "inactive"\}/);
  assert.match(studio, /hasSquareOutput/);
  assert.match(studio, /\{hasSquareOutput \? "Total size" : "Total width"\}/);
  assert.match(studio, /!type\.linear && !hasSquareOutput/);
  assert.match(studio, /className="preset-spec-row"/);
  assert.match(studio, /guidance\.targetX\.toFixed\(3\)/);
  assert.match(studio, /\? "X-dim\." : "Module"/);
  assert.match(studio, /formatLabeledDimensions\(presetMeasurements\.target\)\} total/);
  assert.match(studio, /formatLabeledDimensions\(presetMeasurements\.compact\)\} total/);
  assert.match(studio, /`W \$\{formatMm\(barcode\.widthMm\)\} × H \$\{formatMm\(barcode\.heightMm\)\} mm`/);
  assert.match(studio, /GS1 POS TARGET/);
  assert.match(studio, /GS1 POS MIN/);
  assert.match(studio, /GENERAL USE/);
  assert.match(studio, /TIGHT SPACE/);
  assert.doesNotMatch(studio, /CODE(?:FORM|WORK) DEFAULT|CODE(?:FORM|WORK) COMPACT|PRACTICAL|Practical|practical/);
  assert.match(studio, /className="secondary-download"[^>]*onClick=\{downloadPng\}/);
  assert.match(studio, /className="primary-download"[^>]*onClick=\{downloadSvg\}/);
  assert.ok(studio.indexOf('className="svg-export-card export-card"') < studio.indexOf('className="png-export-card export-card"'));
  assert.match(studio, /Size embedded in millimetres/);
  assert.match(studio, /Vector artwork · no raster DPI/);
  assert.doesNotMatch(studio, /formatDimensions\(rendered\)\} · vector/);
  assert.doesNotMatch(studio, /min="8"/);
  assert.match(studio, /GS1 Digital Link/);
  assert.match(studio, /#h-adjusting-x-dimension-and-quiet-zone/);
  assert.match(studio, /genspecs\/#page=410/);
  assert.match(studio, /Preset size reference/);
  assert.match(studio, /Minimum size reference/);
  assert.match(studio, /Sizing and quiet-zone reference/);
  assert.match(studio, /rMQR standard grids/);
  assert.match(studio, /QR Code details/);
  assert.match(studio, /Micro QR details/);
  assert.match(studio, /faq\.html#patentH2Title/);
  assert.match(studio, /rmqr\.html#r02/);
  assert.match(studio, /codeform\.drafts\.v1/);
  assert.match(studio, /dataMatrixShape/);
  assert.match(studio, /aria-label="Square Data Matrix"/);
  assert.match(studio, /aria-label="Rectangular Data Matrix"/);
  assert.doesNotMatch(studio, /<option value="square">Square<\/option>/);
  assert.match(studio, /rmqrShape/);
  assert.match(studio, /searchParams\.set\("type"/);
  assert.match(studio, /popstate/);
  assert.match(studio, /ClipboardItem\.supports/);
  assert.match(studio, /Barcode Generator update available/);
  assert.match(studio, /\/version\.json\?t=/);
  assert.match(studio, /window\.location\.reload\(\)/);
  assert.match(studio, /role="tooltip"/);
  assert.match(studio, /pointerover/);
  assert.match(studio, /const selector = "\[data-tooltip\]"/);
  assert.doesNotMatch(studio, /Select \$\{item\.label\}: \$\{item\.description\}/);
  assert.match(studio, /Bar height is below the.*GS1 minimum for this format/);
  assert.doesNotMatch(studio, /GS1 minimum shown here/);
  assert.match(studio, /ClipboardItem\.supports\("image\/png"\)/);
  assert.match(studio, /"text\/html": new Blob/);
  assert.match(studio, /"text\/plain": new Blob/);
  assert.match(studio, /clipboardTypes\["image\/svg\+xml"\] = svgBlob/);
  assert.match(studio, /clipboardWidthPx = rendered\.widthMm \* 96 \/ 25\.4/);
  assert.match(studio, /aria-label=\{dimensionsLinked \? "Unlock proportions" : "Lock proportions"\}/);
  assert.match(studio, /setCustomX\(rendered\.xDimension \* scale\)/);
  assert.doesNotMatch(studio, /satoshilabs\.slack\.com/);
  assert.doesNotMatch(studio, /source-tip|Show the source for these size presets/);
  assert.match(stylesheet, /\.preview-symbol-frame\s*\{[\s\S]*?margin:\s*0;/);
  assert.match(stylesheet, /\.warning-note\.critical\s*\{[^}]*background:\s*#fff2ee;[^}]*color:\s*var\(--red\);/);
  assert.match(stylesheet, /animation:\s*update-banner-pulse 2\.8s ease-in-out infinite/);
  assert.match(stylesheet, /prefers-reduced-motion:\s*reduce/);
  assert.match(stylesheet, /\.preview-scale-note\s*\{[^}]*position:\s*absolute;[^}]*top:\s*10px;/);
  assert.match(stylesheet, /@media \(max-width:\s*580px\)[\s\S]*?\.preview-scale-note\s*\{[^}]*position:\s*static;[^}]*border-left:\s*3px solid var\(--acid\);/);
  assert.match(stylesheet, /\.preset-grid small\s*\{[^}]*font:\s*650 11px\/1\.4/);
  assert.match(stylesheet, /\.preset-grid b\s*\{[^}]*font-size:\s*14px/);
  assert.match(stylesheet, /\.preset-spec-row\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*white-space:\s*nowrap;/);
  assert.doesNotMatch(studio, /className="copy-status"/);

  await Promise.all([
    access(new URL("../public/og-v2.png", import.meta.url)),
    access(new URL("../public/favicon.svg", import.meta.url)),
    access(new URL("../public/favicon.ico", import.meta.url)),
    access(new URL("../public/apple-touch-icon.png", import.meta.url)),
    access(new URL("../compose.yaml", import.meta.url)),
  ]);
});
