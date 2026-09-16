import { apiError, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let stage = "authenticate";
  console.info("[SUBMIT] received", { requestId });
  try {
    const actor = await requireUser(["STUDENT"]);
    const { id } = await params;
    console.info("[SUBMIT] authenticated", {
      requestId,
      applicationId: id,
      userId: actor.id,
    });
    stage = "create_database_client";
    const admin = createAdminClient();
    stage = "submit_application";
    console.info("[SUBMIT] RPC start", { requestId, applicationId: id });
    // Ownership, required files and status changes are checked atomically by the RPC.
    const { data, error } = await admin.rpc("submit_application", {
      target_application_id: id,
      actor_id: actor.id,
    });
    if (error) throw error;
    console.info("[SUBMIT] completed", {
      requestId,
      applicationId: id,
      status: data?.status,
      submittedAt: data?.submitted_at,
      durationMs: Date.now() - startedAt,
    });
    return ok(data);
  } catch (error) {
    return apiError(error, { operation: "SUBMIT", requestId, stage });
  }
}
