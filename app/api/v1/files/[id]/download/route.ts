import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { createReadUrl } from "@/lib/r2/files";
import { apiError } from "@/lib/api/response";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser();
    const { id } = await params;
    const db = await createClient();
    const { data, error } = await db
      .from("application_files")
      .select("r2_key, original_name")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return new Response("Không tìm thấy file.", { status: 404 });
    return Response.redirect(
      await createReadUrl(data.r2_key, data.original_name),
    );
  } catch (error) {
    return apiError(error);
  }
}
