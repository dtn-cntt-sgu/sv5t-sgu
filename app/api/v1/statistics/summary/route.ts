import { z } from "zod";
import { apiError, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let stage = "authenticate";
  console.info("[STATISTICS] received", { requestId });
  try {
    const actor = await requireUser([
      "FACULTY_SECRETARY",
      "SCHOOL_PRESIDENT",
      "SUPER_ADMIN",
    ]);
    stage = "validate_query";
    const input = z
      .object({ campaignId: z.uuid(), facultyId: z.uuid().optional() })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    stage = "create_database_client";
    const admin = createAdminClient();
    stage = "application_summary";
    console.info("[STATISTICS] RPC start", {
      requestId,
      campaignId: input.campaignId,
      requestedFacultyId: input.facultyId,
      role: actor.role,
    });
    const { data, error } = await admin.rpc("application_summary", {
      target_campaign_id: input.campaignId,
      actor_id: actor.id,
      target_faculty_id: input.facultyId ?? null,
    });
    if (error) throw error;
    console.info("[STATISTICS] completed", {
      requestId,
      campaignId: input.campaignId,
      durationMs: Date.now() - startedAt,
    });
    return ok(data);
  } catch (error) {
    return apiError(error, { operation: "STATISTICS", requestId, stage });
  }
}
