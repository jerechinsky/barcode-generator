import type { BarcodeKind, RenderedBarcode } from "./barcode";

type Fact = { title: string; text: string };
type Source = { label: string; url: string };
type Segment = { value: string; label: string; tone: "prefix" | "data" | "check" };
type FormatFacts = { hook: string; details: Fact[]; sources: Source[] };
export type BarcodeFacts = FormatFacts & {
  badge?: string;
  segments?: Segment[];
  insight?: Fact;
  checksum?: string;
};

const GS1_PREFIXES = "https://www.gs1.org/standards/id-keys/company-prefix";
const GTIN_STRUCTURE = "https://www.gs1.org/services/activate/how-to-create-a-GTIN";
const GS1_CHECK_DIGIT = "https://www.gs1.org/services/how-calculate-check-digit-manually";
const ZINT = "https://zint.org.uk/manual/chapter/6/";

// A deliberately small offline lookup, checked against GS1's allocation list on
// 2026-09-05. An absent range means "not in this lookup", never "invalid".
// These are allocating organisations, not product origins or company identities.
const COMMON_GS1_ALLOCATIONS: readonly [number, number, string][] = [
  [1, 19, "US"], [30, 39, "US"], [60, 139, "US"],
  [300, 379, "France"], [380, 380, "Bulgaria"], [383, 383, "Slovenia"],
  [385, 385, "Croatia"], [400, 440, "Germany"],
  [450, 459, "Japan"], [460, 469, "Russia"], [471, 471, "Chinese Taipei"],
  [474, 474, "Estonia"], [475, 475, "Latvia"], [477, 477, "Lithuania"],
  [482, 482, "Ukraine"], [489, 489, "Hong Kong, China"], [490, 499, "Japan"],
  [500, 509, "UK"], [520, 521, "Greece"], [539, 539, "Ireland"],
  [540, 549, "Belgium & Luxembourg"], [560, 560, "Portugal"],
  [570, 579, "Denmark"], [590, 590, "Poland"], [594, 594, "Romania"],
  [599, 599, "Hungary"], [600, 601, "South Africa"], [640, 649, "Finland"],
  [680, 681, "China"], [690, 699, "China"], [700, 709, "Norway"],
  [730, 739, "Sweden"], [750, 750, "Mexico"], [754, 755, "Canada"],
  [760, 769, "Switzerland"], [789, 790, "Brazil"], [800, 839, "Italy"],
  [840, 849, "Spain"], [858, 858, "Slovakia"], [859, 859, "Czechia"],
  [860, 860, "Serbia"], [868, 869, "Türkiye"], [870, 879, "Netherlands"],
  [880, 881, "South Korea"], [885, 885, "Thailand"], [888, 888, "Singapore"],
  [890, 890, "India"], [893, 893, "Vietnam"], [899, 899, "Indonesia"],
  [900, 919, "Austria"], [930, 939, "Australia"], [940, 949, "New Zealand"],
  [955, 955, "Malaysia"],
];

type Allocation = { prefix: string; title: string; text: string };

function gs1Allocation(gtin13: string): Allocation | undefined {
  const prefix = gtin13.slice(0, 3);
  const number = Number(prefix);
  const special = (length: number, title: string, text: string): Allocation => ({
    prefix: gtin13.slice(0, length), title, text,
  });
  if (gtin13.startsWith("0000000")) return special(7, "Internal circulation", "This range is used for numbers that circulate within one company.");
  if (/^00000[0-9]{2}/.test(gtin13)) return special(7, "Unused allocation range", "GS1 leaves this range unused to avoid collisions with GTIN-8. A matching check digit does not make it an assigned GTIN.");
  if (/^0000[1-9]/.test(gtin13)) return { prefix: gtin13.slice(0, 5), title: "GS1 US", text: "This prefix is allocated through GS1 US. It does not identify the product's country of manufacture." };
  if (/^000[1-9]/.test(gtin13)) return { prefix: gtin13.slice(0, 4), title: "GS1 US", text: "This prefix is allocated through GS1 US. It does not identify the product's country of manufacture." };
  if (number >= 20 && number <= 29) return special(3, "Regional circulation", "This range is reserved for restricted circulation within a geographic region. Local rules can give some digits a price or weight meaning.");
  if (number >= 40 && number <= 49) return special(3, "Internal circulation", "This range is for use within a company, so its digits follow that company's numbering scheme.");
  if (number >= 50 && number <= 59) return special(3, "Reserved by GS1 US", "This range is reserved for future use. A correct check digit does not establish a valid allocation.");
  if (number >= 200 && number <= 299) return special(2, "Regional circulation", "These opening digits are for restricted regional use. A retailer's scheme can include price or weight, so the rest needs that scheme's rules.");
  if (number === 952) return special(3, "Demonstrations & examples", "GS1 reserves this prefix for examples of its system. It is useful for learning, rather than identifying a real product.");
  if (number === 977) return special(3, "Serial publications", "This allocation is for ISSN-based publication numbers, such as magazines. The remaining digits follow the publication scheme.");
  if (gtin13.startsWith("9790")) return special(4, "Printed music (ISMN)", "The 979-0 allocation identifies notated music publications through the ISMN system. It is not a country prefix.");
  if (number === 978 || number === 979) return special(3, "Publication numbering", "These are publication allocations, commonly ISBNs for books. They are not country prefixes.");
  if (number === 980) return special(3, "Refund receipts", "This prefix is allocated to refund receipts rather than an ordinary product-number structure.");
  if ((number >= 981 && number <= 983) || number >= 990) return special(number >= 990 ? 2 : 3, "Coupons", "This allocation is for coupon identification. Its remaining digits follow the applicable coupon scheme.");
  const allocation = COMMON_GS1_ALLOCATIONS.find(([first, last]) => number >= first && number <= last);
  return allocation ? {
    prefix, title: `GS1 ${allocation[2]}`,
    text: "This identifies the GS1 organisation that allocated the prefix. The product could be made anywhere in the world.",
  } : undefined;
}

