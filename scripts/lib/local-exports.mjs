import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const keyPattern =
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/(archive\.zip|manifest\.json)$/;
export function archivePath(root, key) {
  if (!keyPattern.test(key)) throw new Error("Invalid export path");
  return path.join(path.resolve(root), key);
}
export function signDownload(key, expires, secret) {
  archivePath(".", key);
  if (!secret || secret.length < 32)
    throw new Error(
      "EXPORT_DOWNLOAD_SECRET must contain at least 32 characters",
    );
  return createHmac("sha256", secret)
    .update(`${key}\n${expires}`)
    .digest("hex");
}
export function verifyDownload(
  key,
  expires,
  signature,
  secret,
  now = Date.now(),
) {
  if (
    !/^\d+$/.test(expires) ||
    Number(expires) < Math.floor(now / 1000) ||
    Number(expires) > Math.floor(now / 1000) + 901
  )
    return false;
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(signDownload(key, expires, secret), "hex"),
    );
  } catch {
    return false;
  }
}
export function startDownloadServer({
  root,
  secret,
  host = "127.0.0.1",
  port = 3101,
}) {
  // Validate configuration before binding or accepting jobs.
  signDownload(
    "00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000/archive.zip",
    0,
    secret,
  );
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    try {
      const url = new URL(req.url, "http://localhost");
      const key = url.pathname.slice(1);
      if (
        !verifyDownload(
          key,
          url.searchParams.get("expires") ?? "",
          url.searchParams.get("signature") ?? "",
          secret,
        )
      ) {
        res.writeHead(403).end("Download link invalid or expired");
        return;
      }
      const file = archivePath(root, key);
      const info = await stat(file);
      if (!info.isFile()) {
        res.writeHead(404).end();
        return;
      }
      let start = 0,
        end = info.size - 1,
        status = 200;
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!match || (!match[1] && !match[2])) {
          res.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end();
          return;
        }
        start = match[1]
          ? Number(match[1])
          : Math.max(0, info.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start > end ||
          start >= info.size
        ) {
          res.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end();
          return;
        }
        status = 206;
        res.setHeader("Content-Range", `bytes ${start}-${end}/${info.size}`);
      }
      res.setHeader(
        "Content-Type",
        key.endsWith(".zip") ? "application/zip" : "application/json",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="sv5t-${key.split("/")[0]}.${key.endsWith(".zip") ? "zip" : "json"}"`,
      );
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", end - start + 1);
      res.writeHead(status);
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      await pipeline(createReadStream(file, { start, end }), res);
    } catch {
      if (!res.headersSent) res.writeHead(404).end("Export unavailable");
      else res.destroy();
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}
