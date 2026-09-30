import { z } from "zod";
import { apiError, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const schema = z.object({
  requestId: z.uuid(),
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(1).max(10000),
});
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    await requireUser(["STUDENT", "SCHOOL_PRESIDENT"]);
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(new URL(request.url).searchParams.get("page") ?? 1);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("student_notifications_page", {
      p_page: page,
    });
    if (error) throw error;
    return ok(data, { headers });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    await requireUser(["SCHOOL_PRESIDENT"]);
    const input = schema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("publish_student_notification", {
      p_request_id: input.requestId,
      p_title: input.title,
      p_body: input.body,
    });
    if (error) throw error;
    return ok({ id: data }, { headers });
  } catch (error) {
    return apiError(error);
  }
}
