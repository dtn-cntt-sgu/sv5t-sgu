import { apiError, ok } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
export async function GET() {
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("public_documents")
      .select("id,title,description,category,updated_at")
      .eq("is_published", true)
      .order("sort_order");
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
