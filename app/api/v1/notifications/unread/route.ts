import { apiError, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireUser(["STUDENT"]);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "student_notification_unread_count",
    );
    if (error) throw error;
    return ok(
      { unread: data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
