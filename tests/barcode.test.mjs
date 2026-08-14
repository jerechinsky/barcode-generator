import assert from "node:assert/strict";
import test from "node:test";
import {
  BARCODE_TYPES,
  PORTABLE_2D_KINDS,
  RMQR_VERSIONS,
  analyzeBarcodeCapacity,
  calculateGtinCheckDigit,
  filenameFor,
  renderBarcode,
  validateValue,
} from "../app/barcode.ts";
import { addPngDensity } from "../app/png.ts";

test("calculates and validates GS1 Mod 10 check digits", () => {
  assert.equal(calculateGtinCheckDigit("590123412345"), "7");
  assert.deepEqual(validateValue("ean13", "590123412345"), {
    encoded: "5901234123457",
    checkDigit: "7",
    generatedCheckDigit: true,
  });
  assert.match(validateValue("ean13", "5901234123458").error ?? "", /should be 7/);
  assert.match(validateValue("itf14", "123").error ?? "", /needs 13 digits/);
});

test("handles generated and supplied check digits for every GTIN format", () => {
  for (const [kind, base, complete] of [
    ["ean13", "590123412345", "5901234123457"],
    ["upca", "03600029145", "036000291452"],
    ["ean8", "9638507", "96385074"],
    ["itf14", "1001234567890", "10012345678902"],
  ]) {
    assert.deepEqual(validateValue(kind, base), {
      encoded: complete,
      checkDigit: complete.at(-1),
      generatedCheckDigit: true,
    });
    assert.deepEqual(validateValue(kind, complete), {
      encoded: complete,
      checkDigit: complete.at(-1),
      generatedCheckDigit: false,
    });
    const wrongDigit = complete.at(-1) === "9" ? "0" : String(Number(complete.at(-1)) + 1);
    assert.match(validateValue(kind, `${complete.slice(0, -1)}${wrongDigit}`).error ?? "", /Check digit should be/);
  }
});

test("preserves exact general-purpose text, including intentional edge spaces", () => {
  assert.deepEqual(validateValue("qr", "  shelf A  "), { encoded: "  shelf A  " });
  assert.deepEqual(validateValue("datamatrix", "line 1\nline 2"), {
    encoded: "line 1\nline 2",
  });
  assert.match(validateValue("qr", " \n\t ").error ?? "", /Enter something/);
  assert.equal(validateValue("ean13", " 590123412345 ").encoded, "5901234123457");
});

