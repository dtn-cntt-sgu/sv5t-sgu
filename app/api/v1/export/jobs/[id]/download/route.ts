import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { createReadUrl } from "@/lib/r2/files";
import { apiError } from "@/lib/api/response";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser(["SCHOOL_PRESIDENT", "SUPER_ADMIN"]);
    const id = z.uuid().parse((await params).id);
    const { data, error } = await createAdminClient()
      .from("campaign_exports")
      .select(
        "storage_backend,local_archive_key,archive_r2_key,manifest_r2_key",
      )
      .eq("id", id)
      .eq("status", "READY")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return Response.json(
        { error: { message: "Bản xuất chưa sẵn sàng hoặc không tồn tại." } },
        { status: 404 },
      );
    const manifest =
      new URL(request.url).searchParams.get("type") === "manifest";
    let destination: string;
    if (data.storage_backend === "LOCAL") {
      return Response.json(
        {
          error: {
            message:
              "Bản ZIP này lưu trên máy riêng từ cấu hình cũ. Vui lòng tạo bản xuất mới trên R2; nếu đợt đã lưu trữ, liên hệ quản trị viên để chuyển bản sao cũ lên R2.",
          },
        },
        { status: 409 },
      );
    } else {
      const key = manifest ? data.manifest_r2_key : data.archive_r2_key;
      if (!key) throw new Error("Export file unavailable");
      destination = await createReadUrl(
        key,
        `sv5t-${id}.${manifest ? "json" : "zip"}`,
      );
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: destination,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
