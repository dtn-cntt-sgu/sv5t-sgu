import { z } from "zod";
import { apiError, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(["STUDENT"]);
    const id = z.uuid().parse((await context.params).id);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("read_student_notification", {
      p_notification_id: id,
    });
    if (error) throw error;
    return ok(
      { readAt: data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
