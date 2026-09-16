import { z } from "zod";
import { apiError, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z
  .object({
    action: z.enum(["ACCEPT", "REJECT", "REQUEST_RESUBMISSION"]),
    note: z.string().trim().max(2000).default(""),
  })
  .superRefine((value, context) => {
    if (value.action !== "ACCEPT" && value.note.length < 5) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "Phản hồi phải có ít nhất 5 ký tự.",
      });
    }
  });

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const actor = await requireUser(["FACULTY_SECRETARY"]);
    const { id } = await params;
    const input = schema.parse(await request.json());
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("review_application_file", {
      target_file_id: id,
      actor_id: actor.id,
      target_action: input.action,
      target_note: input.note,
    });
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
