# Barcode Generator

A self-hostable barcode generator for QR, rMQR, Micro QR, Aztec, PDF417,
EAN-13, UPC-A, EAN-8, ITF-14, Code 128, and square or rectangular Data Matrix.
Generation happens entirely in the browser. Barcode content is saved only in
that browser so compatible matrix and stacked formats can reuse the same value.

## Run locally

```sh
npm install
npm run dev
```

Open `http://localhost:3000`.

## Run on a server with Docker

```sh
docker compose up -d --build
```

The service listens on port `3000`. Put it behind the HTTPS reverse proxy or
private access layer already used by the server before sharing it externally.

## Production without Docker

```sh
npm ci
npm run build
npm run start -- --hostname 0.0.0.0 --port 3000
```

## Export behavior

- SVG files contain paths, including human-readable OCR-B digits, so the
  recipient does not need the font installed.
- PNG files are rasterized to the selected 300, 600, or 1200 DPI pixel count.
- GTIN check digits are calculated and validated locally.
- Required quiet zones are included automatically.
- General-purpose content carries across QR, rMQR, Micro QR, Data Matrix,
  Aztec, and PDF417, while retail number drafts stay separate.
- The current value and selected format persist in local browser storage and
  can be reset to the built-in examples.
