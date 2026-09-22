import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/admin/audit";
import { apiError, ok } from "@/lib/api/response";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(["SUPER_ADMIN"]);
    const id = z.uuid().parse((await params).id);
    const input = z
      .object({
        email: z.string().trim().max(254).toLowerCase().pipe(z.email()),
        emailChangeEnabled: z.literal(true),
      })
      .strict()
      .parse(await request.json());
    const db = createAdminClient();
    const { data: target, error } = await db
      .from("users")
      .select("id, role, email")
      .eq("id", id)
      .single();
    if (error) throw error;
    if (target.role === "SUPER_ADMIN" && id !== actor.id)
      return Response.json(
        { error: { message: "Không được sửa tài khoản quản trị viên khác." } },
        { status: 403 },
      );
    if (target.email.toLowerCase() === input.email)
      return ok({ email: target.email });
    const { data: ready, error: readinessError } = await db.rpc(
      "admin_email_sync_ready",
    );
    if (readinessError || !ready)
      return Response.json(
        {
          error: {
            message:
              "Chức năng đổi email chưa sẵn sàng. Vui lòng chạy migration 018 trước khi sử dụng.",
          },
        },
        { status: 503 },
      );
    // Auth and profile email change in the same database transaction via migration 018.
    await audit(actor, "UPDATE_USER_EMAIL_REQUESTED", id, {
      before: target.email,
      after: input.email,
    });
    const { data: updated, error: authError } =
      await db.auth.admin.updateUserById(id, {
        email: input.email,
        email_confirm: true,
      });
    if (authError) {
      if (
        [
          "email_exists",
          "email_address_not_authorized",
          "user_already_exists",
        ].includes(authError.code ?? "")
      )
        return Response.json(
          {
            error: {
              message:
                "Email đã được sử dụng hoặc không được chấp nhận. Vui lòng kiểm tra lại.",
            },
          },
          { status: 409 },
        );
      throw authError;
    }
    if (
      !updated.user?.email ||
      updated.user.email.toLowerCase() !== input.email
    )
      throw new Error("EMAIL_UPDATE_NOT_COMPLETED");
    await audit(actor, "UPDATE_USER_EMAIL", id, {
      before: target.email,
      after: input.email,
    }).catch(() => {
      console.error("Email updated; completion audit unavailable", {
        userId: id,
      });
    });
    return ok({ email: updated.user.email });
  } catch (error) {
    return apiError(error);
  }
}
