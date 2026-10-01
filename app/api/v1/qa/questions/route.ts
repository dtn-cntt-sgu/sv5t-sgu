import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { apiError, ok } from "@/lib/api/response";
export async function POST(request: Request) {
  try {
    await requireUser(["STUDENT"]);
    const input = z
      .object({ id: z.uuid(), question: z.string().trim().min(2).max(3000) })
      .parse(await request.json());
    const db = await createClient();
    const { data, error } = await db.rpc("qa_ask", {
      p_id: input.id,
      p_question: input.question,
    });
    if (error) throw error;
    return ok({ id: data });
  } catch (error) {
    return apiError(error);
  }
}
