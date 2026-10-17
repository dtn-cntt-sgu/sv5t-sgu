import { z } from "zod";
import { NextResponse } from "next/server";
import { apiError, created } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/config/env";

const schema = z.object({
  mssv: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{5,20}$/)
    .transform((value) => value.toUpperCase()),
  fullName: z.string().trim().min(2).max(100),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(72),
  facultyId: z.uuid(),
  majorId: z.uuid(),
  className: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .transform((value) => value.toUpperCase()),
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let stage = "parse_request";

  try {
    const input = schema.parse(await request.json());
    stage = "create_supabase_client";
    const supabase = await createClient();
    stage = "validate_faculty_major";
    const { data: major, error: catalogError } = await supabase
      .from("majors")
      .select("id")
      .eq("id", input.majorId)
      .eq("faculty_id", input.facultyId)
      .maybeSingle();

    if (catalogError) throw catalogError;
    if (!major) {
      console.warn("[AUTH_REGISTER] invalid_catalog_selection", { requestId });
      return NextResponse.json(
        {
          error: {
            code: "INVALID_FACULTY_MAJOR",
            message:
              "Khoa hoặc ngành đã chọn không hợp lệ. Vui lòng tải lại trang và chọn lại.",
            requestId,
          },
        },
        { status: 422, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    stage = "load_public_config";
    const env = getPublicEnv();
    stage = "supabase_signup";
    console.info("[AUTH_REGISTER] signup_started", { requestId });
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: {
          mssv: input.mssv,
          full_name: input.fullName,
          faculty_id: input.facultyId,
          major_id: input.majorId,
          class_name: input.className,
        },
      },
    });
    if (error) throw error;
    console.info("[AUTH_REGISTER] signup_succeeded", {
      requestId,
      emailConfirmationRequired: !data.session,
    });
    return created({
      userId: data.user?.id,
      emailConfirmationRequired: !data.session,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn("[AUTH_REGISTER] validation_failed", {
        requestId,
        fields: error.issues.map((issue) => issue.path.join(".")),
      });
      return apiError(error);
    }

    const details = error && typeof error === "object" ? error : {};
    const code = "code" in details ? String(details.code) : "UNEXPECTED";
    const status =
      "status" in details && typeof details.status === "number"
        ? details.status
        : undefined;
    const name = "name" in details ? String(details.name) : "Error";
    const rawMessage =
      "message" in details ? String(details.message) : "Unknown error";
    const safeMessage = rawMessage
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .slice(0, 240);
    const safeError = Object.assign(new Error(safeMessage), {
      code,
      ...(status === undefined ? {} : { status }),
    });

    if (
      stage === "supabase_signup" &&
      status &&
      status >= 400 &&
      status < 500
    ) {
      console.warn("[AUTH_REGISTER] supabase_rejected", {
        requestId,
        stage,
        name,
        code,
        status,
        message: safeMessage,
      });
      const message =
        status === 429
          ? "Bạn đã thử đăng ký quá nhiều lần. Vui lòng chờ rồi thử lại."
          : status === 409 || code.includes("already") || code.includes("exists")
            ? "Email hoặc mã số sinh viên đã được sử dụng. Vui lòng kiểm tra lại."
            : "Thông tin đăng ký chưa hợp lệ hoặc chưa thể xác thực. Vui lòng kiểm tra lại.";
      return NextResponse.json(
        { error: { code: `AUTH_${code}`, message, requestId } },
        { status, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    return apiError(safeError, {
      requestId,
      stage,
      operation: "AUTH_REGISTER",
      name,
      ...(status === undefined ? {} : { status }),
    });
  }
}
