import { apiError, ok } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("faculties")
      .select("id, code, name, majors(id, code, name)")
      .order("name")
      .order("name", { referencedTable: "majors" });
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
