import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Barcode Generator · Print-ready barcode maker";
const description =
  "A standards-aware barcode maker for QR, rMQR, Micro QR, Aztec, PDF417, Data Matrix, EAN, UPC, ITF-14, and Code 128.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const localHost = host.startsWith("localhost") || host.startsWith("127.");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (localHost ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og-v2.png`;

  return {
    title,
    description,
    icons: {
      icon: [
        { url: "/favicon.ico?v=barcode-generator1", sizes: "any" },
        { url: "/favicon.svg?v=barcode-generator1", type: "image/svg+xml" },
      ],
      shortcut: "/favicon.ico?v=barcode-generator1",
      apple: [{ url: "/apple-touch-icon.png?v=barcode-generator1", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "Barcode Generator" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#e7ff45" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Barcode Generator" />
      </head>
      <body>{children}</body>
    </html>
  );
}
