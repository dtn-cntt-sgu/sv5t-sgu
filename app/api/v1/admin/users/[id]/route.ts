import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, ok } from "@/lib/api/response";
import { audit } from "@/lib/admin/audit";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(["SUPER_ADMIN"]);
    const { id } = await params;
    const input = z
      .object({
        full_name: z.string().trim().min(2).max(100),
        is_active: z.boolean(),
        phone: z
          .string()
          .regex(/^\+?[0-9]{9,15}$/)
          .nullable()
          .optional(),
        faculty_id: z.uuid().nullable().optional(),
        major_id: z.uuid().nullable().optional(),
        class_name: z.string().min(2).max(50).nullable().optional(),
      })
      .strict()
      .parse(await request.json());
    const db = createAdminClient();
    const { data: target, error: targetError } = await db
      .from("users")
      .select("*")
      .eq("id", id)
      .single();
    if (targetError) throw targetError;
    if (target.role === "SUPER_ADMIN" && id !== actor.id)
      return Response.json(
        { error: { message: "Không được sửa tài khoản quản trị viên khác." } },
        { status: 403 },
      );
    if (id === actor.id && !input.is_active)
      return Response.json(
        { error: { message: "Không thể tự khóa tài khoản đang dùng." } },
        { status: 409 },
      );
    const { data, error } = await db
      .from("users")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    await audit(actor, "UPDATE_USER", id, {
      before: { is_active: target.is_active, full_name: target.full_name },
      after: input,
    });
    return ok(data);
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireUser(["SUPER_ADMIN"]);
    const { id } = await params;
    const db = createAdminClient();
    const { data: target, error } = await db
      .from("users")
      .select("role")
      .eq("id", id)
      .single();
    if (error) throw error;
    if (target.role === "SUPER_ADMIN")
      return Response.json(
        { error: { message: "Không thể xóa quản trị viên." } },
        { status: 403 },
      );
    const { count, error: countError } = await db
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id);
    if (countError) throw countError;
    if (count)
      return Response.json(
        {
          error: {
            message:
              "Tài khoản còn hồ sơ. Hãy khóa tài khoản hoặc lưu trữ hồ sơ trước khi xóa.",
          },
        },
        { status: 409 },
      );
    await audit(actor, "DELETE_USER_REQUESTED", id);
    const { error: deleteError } = await db.auth.admin.deleteUser(id);
    if (deleteError) throw deleteError;
    return ok({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
