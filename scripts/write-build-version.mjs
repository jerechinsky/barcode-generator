import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const versionPath = fileURLToPath(new URL("../public/version.json", import.meta.url));
await writeFile(versionPath, `${JSON.stringify({ version: randomUUID() })}\n`, "utf8");
