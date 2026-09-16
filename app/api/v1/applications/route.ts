import { apiError, created, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createApplicationSchema } from "@/lib/validation/application";

export async function GET(request: Request) {
  try {
    const user = await requireUser(["STUDENT"]);
    const campaignId = new URL(request.url).searchParams.get("campaignId");
    const admin = createAdminClient();
    let query = admin
      .from("applications")
      .select(
        "*, campaigns(id, name, academic_year, start_date, end_date), application_files(*, file_review_logs(*))",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (campaignId) query = query.eq("campaign_id", campaignId);
    const { data, error } = await query;
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(["STUDENT"]);
    const input = createApplicationSchema.parse(await request.json());
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .select("id")
      .eq("id", input.campaignId)
      .eq("is_active", true)
      .eq("is_archived", false)
      .lte("start_date", now)
      .gte("end_date", now)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) throw new Error("CAMPAIGN_NOT_OPEN");

    const { data, error } = await admin
      .from("applications")
      .insert({
        campaign_id: input.campaignId,
        user_id: user.id,
        type: input.type,
        status: "DRAFT",
      })
      .select()
      .single();
    if (error) throw error;
    return created(data);
  } catch (error) {
    return apiError(error);
  }
}
