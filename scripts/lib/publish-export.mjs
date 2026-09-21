import { createReadStream } from "node:fs";
import path from "node:path";
import { Upload } from "@aws-sdk/lib-storage";

export async function publishExport({
  client,
  bucket,
  prefix,
  directory,
  signal,
  createUpload = (options) => new Upload(options),
}) {
  // Publish both objects before exposing a READY download. Each attempt has its own prefix.
  for (const [name, contentType] of [
    ["archive.zip", "application/zip"],
    ["manifest.json", "application/json"],
  ]) {
    signal.throwIfAborted();
    const body = createReadStream(path.join(directory, name));
    const upload = createUpload({
      client,
      params: {
        Bucket: bucket,
        Key: `${prefix}/${name}`,
        Body: body,
        ContentType: contentType,
      },
      leavePartsOnError: false,
    });
    const abort = () => {
      void upload.abort().catch(() => {});
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      signal.throwIfAborted();
      await upload.done();
      signal.throwIfAborted();
    } finally {
      signal.removeEventListener("abort", abort);
      body.destroy();
    }
  }
}
