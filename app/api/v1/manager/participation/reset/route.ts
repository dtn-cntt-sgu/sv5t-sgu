import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { apiError, ok } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { PARTICIPATION_RESET_CONFIRMATION } from "@/lib/domain/participation";

const resetSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("prepare"),
    confirmation: z.literal(PARTICIPATION_RESET_CONFIRMATION),
  }),
  z.object({ step: z.literal("confirm"), requestId: z.uuid() }),
]);

export async function POST(request: Request) {
  try {
    await requireUser(["SCHOOL_PRESIDENT"]);
    const input = resetSchema.parse(await request.json());
    const db = await createClient();
    const { data, error } =
      input.step === "prepare"
        ? await db.rpc("prepare_participation_reset", {
            p_confirmation: input.confirmation,
          })
        : await db.rpc("reset_participation_registrations", {
            p_request_id: input.requestId,
          });
    if (error) throw error;
    return ok(
      input.step === "prepare" ? { requestId: data } : { deletedCount: data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
