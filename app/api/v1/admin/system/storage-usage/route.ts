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
        const { data, error } = await createAdminClient().rpc(
          "database_size_bytes",
        );
        if (error) throw error;
        return { bytes: Number(data) };
      })(),
    ]);
    return ok({
      r2: results[0].status === "fulfilled" ? results[0].value : null,
      database: results[1].status === "fulfilled" ? results[1].value : null,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
