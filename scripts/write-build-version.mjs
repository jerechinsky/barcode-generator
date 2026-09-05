import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const versionPath = fileURLToPath(new URL("../public/version.json", import.meta.url));
const modulePath = fileURLToPath(new URL("../app/build-version.json", import.meta.url));
const contents = `${JSON.stringify({ version: randomUUID() })}\n`;
await Promise.all([
  writeFile(versionPath, contents, "utf8"),
  writeFile(modulePath, contents, "utf8"),
]);
