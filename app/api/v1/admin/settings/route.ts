import { uploadLimitsSchema } from "@/lib/domain/upload-limits";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, ok } from "@/lib/api/response";
export async function GET() {
  try {
    await requireUser(["SUPER_ADMIN"]);
    const { data, error } = await createAdminClient()
      .from("system_settings")
      .select("*")
      .single();
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
export async function PUT(request: Request) {
  try {
    const actor = await requireUser(["SUPER_ADMIN"]);
    const input = z
      .object({
        r2_hard_limit_bytes: z
          .number()
          .int()
          .min(1024 ** 2)
          .max(10 * 1024 ** 3),
        r2_warning_percent: z.number().int().min(1).max(99),
        file_upload_limits: uploadLimitsSchema,
      })
      .partial()
      .strict()
      .refine(
        (value) => Object.keys(value).length > 0,
        "Không có cấu hình cần lưu",
      )
      .parse(await request.json());
    const db = createAdminClient();
    const { data: current, error: currentError } = await db
      .from("system_settings")
      .select("*")
      .single();
    if (currentError) throw currentError;
    if (
      input.file_upload_limits &&
      !uploadLimitsSchema.safeParse(current.file_upload_limits).success
    ) {
      return Response.json(
        {
          error: {
            message:
              "Cấu hình giới hạn file chưa sẵn sàng. Kiểm tra migration 016 trên đúng dự án Supabase rồi tải lại cấu hình.",
          },
        },
        { status: 503 },
      );
    }
    const { data: used, error: usageError } = await db.rpc(
      "storage_committed_bytes",
    );
    if (usageError) throw usageError;
    if (
      input.r2_hard_limit_bytes !== undefined &&
      input.r2_hard_limit_bytes < Number(used)
    )
      throw new Error("STORAGE_HARD_LIMIT_REACHED");
    const { data, error } = await db
      .from("system_settings")
      .update({
        ...input,
        updated_by: actor.id,
        updated_at: new Date().toISOString(),
      })
      .eq("singleton", true)
      .select()
      .single();
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
