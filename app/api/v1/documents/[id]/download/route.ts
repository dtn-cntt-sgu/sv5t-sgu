import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { createReadUrl } from "@/lib/r2/files";
import { apiError } from "@/lib/api/response";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (id === "criteria" || id === "individual-template") {
      if (id === "individual-template") await requireUser(["STUDENT"]);
      const filename =
        id === "criteria"
          ? "Bộ tiêu chuẩn & Hướng dẫn danh hiệu sv5t cấp TP.pdf"
          : "SV5T - MẪU - CÁ NHÂN - CNTT.docx";
      const buffer = await readFile(
        path.join(process.cwd(), "assets", filename),
      );
      return new Response(buffer, {
        headers: {
          "content-type":
            id === "criteria"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "cache-control":
            id === "criteria" ? "public, max-age=3600" : "private, no-store",
        },
      });
    }
    const db = await createClient();
    const { data, error } = await db
      .from("public_documents")
      .select("*")
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) return new Response("Không tìm thấy tài liệu.", { status: 404 });
    if (data.category === "TEMPLATE") await requireUser(["STUDENT"]);
    if (data.r2_key)
      return Response.redirect(await createReadUrl(data.r2_key, data.title));
    const url = new URL(data.external_url);
    if (url.protocol !== "https:")
      return new Response("Liên kết không hợp lệ.", { status: 400 });
    return Response.redirect(url);
  } catch (error) {
    return apiError(error);
  }
}
