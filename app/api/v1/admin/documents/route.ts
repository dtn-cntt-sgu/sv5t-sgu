import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, ok } from "@/lib/api/response";
export async function GET() {
  try {
    await requireUser(["SUPER_ADMIN"]);
    const { data, error } = await createAdminClient()
      .from("public_documents")
      .select("*")
      .order("sort_order");
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await requireUser(["SUPER_ADMIN"]);
    const { id, ...input } = z
      .object({
        id: z.uuid().optional(),
        title: z.string().trim().min(3).max(200),
        description: z.string().max(2000),
        category: z.enum(["CRITERIA", "GUIDE", "TEMPLATE", "NOTICE"]),
        external_url: z.url().refine((v) => v.startsWith("https://")),
        is_published: z.boolean(),
        sort_order: z.number().int().min(0).max(10000),
      })
      .parse(await request.json());
    const db = createAdminClient();
    const query = id
      ? db
          .from("public_documents")
          .update({ ...input, r2_key: null })
          .eq("id", id)
      : db.from("public_documents").insert({ ...input, created_by: actor.id });
    const { data, error } = await query.select().single();
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
