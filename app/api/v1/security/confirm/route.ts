import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicEnv } from "@/lib/config/env";
import { apiError, ok } from "@/lib/api/response";
import { audit } from "@/lib/admin/audit";
export async function POST(request: Request) {
  try {
    const actor = await requireUser(["SCHOOL_PRESIDENT", "SUPER_ADMIN"]);
    const input = z
      .object({
        challengeId: z.uuid(),
        code: z.string().regex(/^\d{6}$/),
        password: z.string().min(14).max(72).optional(),
      })
      .parse(await request.json());
    const db = createAdminClient();
    const { data: challenge, error } = await db.rpc(
      "attempt_security_challenge",
      { target_id: input.challengeId, actor_id: actor.id },
    );
    if (error) throw error;
    if (!challenge) throw new Error("OTP_INVALID");
    if (
      challenge.purpose === "CHANGE_ADMIN_PASSWORD" &&
      (actor.role !== "SUPER_ADMIN" || !input.password)
    )
      return Response.json(
        { error: { message: "Thiếu mật khẩu mới hoặc không có quyền." } },
        { status: 422 },
      );
    const email =
      challenge.purpose === "PURGE_CAMPAIGN"
        ? process.env.SCHOOL_PRESIDENT_EMAIL
        : process.env.ADMIN_RECOVERY_EMAIL;
    if (!email) throw new Error("OTP_INVALID");
    const env = getPublicEnv();
    const verifier = createSupabaseClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    const { data: verified, error: verifyError } =
      await verifier.auth.verifyOtp({
        email,
        token: input.code,
        type: "email",
      });
    if (
      verifyError ||
      verified.user?.email?.toLowerCase() !== email.toLowerCase()
    )
      throw new Error("OTP_INVALID");
    const { error: markError } = await db
      .from("security_challenges")
      .update({ code_hash: "VERIFIED" })
      .eq("id", input.challengeId)
      .eq("user_id", actor.id)
      .is("consumed_at", null);
    if (markError) throw markError;
    if (challenge.purpose === "PURGE_CAMPAIGN") {
      const { error: purgeError } = await db.rpc("purge_verified_campaign", {
        target_campaign_id: challenge.resource_id,
        actor_id: actor.id,
        challenge_id: input.challengeId,
      });
      if (purgeError) throw purgeError;
    } else {
      const { data: consumed, error: consumeError } = await db
        .from("security_challenges")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", input.challengeId)
        .eq("code_hash", "VERIFIED")
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("id")
        .maybeSingle();
      if (consumeError || !consumed) throw new Error("OTP_INVALID");
      const { error: passwordError } = await db.auth.admin.updateUserById(
        actor.id,
        { password: input.password },
      );
      if (passwordError) throw passwordError;
      await audit(actor, "CHANGE_ADMIN_PASSWORD", actor.id);
    }
    return ok({ completed: true });
  } catch (error) {
    return apiError(error);
  }
}
