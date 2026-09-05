import type { BarcodeKind } from "./barcode";

const ANALYTICS_ORIGIN = process.env.CODEFORM_ANALYTICS_INTERNAL_URL ?? "http://127.0.0.1:3101";

export type AnalyticsSummary = {
  totals: { visits: number; generations: number };
  formats: Array<{ barcodeKind: string | null; count: number }>;
  visits: Array<{ id: number; country: string; occurredAt: string }>;
};

export async function recordAnonymousAnalyticsEvent(event: {
  event: "visit" | "generation";
  barcodeKind: BarcodeKind | null;
  country: string;
}): Promise<boolean> {
  try {
    const response = await fetch(`${ANALYTICS_ORIGIN}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(1_500),
    });
    return response.status === 204;
  } catch {
    return false;
  }
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary | null> {
  try {
    const response = await fetch(`${ANALYTICS_ORIGIN}/summary`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return null;
    return await response.json() as AnalyticsSummary;
  } catch {
    return null;
  }
}
