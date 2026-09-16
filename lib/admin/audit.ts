import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
export async function audit(
  actor: { id: string; role: string },
  action: string,
  resourceId: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await createAdminClient()
    .from("system_audit_logs")
    .insert({
      user_id: actor.id,
      actor_snapshot: { role: actor.role },
      action,
      resource_id: resourceId,
      metadata,
    });
  if (error) throw error;
}
