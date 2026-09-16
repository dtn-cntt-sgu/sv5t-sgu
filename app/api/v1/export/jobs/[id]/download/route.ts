import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createReadUrl } from "@/lib/r2/files";
import { apiError } from "@/lib/api/response";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(["SCHOOL_PRESIDENT", "SUPER_ADMIN"]);
    const { id } = await params;
    const { data, error } = await createAdminClient()
      .from("campaign_exports")
      .select("archive_r2_key,manifest_r2_key")
      .eq("id", id)
      .eq("status", "READY")
      .single();
    if (error) throw error;
    const manifest =
      new URL(request.url).searchParams.get("type") === "manifest";
    return Response.redirect(
      await createReadUrl(
        manifest ? data.manifest_r2_key : data.archive_r2_key,
        `sv5t-${id}.${manifest ? "json" : "zip"}`,
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
