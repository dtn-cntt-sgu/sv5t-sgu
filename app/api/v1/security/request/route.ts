import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { apiError, ok } from "@/lib/api/response";
export async function POST(request: Request) {
  try {
    const actor = await requireUser(["SCHOOL_PRESIDENT", "SUPER_ADMIN"]);
    const input = z
      .object({
        purpose: z.enum(["PURGE_CAMPAIGN", "CHANGE_ADMIN_PASSWORD"]),
        campaignId: z.uuid().optional(),
      })
      .parse(await request.json());
    if (
      input.purpose === "CHANGE_ADMIN_PASSWORD" &&
      actor.role !== "SUPER_ADMIN"
    )
      return Response.json(
        { error: { message: "Không có quyền." } },
        { status: 403 },
      );
    const email =
      input.purpose === "PURGE_CAMPAIGN"
        ? process.env.SCHOOL_PRESIDENT_EMAIL
        : process.env.ADMIN_RECOVERY_EMAIL;
    if (!email)
      return Response.json(
        {
          error: {
            message:
              "Email xác thực chính thức chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
          },
        },
        { status: 503 },
      );
    const db = createAdminClient();
    if (input.purpose === "PURGE_CAMPAIGN") {
      if (!input.campaignId)
        return Response.json(
          { error: { message: "Chưa chọn đợt xét." } },
          { status: 422 },
        );
      const { data: campaign } = await db
        .from("campaigns")
        .select("*")
        .eq("id", input.campaignId)
        .single();
      const { data: exports } = await db
        .from("campaign_exports")
        .select("id")
        .eq("campaign_id", input.campaignId)
        .eq("status", "READY")
        .limit(1);
      if (
        !campaign ||
        campaign.is_active ||
        campaign.is_archived ||
        Date.parse(campaign.end_date) >= Date.now() ||
        !exports?.length
      )
        throw new Error("READY_EXPORT_REQUIRED");
    }
    const { data: challenge, error } = await db.rpc(
      "create_security_challenge",
      {
        actor_id: actor.id,
        target_purpose: input.purpose,
        target_resource: input.campaignId ?? null,
      },
    );
    if (error) throw error;
    const client = await createClient();
    const { error: sendError } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (sendError) {
      await db
        .from("security_challenges")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", challenge);
      throw sendError;
    }
    return ok({
      challengeId: challenge,
      expiresInSeconds: 300,
      message: "Mã xác thực đã gửi tới email chính thức của đơn vị.",
    });
  } catch (error) {
    return apiError(error);
  }
}
