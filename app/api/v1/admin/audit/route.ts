import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, ok } from "@/lib/api/response";
export async function GET(request: Request) {
  try {
    await requireUser(["SUPER_ADMIN"]);
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .parse(new URL(request.url).searchParams.get("page") ?? 1);
    const { data, error, count } = await createAdminClient()
      .from("system_audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * 30, page * 30 - 1);
    if (error) throw error;
    return ok({ items: data, total: count });
  } catch (error) {
    return apiError(error);
  }
}
