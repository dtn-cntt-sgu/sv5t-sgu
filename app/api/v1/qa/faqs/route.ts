import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { apiError, ok } from "@/lib/api/response";
const base = { id: z.uuid(), version: z.number().int().nonnegative() };
const schema = z.discriminatedUnion("action", [
  z.object({
    ...base,
    action: z.literal("save"),
    question: z.string().trim().min(2).max(240),
    answer: z.string().trim().min(1).max(5000),
  }),
  z.object({ ...base, action: z.literal("delete") }),
  z.object({
    ...base,
    action: z.literal("move"),
    direction: z.union([z.literal(-1), z.literal(1)]),
  }),
]);
export async function POST(request: Request) {
  try {
    await requireUser(["SCHOOL_PRESIDENT"]);
    const input = schema.parse(await request.json());
    const db = await createClient();
    const { data, error } = await db.rpc("qa_manage_faq", {
      p_action: input.action,
      p_id: input.id,
      p_version: input.version,
      ...(input.action === "save"
        ? { p_question: input.question, p_answer: input.answer }
        : {}),
      ...(input.action === "move" ? { p_direction: input.direction } : {}),
    });
    if (error) throw error;
    return ok({ id: data });
  } catch (error) {
    return apiError(error);
  }
}
