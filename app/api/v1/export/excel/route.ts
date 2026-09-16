import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { apiError } from "@/lib/api/response";
import { applicationWorkbook } from "@/lib/export/workbook";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    await requireUser(["FACULTY_SECRETARY", "SCHOOL_PRESIDENT", "SUPER_ADMIN"]);
    const id = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("campaignId"));
    const buffer = await applicationWorkbook(id);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="sv5t-${id}.xlsx"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
