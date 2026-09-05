import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAnalyticsSummary } from "../../analytics-store";
import { BARCODE_TYPES } from "../../barcode";
import { isOwnerAccessRequest } from "../../cloudflare-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics · Barcode Generator",
  robots: { index: false, follow: false },
};

const formatLabels = new Map<string, string>(BARCODE_TYPES.map((type) => [type.id, type.label]));
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code: string) {
  if (code === "XX") return "Unknown";
  if (code === "T1") return "Tor network";
  return regionNames.of(code) ?? code;
}

function visitTime(value: string) {
  const utc = value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Prague",
  }).format(new Date(utc));
}

export default async function AnalyticsPage() {
  if (!await isOwnerAccessRequest()) notFound();

  const summary = await getAnalyticsSummary();
  if (!summary) throw new Error("Analytics storage is unavailable");
  const { visits, formats, totals } = summary;

  return (
    <main className="analytics-shell">
      <header className="analytics-header">
        <div>
          <span className="analytics-kicker">OWNER VIEW</span>
          <h1>Analytics</h1>
          <p>Anonymous events from the last 90 days. Times are shown in Prague time.</p>
        </div>
        <Link href="/">Back to generator</Link>
      </header>

      <section className="analytics-totals" aria-label="Totals">
        <article><span>Visits</span><strong>{totals.visits}</strong></article>
        <article><span>Codes generated</span><strong>{totals.generations}</strong></article>
      </section>

      <div className="analytics-grid">
        <section className="analytics-panel">
          <div className="analytics-panel-heading">
            <h2>Popular formats</h2>
            <span>{formats.length} used</span>
          </div>
          {formats.length ? (
            <ol className="analytics-ranking">
              {formats.map((row) => (
                <li key={row.barcodeKind ?? "unknown"}>
                  <span>{formatLabels.get(row.barcodeKind ?? "") ?? row.barcodeKind ?? "Unknown"}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ol>
          ) : <p className="analytics-empty">No generated codes yet.</p>}
        </section>

        <section className="analytics-panel">
          <div className="analytics-panel-heading">
            <h2>Recent visits</h2>
            <span>Latest 200</span>
          </div>
          {visits.length ? (
            <ol className="analytics-visits">
              {visits.map((visit) => (
                <li key={visit.id}>
                  <strong>{countryName(visit.country)}</strong>
                  <span>{visit.country}</span>
                  <time>{visitTime(visit.occurredAt)}</time>
                </li>
              ))}
            </ol>
          ) : <p className="analytics-empty">No visits recorded yet.</p>}
        </section>
      </div>

      <p className="analytics-privacy">Stored: time, country, event type, and barcode format only. No barcode contents or visitor identifiers.</p>
    </main>
  );
}
