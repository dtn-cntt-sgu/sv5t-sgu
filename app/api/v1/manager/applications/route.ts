import { z } from "zod";
import { apiError, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  campaignId: z.uuid(),
  status: z
    .enum([
      "SUBMITTED",
      "RESUBMIT_REQUIRED",
      "RESUBMITTED",
      "APPROVED",
      "REJECTED",
    ])
    .optional(),
  majorId: z.uuid().optional(),
  facultyId: z.uuid().optional(),
  className: z.string().trim().max(50).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  try {
    const actor = await requireUser([
      "FACULTY_SECRETARY",
      "SCHOOL_PRESIDENT",
      "SUPER_ADMIN",
    ]);
    const url = new URL(request.url);
    const input = querySchema.parse(Object.fromEntries(url.searchParams));
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("faculty_id")
      .eq("id", actor.id)
      .single();
    if (profileError) throw profileError;

    let userIds: string[] | undefined;
    if (
      actor.role === "FACULTY_SECRETARY" ||
      input.majorId ||
      input.search ||
      input.facultyId ||
      input.className
    ) {
      let users = admin.from("users").select("id").eq("role", "STUDENT");
      if (actor.role === "FACULTY_SECRETARY")
        users = users.eq("faculty_id", profile.faculty_id);
      if (actor.role !== "FACULTY_SECRETARY" && input.facultyId)
        users = users.eq("faculty_id", input.facultyId);
      if (input.className)
        users = users.eq("class_name", input.className.toUpperCase());
      if (input.majorId) users = users.eq("major_id", input.majorId);
      if (input.search)
        users = users.or(
          `mssv.ilike.%${escapeFilter(input.search)}%,full_name.ilike.%${escapeFilter(input.search)}%`,
        );
      const { data, error } = await users;
      if (error) throw error;
      userIds = data.map((row) => row.id);
      if (!userIds.length)
        return ok({
          items: [],
          page: input.page,
          pageSize: input.pageSize,
          total: 0,
        });
    }

    const from = (input.page - 1) * input.pageSize;
    let applications = admin
      .from("applications")
      .select(
        "id, type, status, submitted_at, updated_at, users!applications_user_id_fkey(id, mssv, full_name, class_name, faculty_id, major_id)",
        { count: "exact" },
      )
      .eq("campaign_id", input.campaignId)
      .neq("status", "DRAFT")
      .order("updated_at", { ascending: false })
      .range(from, from + input.pageSize - 1);
    if (input.from) applications = applications.gte("submitted_at", input.from);
    if (input.to) applications = applications.lte("submitted_at", input.to);
    if (input.status) applications = applications.eq("status", input.status);
    if (userIds) applications = applications.in("user_id", userIds);
    const { data, error, count } = await applications;
    if (error) throw error;
    return ok({
      items: data,
      page: input.page,
      pageSize: input.pageSize,
      total: count ?? 0,
    });
  } catch (error) {
    return apiError(error);
  }
}

function escapeFilter(value: string) {
  return value.replace(/[%,().]/g, "");
}