const FORMATS: Record<BarcodeKind, FormatFacts> = {
  ean13: {
    hook: "The last digit checks the other twelve.",
    details: [
      { title: "Who assigned it, not where it was made", text: "For ordinary product numbers, the opening GS1 prefix identifies the allocating organisation. For example: 859 is Czechia, 858 Slovakia, and 590 Poland." },
      { title: "The company / product split moves", text: "The allocation prefix is part of the longer GS1 Company Prefix. Its length varies, so you cannot reliably split the remaining digits into company and item just by counting. Publication and restricted-use ranges have their own structures." },
      { title: "An ID, not a product description", text: "An ordinary GTIN identifies the item. The shop looks up its name and price in a database; those details are not spelled out by the number." },
    ],
    sources: [{ label: "GS1 prefixes", url: GS1_PREFIXES }, { label: "GTIN structure", url: GTIN_STRUCTURE }, { label: "Check digit", url: GS1_CHECK_DIGIT }],
  },
  upca: {
    hook: "UPC-A and an EAN-13 starting with zero can describe the same item.",
    details: [
      { title: "Eleven data digits + one check digit", text: "The data combines an allocated company prefix and an item reference. Their lengths can vary; a fixed five-digit manufacturer / five-digit product split is not universal." },
      { title: "The invisible leading zero", text: "For GS1 prefix lookup, add a zero before the 12-digit UPC. For example, a UPC starting 614 has GS1 prefix 061, not 614. EAN-13 with that leading zero has the same bar pattern." },
      { title: "Allocation is not origin", text: "A GS1 allocation does not tell you where the product was manufactured. Restricted circulation and coupon ranges can follow different numbering rules." },
    ],
    sources: [{ label: "GS1 prefixes", url: GS1_PREFIXES }, { label: "GTIN structure", url: GTIN_STRUCTURE }, { label: "Check digit", url: GS1_CHECK_DIGIT }],
  },
  ean8: {
    hook: "Eight digits for small packaging, with a number of its own.",
    details: [
      { title: "Seven data digits + one check digit", text: "A GTIN-8 combines a GS1-8 allocation prefix, an item reference and the final check digit. The prefix length can vary." },
      { title: "Small symbol, separate assignment", text: "EAN-8 is not made by cutting digits off EAN-13. The shorter number must be separately assigned, which preserves its uniqueness." },
      { title: "White space is part of the design", text: "Both sides need a clear margin of seven narrow modules. Cropping this quiet zone can make an otherwise correct code difficult to scan." },
    ],
    sources: [{ label: "GS1 specifications", url: "https://ref.gs1.org/standards/genspecs/" }, { label: "Check digit", url: GS1_CHECK_DIGIT }],
  },
  itf14: {
    hook: "The first digit can distinguish packaging levels; the last checks the number.",
    details: [
      { title: "The first digit is not a quantity", text: "Indicators 1 to 8 distinguish fixed-measure trade item groupings. The brand owner chooses them: 1 does not universally mean one item or one case. Indicator 9 is reserved for variable measure." },
      { title: "A leading zero has a different job", text: "ITF-14 can also carry a shorter GTIN padded to 14 digits with zeros. Padding does not create a new packaging level or change the item identity." },
      { title: "The frame helps the scanner", text: "The heavy bearer bars help prevent a partial scan through only the top or bottom of the symbol." },
    ],
    sources: [{ label: "GS1 indicators", url: "https://www.gs1.org/standards/gs1-healthcare-gtin-allocation-rules-standard/current-standard" }, { label: "GS1 specifications", url: "https://ref.gs1.org/standards/genspecs/" }, { label: "Check digit", url: GS1_CHECK_DIGIT }],
  },
  code128: {
    hook: "Some bars are instructions to the scanner, not characters you typed.",
    details: [
      { title: "Start, data, check, stop", text: "The symbol includes a start pattern, your encoded content, a modulo-103 checksum and a stop pattern. The checksum is carried in the bars, not added to the readable text." },
      { title: "Three alphabets in one", text: "Code sets A, B and C let the encoder switch between character groups. Set C packs a pair of digits into one symbol character, making numeric runs especially efficient." },
      { title: "GS1-128 adds another layer", text: "GS1-128 uses a special FNC1 marker and GS1 Application Identifiers for fields such as GTIN, batch and expiry. The ordinary Code 128 generated here does not assign those meanings to your text." },
    ],
    sources: [{ label: "Code 128 technical guide", url: ZINT }],
  },
  qr: {
    hook: "The three big corner squares help a scanner find its bearings.",
    details: [
      { title: "A map, as well as a message", text: "Finder squares locate the code. Timing patterns help establish the grid, while alignment patterns in larger versions help correct distortion." },
      { title: "Some of the grid is a repair kit", text: "Error correction adds redundant information so a reader can recover some damaged data. Higher correction can require a larger grid; it is not a promise that any covered area will still scan." },
      { title: "Born on the factory floor", text: "DENSO introduced QR Code in 1994 to help handle manufacturing information. QR stands for Quick Response." },
    ],
    sources: [{ label: "DENSO QR structure", url: "https://www.qrcode.com/en/about/" }, { label: "Error correction", url: "https://www.qrcode.com/en/about/error_correction.html" }, { label: "QR history", url: "https://www.qrcode.com/en/history/" }],
  },
  microqr: {
    hook: "One finder square instead of three leaves more room for a tiny message.",
    details: [
      { title: "Four small grids", text: "Versions M1 to M4 use 11, 13, 15 and 17 modules per side. The selected version depends on both your content and error correction." },
      { title: "Digits go further", text: "Numeric data packs more tightly than general text. The largest version can hold up to 35 digits at its lowest correction level; mixed text fits much less." },
      { title: "A smaller border too", text: "Micro QR needs two clear modules around the symbol, compared with four for standard QR. Its compact design also needs explicit support from the scanner." },
    ],
    sources: [{ label: "DENSO Micro QR", url: "https://www.qrcode.com/en/codes/microqr.html" }],
  },
  rmqr: {
    hook: "A rectangle by design, with every tiny module still square.",
    details: [
      { title: "A finder and a smaller partner", text: "rMQR uses one main finder pattern and a smaller subpattern to save space along a narrow strip." },
      { title: "The version names give away the shape", text: "R7x43 means 7 rows by 43 columns before the quiet zone. The format has a fixed menu of grids, rather than allowing an ordinary QR to be stretched." },
      { title: "A younger QR relative", text: "rMQR received ISO approval in May 2022. Its grids range from 7 × 43 to 17 × 139 modules, with room for up to 361 digits in the largest configuration." },
    ],
    sources: [{ label: "DENSO rMQR", url: "https://www.qrcode.com/en/codes/rmqr.html" }],
  },
  datamatrix: {
    hook: "Look for the solid L along two edges: it tells the reader how to orient the code.",
    details: [
      { title: "An L and a clock", text: "The solid L locates and orients each data region. The opposite edges alternate light and dark to help the reader count the rows and columns." },
      { title: "Room for recovery", text: "The ECC 200 format includes Reed-Solomon error correction alongside the data. Both square and rectangular layouts use square modules." },
      { title: "GS1 DataMatrix has structured fields", text: "GS1 DataMatrix adds an initial FNC1 marker and Application Identifiers: 01 for a GTIN, 17 for expiry and 10 for a batch. Plain Data Matrix, as generated here, does not automatically turn text into those fields." },
    ],
    sources: [{ label: "GS1 DataMatrix structure", url: "https://www.gs1greece.org/DNLfiles/srvNhelp/GS1_DataMatrix_Introduction_and_technical_overview.pdf" }, { label: "GS1 data fields", url: "https://ref.gs1.org/guidelines/2d-in-retail/" }],
  },
  aztec: {
    hook: "The square bullseye is in the middle, rather than the corners.",
    details: [
      { title: "Built around a centre", text: "A central finder pattern gives the reader its reference point, with encoded data arranged around it." },
      { title: "Two families of symbol", text: "Compact Aztec uses a smaller central finder. Full-range Aztec offers larger symbols for more data; the encoder chooses a suitable size for your message." },
      { title: "Recovery takes space", text: "Extra error-correction information lets the reader recover some damaged data. Both that redundancy and your message contribute to the final symbol size." },
    ],
    sources: [{ label: "Aztec technical guide", url: ZINT }],
  },
  pdf417: {
    hook: "The 417 in its name describes the pattern of the bars.",
    details: [
      { title: "Four bars, seventeen modules", text: "Each ordinary codeword uses four bars and four spaces across 17 narrow modules. PDF stands for Portable Data File." },
      { title: "A stack that reads as one message", text: "Rows carry data together with start and stop patterns and row indicators. Those indicators help the reader reconstruct the whole symbol." },
      { title: "More than an ID number", text: "PDF417 can store a record in the symbol itself, which is useful for offline reading. Error-correction codewords help recover damaged data, but a ticket or ID system still defines what that record means." },
    ],
    sources: [{ label: "PDF417 technical guide", url: "https://www.barcodefaq.com/2d/pdf417/" }],
  },
};

