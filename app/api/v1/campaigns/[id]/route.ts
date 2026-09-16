import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, ok } from "@/lib/api/response";
import { campaignSchema } from "../route";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(["SCHOOL_PRESIDENT", "SUPER_ADMIN"]);
    const { id } = await params;
    const input = campaignSchema.parse(await request.json());
    const { data, error } = await createAdminClient()
      .from("campaigns")
      .update(input)
      .eq("id", id)
      .eq("is_archived", false)
      .select()
      .single();
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
