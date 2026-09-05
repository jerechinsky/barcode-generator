# Barcode QA - 5 September 2026

Fixed incorrect linked dimensions (including rotated linear codes), silent removal
of invalid GTIN characters, undersized Code 128 quiet zones, and unreachable sizes
that previously exported at a different width. Inline edits now apply when focus
leaves the field.

Blocked or full browser storage no longer crashes the app. PNG creation failures
are visible, oversized canvases are rejected before allocation, download URLs stay
alive while the browser starts the transfer, and PNG rasterization uses crisp edges.
General Code 128 height guidance no longer claims a GS1 minimum.

The offline installation now includes the exact scripts, styles, and fonts from its
build. Failed page requests cannot overwrite a working offline shell, unrelated
caches are preserved, and update detection uses the version embedded in the app.

## Barcode facts and UI

The existing format badge opens a compact explanation on hover. Clicking or tapping
pins it open, with Escape, a close button, and outside-click dismissal. Facts remain
hidden by default. Mantine provides the popover, focus handling, placement, and
existing control tooltips; the green palette, typography, and square corners remain.
Popovers fit the available viewport, with a fixed header and a scrollable body.

All 11 formats have source-linked structure notes and interesting details. Valid
GTINs also show a digit breakdown and the actual check-digit calculation. The small
offline GS1 lookup distinguishes allocation from manufacturing origin, handles
special publication/coupon/restricted ranges, and treats absent entries as unknown.
It does not infer a fixed company/item split or claim that a product is registered.

## Validation

- Lint, production build, TypeScript checking, and all 85 automated tests passed.
- The eight new facts tests cover all formats, common and special GS1 allocations,
  UPC/EAN equivalence, GTIN-8 independence, ITF-14 indicators, invalid input, and
  actual QR-family grid labels. Server rendering keeps facts hidden.
- ZXing-C++ independently decoded 126 raster cases: all 11 formats, target and
  compact sizes, supported rotations, both Data Matrix shapes, and 300/600/1200 DPI.
- Real browser PNG exports from all 11 formats decoded successfully at 600 DPI.
  PNG dimensions and embedded density were verified. UPC-A was also recognized
  through its equivalent EAN-13 representation with a leading zero.
- Browser checks covered invalid GTINs, blocked storage, linked resizing, blur
  commits, failed PNG creation, excessive PNG sizes, offline reload and editing.
- Facts were reviewed for all 11 formats, with hover, pinning, Escape, keyboard,
  outside dismissal, scrollable content, and phone-size placement checks.
- Desktop and phone viewports at 390 and 320 CSS pixels were checked. No document
  overflow remained after layout settled; the mobile barcode and rulers were clear.
- Compatible security updates to React, Vinext, Vite, Wrangler and transitive
  dependencies leave npm audit with zero reported vulnerabilities. Drizzle schema
  generation and its overridden esbuild synchronous/asynchronous transforms passed.

The deployment script builds and validates a separate release while the current
site runs, verifies the new service and version after switching, and retains the
complete previous release for rollback.

These checks validate digital output. Physical printer, stock, ink, and scanner
combinations have not been tested.
