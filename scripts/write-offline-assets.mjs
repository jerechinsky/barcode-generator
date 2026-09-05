import { readdir, readFile, writeFile } from "node:fs/promises";

const client = new URL("../dist/client/", import.meta.url);
const files = await readdir(client, { recursive: true });
const assets = files.filter((file) => /\.(?:js|css|woff2?)$/.test(file) && file !== "sw.js")
  .sort().map((file) => `/${file}`);
if (!assets.some((file) => file.endsWith(".js"))) throw new Error("Missing offline application scripts.");
const { version } = JSON.parse(await readFile(new URL("version.json", client), "utf8"));
const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const worker = source
  .replace('const CACHE_NAME = "barcode-generator-pwa-v3";', `const CACHE_NAME = ${JSON.stringify(`barcode-generator-pwa-${version}`)};`)
  .replace("const BUILD_ASSETS = [];", `const BUILD_ASSETS = ${JSON.stringify(assets)};`);
await writeFile(new URL("sw.js", client), worker);
