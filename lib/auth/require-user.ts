import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/auth/roles";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status = 401,
  ) {
    super(message);
  }
}

export async function requireUser(allowedRoles?: UserRole[]) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub)
    throw new AuthError("Bạn cần đăng nhập để tiếp tục.");

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", data.claims.sub)
    .single();
  if (profileError || !profile)
    throw new AuthError("Không tìm thấy thông tin tài khoản.", 403);
  if (!profile.is_active)
    throw new AuthError(
      "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
      403,
    );
  const role = profile.role as UserRole;

  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new AuthError("Bạn không có quyền thực hiện thao tác này.", 403);
  }

  return { id: data.claims.sub, role, profile, claims: data.claims };
}
