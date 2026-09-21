import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2/client";
import { getServerEnv } from "@/lib/config/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require-user";
import { ok, apiError } from "@/lib/api/response";
export async function GET() {
  try {
    await requireUser(["SUPER_ADMIN"]);
    const results = await Promise.allSettled([
      (async () => {
        const signal = AbortSignal.timeout(20000);
        let token: string | undefined;
        let bytes = 0,
          objects = 0;
        do {
          const page = await getR2Client().send(
            new ListObjectsV2Command({
              Bucket: getServerEnv().R2_BUCKET_NAME,
              ContinuationToken: token,
              MaxKeys: 1000,
            }),
            { abortSignal: signal },
          );
          for (const object of page.Contents ?? []) {
            bytes += object.Size ?? 0;
            objects++;
          }
          if (page.IsTruncated && !page.NextContinuationToken)
            throw new Error("Incomplete listing");
          token = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (token);
        return { bytes, objects };
      })(),
      (async () => {
        const { data, error } = await createAdminClient()
          .rpc("database_size_bytes")
          .abortSignal(AbortSignal.timeout(20000));
        if (error) throw error;
        if (data === null || !Number.isFinite(Number(data)))
          throw new Error("Invalid database size");
        return { bytes: Number(data), referenceBytes: 500 * 1024 ** 2 };
      })(),
    ]);
    return ok({
      r2: results[0].status === "fulfilled" ? results[0].value : null,
      database: results[1].status === "fulfilled" ? results[1].value : null,
      databaseError:
        results[1].status === "rejected"
          ? ["PGRST202", "42883", "42501"].includes(results[1].reason?.code)
            ? "Chưa có hàm đọc dung lượng hoặc quyền gọi. Chạy migration 017 rồi làm mới."
            : "Không thể đọc dung lượng database. Kiểm tra kết nối Supabase rồi thử lại."
          : null,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
