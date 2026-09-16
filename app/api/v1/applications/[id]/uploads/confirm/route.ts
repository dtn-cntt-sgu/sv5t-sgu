import { requireDesktopUpload } from "@/lib/auth/desktop-upload";
import { apiError, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { inspectObject } from "@/lib/r2/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmUploadSchema } from "@/lib/validation/application";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const requestId = crypto.randomUUID();
  let stage = "authenticate";
  console.info("[UPLOAD] confirm received", { requestId });
  try {
    const user = await requireUser(["STUDENT"]);
    stage = "validate_request";
    requireDesktopUpload(request);
    const { id } = await params;
    const input = confirmUploadSchema.parse(await request.json());
    stage = "load_reservation";
    const admin = createAdminClient();
    const { data: reservation, error } = await admin
      .from("upload_reservations")
      .select(
        "id, application_id, user_id, r2_key, expected_size_bytes, mime_type, expires_at, completed_at",
      )
      .eq("id", input.reservationId)
      .eq("application_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (
      error ||
      !reservation ||
      reservation.completed_at ||
      new Date(reservation.expires_at) <= new Date()
    ) {
      throw error ?? new Error("UPLOAD_RESERVATION_INVALID");
    }

    stage = "inspect_object";
    const object = await inspectObject(reservation.r2_key);
    const actualType = (object.ContentType ?? "").toLowerCase();
    const expectedType = reservation.mime_type.toLowerCase();
    const actualSize = object.ContentLength ?? 0;
    const isMatchingMime = actualType === expectedType;
    if (actualSize !== reservation.expected_size_bytes || !isMatchingMime) {
      throw new Error("UPLOADED_OBJECT_MISMATCH");
    }

    stage = "complete_upload";
    const { data, error: completeError } = await admin.rpc("complete_upload", {
      target_reservation_id: reservation.id,
      actor_id: user.id,
      actual_size_bytes: actualSize,
      actual_mime_type: actualType,
      actual_etag: object.ETag ?? "",
    });
    if (completeError) throw completeError;
    console.info("[UPLOAD] confirmed", {
      requestId,
      reservationId: reservation.id,
    });
    return ok(data);
  } catch (error) {
    return apiError(error, { requestId, stage });
  }
}
