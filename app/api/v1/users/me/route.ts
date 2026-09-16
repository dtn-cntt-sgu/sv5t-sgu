import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { apiError, ok } from "@/lib/api/response";
export async function GET() {
  try {
    const actor = await requireUser();
    const db = await createClient();
    const { data, error } = await db
      .from("users")
      .select("*, faculties(name, code), majors(name)")
      .eq("id", actor.id)
      .single();
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
export async function PUT(request: Request) {
  try {
    const actor = await requireUser();
    const input = z
      .object({
        full_name: z.string().trim().min(2).max(100),
        phone: z.string().regex(/^\+?[0-9]{9,15}$/),
      })
      .strict()
      .parse(await request.json());
    const db = await createClient();
    const { data, error } = await db
      .from("users")
      .update(input)
      .eq("id", actor.id)
      .select()
      .single();
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
