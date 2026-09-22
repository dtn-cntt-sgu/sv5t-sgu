import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, ok, created } from "@/lib/api/response";
import { audit } from "@/lib/admin/audit";
export async function GET(request: Request) {
  try {
    await requireUser(["SUPER_ADMIN"]);
    const input = z
      .object({
        page: z.coerce.number().int().min(1).optional(),
        search: z.string().max(100).default(""),
        role: z
          .enum([
            "STUDENT",
            "FACULTY_SECRETARY",
            "SCHOOL_PRESIDENT",
            "SUPER_ADMIN",
          ])
          .optional(),
      })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    let query = createAdminClient()
      .from("users")
      .select("*,faculties(name,code),majors(name)", { count: "exact" })
      .order("created_at", { ascending: false });
    if (input.page) query = query.range((input.page - 1) * 30, input.page * 30 - 1);
    if (input.role) query = query.eq("role", input.role);
    if (input.search)
      query = query.ilike(
        "full_name",
        `%${input.search.replace(/[%,().]/g, "")}%`,
      );
    const { data, error, count } = await query;
    if (error) throw error;
    return ok({ items: data, total: count });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await requireUser(["SUPER_ADMIN"]);
    const input = z
      .object({
        email: z.email(),
        password: z.string().min(14).max(72),
        full_name: z.string().trim().min(2).max(100),
        role: z.enum(["FACULTY_SECRETARY", "SCHOOL_PRESIDENT", "STUDENT"]),
        faculty_id: z.uuid().nullable(),
        major_id: z.uuid().nullable().optional(),
        class_name: z.string().min(2).max(50).optional(),
        mssv: z
          .string()
          .regex(/^[A-Za-z0-9_-]{5,20}$/)
          .optional(),
        phone: z
          .string()
          .regex(/^\+?[0-9]{9,15}$/)
          .optional(),
      })
      .superRefine((v, c) => {
        if (
          (v.role === "FACULTY_SECRETARY" || v.role === "STUDENT") &&
          !v.faculty_id
        )
          c.addIssue({ code: "custom", message: "Vui lòng chọn khoa." });
        if (
          v.role === "STUDENT" &&
          (!v.major_id || !v.class_name || !v.mssv || !v.phone)
        )
          c.addIssue({ code: "custom", message: "Thiếu thông tin sinh viên." });
      })
      .parse(await request.json());
    const { data, error } = await createAdminClient().auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { role: input.role },
      user_metadata: {
        full_name: input.full_name,
        faculty_id: input.faculty_id,
        major_id: input.major_id,
        class_name: input.class_name,
        mssv: input.mssv,
        phone: input.phone,
      },
    });
    if (error) throw error;
    await audit(actor, "CREATE_USER", data.user.id, { role: input.role });
    return created({ id: data.user.id });
  } catch (error) {
    return apiError(error);
  }
}
