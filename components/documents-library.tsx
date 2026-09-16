"use client";
import Link from "next/link";
import { ArrowLeft, Download, FileText, LockKeyhole } from "lucide-react";
import { Brand } from "./brand";
import { useResource } from "@/lib/client/use-resource";
import { type Profile, dateLabel } from "@/lib/domain/models";
type Document = {
  id: string;
  title: string;
  description: string;
  category: string;
  updated_at?: string;
};
export function DocumentsLibrary() {
  const profile = useResource<Profile>("/users/me");
  const documents = useResource<Document[]>("/public/documents");
  const student = profile.data?.role === "STUDENT";
  const items: Document[] = [
    {
      id: "criteria",
      title: "Bộ tiêu chuẩn & hướng dẫn danh hiệu SV5T cấp Thành phố",
      description:
        "Tài liệu tham khảo công khai về năm tiêu chí xét danh hiệu.",
      category: "CRITERIA",
    },
    ...(student
      ? [
          {
            id: "individual-template",
            title: "Mẫu kê khai thành tích cá nhân · Khoa CNTT",
            description:
              "Biểu mẫu dành cho sinh viên. Đọc và thay các nội dung ví dụ trước khi nộp.",
            category: "TEMPLATE",
          },
        ]
      : []),
    ...(documents.data ?? []).filter(
      (d) => d.category !== "TEMPLATE" || student,
    ),
  ];
  return (
    <main className="documents-page">
      <header>
        <Brand />
        <Link href={student ? "/dashboard" : "/"}>
          <ArrowLeft size={16} />
          {student ? "Về tổng quan" : "Trang chủ"}
        </Link>
      </header>
      <section className="documents-hero">
        <span className="section-kicker">CHUẨN BỊ TỐT · TỰ TIN HƠN</span>
        <h1>Góc tài liệu của bạn.</h1>
        <p>
          Tìm hiểu tiêu chí, tải đúng biểu mẫu và sẵn sàng cho hành trình Sinh
          viên 5 Tốt.
        </p>
      </section>
      <section className="document-list">
        {items.map((d) => (
          <article key={d.id}>
            <i>
              <FileText size={24} />
            </i>
            <div>
              <span>
                {d.category === "TEMPLATE"
                  ? "BIỂU MẪU SINH VIÊN"
                  : "TÀI LIỆU CÔNG KHAI"}
              </span>
              <h2>{d.title}</h2>
              <p>{d.description}</p>
              {d.updated_at && (
                <small>Cập nhật {dateLabel(d.updated_at)}</small>
              )}
            </div>
            <a
              className="button button-outline"
              href={`/api/v1/documents/${d.id}/download`}
            >
              <Download size={17} />
              Tải xuống
            </a>
          </article>
        ))}
        {!student && (
          <article>
            <i>
              <LockKeyhole size={24} />
            </i>
            <div>
              <h2>Biểu mẫu dành cho sinh viên</h2>
              <p>
                Đăng nhập tài khoản sinh viên để tải mẫu kê khai thành tích.
              </p>
            </div>
            <Link className="button button-primary" href="/login">
              Đăng nhập
            </Link>
          </article>
        )}
        {documents.error && (
          <p className="notice">
            Chưa tải được tài liệu bổ sung. Các tài liệu có sẵn ở trên vẫn có
            thể tải xuống.
          </p>
        )}
        <section className="panel">
          <h2>Trước khi bạn nộp hồ sơ</h2>
          <ol className="guide-list">
            <li>
              Cá nhân: chuẩn bị bản kê khai DOCX, tệp ảnh minh chứng DOCX và ảnh
              chân dung.
            </li>
            <li>
              Tập thể: chuẩn bị bản kê khai DOCX và ảnh tập thể tuyên dương. Mẫu
              tập thể sẽ được bổ sung khi ban tổ chức công bố.
            </li>
            <li>
              Mỗi file DOCX tối đa 15 MB; ảnh JPG, PNG hoặc WEBP tối đa 8 MB.
            </li>
            <li>
              Dùng máy tính để tải file. Kiểm tra kỹ thông tin và gửi hồ sơ
              trước hạn nhận.
            </li>
          </ol>
        </section>
      </section>
    </main>
  );
}
