import { apiError, ok } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return ok({ signedOut: true });
  } catch (error) {
    return apiError(error);
  }
}
