import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/admin/audit";
import { apiError, ok } from "@/lib/api/response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  let stage = "authorize";
  const failure = (status: number, code: string, message: string) =>
    Response.json(
      { error: { code, message, requestId } },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  const conflict = () =>
    failure(
      409,
      "EMAIL_EXISTS",
      "Email này đã được sử dụng bởi một tài khoản khác (kể cả tài khoản chưa hoàn tất đăng ký). Vui lòng dùng email khác hoặc kiểm tra tài khoản đã đăng ký với email này.",
    );
  try {
    const actor = await requireUser(["SUPER_ADMIN"]);
    stage = "parse_request";
    const id = z.uuid().parse((await params).id);
    const input = z
      .object({
        email: z.string().trim().max(254).toLowerCase().pipe(z.email()),
        emailChangeEnabled: z.literal(true),
      })
      .strict()
      .parse(await request.json());
    const db = createAdminClient();
    stage = "load_target";
    const { data: target, error } = await db
      .from("users")
      .select("id, role, email")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!target)
      return failure(
        404,
        "USER_NOT_FOUND",
        "Không tìm thấy tài khoản cần sửa.",
      );
    if (target.role === "SUPER_ADMIN" && id !== actor.id)
      return Response.json(
        { error: { message: "Không được sửa tài khoản quản trị viên khác." } },
        { status: 403 },
      );
    if (target.email.toLowerCase() === input.email)
      return ok({ email: target.email });
    stage = "check_email_sync";
    const { data: ready, error: readinessError } = await db.rpc(
      "admin_email_sync_ready",
    );
    if (readinessError) throw readinessError;
    if (!ready)
      return failure(
        503,
        "EMAIL_SYNC_UNAVAILABLE",
        "Chức năng đổi email chưa sẵn sàng. Vui lòng liên hệ quản trị viên và cung cấp mã yêu cầu.",
      );
    const checkAvailability = () =>
      db.rpc("admin_email_available", {
        target_user_id: id,
        requested_email: input.email,
      });
    stage = "check_email_availability";
    const { data: available, error: availabilityError } =
      await checkAvailability();
    if (availabilityError) throw availabilityError;
    if (available === false) return conflict();
    if (available !== true) throw new Error("EMAIL_AVAILABILITY_INVALID");
    // Auth and profile email change in the same database transaction via migration 018.
    stage = "audit_requested";
    await audit(actor, "UPDATE_USER_EMAIL_REQUESTED", id, {
      requestId,
      before: target.email,
      after: input.email,
    });
    stage = "update_auth_email";
    const { data: updated, error: authError } =
      await db.auth.admin.updateUserById(id, {
        email: input.email,
        email_confirm: true,
      });
    if (authError) {
      if (
        ["email_exists", "user_already_exists", "23505"].includes(
          authError.code ?? "",
        )
      )
        return conflict();
      // Auth wraps SQL 23505 as HTTP 500; the SDK may omit its code.
      // Recheck after failure to cover an account created after preflight.
      const { data: stillAvailable } = await checkAvailability();
      if (stillAvailable === false) return conflict();
      if (authError.code === "email_address_not_authorized")
        return failure(
          422,
          "EMAIL_NOT_AUTHORIZED",
          "Địa chỉ email này không được dịch vụ xác thực chấp nhận. Vui lòng kiểm tra lại hoặc liên hệ quản trị viên.",
        );
      throw authError;
    }
    stage = "verify_email_update";
    if (
      !updated.user?.email ||
      updated.user.email.toLowerCase() !== input.email
    )
      throw new Error("EMAIL_UPDATE_NOT_COMPLETED");
    const { data: profile, error: profileError } = await db
      .from("users")
      .select("email")
      .eq("id", id)
      .single();
    if (profileError) throw profileError;
    if (profile.email.toLowerCase() !== input.email)
      throw new Error("EMAIL_PROFILE_SYNC_FAILED");
    await audit(actor, "UPDATE_USER_EMAIL", id, {
      requestId,
      before: target.email,
      after: input.email,
    }).catch(() => {
      console.error("Email updated; completion audit unavailable", {
        requestId,
        userId: id,
      });
    });
    return ok({ email: updated.user.email });
  } catch (error) {
    // Keep Auth/SQL diagnostics useful without logging email addresses or rows.
    const details = error && typeof error === "object" ? error : {};
    const code =
      "code" in details ? String(details.code ?? "UNEXPECTED") : "UNEXPECTED";
    const status =
      "status" in details && typeof details.status === "number"
        ? details.status
        : undefined;
    const name = "name" in details ? String(details.name) : "Error";
    if (stage === "authorize" || stage === "parse_request")
      return apiError(error);
    const safeMessage = (
      "message" in details ? String(details.message) : "Unknown error"
    )
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+/gi, "[email]")
      .slice(0, 240);
    const context = {
      requestId,
      stage,
      operation: "ADMIN_USER_EMAIL",
      name,
      status,
    };
    if (["PGRST202", "42P01", "42703", "42883", "42501"].includes(code)) {
      console.error("[ADMIN_USER_EMAIL] unavailable", {
        ...context,
        code,
        message: safeMessage,
      });
      return failure(
        503,
        "EMAIL_DATABASE_UNAVAILABLE",
        "Chức năng đổi email chưa sẵn sàng. Vui lòng liên hệ quản trị viên và cung cấp mã yêu cầu.",
      );
    }
    return apiError(Object.assign(new Error(safeMessage), { code }), context);
  }
}
