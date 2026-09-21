import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";
import { pipeline, finished } from "node:stream/promises";
import { ZipArchive } from "archiver";
import ExcelJS from "exceljs";

export async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

// All bytes go to the worker's private disk. No writes to object storage.
export async function buildExport({
  job,
  directory,
  loadPage,
  loadFile,
  signal,
}) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const partial = path.join(directory, "archive.zip.part");
  const archive = path.join(directory, "archive.zip");
  const zip = new ZipArchive({ zlib: { level: 1 } });
  const completion = pipeline(
    zip,
    createWriteStream(partial, { flags: "wx", mode: 0o600 }),
    { signal },
  );
  completion.catch(() => {});
  const workbookStream = new PassThrough();
  const abortWorkbook = () =>
    workbookStream.destroy(new Error("Export stream closed"));
  zip.on("error", abortWorkbook);
  const book = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: workbookStream,
  });
  const sheet = book.addWorksheet("Hồ sơ");
  sheet.columns = [
    { header: "MSSV", key: "mssv", width: 20 },
    { header: "Họ tên", key: "name", width: 30 },
    { header: "Lớp", key: "class", width: 20 },
    { header: "Email", key: "email", width: 30 },
    { header: "Loại", key: "type", width: 20 },
    { header: "Trạng thái", key: "status", width: 24 },
    { header: "Lý do", key: "reason", width: 50 },
  ];
  zip.append(workbookStream, { name: "ho-so.xlsx" });
  const manifest = {
    version: 2,
    campaignId: job.campaign_id,
    exportId: job.id,
    createdAt: new Date().toISOString(),
    applications: [],
  };
  const files = [];
  try {
    for (let offset = 0; ; offset += 200) {
      signal?.throwIfAborted();
      const rows = await loadPage(offset);
      for (const a of rows) {
        manifest.applications.push(a);
        sheet
          .addRow({
            mssv: a.users?.mssv,
            name: a.users?.full_name,
            class: a.users?.class_name,
            email: a.users?.email,
            type: a.type,
            status: a.status,
            reason: a.rejection_reason,
          })
          .commit();
        for (const f of a.application_files)
          files.push({ application: a.id, ...f });
      }
      if (rows.length < 200) break;
    }
    sheet.commit();
    await book.commit();
    for (const file of files) {
      signal?.throwIfAborted();
      const object = await loadFile(file);
      if (Number(object.ContentLength) !== Number(file.file_size_bytes)) {
        object.Body.destroy();
        throw new Error("Export file size mismatch");
      }
      // Install stream listeners before archiver starts reading.
      const consumed = finished(object.Body, { cleanup: true, signal });
      const destroySource = () =>
        object.Body.destroy(new Error("Archive destination failed"));
      zip.once("error", destroySource);
      const safe = file.original_name.replace(/[\\/\x00-\x1f]/g, "_");
      zip.append(object.Body, {
        name: `minh-chung/${file.application}/${file.file_type}-${safe}`,
      });
      try {
        await consumed;
      } finally {
        zip.off("error", destroySource);
      }
    }
    const json = JSON.stringify(manifest, null, 2);
    zip.append(json, { name: "manifest.json" });
    await zip.finalize();
    await completion;
    await writeFile(path.join(directory, "manifest.json"), json, {
      mode: 0o600,
    });
    await rename(partial, archive);
    const info = await stat(archive);
    return {
      recordCount: manifest.applications.length,
      archiveBytes: info.size,
      sha256: await hashFile(archive),
    };
  } catch (error) {
    zip.abort();
    zip.destroy();
    workbookStream.destroy();
    await completion.catch(() => {});
    await rm(directory, { recursive: true, force: true });
    throw error;
  } finally {
    zip.off("error", abortWorkbook);
  }
}
