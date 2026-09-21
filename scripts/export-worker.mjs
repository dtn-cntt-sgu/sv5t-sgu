// Durable export and cleanup worker. Run on a machine with Node 20+; never inside a short-lived request.
import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { ZipArchive } from "archiver";
import ExcelJS from "exceljs";
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];
for (const name of required)
  if (!process.env[name]) throw new Error(`Missing ${name}`);
const secret =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) throw new Error("Missing Supabase server credential");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const bucket = process.env.R2_BUCKET_NAME;
const workerId = randomUUID();
async function check(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data;
}
async function exportJob(job) {
  const archiveKey = `exports/${job.campaign_id}/${job.id}/archive.zip`;
  const manifestKey = `exports/${job.campaign_id}/${job.id}/manifest.json`;
  const zip = new ZipArchive({ zlib: { level: 1 } });
  const body = new PassThrough();
  zip.pipe(body);
  zip.on("error", (e) => body.destroy(e));
  const upload = new Upload({
    client: r2,
    params: {
      Bucket: bucket,
      Key: archiveKey,
      Body: body,
      ContentType: "application/zip",
    },
    queueSize: 2,
    partSize: 8 * 1024 ** 2,
  });
  const completion = upload.done();
  completion.catch(() => {});
  const manifest = {
    version: 1,
    campaignId: job.campaign_id,
    exportId: job.id,
    createdAt: new Date().toISOString(),
    applications: [],
  };
  let offset = 0,
    count = 0;
  const workbookStream = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: workbookStream,
  });
  const sheet = workbook.addWorksheet("Hồ sơ");
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
  const heartbeat = setInterval(() => {
    void db
      .from("campaign_exports")
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("worker_token", workerId)
      .then(({ error }) => {
        if (error) body.destroy(new Error("Worker heartbeat failed"));
      });
  }, 30000);
  try {
    // Add workbook first, but do not append evidence until it is committed: ZIP consumes entries sequentially.
    const files = [];
    while (true) {
      const rows = await check(
        db
          .from("applications")
          .select(
            "*,users!applications_user_id_fkey(*),application_files(*,file_review_logs(*))",
          )
          .eq("campaign_id", job.campaign_id)
          .order("id")
          .range(offset, offset + 199),
      );
      for (const a of rows) {
        manifest.applications.push(a);
        count++;
        sheet
          .addRow({
            mssv: a.users.mssv,
            name: a.users.full_name,
            class: a.users.class_name,
            email: a.users.email,
            type: a.type,
            status: a.status,
            reason: a.rejection_reason,
          })
          .commit();
        for (const f of a.application_files)
          files.push({ application: a.id, ...f });
      }
      if (rows.length < 200) break;
      offset += 200;
    }
    sheet.commit();
    await workbook.commit();
    for (const f of files) {
      const object = await r2.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: f.r2_key,
          IfMatch: f.r2_etag || undefined,
        }),
      );
      if (Number(object.ContentLength) !== Number(f.file_size_bytes))
        throw new Error("Export file size mismatch");
      const safe = f.original_name.replace(/[\\/\x00-\x1f]/g, "_");
      zip.append(object.Body, {
        name: `minh-chung/${f.application}/${f.file_type}-${safe}`,
      });
      await new Promise((resolve, reject) => {
        object.Body.once("end", resolve);
        object.Body.once("error", reject);
      });
    }
    const manifestBody = JSON.stringify(manifest, null, 2);
    zip.append(manifestBody, { name: "manifest.json" });
    await zip.finalize();
    await completion;
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: manifestKey,
        Body: manifestBody,
        ContentType: "application/json",
      }),
    );
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: archiveKey }));
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: manifestKey }));
    await check(
      db
        .from("campaign_exports")
        .update({
          status: "READY",
          archive_r2_key: archiveKey,
          manifest_r2_key: manifestKey,
          record_count: count,
          completed_at: new Date().toISOString(),
          heartbeat_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", job.id)
        .eq("worker_token", workerId),
    );
    console.log(`Export ${job.id}: READY (${count} records)`);
  } catch (error) {
    zip.abort();
    body.destroy();
    await upload.abort();
    await check(
      db
        .from("campaign_exports")
        .update({
          status: "FAILED",
          error_message:
            "Xuất lưu trữ thất bại. Kiểm tra kết nối worker/R2 rồi tạo lại bản xuất.",
        })
        .eq("id", job.id)
        .eq("worker_token", workerId),
    );
    console.error(
      `Export ${job.id}: FAILED`,
      error?.code ?? error?.name ?? "ERROR",
    );
  } finally {
    clearInterval(heartbeat);
  }
}
async function cleanupJob(job) {
  await check(
    db
      .from("campaign_exports")
      .update({
        cleanup_status: "RUNNING",
        heartbeat_at: new Date().toISOString(),
      })
      .eq("id", job.id),
  );
  try {
    while (true) {
      const list = await r2.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: `campaigns/${job.campaign_id}/`,
          MaxKeys: 500,
        }),
      );
      if (!list.Contents?.length) break;
      const deleted = await r2.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: list.Contents.map((o) => ({ Key: o.Key })),
            Quiet: true,
          },
        }),
      );
      if (deleted.Errors?.length) throw new Error("Partial delete");
      await check(
        db
          .from("campaign_exports")
          .update({ heartbeat_at: new Date().toISOString() })
          .eq("id", job.id),
      );
    }
    await check(
      db
        .from("campaign_exports")
        .update({ cleanup_status: "DONE" })
        .eq("id", job.id),
    );
    console.log(`Cleanup ${job.id}: DONE`);
  } catch {
    await check(
      db
        .from("campaign_exports")
        .update({ cleanup_status: "FAILED" })
        .eq("id", job.id),
    );
    console.error(`Cleanup ${job.id}: FAILED, will retry`);
  }
}
async function tick() {
  const job = await check(db.rpc("claim_export", { worker_id: workerId }));
  if (job?.id) {
    console.log(`Export ${job.id}: processing`);
    await exportJob(job);
  } else {
    console.log("No export waiting for this worker.");
  }
  if (process.argv.includes("--exports-only")) return;
  const cleanup = await check(
    db
      .from("campaign_exports")
      .select("*")
      .in("cleanup_status", ["PENDING", "FAILED"])
      .limit(1),
  );
  if (cleanup?.[0]) await cleanupJob(cleanup[0]);
}
console.log("Export worker started; checking the queue.");
do {
  await tick();
  if (process.argv.includes("--once")) break;
  await new Promise((r) => setTimeout(r, 10000));
} while (true);