test("safely and deterministically renders punctuation, Unicode, and markup-like text", () => {
  const payload = "<script>alert('x')</script> & café\nA26";
  const base = {
    kind: "qr",
    value: payload,
    preset: "target",
    customX: 0.495,
    customHeight: 15,
    rotation: "N",
    includeText: false,
    errorCorrection: "M",
  };
  const first = renderBarcode(base);
  const second = renderBarcode(base);

  assert.equal(first.encoded, payload);
  assert.equal(first.svg, second.svg);
  assert.doesNotMatch(first.svg, /<script|alert\(|café/i);
  assert.match(first.svg, /^<svg width="[\d.]+mm" height="[\d.]+mm"/);
});

test("renders valid physical SVG output for every offered symbology", () => {
  for (const barcodeType of BARCODE_TYPES) {
    for (const preset of ["target", "compact"]) {
      const rendered = renderBarcode({
        kind: barcodeType.id,
        value: barcodeType.example,
        preset,
        customX: 0.33,
        customHeight: 20,
        rotation: "N",
        includeText: true,
        errorCorrection: "M",
      });

      assert.match(rendered.svg, /^<svg width="[\d.]+mm" height="[\d.]+mm"/);
      assert.ok(rendered.widthMm > 0);
      assert.ok(rendered.heightMm > 0);
      assert.ok(rendered.svg.length > 500);
    }
  }
});

test("embeds the reported millimetre size directly in SVG without fake DPI metadata", () => {
  const rendered = renderBarcode({
    kind: "qr",
    value: "GHB016",
    preset: "target",
    customX: 0.4,
    customHeight: 15,
    rotation: "N",
    includeText: false,
    errorCorrection: "M",
  });

  assert.match(
    rendered.svg,
    new RegExp(`^<svg width="${rendered.widthMm.toFixed(3)}mm" height="${rendered.heightMm.toFixed(3)}mm" viewBox=`),
  );
  assert.doesNotMatch(rendered.svg, /\b(?:dpi|ppi|resolution)\s*=/i);
});

test("keeps exact-width ITF-14 rendering within the bearer-bar limit", () => {
  for (const requestedWidth of [30, 100, 138]) {
    const rendered = renderBarcode({
      kind: "itf14",
      value: "1001234567890",
      preset: "custom",
      customX: 0.635,
      customHeight: 31.75,
      targetWidth: requestedWidth,
      rotation: "N",
      includeText: true,
      errorCorrection: "M",
    });

    assert.ok(Math.abs(rendered.widthMm - requestedWidth) < 0.1);
  }
});

test("renders a 20 mm custom-width EAN-13 without probing an invalid renderer width", () => {
  const rendered = renderBarcode({
    kind: "ean13",
    value: "590123412345",
    preset: "custom",
    // The target width must drive the calculation independently of a stale or
    // otherwise invalid X-dimension left in the alternate manual-size field.
    customX: 99,
    customHeight: 22.85,
    targetWidth: 20,
    rotation: "N",
    includeText: true,
    errorCorrection: "M",
  });

  assert.ok(Math.abs(rendered.widthMm - 20) < 0.05);
  assert.ok(rendered.xDimension > 0 && rendered.xDimension < 0.2);
  assert.match(rendered.svg, /^<svg width="20\.000mm"/);
});

test("keeps custom total-width sizing accurate for other linear formats", () => {
  for (const [kind, value] of [
    ["upca", "03600029145"],
    ["ean8", "9638507"],
    ["code128", "PART-2026-0142"],
  ]) {
    const rendered = renderBarcode({
      kind,
      value,
      preset: "custom",
      customX: 99,
      customHeight: 20,
      targetWidth: 20,
      rotation: "N",
      includeText: true,
      errorCorrection: "M",
    });

    assert.ok(Math.abs(rendered.widthMm - 20) < 0.05, `${kind} should be 20 mm wide`);
  }
});

test("uses bar height to honor custom visible width after rotating a linear barcode", () => {
  const rendered = renderBarcode({
    kind: "ean13",
    value: "590123412345",
    preset: "custom",
    customX: 0.33,
    customHeight: 22.85,
    targetWidth: 18,
    rotation: "R",
    includeText: true,
    errorCorrection: "M",
  });

  assert.ok(Math.abs(rendered.widthMm - 18) < 0.02);
  assert.ok(rendered.heightMm > rendered.widthMm);
});

test("keeps custom total-width sizing exact for square and rectangular symbols", () => {
  for (const [kind, value, extra] of [
    ["qr", "GHB016", {}],
    ["datamatrix", "LOT:A26-0813", { dataMatrixShape: "rectangle" }],
    ["pdf417", "TICKET:A26-0813", {}],
  ]) {
    for (const rotation of ["N", "R"]) {
      const rendered = renderBarcode({
        kind,
        value,
        preset: "custom",
        customX: 99,
        customHeight: 20,
        targetWidth: 20,
        rotation,
        includeText: false,
        errorCorrection: "M",
        ...extra,
      });

      assert.ok(Math.abs(rendered.widthMm - 20) < 0.001, `${kind} ${rotation} should be exactly 20 mm wide`);
      assert.ok(rendered.xDimension > 0);
    }
  }
});

test("keeps custom total-height sizing exact without stretching matrix or stacked symbols", () => {
  for (const [kind, value, extra] of [
    ["qr", "GHB016", {}],
    ["datamatrix", "LOT:A26-0813", { dataMatrixShape: "rectangle" }],
    ["pdf417", "TICKET:A26-0813", {}],
  ]) {
    const rendered = renderBarcode({
      kind,
      value,
      preset: "custom",
      customX: 0.4,
      customHeight: 20,
      targetHeight: 12.5,
      rotation: "N",
      includeText: false,
      errorCorrection: "M",
      ...extra,
    });

    assert.ok(Math.abs(rendered.heightMm - 12.5) < 0.001, `${kind} should be exactly 12.5 mm high`);
    assert.ok(rendered.xDimension > 0, `${kind} must retain a valid square module size`);
  }
});

test("allows custom total widths below the former 8 mm interface floor", () => {
  for (const targetWidth of [7.9, 5, 1]) {
    const rendered = renderBarcode({
      kind: "qr",
      value: "GHB016",
      preset: "custom",
      customX: 0.4,
      customHeight: 20,
      targetWidth,
      rotation: "N",
      includeText: false,
      errorCorrection: "M",
    });

    assert.ok(
      Math.abs(rendered.widthMm - targetWidth) < 0.001,
      `QR should render at ${targetWidth} mm instead of stopping at 8 mm`,
    );
  }
});

test("rejects an invalid custom total width instead of silently using the alternate X field", () => {
  for (const targetWidth of [0, -1, Number.NaN]) {
    assert.throws(
      () => renderBarcode({
        kind: "ean13",
        value: "590123412345",
        preset: "custom",
        customX: 0.33,
        customHeight: 22.85,
        targetWidth,
        rotation: "N",
        includeText: true,
        errorCorrection: "M",
      }),
      /Total output width must be greater than 0 mm/,
    );
  }
});

test("keeps EAN-13 target and compact output inside expected GS1 dimensions", () => {
  const base = {
    kind: "ean13",
    value: "590123412345",
    customX: 0.33,
    customHeight: 22.85,
    rotation: "N",
    includeText: true,
    errorCorrection: "M",
  };
  const target = renderBarcode({ ...base, preset: "target" });
  const compact = renderBarcode({ ...base, preset: "compact" });

  assert.ok(target.widthMm >= 37 && target.widthMm <= 38);
  assert.ok(target.heightMm >= 26 && target.heightMm <= 27);
  assert.ok(compact.widthMm >= 29.5 && compact.widthMm <= 30.5);
  assert.ok(compact.heightMm >= 21 && compact.heightMm <= 22.5);
  assert.equal(target.svg.match(/<path\b/g)?.length, 17, "the optional > quiet-zone marker is hidden");
});

test("hiding EAN and UPC digits preserves the full quiet-zone canvas and bar layout", () => {
  for (const [kind, value] of [
    ["ean13", "590123412345"],
    ["upca", "03600029145"],
    ["ean8", "9638507"],
  ]) {
    const base = {
      kind,
      value,
      preset: "target",
      customX: 0.33,
      customHeight: 22.85,
      rotation: "N",
      errorCorrection: "M",
    };
    const withDigits = renderBarcode({ ...base, includeText: true });
    const withoutDigits = renderBarcode({ ...base, includeText: false });
    const barPaths = (svg) => [...svg.matchAll(/<path\b[^>]*\/>/g)].slice(0, 4).map((match) => match[0]);

    assert.equal(withoutDigits.widthMm, withDigits.widthMm, `${kind} width must not depend on HRI`);
    assert.equal(withoutDigits.heightMm, withDigits.heightMm, `${kind} canvas must not shift when HRI is hidden`);
    assert.deepEqual(barPaths(withoutDigits.svg), barPaths(withDigits.svg), `${kind} bar positions must stay unchanged`);
    assert.equal(withoutDigits.svg.match(/<path\b/g)?.length, 4, `${kind} should remove only HRI paths`);
  }
});

test("hiding text from every linear format never changes its horizontal canvas", () => {
  for (const [kind, value] of [
    ["ean13", "590123412345"],
    ["upca", "03600029145"],
    ["ean8", "9638507"],
    ["itf14", "1001234567890"],
    ["code128", "PART-2026-0142"],
  ]) {
    const base = {
      kind,
      value,
      preset: "target",
      customX: 0.33,
      customHeight: 20,
      rotation: "N",
      errorCorrection: "M",
    };
    const withText = renderBarcode({ ...base, includeText: true });
    const withoutText = renderBarcode({ ...base, includeText: false });

    assert.equal(withoutText.widthMm, withText.widthMm, `${kind} width must not depend on visible text`);
    assert.ok((withoutText.svg.match(/<path\b/g)?.length ?? 0) < (withText.svg.match(/<path\b/g)?.length ?? 0));
  }
});

test("keeps compact EAN-13 digits proportional instead of condensing them", () => {
  const base = {
    kind: "ean13",
    value: "590123412345",
    customX: 0.33,
    customHeight: 22.85,
    rotation: "N",
    includeText: true,
    errorCorrection: "M",
  };
  const target = renderBarcode({ ...base, preset: "target" });
  const compact = renderBarcode({ ...base, preset: "compact" });

  const firstDigitBounds = (svg) => {
    const textPath = [...svg.matchAll(/<path\b[^>]*d="([^"]+)"[^>]*\/>/g)]
      .find((match) => match[0].includes('fill="#111111"'));
    assert.ok(textPath, "EAN-13 should include human-readable digits");
    const coordinates = [...textPath[1].matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    const xCoordinates = coordinates.filter((_, index) => index % 2 === 0);
    const yCoordinates = coordinates.filter((_, index) => index % 2 === 1);
    return {
      width: Math.max(...xCoordinates) - Math.min(...xCoordinates),
      height: Math.max(...yCoordinates) - Math.min(...yCoordinates),
    };
  };

  const targetDigit = firstDigitBounds(target.svg);
  const compactDigit = firstDigitBounds(compact.svg);
  const targetAspect = targetDigit.width / targetDigit.height;
  const compactAspect = compactDigit.width / compactDigit.height;
  const expectedScale = compact.xDimension / target.xDimension;

  assert.ok(Math.abs(compactAspect - targetAspect) < 0.01);
  assert.ok(Math.abs(compactDigit.height / targetDigit.height - expectedScale) < 0.01);
});

test("keeps ITF-14 human-readable digits clear of the bottom bearer bar", () => {
  for (const preset of ["target", "compact"]) {
    const rendered = renderBarcode({
      kind: "itf14",
      value: "1001234567890",
      preset,
      customX: 0.635,
      customHeight: 31.75,
      rotation: "N",
      includeText: true,
      errorCorrection: "M",
    });

    const viewBox = rendered.svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const paths = [...rendered.svg.matchAll(/<path\b[^>]*d="([^"]+)"[^>]*\/>/g)];
    const bearerIndex = paths.findIndex((match) => match[0].includes('fill-rule="evenodd"'));
    assert.ok(viewBox && bearerIndex >= 0 && paths[bearerIndex + 1], `${preset} should contain bearer bars and HRI`);

    const yCoordinates = (pathData) =>
      [...pathData.matchAll(/-?\d+(?:\.\d+)?/g)]
        .map((match) => Number(match[0]))
        .filter((_, index) => index % 2 === 1);
    const bearerBottom = Math.max(...yCoordinates(paths[bearerIndex][1]));
    const textTop = Math.min(...yCoordinates(paths[bearerIndex + 1][1]));
    const gapMm = ((textTop - bearerBottom) / Number(viewBox[2])) * rendered.heightMm;

    assert.ok(gapMm >= 1.02, `${preset} HRI gap should be at least 1.02 mm, got ${gapMm.toFixed(3)} mm`);
  }
});

test("uses retail reference module sizes and full quiet zones for QR", () => {
  const base = {
    kind: "qr",
    value: "https://example.com/product",
    customX: 0.495,
    customHeight: 15,
    rotation: "N",
    includeText: false,
    errorCorrection: "M",
  };
  const target = renderBarcode({ ...base, preset: "target" });
  const compact = renderBarcode({ ...base, preset: "compact" });

  assert.equal(target.xDimension, 0.495);
  assert.equal(compact.xDimension, 0.396);
  assert.equal(target.widthMm, (target.moduleCount + 8) * target.xDimension);
  assert.equal(compact.widthMm, (compact.moduleCount + 8) * compact.xDimension);
  assert.ok(compact.widthMm < target.widthMm);
});

test("uses the exact selected QR error-correction level", () => {
  const base = {
    kind: "qr",
    value: "GHB016",
    preset: "target",
    customX: 0.495,
    customHeight: 15,
    rotation: "N",
    includeText: false,
  };
  const results = ["L", "M", "Q", "H"].map((errorCorrection) =>
    renderBarcode({ ...base, errorCorrection })
  );

  assert.deepEqual(results.map((result) => result.moduleCount), [21, 21, 21, 21]);
  assert.equal(new Set(results.map((result) => result.svg)).size, 4);
});

test("keeps QR dimensions stable when a short value stays in the same version", () => {
  const base = {
    kind: "qr",
    value: "GHB016",
    preset: "target",
    customX: 0.495,
    customHeight: 15,
    rotation: "N",
    includeText: false,
  };
  const results = ["L", "M", "Q", "H"].map((errorCorrection) =>
    renderBarcode({ ...base, errorCorrection })
  );

  assert.equal(new Set(results.map(({ widthMm, heightMm }) => `${widthMm}:${heightMm}`)).size, 1);
  assert.equal(new Set(results.map((result) => result.svg)).size, 4);
});

test("selects compact or low-profile rMQR versions and includes the 2X quiet zone", () => {
  const base = {
    kind: "rmqr",
    value: "1234",
    preset: "target",
    customX: 0.4,
    customHeight: 15,
    rotation: "N",
    includeText: false,
    errorCorrection: "M",
  };
  const compact = renderBarcode({ ...base, rmqrShape: "compact" });
  const lowProfile = renderBarcode({ ...base, rmqrShape: "low-profile" });

  assert.equal(compact.symbolVersion, "R11x27");
  assert.equal(compact.moduleColumns, 27);
  assert.equal(compact.moduleRows, 11);
  assert.equal(compact.widthMm, (27 + 4) * compact.xDimension);
  assert.equal(compact.heightMm, (11 + 4) * compact.xDimension);
  assert.equal(lowProfile.symbolVersion, "R7x43");
  assert.equal(lowProfile.moduleColumns, 43);
  assert.equal(lowProfile.moduleRows, 7);
  assert.ok(lowProfile.heightMm < compact.heightMm);
});

test("exposes every standardized rMQR grid as structured metadata", () => {
  assert.equal(RMQR_VERSIONS.length, 32);
  assert.equal(new Set(RMQR_VERSIONS.map((version) => version.id)).size, 32);
  assert.deepEqual(RMQR_VERSIONS[0], { id: "R7x43", rows: 7, columns: 43 });
  assert.deepEqual(RMQR_VERSIONS.at(-1), { id: "R17x139", rows: 17, columns: 139 });

  for (const version of RMQR_VERSIONS) {
    assert.equal(version.id, `R${version.rows}x${version.columns}`);
  }
});

test("fits rMQR into both box dimensions by maximizing one square module size", () => {
  const base = {
    kind: "rmqr",
    value: "1234",
    preset: "custom",
    customX: 0.4,
    customHeight: 15,
    rotation: "N",
    includeText: false,
    errorCorrection: "M",
    rmqrMode: "fit",
  };
  const lowBox = renderBarcode({ ...base, rmqrMaxWidth: 20, rmqrMaxHeight: 6 });
  const compactBox = renderBarcode({ ...base, rmqrMaxWidth: 15, rmqrMaxHeight: 8 });

  assert.equal(lowBox.rmqrVersion, "R7x43");
  assert.equal(lowBox.symbolVersion, "R7x43");
  assert.equal(lowBox.widthMm, 20);
  assert.ok(lowBox.heightMm <= 6);
  assert.equal(lowBox.widthMm, (lowBox.moduleColumns + 4) * lowBox.xDimension);
  assert.equal(lowBox.heightMm, (lowBox.moduleRows + 4) * lowBox.xDimension);
  assert.ok(lowBox.xDimension >= 0.3, "fit mode defaults to the practical 0.3 mm X floor");

  assert.equal(compactBox.rmqrVersion, "R11x27");
  assert.equal(compactBox.widthMm, 15);
  assert.ok(compactBox.heightMm <= 8);
  assert.ok(compactBox.xDimension > lowBox.xDimension);
});

test("honors rotation while fitting rMQR into a maximum box", () => {
  const base = {
    kind: "rmqr",
    value: "1234",
    preset: "custom",
    customX: 0.4,
    customHeight: 15,
    includeText: false,
    errorCorrection: "M",
    rmqrMode: "fit",
  };
  const normal = renderBarcode({
    ...base,
    rotation: "N",
    rmqrMaxWidth: 20,
    rmqrMaxHeight: 6,
  });
  const rotated = renderBarcode({
    ...base,
    rotation: "R",
    rmqrMaxWidth: 6,
    rmqrMaxHeight: 20,
  });

  assert.equal(rotated.rmqrVersion, normal.rmqrVersion);
  assert.equal(rotated.xDimension, normal.xDimension);
  assert.equal(rotated.widthMm, normal.heightMm);
  assert.equal(rotated.heightMm, normal.widthMm);
});

test("rejects impossible rMQR fit boxes unless an explicit lower X floor makes them viable", () => {
  const base = {
    kind: "rmqr",
    value: "1234",
    preset: "custom",
    customX: 0.4,
    customHeight: 15,
    rotation: "N",
    includeText: false,
    errorCorrection: "M",
    rmqrMode: "fit",
    rmqrMaxWidth: 10,
    rmqrMaxHeight: 3,
  };

  assert.throws(() => renderBarcode(base), /fits within 10 × 3 mm.*0\.300 mm/);

  const fitted = renderBarcode({ ...base, rmqrMinX: 0.2 });
  assert.equal(fitted.rmqrVersion, "R7x43");
  assert.ok(fitted.widthMm <= 10);
  assert.ok(fitted.heightMm <= 3);
  assert.ok(fitted.xDimension >= 0.2);

  assert.throws(
    () => renderBarcode({ ...base, rmqrMaxWidth: 0 }),
    /positive maximum width and height/,
  );
});

test("uses an exact rMQR version without silently substituting another grid", () => {
  const base = {
    kind: "rmqr",
    value: "1234",
    preset: "custom",
    customX: 0.4,
    customHeight: 15,
    rotation: "N",
    includeText: false,
    errorCorrection: "M",
    rmqrMode: "exact",
  };
  const rendered = renderBarcode({ ...base, rmqrVersion: "R17x139" });

  assert.equal(rendered.rmqrVersion, "R17x139");
  assert.equal(rendered.symbolVersion, "R17x139");
  assert.equal(rendered.moduleRows, 17);
  assert.equal(rendered.moduleColumns, 139);
  assert.equal(rendered.widthMm, 143 * rendered.xDimension);
  assert.equal(rendered.heightMm, 21 * rendered.xDimension);

  assert.throws(
    () => renderBarcode({ ...base, rmqrVersion: undefined }),
    /Choose a valid exact rMQR version/,
  );
});

test("validates payload capacity against the selected exact rMQR version", () => {
  const base = {
    kind: "rmqr",
    value: "XXXXXXXX",
    preset: "custom",
    customX: 0.4,
    customHeight: 15,
    rotation: "N",
    includeText: false,
    errorCorrection: "M",
    rmqrMode: "exact",
  };

  assert.throws(
    () => renderBarcode({ ...base, rmqrVersion: "R7x43" }),
    /does not fit in rMQR version R7x43 at M error correction/,
  );
  assert.equal(renderBarcode({ ...base, rmqrVersion: "R7x59" }).rmqrVersion, "R7x59");
});

test("rejects invalid exact rMQR module sizes", () => {
  assert.throws(
    () => renderBarcode({
      kind: "rmqr",
      value: "1234",
      preset: "custom",
      customX: 0,
      customHeight: 15,
      rotation: "N",
      includeText: false,
      errorCorrection: "M",
      rmqrMode: "exact",
      rmqrVersion: "R7x43",
    }),
    /Module size must be greater than 0 mm/,
  );
});

test("swaps rectangular physical dimensions when rotated", () => {
  const base = {
    kind: "rmqr",
    value: "https://example.com/product",
    preset: "target",
    customX: 0.4,
    customHeight: 15,
    includeText: false,
    errorCorrection: "M",
    rmqrShape: "low-profile",
  };
  const normal = renderBarcode({ ...base, rotation: "N" });
  const rotated = renderBarcode({ ...base, rotation: "R" });

  assert.equal(rotated.moduleColumns, normal.moduleColumns);
  assert.equal(rotated.moduleRows, normal.moduleRows);
  assert.equal(rotated.widthMm, normal.heightMm);
  assert.equal(rotated.heightMm, normal.widthMm);
});

test("swaps exported dimensions for every rotatable rectangular family", () => {
  const cases = [
    ["ean13", "590123412345", { includeText: true }],
    ["code128", "PART-2026", { includeText: true }],
    ["datamatrix", "LOT:A26-0813", { dataMatrixShape: "rectangle" }],
    ["pdf417", "TICKET:A26-0813", {}],
  ];
  const base = {
    preset: "target",
    customX: 0.33,
    customHeight: 20,
    includeText: false,
    errorCorrection: "M",
  };

  for (const [kind, value, extra] of cases) {
    const normal = renderBarcode({ ...base, kind, value, rotation: "N", ...extra });
    const rotated = renderBarcode({ ...base, kind, value, rotation: "R", ...extra });
    assert.ok(Math.abs(rotated.widthMm - normal.heightMm) < 0.001, `${kind} rotated width`);
    assert.ok(Math.abs(rotated.heightMm - normal.widthMm) < 0.001, `${kind} rotated height`);
  }
});

test("rotates the Data Matrix artwork by one quarter turn", () => {
  const base = {
    kind: "datamatrix",
    value: "LOT:A26-0813",
    preset: "target",
    customX: 0.33,
    customHeight: 20,
    includeText: true,
    errorCorrection: "M",
    dataMatrixShape: "square",
  };
  const normal = renderBarcode({ ...base, rotation: "N" });
  const rotated = renderBarcode({ ...base, rotation: "R" });

  const firstSegment = (svg) => {
    const match = svg.match(/<path d="M(\d+) (\d+)L(\d+) (\d+)/);
    assert.ok(match, "Data Matrix should start with a finder-border segment");
    return match.slice(1).map(Number);
  };
  const [normalX1, normalY1, normalX2, normalY2] = firstSegment(normal.svg);
  const [rotatedX1, rotatedY1, rotatedX2, rotatedY2] = firstSegment(rotated.svg);

  // Its solid bottom finder border becomes the solid left finder border. A
  // half turn would leave the segment horizontal on the opposite edge.
  assert.equal(normalY1, normalY2);
  assert.notEqual(normalX1, normalX2);
  assert.equal(rotatedX1, rotatedX2);
  assert.notEqual(rotatedY1, rotatedY2);
  assert.notEqual(rotated.svg, normal.svg);
});

test("renders square and standard rectangular Data Matrix shapes", () => {
  const base = {
    kind: "datamatrix",
    value: "LOT:A26-0813",
    preset: "target",
    customX: 0.495,
    customHeight: 15,
    rotation: "N",
    includeText: false,
    errorCorrection: "M",
  };
  const square = renderBarcode({ ...base, dataMatrixShape: "square" });
  const rectangle = renderBarcode({ ...base, dataMatrixShape: "rectangle" });

  assert.equal(square.moduleColumns, square.moduleRows);
  assert.ok(rectangle.moduleColumns > rectangle.moduleRows);
  assert.equal(rectangle.widthMm, (rectangle.moduleColumns + 2) * rectangle.xDimension);
  assert.equal(rectangle.heightMm, (rectangle.moduleRows + 2) * rectangle.xDimension);
});

test("renders Aztec and PDF417 with their physical module grids", () => {
  for (const kind of ["aztec", "pdf417"]) {
    const rendered = renderBarcode({
      kind,
      value: "TICKET:A26-0813:SEAT-14",
      preset: "target",
      customX: 0.33,
      customHeight: 15,
      rotation: "N",
      includeText: false,
      errorCorrection: "M",
    });

    assert.ok(rendered.moduleColumns > 0);
    assert.ok(rendered.moduleRows > 0);
    assert.ok(rendered.widthMm > 0);
    assert.ok(rendered.heightMm > 0);
  }
});

test("returns friendly errors when a compact 2D shape cannot hold the value", () => {
  const base = {
    preset: "target",
    customX: 0.4,
    customHeight: 15,
    rotation: "N",
    includeText: false,
    errorCorrection: "M",
  };

  assert.throws(
    () => renderBarcode({ ...base, kind: "microqr", value: "https://example.com/a-longer-value" }),
    /does not fit in Micro QR/,
  );
  assert.throws(
    () => renderBarcode({
      ...base,
      kind: "datamatrix",
      value: "X".repeat(500),
      dataMatrixShape: "rectangle",
    }),
    /does not fit in rectangular Data Matrix/,
  );
  assert.throws(
    () => renderBarcode({ ...base, kind: "rmqr", value: "X".repeat(500) }),
    /does not fit in rMQR/,
  );
});

test("reports exact Micro QR capacity for the payload encoding and correction level", () => {
  assert.deepEqual(
    analyzeBarcodeCapacity({
      kind: "microqr",
      value: "hi there ya cunt",
      errorCorrection: "M",
    }),
    {
      kind: "microqr",
      fits: false,
      used: 16,
      maximum: 13,
      remaining: 0,
      overBy: 3,
      unit: "bytes",
      mode: "byte",
      requestedErrorCorrection: "M",
      effectiveErrorCorrection: "M",
      currentVersion: undefined,
      limitVersion: "M4",
      basis: "payload-specific",
      explanation: "Lowercase letters and other characters outside Micro QR's numeric and uppercase alphanumeric set require byte encoding, which has less capacity.",
    },
  );

  const fitting = analyzeBarcodeCapacity({
    kind: "microqr",
    value: "hello world!",
    errorCorrection: "M",
  });
  assert.equal(fitting.fits, true);
  assert.equal(fitting.used, 12);
  assert.equal(fitting.maximum, 13);
  assert.equal(fitting.remaining, 1);
  assert.equal(fitting.currentVersion, "M4");
});

test("Micro QR capacity follows content mode and effective error correction", () => {
  const numeric = analyzeBarcodeCapacity({
    kind: "microqr",
    value: "1234567890",
    errorCorrection: "M",
  });
  assert.equal(numeric.mode, "numeric");
  assert.equal(numeric.unit, "digits");
  assert.equal(numeric.maximum, 30);
  assert.equal(numeric.remaining, 20);

  const alphanumeric = analyzeBarcodeCapacity({
    kind: "microqr",
    value: "HELLO 123",
    errorCorrection: "M",
  });
  assert.equal(alphanumeric.mode, "alphanumeric");
  assert.equal(alphanumeric.maximum, 18);
  assert.equal(alphanumeric.remaining, 9);

  const high = analyzeBarcodeCapacity({
    kind: "microqr",
    value: "abcdefghi",
    errorCorrection: "H",
  });
  assert.equal(high.effectiveErrorCorrection, "Q");
  assert.equal(high.maximum, 9);
  assert.equal(high.remaining, 0);

  assert.equal(analyzeBarcodeCapacity({
    kind: "qr",
    value: "hello",
    errorCorrection: "M",
  }), undefined);
});

test("Micro QR reports the exact last fitting unit for every mode and correction level", () => {
  const cases = [
    ["L", "numeric", "1", 35],
    ["M", "numeric", "1", 30],
    ["Q", "numeric", "1", 21],
    ["L", "alphanumeric", "A", 21],
    ["M", "alphanumeric", "A", 18],
    ["Q", "alphanumeric", "A", 13],
    ["L", "byte", "a", 15],
    ["M", "byte", "a", 13],
    ["Q", "byte", "a", 9],
  ];

  for (const [errorCorrection, mode, unit, maximum] of cases) {
    const atLimit = analyzeBarcodeCapacity({
      kind: "microqr",
      value: unit.repeat(maximum),
      errorCorrection,
    });
    const oneOver = analyzeBarcodeCapacity({
      kind: "microqr",
      value: unit.repeat(maximum + 1),
      errorCorrection,
    });

    assert.equal(atLimit.mode, mode);
    assert.equal(atLimit.fits, true);
    assert.equal(atLimit.remaining, 0);
    assert.equal(atLimit.maximum, maximum);
    assert.equal(oneOver.fits, false);
    assert.equal(oneOver.overBy, 1);
    assert.equal(oneOver.maximum, maximum);
  }
});

test("Micro QR capacity counts UTF-8 bytes and respects mixed-mode segmentation", () => {
  const unicode = analyzeBarcodeCapacity({
    kind: "microqr",
    value: "é".repeat(6),
    errorCorrection: "M",
  });
  assert.equal(unicode.used, 12);
  assert.equal(unicode.maximum, 13);
  assert.equal(unicode.remaining, 1);

  // BWIPP can split this into an efficient alphanumeric segment and a short
  // byte segment, so an encoder-backed calculation is more accurate than
  // treating the whole 16-byte string as a homogeneous byte payload.
  const mixed = analyzeBarcodeCapacity({
    kind: "microqr",
    value: "AAAAAAAAAAAAAAAa",
    errorCorrection: "M",
  });
  assert.equal(mixed.fits, true);
  assert.equal(mixed.used, 16);
  assert.equal(mixed.maximum, 16);
  assert.equal(mixed.remaining, 0);
});

test("exposes metadata for portable values and metadata-driven controls", () => {
  assert.deepEqual(PORTABLE_2D_KINDS, ["qr", "rmqr", "microqr", "datamatrix", "aztec", "pdf417"]);
  assert.equal(BARCODE_TYPES.find((type) => type.id === "code128").valueGroup, "code128");
  for (const type of BARCODE_TYPES) {
    assert.equal(typeof type.contentLabel, "string");
    assert.equal(typeof type.multiline, "boolean");
    assert.equal(typeof type.rotatable, "boolean");
    assert.ok(["Matrix", "Stacked", "Linear"].includes(type.family));
  }
});

test("creates concise filenames with type, content, and raster density", () => {
  assert.equal(filenameFor("ean13", "5901234123457", "svg"), "EAN13-5901234123457.svg");
  assert.equal(filenameFor("ean13", "5901234123457", "png", 600), "EAN13-5901234123457-600dpi.png");
  assert.equal(
    filenameFor("qr", "https://example.com/products/green one", "png", 300),
    "QR-example-com-products-green-one-300dpi.png",
  );
  assert.equal(filenameFor("rmqr", "A26-813", "svg"), "rMQR-A26-813.svg");
  assert.equal(filenameFor("aztec", "TICKET:813", "svg"), "Aztec-TICKET-813.svg");
  assert.equal(filenameFor("pdf417", "ID:123", "png", 600), "PDF417-ID-123-600dpi.png");
  assert.equal(filenameFor("qr", "✓ ✓ ✓", "svg"), "QR-barcode.svg");
  assert.equal(
    filenameFor("qr", `${"A".repeat(47)} / trailing content`, "png", 600),
    `QR-${"A".repeat(47)}-600dpi.png`,
  );
});

test("writes the selected print density into exported PNG files", () => {
  const onePixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2Z7sAAAAASUVORK5CYII=",
    "base64",
  );
  const output = addPngDensity(new Uint8Array(onePixelPng), 600);
  const marker = Buffer.from(output).indexOf("pHYs", 0, "ascii");
  assert.ok(marker > 0);

  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const pixelsPerMetre = view.getUint32(marker + 4);
  assert.equal(pixelsPerMetre, Math.round(600 / 0.0254));
  assert.equal(output[marker + 12], 1);

  const replaced = addPngDensity(output, 300);
  const text = Buffer.from(replaced).toString("latin1");
  assert.equal(text.match(/pHYs/g)?.length, 1, "an existing density chunk should be replaced, not duplicated");
  const replacedMarker = Buffer.from(replaced).indexOf("pHYs", 0, "ascii");
  const replacedView = new DataView(replaced.buffer, replaced.byteOffset, replaced.byteLength);
  assert.equal(replacedView.getUint32(replacedMarker + 4), Math.round(300 / 0.0254));
});
