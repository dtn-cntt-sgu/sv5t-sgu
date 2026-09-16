import { apiError, ok } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name, academic_year, start_date, end_date")
      .eq("is_active", true)
      .eq("is_archived", false)
      .lte("start_date", new Date().toISOString())
      .gte("end_date", new Date().toISOString())
      .maybeSingle();
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
