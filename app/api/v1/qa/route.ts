import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { apiError, ok } from "@/lib/api/response";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireUser(["STUDENT", "SCHOOL_PRESIDENT"]);
    const params = new URL(request.url).searchParams;
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(params.get("page") ?? 1);
    const filter = z
      .enum(["all", "waiting", "answered"])
      .parse(params.get("filter") ?? "all");
    const db = await createClient();
    const { data, error } = await db.rpc("qa_page", {
      p_page: page,
      p_filter: filter,
    });
    if (error) throw error;
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