const GTIN_LENGTHS: Partial<Record<BarcodeKind, number>> = { ean13: 13, upca: 12, ean8: 8, itf14: 14 };

export function getBarcodeFacts(
  kind: BarcodeKind,
  encoded?: string,
  symbol?: Pick<RenderedBarcode, "moduleColumns" | "moduleRows" | "symbolVersion"> | null,
): BarcodeFacts {
  const facts: BarcodeFacts = { ...FORMATS[kind] };
  const length = GTIN_LENGTHS[kind];
  if (length) {
    facts.badge = `${length} digits`;
    // Do not annotate incomplete input or imply that an invalid checksum passed.
    if (!encoded || encoded.length !== length || !/^\d+$/.test(encoded)) return facts;
    const base = encoded.slice(0, -1);
    const weightedTotal = [...base].reverse().reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 1 : 3), 0);
    const checkDigit = Number(encoded.at(-1));
    if ((weightedTotal + checkDigit) % 10 !== 0) return facts;
    facts.checksum = `Weight the data digits alternately ×3 and ×1, starting from the right. For your value, the sum is ${weightedTotal}; ${weightedTotal} + ${checkDigit} = ${weightedTotal + checkDigit}, a multiple of 10.`;
    facts.segments = [{ value: base, label: "Identifier", tone: "data" }, { value: String(checkDigit), label: "Check", tone: "check" }];
    if (kind === "ean13") {
      const allocation = gs1Allocation(encoded);
      if (allocation) {
        facts.segments = [
          { value: allocation.prefix, label: "Prefix", tone: "prefix" },
          { value: base.slice(allocation.prefix.length), label: "Rest of ID", tone: "data" },
          { value: String(checkDigit), label: "Check", tone: "check" },
        ];
        facts.insight = { title: `${allocation.prefix} · ${allocation.title}`, text: allocation.text };
        if (allocation.prefix === "9790") facts.sources = [...facts.sources, { label: "ISMN music numbers", url: "https://ismn-international.org/ismn/the-ismn/" }];
      } else {
        facts.insight = { title: "Allocation needs a lookup", text: "These opening digits are not in this app's short offline prefix list. Follow GS1 prefixes below for the full list; this is not a verdict on the number's validity." };
      }
    } else if (kind === "upca") {
      const allocation = gs1Allocation(`0${encoded}`);
      facts.insight = {
        title: `EAN-13 equivalent: 0${encoded}`,
        text: allocation ? `With the implied zero, the prefix is ${allocation.prefix}: ${allocation.title}. ${allocation.text}` : "The extra leading zero preserves the same identity and bar pattern. This prefix is not in the app's short allocation list; GS1 has the full list.",
      };
    } else if (kind === "itf14") {
      const indicator = encoded[0];
      facts.segments = [
        { value: indicator, label: indicator === "0" ? "Padding" : "Indicator", tone: "prefix" },
        { value: base.slice(1), label: "Rest of ID", tone: "data" },
        { value: String(checkDigit), label: "Check", tone: "check" },
      ];
      facts.insight = indicator === "0"
        ? { title: "0 · A shorter GTIN, padded", text: "The leading zero fills the 14-digit field. It does not identify a new packaging level." }
        : indicator === "9"
          ? { title: "9 · Variable measure", text: "This indicator is reserved for a trade item with a variable measure, such as weight or count." }
          : { title: `${indicator} · Packaging indicator`, text: "This distinguishes a trade item grouping under the brand owner's scheme. It does not specify the number of items inside." };
    }
    return facts;
  }
  if (symbol?.moduleColumns && symbol.moduleRows && kind !== "pdf417") {
    const grid = `${symbol.moduleColumns} × ${symbol.moduleRows}`;
    facts.badge = kind === "qr"
      ? `V${(symbol.moduleColumns - 17) / 4} · ${grid}`
      : kind === "microqr"
        ? `M${(symbol.moduleColumns - 9) / 2} · ${grid}`
        : kind === "rmqr" && symbol.symbolVersion
          ? symbol.symbolVersion
          : `${grid} modules`;
  }
  return facts;
}
