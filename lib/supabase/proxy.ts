import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  function redirect(path: string) {
    const next = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
    return next;
  }

  // getClaims verifies the JWT and refreshes cookies when needed.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const path = request.nextUrl.pathname;
  const role =
    claims?.app_metadata &&
    typeof claims.app_metadata === "object" &&
    "role" in claims.app_metadata
      ? claims.app_metadata.role
      : "STUDENT";

  const isStudentArea =
    path.startsWith("/dashboard") || path.startsWith("/application");
  const isManagerArea =
    path.startsWith("/manager") && path !== "/manager/login";
  const isAdminArea = path.startsWith("/admin") && path !== "/admin/login";

  if (!claims && (isStudentArea || isManagerArea || isAdminArea)) {
    const loginPath = isAdminArea
      ? "/admin/login"
      : isManagerArea
        ? "/manager/login"
        : "/login";
    return redirect(loginPath);
  }
  if (isStudentArea && role !== "STUDENT") {
    return redirect(role === "SUPER_ADMIN" ? "/admin" : "/manager");
  }
  if (
    isManagerArea &&
    !["FACULTY_SECRETARY", "SCHOOL_PRESIDENT"].includes(String(role))
  ) {
    return redirect(role === "SUPER_ADMIN" ? "/admin" : "/login");
  }
  if (isAdminArea && role !== "SUPER_ADMIN") {
    return redirect(role === "STUDENT" ? "/dashboard" : "/manager");
  }

  return response;
}
