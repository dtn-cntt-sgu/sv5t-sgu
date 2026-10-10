import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ParticipationRegistrationList } from "@/lib/domain/participation";

export async function participationRegistrations() {
  const db = await createClient();
  const { data, error } = await db.rpc("participation_registration_list");
  if (error) throw error;
  return data as ParticipationRegistrationList;
}
