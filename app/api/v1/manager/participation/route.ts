import { requireUser } from "@/lib/auth/require-user";
import { apiError, ok } from "@/lib/api/response";
import { participationRegistrations } from "@/lib/participation/registrations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser(["SCHOOL_PRESIDENT"]);
    return ok(await participationRegistrations(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
