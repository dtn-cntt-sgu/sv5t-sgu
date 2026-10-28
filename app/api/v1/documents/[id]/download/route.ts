import { readFile } from "node:fs/promises";
import path from "node:path";
import { AuthError, requireUser } from "@/lib/auth/require-user";
import { hasRegisteredParticipation } from "@/lib/participation/status";
import { createClient } from "@/lib/supabase/server";
import { createReadUrl } from "@/lib/r2/files";
import { apiError } from "@/lib/api/response";
import { publicDocuments, studentTemplates } from "@/lib/domain/documents";

const builtinDownloads = [
  ...publicDocuments.flatMap((document) =>
    document.downloads.map((download) => ({
      ...download,
      directory: "public_docs",
      studentOnly: false,
    })),
  ),
  ...studentTemplates.flatMap((document) =>
    document.downloads.map((download) => ({
      ...download,
      directory: "public_template",
      studentOnly: true,
    })),
  ),
  // Keep existing links from the home page and application form working.
  {
    id: "criteria",
    filename: "Bộ tiêu chuẩn & Hướng dẫn danh hiệu sv5t cấp TP.pdf",
    format: "pdf" as const,
    directory: "",
    studentOnly: false,
  },
  {
    id: "individual-template",
    filename: "SV5T - MẪU - CÁ NHÂN - CNTT.docx",
    format: "docx" as const,
    directory: "",
    studentOnly: true,
  },
];

const contentTypes = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

async function requireRegisteredStudent() {
  await requireUser(["STUDENT"]);
  if (!(await hasRegisteredParticipation())) {
    throw new AuthError(
      'Bạn hãy đăng ký tham gia xét duyệt danh hiệu "Sinh viên 5 tốt" để truy cập tính năng này',
      403,
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const download = builtinDownloads.find((item) => item.id === id);
    if (download) {
      if (download.studentOnly) await requireRegisteredStudent();
      const buffer = await readFile(
        path.join(
          process.cwd(),
          "assets",
          download.directory,
          download.filename,
        ),
      );
      const inline =
        !download.studentOnly &&
        download.format === "pdf" &&
        new URL(request.url).searchParams.get("view") === "inline";
      return new Response(buffer, {
        headers: {
          "content-type": contentTypes[download.format],
          "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(download.filename)}`,
          "cache-control": download.studentOnly
            ? "private, no-store"
            : "public, max-age=3600",
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
    if (data.category === "TEMPLATE") await requireRegisteredStudent();
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
