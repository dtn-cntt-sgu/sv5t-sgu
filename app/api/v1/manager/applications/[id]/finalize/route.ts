import { z } from "zod";
import { apiError, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
const schema = z.object({
  decisions: z
    .array(
      z
        .object({
          fileId: z.uuid(),
          action: z.enum(["ACCEPT", "REJECT", "REQUEST_RESUBMISSION"]),
          note: z.string().trim().max(2000),
        })
        .refine(
          (v) => v.action === "ACCEPT" || v.note.length >= 5,
          "Vui lòng nhập lý do (ít nhất 5 ký tự).",
        ),
    )
    .min(2)
    .max(3),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let stage = "authenticate";
  console.info("[REVIEW] received", { requestId });
  try {
    const actor = await requireUser(["FACULTY_SECRETARY"]);
    const { id } = await params;
    console.info("[REVIEW] authenticated", {
      requestId,
      applicationId: id,
      actorId: actor.id,
      role: actor.role,
    });
    stage = "validate_decisions";
    const input = schema.parse(await request.json());
    console.info("[REVIEW] decisions validated", {
      requestId,
      applicationId: id,
      decisions: input.decisions.map(({ fileId, action, note }) => ({
        fileId,
        action,
        noteLength: note.length,
      })),
    });
    stage = "create_database_client";
    const admin = createAdminClient();
    stage = "finalize_review";
    console.info("[REVIEW] RPC start", { requestId, applicationId: id });
    const { data, error } = await admin.rpc("finalize_review", {
      target_application_id: id,
      actor_id: actor.id,
      decisions: input.decisions,
    });
    if (error) throw error;
    console.info("[REVIEW] completed", {
      requestId,
      applicationId: id,
      status: data?.status,
      durationMs: Date.now() - startedAt,
    });
    return ok(data);
  } catch (error) {
    return apiError(error, { operation: "REVIEW", requestId, stage });
  }
}
