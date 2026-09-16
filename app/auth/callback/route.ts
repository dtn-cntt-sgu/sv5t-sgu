import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, type UserRole } from "@/lib/auth/roles";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          url.searchParams.get("next") === "/reset-password"
            ? "/reset-password"
            : homeForRole(
                (data.user?.app_metadata.role ?? "STUDENT") as UserRole,
              ),
          url.origin,
        ),
      );
  }
  return NextResponse.redirect(
    new URL("/login?error=verification", url.origin),
  );
}
