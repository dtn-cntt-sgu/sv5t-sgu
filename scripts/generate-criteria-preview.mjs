// Requires Poppler (pdfinfo and pdftoppm). Run after replacing the criteria PDF.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, mkdir, readdir, writeFile } from "node:fs/promises";
const input = "assets/Bộ tiêu chuẩn & Hướng dẫn danh hiệu sv5t cấp TP.pdf";
const hash = createHash("sha256")
  .update(await readFile(input))
  .digest("hex")
  .slice(0, 12);
const folder = `public/criteria-preview/${hash}`;
await mkdir(folder, { recursive: true });
execFileSync("pdftoppm", [
  "-scale-to",
  "1400",
  "-jpeg",
  "-jpegopt",
  "quality=85",
  input,
  `${folder}/page`,
]);
const info = execFileSync("pdfinfo", [input], { encoding: "utf8" });
const size = info.match(/Page size:\s+([\d.]+) x ([\d.]+)/);
if (!size) throw new Error("Cannot determine page size");
const scale = 1400 / Math.max(Number(size[1]), Number(size[2]));
const pages = (await readdir(folder))
  .filter((name) => name.endsWith(".jpg"))
  .sort();
const count = Number(info.match(/Pages:\s+(\d+)/)?.[1]);
if (count !== pages.length) throw new Error("Incomplete preview");
await writeFile(
  "components/criteria-preview.json",
  JSON.stringify(
    {
      sourceSha256: hash,
      width: Math.ceil(Number(size[1]) * scale),
      height: Math.ceil(Number(size[2]) * scale),
      pages: pages.map((name) => `/criteria-preview/${hash}/${name}`),
    },
    null,
    2,
  ) + "\n",
);
console.log(`Generated ${pages.length} static preview pages.`);
