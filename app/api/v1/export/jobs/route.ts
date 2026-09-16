import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, ok, created } from "@/lib/api/response";
export async function GET(request: Request) {
  try {
    await requireUser(["SCHOOL_PRESIDENT", "SUPER_ADMIN"]);
    const id = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("campaignId"));
    const { data, error } = await createAdminClient()
      .from("campaign_exports")
      .select(
        "id,status,record_count,error_message,created_at,completed_at,cleanup_status",
      )
      .eq("campaign_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await requireUser(["SCHOOL_PRESIDENT", "SUPER_ADMIN"]);
    const input = z
      .object({ campaignId: z.uuid() })
      .parse(await request.json());
    const { data, error } = await createAdminClient().rpc(
      "queue_campaign_export",
      { target_campaign_id: input.campaignId, actor_id: actor.id },
    );
    if (error) throw error;
    return created(data);
  } catch (error) {
    return apiError(error);
  }
}
