import { uploadLimitsSchema } from "@/lib/domain/upload-limits";
import { requireDesktopUpload } from "@/lib/auth/desktop-upload";
import { apiError, created } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildObjectKey,
  createUploadUrl,
  validateUpload,
} from "@/lib/r2/files";
import {
  collectiveFiles,
  individualFiles,
  presignUploadSchema,
} from "@/lib/validation/application";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const requestId = crypto.randomUUID();
  let stage = "authenticate";
  console.info("[UPLOAD] presign received", { requestId });
  try {
    const user = await requireUser(["STUDENT"]);
    stage = "validate_request";
    requireDesktopUpload(request);
    const { id } = await params;
    const input = presignUploadSchema.parse(await request.json());
    console.log("[UPLOAD] presign start:", {
      requestId,
      userId: user.id,
      applicationId: id,
      fileType: input.fileType,
      mimeType: input.mimeType,
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
    });

    stage = "load_application";
    const admin = createAdminClient();
    const { data: settings, error: settingsError } = await admin
      .from("system_settings")
      .select("file_upload_limits")
      .single();
    if (settingsError) throw settingsError;
    validateUpload(
      input.fileType,
      input.mimeType,
      input.fileSizeBytes,
      uploadLimitsSchema.parse(settings.file_upload_limits)[input.fileType],
    );
    const { data: application, error } = await admin
      .from("applications")
      .select("id, campaign_id, user_id, type, status")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!application) throw new Error("APPLICATION_NOT_FOUND");

    const expected =
      application.type === "INDIVIDUAL" ? individualFiles : collectiveFiles;
    if (!(expected as readonly string[]).includes(input.fileType))
      throw new Error("FILE_NOT_ALLOWED_FOR_APPLICATION");

    stage = "load_profile";
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("mssv, faculties(code)")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile?.mssv)
      throw profileError ?? new Error("PROFILE_INCOMPLETE");
    const facultyRelation = profile.faculties as unknown as {
      code: string;
    } | null;
    if (!facultyRelation?.code) throw new Error("PROFILE_INCOMPLETE");

    stage = "build_object_key";
    const r2Key = buildObjectKey({
      campaignId: application.campaign_id,
      applicationId: application.id,
      facultyCode: facultyRelation.code,
      studentCode: profile.mssv,
      category: input.fileType,
      mimeType: input.mimeType,
    });
    console.log("[UPLOAD] generated r2 key:", {
      r2Key,
      applicationId: application.id,
      fileType: input.fileType,
    });

    stage = "sign_url";
    const uploadUrl = await createUploadUrl(
      r2Key,
      input.mimeType,
      input.fileSizeBytes,
    );
    stage = "reserve_upload";
    const { data: reservationId, error: reservationError } = await admin.rpc(
      "reserve_upload",
      {
        target_application_id: application.id,
        actor_id: user.id,
        target_file_type: input.fileType,
        target_r2_key: r2Key,
        target_original_name: input.fileName,
        target_mime_type: input.mimeType,
        target_size_bytes: input.fileSizeBytes,
      },
    );
    if (reservationError) throw reservationError;

    console.log("[UPLOAD] presign response:", {
      requestId,
      reservationId,
      r2Key,
      uploadUrlHost: new URL(uploadUrl).origin + new URL(uploadUrl).pathname,
      expiresInSeconds: 300,
    });
    return created({
      reservationId,
      uploadUrl,
      expiresInSeconds: 300,
      requiredHeaders: {
        "content-type": input.mimeType,
      },
    });
  } catch (error) {
    return apiError(error, { requestId, stage });
  }
}
