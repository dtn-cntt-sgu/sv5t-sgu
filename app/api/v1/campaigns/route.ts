import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, ok, created } from "@/lib/api/response";
export const campaignSchema = z
  .object({
    name: z.string().trim().min(3).max(150),
    academic_year: z.string().regex(/^\d{4}-\d{4}$/),
    start_date: z.iso.datetime({ offset: true }),
    end_date: z.iso.datetime({ offset: true }),
    is_active: z.boolean(),
  })
  .refine(
    (v) => Date.parse(v.end_date) > Date.parse(v.start_date),
    "Ngày đóng phải sau ngày mở.",
  );
export async function GET() {
  try {
    await requireUser(["FACULTY_SECRETARY", "SCHOOL_PRESIDENT", "SUPER_ADMIN"]);
    const { data, error } = await createAdminClient()
      .from("campaigns")
      .select("*")
      .order("start_date", { ascending: false });
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await requireUser(["SCHOOL_PRESIDENT", "SUPER_ADMIN"]);
    const input = campaignSchema.parse(await request.json());
    const { data, error } = await createAdminClient()
      .from("campaigns")
      .insert({ ...input, created_by: actor.id })
      .select()
      .single();
    if (error) throw error;
    return created(data);
  } catch (error) {
    return apiError(error);
  }
}
