import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { apiError, ok } from "@/lib/api/response";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(["SCHOOL_PRESIDENT"]);
    const id = z.uuid().parse((await context.params).id);
    const { answer } = z
      .object({ answer: z.string().trim().min(1).max(5000) })
      .parse(await request.json());
    const db = await createClient();
    const { data, error } = await db.rpc("qa_answer", {
      p_id: id,
      p_answer: answer,
    });
    if (error) throw error;
    return ok({ id: data });
  } catch (error) {
    return apiError(error);
  }
}
