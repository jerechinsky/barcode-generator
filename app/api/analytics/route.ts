import { recordAnonymousAnalyticsEvent } from "../../analytics-store";
import { BARCODE_TYPES, type BarcodeKind } from "../../barcode";

const BARCODE_KINDS = new Set<BarcodeKind>(BARCODE_TYPES.map((type) => type.id));

function countryFrom(request: Request): string {
  const country = request.headers.get("cf-ipcountry")?.toUpperCase() ?? "XX";
  return /^[A-Z0-9]{2}$/.test(country) ? country : "XX";
}

export async function POST(request: Request) {
  let payload: { event?: unknown; barcodeKind?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid analytics event" }, { status: 400 });
  }

  if (payload.event !== "visit" && payload.event !== "generation") {
    return Response.json({ error: "Invalid analytics event" }, { status: 400 });
  }

  const barcodeKind = payload.barcodeKind;
  if (
    payload.event === "generation" &&
    (typeof barcodeKind !== "string" || !BARCODE_KINDS.has(barcodeKind as BarcodeKind))
  ) {
    return Response.json({ error: "Invalid barcode format" }, { status: 400 });
  }

  const stored = await recordAnonymousAnalyticsEvent({
    event: payload.event,
    barcodeKind: payload.event === "generation" ? barcodeKind as BarcodeKind : null,
    country: countryFrom(request),
  });
  if (!stored) return Response.json({ error: "Analytics unavailable" }, { status: 503 });

  return new Response(null, { status: 204 });
}
