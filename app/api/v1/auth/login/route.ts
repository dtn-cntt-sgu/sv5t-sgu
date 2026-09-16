import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, ok } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, ROLES, type UserRole } from "@/lib/auth/roles";

const schema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(72),
  portal: z.enum(["student", "manager", "admin"]).default("student"),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    let email = input.identifier.toLowerCase();

    if (!z.email().safeParse(email).success) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("users")
        .select("email")
        .eq("mssv", input.identifier.toUpperCase())
        .eq("is_active", true)
        .maybeSingle();
      if (!data?.email) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_CREDENTIALS",
              message: "Thông tin đăng nhập không chính xác.",
            },
          },
          { status: 401 },
        );
      }
      email = data.email;
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: input.password,
    });
    if (error || !data.user) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Thông tin đăng nhập không chính xác.",
          },
        },
        { status: 401 },
      );
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role, is_active")
      .eq("id", data.user.id)
      .single();
    if (!profile?.is_active) {
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          error: {
            code: "ACCOUNT_INACTIVE",
            message: "Tài khoản chưa sẵn sàng hoặc đã bị khóa.",
          },
        },
        { status: 403 },
      );
    }
    const candidate = String(profile.role);
    const role: UserRole = ROLES.includes(candidate as UserRole)
      ? (candidate as UserRole)
      : "STUDENT";
    const portalAllowed =
      input.portal === "student"
        ? role === "STUDENT"
        : input.portal === "admin"
          ? role === "SUPER_ADMIN"
          : ["FACULTY_SECRETARY", "SCHOOL_PRESIDENT"].includes(role);

    if (!portalAllowed) {
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          error: {
            code: "WRONG_PORTAL",
            message: "Tài khoản không thuộc cổng đăng nhập này.",
          },
        },
        { status: 403 },
      );
    }

    return ok({ role, redirectTo: homeForRole(role) });
  } catch (error) {
    return apiError(error);
  }
}
