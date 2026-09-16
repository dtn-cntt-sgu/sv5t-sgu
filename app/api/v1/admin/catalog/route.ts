import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, ok } from "@/lib/api/response";
const schema = z.object({
  id: z.uuid().optional(),
  kind: z.enum(["faculties", "majors"]),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_-]{2,20}$/),
  name: z.string().trim().min(2).max(150),
  faculty_id: z.uuid().optional(),
});
export async function POST(request: Request) {
  try {
    await requireUser(["SUPER_ADMIN"]);
    const { kind, id, ...input } = schema.parse(await request.json());
    if (kind === "majors" && !input.faculty_id)
      return Response.json(
        { error: { message: "Vui lòng chọn khoa." } },
        { status: 422 },
      );
    const payload =
      kind === "faculties" ? { code: input.code, name: input.name } : input;
    const db = createAdminClient();
    const query = id
      ? db.from(kind).update(payload).eq("id", id)
      : db.from(kind).insert(payload);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
