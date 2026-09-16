import { apiError, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createReadUrl } from "@/lib/r2/files";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const actor = await requireUser(["FACULTY_SECRETARY", "SCHOOL_PRESIDENT"]);
    const { id } = await params;
    const admin = createAdminClient();
    const [{ data: reviewer }, { data: application, error }] =
      await Promise.all([
        admin.from("users").select("faculty_id").eq("id", actor.id).single(),
        admin
          .from("applications")
          .select(
            "*, users!applications_user_id_fkey(*), application_files(*, file_review_logs(*))",
          )
          .eq("id", id)
          .single(),
      ]);
    if (error || !application)
      throw error ?? new Error("APPLICATION_NOT_FOUND");
    const applicant = application.users as unknown as { faculty_id: string };
    if (
      actor.role === "FACULTY_SECRETARY" &&
      applicant.faculty_id !== reviewer?.faculty_id
    ) {
      return Response.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Hồ sơ không thuộc khoa của bạn.",
          },
        },
        { status: 403 },
      );
    }
    const files = await Promise.all(
      (
        application.application_files as Array<{
          r2_key: string;
          original_name: string;
        }>
      ).map(async (file) => ({
        ...file,
        previewUrl: await createReadUrl(file.r2_key),
        downloadUrl: await createReadUrl(file.r2_key, file.original_name),
        urlExpiresInSeconds: 300,
      })),
    );
    return ok({ ...application, application_files: files });
  } catch (error) {
    return apiError(error);
  }
}
