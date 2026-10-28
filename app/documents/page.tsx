import { DocumentsLibrary } from "@/components/documents-library";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { hasSupabaseEnv } from "@/lib/config/env";
import { createClient } from "@/lib/supabase/server";
import { hasRegisteredParticipation } from "@/lib/participation/status";

export default async function Page() {
  if (hasSupabaseEnv()) {
    const db = await createClient();
    const { data, error } = await db.auth.getClaims();
    if (error) throw error;
    if (data?.claims?.sub) {
      const actor = await requireUser();
      if (actor.role === "STUDENT" && !(await hasRegisteredParticipation())) {
        redirect("/dashboard?documents=registration-required");
      }
    }
  }
  return <DocumentsLibrary />;
}
