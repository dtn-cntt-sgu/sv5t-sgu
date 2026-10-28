"use client";
import Link from "next/link";
import { ArrowLeft, Download, FileText, LockKeyhole } from "lucide-react";
import { Brand } from "./brand";
import { useResource } from "@/lib/client/use-resource";
import { type Profile, dateLabel } from "@/lib/domain/models";
import {
  type BuiltinDocument,
  publicDocuments,
  studentTemplates,
} from "@/lib/domain/documents";
type Document = {
  id: string;
  title: string;
  description: string;
  category: string;
  updated_at?: string;
};
function BuiltinDocumentCard({ document }: { document: BuiltinDocument }) {
  return (
    <article>
      <i>
        <FileText size={24} />
      </i>
      <div>
        <h3>{document.title}</h3>
      </div>
      <div className="document-actions">
        {document.downloads.map((download) => (
          <a
            key={download.id}
            className="button button-outline"
            href={`/api/v1/documents/${download.id}/download`}
            aria-label={`${download.label}: ${document.title}`}
          >
            <Download size={17} />
            {download.label}
          </a>
        ))}
      </div>
    </article>
  );
}

function AdditionalDocumentCard({
  document,
  downloadLabel = "Tải xuống",
}: {
  document: Document;
  downloadLabel?: string;
}) {
  return (
    <article>
      <i>
        <FileText size={24} />
      </i>
      <div>
        <h3>{document.title}</h3>
        <p>{document.description}</p>
        {document.updated_at && (
          <small>Cập nhật {dateLabel(document.updated_at)}</small>
        )}
      </div>
      <a
        className="button button-outline"
        href={`/api/v1/documents/${document.id}/download`}
        aria-label={`${downloadLabel}: ${document.title}`}
      >
        <Download size={17} />
        {downloadLabel}
      </a>
    </article>
  );
}

export function DocumentsLibrary() {
  const profile = useResource<Profile>("/users/me");
  const documents = useResource<Document[]>("/public/documents");
  const student = profile.data?.role === "STUDENT";
  const additionalDocuments = documents.data ?? [];
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
        <span className="section-kicker">CHUẨN BỊ TỐT - TỰ TIN HƠN</span>
        <h1>Góc tài liệu của bạn.</h1>
        <p>
          Tìm hiểu tiêu chí, tải đúng biểu mẫu và sẵn sàng cho hành trình Sinh
          viên 5 Tốt.
        </p>
      </section>
      <section className="document-list">
        <section
          className="document-section"
          aria-labelledby="public-documents-title"
        >
          <h2 id="public-documents-title">
            Phần 1: Tài liệu, quy định và hướng dẫn
          </h2>
          {publicDocuments.map((document) => (
            <BuiltinDocumentCard key={document.id} document={document} />
          ))}
          {additionalDocuments
            .filter((document) => document.category !== "TEMPLATE")
            .map((document) => (
              <AdditionalDocumentCard key={document.id} document={document} />
            ))}
        </section>
        <section
          className="document-section"
          aria-labelledby="student-templates-title"
        >
          <h2 id="student-templates-title">
            Phần 2: Các biểu mẫu dành cho sinh viên
          </h2>
          <div className="document-section-intro">
            <h3>5. Mẫu khai thành tích cá nhân, tập thể cấp Trường năm 2026</h3>
            <p><b>Cá nhân, tập thể tách riêng từng mẫu khi nộp về LCH SV khoa</b></p>

          </div>
          {student ? (
            <>
              {studentTemplates.map((document) => (
                <BuiltinDocumentCard key={document.id} document={document} />
              ))}
              {additionalDocuments
                .filter((document) => document.category === "TEMPLATE")
                .map((document, index) => (
                  <AdditionalDocumentCard
                    key={document.id}
                    document={document}
                    downloadLabel={`Tải Mẫu ${String(studentTemplates.length + index + 1).padStart(2, "0")}`}
                  />
                ))}
            </>
          ) : (
            <article>
              <i>
                <LockKeyhole size={24} />
              </i>
              <div>
                <h3>Đăng nhập để tải biểu mẫu</h3>
                <p>
                  Đăng nhập tài khoản sinh viên để tải mẫu kê khai thành tích.
                </p>
              </div>
              <Link className="button button-primary" href="/login">
                Đăng nhập
              </Link>
            </article>
          )}
        </section>
        {documents.error && (
          <p className="notice">
            Chưa tải được tài liệu bổ sung. Các tài liệu có sẵn ở trên vẫn có
            thể tải xuống.
          </p>
        )}
        <section className="panel">
          <h2>Tiến độ đánh giá và xét chọn</h2>
          <ul className="guide-list">
            <li>
              {" "}
              Ngày 22/11/2026: Hạn chót cá nhân và tập thể khai hồ sơ và gửi về
              LCH SV khoa;
            </li>
            <li> Từ ngày 23/11 – 27/11/2026: LCH SV khoa thẩm định hồ sơ;</li>
            <li> Từ ngày 28/11 – 04/12/2026: Cấp Trường thẩm định hồ sơ;</li>
            <li>
              {" "}
              Ngày 05/12/2026: Công bố kết quả thẩm định hồ sơ cấp Trường;
            </li>
            <li>
              {" "}
              Từ ngày 06/12 – 08/12/2026: LCH SV khoa phản hồi và giải trình
              (nếu có);
            </li>
            <li> Ngày 14/12/2026: Công bố kết quả các hồ sơ loại A; </li>
            <li>
              {" "}
              Dự kiến ngày 17/12/2026: Họp Hội đồng xét chọn Danh hiệu cấp
              Trường;{" "}
            </li>
            <li>
              {" "}
              Dự kiến ngày 09/01/2027: Tổ chức Lễ tuyên dương Danh hiệu “Sinh
              viên 5 tốt” và “Tập thể Sinh viên 5 tốt” trường Đại học Sài Gòn
              năm học 2026.{" "}
            </li>
          </ul>
        </section>
      </section>
    </main>
  );
}
