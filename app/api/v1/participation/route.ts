import { apiError, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("participation_status");
    if (error) throw error;
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST() {
  try {
    await requireUser(["STUDENT"]);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("register_participation");
    if (error) throw error;
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
