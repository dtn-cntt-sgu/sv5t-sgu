// Run when exports or cleanup are queued. Completed archives are served directly by R2.
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { publishExport } from "./lib/publish-export.mjs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { cleanupExport } from "./lib/cleanup-export.mjs";
import { buildExport, hashFile } from "./lib/build-export.mjs";
import { archivePath } from "./lib/local-exports.mjs";
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
async function ownedUpdate(job, values, cleanup = false) {
  const token = cleanup ? "cleanup_worker_token" : "worker_token";
  const rows = await check(
    db
      .from("campaign_exports")
      .update(values)
      .eq("id", job.id)
      .eq(token, workerId)
      .select("id")
      .abortSignal(AbortSignal.timeout(20000)),
  );
  if (rows.length !== 1) throw new Error("Worker lease lost");
}
function lease(job, cleanup = false) {
  const controller = new AbortController();
  let refreshing = false;
  const refresh = async () => {
    if (refreshing) return;
    refreshing = true;
    try {
      await ownedUpdate(
        job,
        {
          [cleanup ? "cleanup_heartbeat_at" : "heartbeat_at"]:
            new Date().toISOString(),
        },
        cleanup,
      );
    } catch (error) {
      controller.abort(error);
    } finally {
      refreshing = false;
    }
  };
  const timer = setInterval(() => void refresh(), 30000);
  return { signal: controller.signal, stop: () => clearInterval(timer) };
}
function requestSignal(signal) {
  return AbortSignal.any([signal, AbortSignal.timeout(120000)]);
}
async function exportJob(job) {
  const prefix = `exports/${job.campaign_id}/${job.id}/${workerId}`;
  const directory = await mkdtemp(path.join(tmpdir(), "sv5t-export-"));
  const heartbeat = lease(job);
  try {
    const result = await buildExport({
      job,
      directory,
      signal: heartbeat.signal,
      loadPage: (offset) =>
        check(
          db
            .from("applications")
            .select(
              "*,users!applications_user_id_fkey(*),application_files(*,file_review_logs(*))",
            )
            .eq("campaign_id", job.campaign_id)
            .order("id")
            .range(offset, offset + 199)
            .abortSignal(requestSignal(heartbeat.signal)),
        ),
      loadFile: (file) =>
        r2.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: file.r2_key,
            IfMatch: file.r2_etag || undefined,
          }),
          { abortSignal: requestSignal(heartbeat.signal) },
        ),
    });
    heartbeat.signal.throwIfAborted();
    await publishExport({
      client: r2,
      bucket,
      prefix,
      directory,
      signal: heartbeat.signal,
    });
    await ownedUpdate(job, {
      status: "READY",
      storage_backend: "R2",
      local_archive_key: null,
      archive_bytes: result.archiveBytes,
      archive_sha256: result.sha256,
      archive_r2_key: `${prefix}/archive.zip`,
      manifest_r2_key: `${prefix}/manifest.json`,
      record_count: result.recordCount,
      completed_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      error_message: null,
    });
    console.log(
      `Export ${job.id}: READY (${result.recordCount} records, ${result.archiveBytes} bytes on R2)`,
    );
  } catch (error) {
    // Keep published R2 objects if the database acknowledgement was lost.
    await ownedUpdate(job, {
      status: "FAILED",
      error_message:
        "Không thể tạo bản ZIP. Kiểm tra ổ đĩa, kết nối worker/R2 rồi tạo lại.",
    }).catch(() => {});
    console.error(
      `Export ${job.id}: FAILED`,
      error?.code ?? error?.name ?? "ERROR",
    );
  } finally {
    heartbeat.stop();
    await rm(directory, { recursive: true, force: true });
  }
}
async function cleanupJob(job) {
  const heartbeat = lease(job, true);
  try {
    await cleanupExport({
      signal: heartbeat.signal,
      verifyBackup: async () => {
        if (job.storage_backend === "LOCAL") {
          const file = archivePath(
            path.resolve(process.env.EXPORT_LOCAL_DIR || "var/exports"),
            job.local_archive_key,
          );
          const info = await stat(file);
          if (
            info.size !== Number(job.archive_bytes) ||
            (await hashFile(file)) !== job.archive_sha256
          )
            throw new Error("Backup unavailable");
        } else {
          await r2.send(
            new HeadObjectCommand({ Bucket: bucket, Key: job.archive_r2_key }),
            { abortSignal: requestSignal(heartbeat.signal) },
          );
          await r2.send(
            new HeadObjectCommand({ Bucket: bucket, Key: job.manifest_r2_key }),
            { abortSignal: requestSignal(heartbeat.signal) },
          );
        }
      },
      renewLease: () =>
        ownedUpdate(
          job,
          { cleanup_heartbeat_at: new Date().toISOString() },
          true,
        ),
      listObjects: async () => {
        const result = await r2.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: `campaigns/${job.campaign_id}/`,
            MaxKeys: 500,
          }),
          { abortSignal: requestSignal(heartbeat.signal) },
        );
        return result.Contents ?? [];
      },
      deleteObjects: (objects) =>
        r2.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: objects.map((o) => ({ Key: o.Key })),
              Quiet: true,
            },
          }),
          { abortSignal: requestSignal(heartbeat.signal) },
        ),
      finish: () =>
        check(
          db
            .rpc("finish_export_cleanup", {
              target_export_id: job.id,
              worker_id: workerId,
            })
            .abortSignal(AbortSignal.timeout(20000)),
        ),
    });
    console.log(`Cleanup ${job.id}: DONE`);
  } catch (error) {
    await ownedUpdate(
      job,
      {
        cleanup_status: "FAILED",
        cleanup_error:
          "Dọn minh chứng chưa hoàn tất; worker sẽ thử lại. Hồ sơ chưa bị xóa khỏi database.",
        cleanup_retry_at: new Date(Date.now() + 60000).toISOString(),
      },
      true,
    ).catch(() => {});
    console.error(
      `Cleanup ${job.id}: FAILED`,
      error?.code ?? error?.name ?? "ERROR",
    );
  } finally {
    heartbeat.stop();
  }
}
async function tick() {
  const job = await check(db.rpc("claim_export", { worker_id: workerId }));
  if (job?.id) {
    console.log(`Export ${job.id}: processing`);
    await exportJob(job);
  }
  if (process.argv.includes("--exports-only")) return;
  const cleanup = await check(
    db.rpc("claim_export_cleanup", { worker_id: workerId }),
  );
  if (cleanup?.id) await cleanupJob(cleanup);
}
console.log("Export worker started; checking the queue.");
do {
  try {
    await tick();
  } catch (error) {
    console.error("Worker tick failed", error?.code ?? error?.name ?? "ERROR");
    if (process.argv.includes("--once")) process.exitCode = 1;
  }
  if (process.argv.includes("--once")) break;
  await new Promise((resolve) => setTimeout(resolve, 10000));
} while (true);
