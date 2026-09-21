import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, ok } from "@/lib/api/response";
export async function GET() {
  try {
    const { data, error } = await createAdminClient()
      .from("system_settings")
      .select("file_upload_limits")
      .single();
    if (error) throw error;
    return ok(data.file_upload_limits);
  } catch (error) {
    return apiError(error);
  }
}
