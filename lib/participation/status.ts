import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function hasRegisteredParticipation() {
  const db = await createClient();
  const { data, error } = await db.rpc("participation_status");
  if (error) throw error;
  return data?.registered === true;
}
