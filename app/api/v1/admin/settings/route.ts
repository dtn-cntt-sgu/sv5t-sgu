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
      })
      .strict()
      .parse(await request.json());
    const db = createAdminClient();
    const { data: used, error: usageError } = await db.rpc(
      "storage_committed_bytes",
    );
    if (usageError) throw usageError;
    if (input.r2_hard_limit_bytes < Number(used))
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
