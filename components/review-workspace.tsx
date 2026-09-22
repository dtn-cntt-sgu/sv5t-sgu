"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Save } from "lucide-react";
import { PortalShell } from "./portal-shell";
import { ResourceState } from "./resource-state";
import { useResource } from "@/lib/client/use-resource";
import { ApiError, mutation } from "@/lib/client/api";
import {
  type Application,
  type ApplicationFile,
  type Profile,
  fileLabels,
  statusLabels,
  dateLabel,
} from "@/lib/domain/models";
export function ReviewWorkspace({ id }: { id: string }) {
  const resource = useResource<Application>(`/manager/applications/${id}`);
  const profile = useResource<Profile>("/users/me");
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const a = resource.data;
  const file =
    a?.application_files.find((f) => f.id === selected) ??
    a?.application_files[0];
  const canReview =
    profile.data?.role === "FACULTY_SECRETARY" &&
    !!a &&
    ["SUBMITTED", "RESUBMITTED"].includes(a.status);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!a || !canReview || pending) return;
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError("");
    setMessage("");
    let stage = "finalize";
    const decisions = a.application_files.map((f) => ({
      fileId: f.id,
      action: form.get(`action-${f.id}`),
      note: String(form.get(`note-${f.id}`) ?? "").trim(),
    }));
    const missingReviewNote = decisions.some(
      (decision) =>
        (decision.action === "REJECT" ||
          decision.action === "REQUEST_RESUBMISSION") &&
        decision.note.length < 5,
    );
    if (missingReviewNote) {
      setError(
        "Vui lòng nhập lý do khi từ chối hoặc yêu cầu gửi lại",
      );
      setPending(false);
      return;
    }
    console.info("[REVIEW] save start", {
      applicationId: id,
      status: a.status,
      fileCount: a.application_files.length,
    });
    try {
      const result = await mutation<Application>(
        `/manager/applications/${id}/finalize`,
        {
          decisions,
        },
      );
      console.info("[REVIEW] API success", {
        applicationId: id,
        status: result.status,
      });
      stage = "refresh";
      await resource.reload();
      console.info("[REVIEW] refreshed", { applicationId: id });
      setMessage("Đã lưu kết quả xét duyệt và phản hồi cho sinh viên.");
    } catch (e) {
      console.error("[REVIEW] failed", {
        stage,
        applicationId: id,
        message: e instanceof Error ? e.message : "Unknown error",
        ...(e instanceof ApiError
          ? { status: e.status, code: e.code, requestId: e.requestId }
          : {}),
      });
      setError(e instanceof Error ? e.message : "Không thể lưu kết quả.");
    } finally {
      setPending(false);
    }
  }
  return (
    <PortalShell portal="manager" title="Chi tiết xét duyệt">
      <Link href="/manager/applications" className="back-link">
        <ArrowLeft size={16} />
        Danh sách hồ sơ
      </Link>
      <ResourceState {...resource} retry={resource.reload} />
      {message && (
        <p className="form-message success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {a && (
        <>
          <section className="panel applicant-info">
            <div>
              <span className="section-kicker">
                {a.type === "INDIVIDUAL" ? "HỒ SƠ CÁ NHÂN" : "HỒ SƠ TẬP THỂ"}
              </span>
              <h2>{a.users?.full_name}</h2>
              <span className={`status-pill state-${a.status}`}>
                {statusLabels[a.status]}
              </span>
            </div>
            <dl>
              {[
                ["MSSV", a.users?.mssv],
                ["Lớp", a.users?.class_name],
                ["Email", a.users?.email],
                ["Điện thoại", a.users?.phone],
                ["Ngày nộp", dateLabel(a.submitted_at)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </section>
          <div className="review-layout">
            <section className="panel file-preview-panel">
              <div className="tabs">
                {a.application_files.map((f) => (
                  <button
                    key={f.id}
                    className={file?.id === f.id ? "active" : ""}
                    onClick={() => setSelected(f.id)}
                  >
                    {fileLabels[f.file_type]}
                  </button>
                ))}
              </div>
              {file && (
                <>
                  <div className="section-title">
                    <strong>{file.original_name}</strong>
                    <a
                      className="button button-outline"
                      href={`/api/v1/files/${file.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download size={16} />
                      Tải về
                    </a>
                  </div>
                  <FilePreview
                    key={`${file.id}-${file.revision}`}
                    file={file}
                  />
                  <button
                    className="inline-link"
                    onClick={() => void resource.reload()}
                  >
                    Làm mới liên kết xem file
                  </button>
                </>
              )}
            </section>
            <form className="panel workspace-form review-form" onSubmit={save}>
              <h2>Kết quả xét duyệt</h2>
              <p className="notice warning">
                LCHT vui lòng tải về file minh chứng cũ. Vì khi yêu cầu sinh viên nộp file mới, sẽ ghi đè file
                cũ, không xem được file cũ.
              </p>
              {a.application_files.map((f) => (
                <fieldset
                  key={`${f.id}-${f.review_status}`}
                  disabled={!canReview || pending}
                >
                  <legend>{fileLabels[f.file_type]}</legend>
                  <label>
                    Quyết định
                    <select
                      name={`action-${f.id}`}
                      defaultValue={
                        f.review_status === "ACCEPTED" ? "ACCEPT" : ""
                      }
                      required
                    >
                      <option value="" disabled>
                        Chọn kết quả
                      </option>
                      <option value="ACCEPT">Chấp nhận</option>
                      <option value="REQUEST_RESUBMISSION">
                        Yêu cầu gửi lại
                      </option>
                      <option value="REJECT">Từ chối</option>
                    </select>
                  </label>
                  <label>
                    Lý do / nhận xét
                    <textarea
                      name={`note-${f.id}`}
                      maxLength={2000}
                      defaultValue={f.feedback_note ?? ""}
                      placeholder="Bắt buộc ít nhất 5 ký tự nếu từ chối hoặc yêu cầu gửi lại"
                      rows={3}
                    />
                  </label>
                  <small className="review-current-status">
                    Hiện tại:
                    <span className={`status-pill state-${f.review_status}`}>
                      {statusLabels[f.review_status]}
                    </span>
                  </small>
                </fieldset>
              ))}
              {canReview ? (
                <button className="button button-primary" disabled={pending}>
                  <Save size={17} />
                  {pending ? "Đang lưu…" : "Lưu kết quả toàn bộ hồ sơ"}
                </button>
              ) : (
                <p className="notice">
                  {profile.data?.role !== "FACULTY_SECRETARY"
                    ? "Bạn đang xem hồ sơ trong chế độ giám sát."
                    : "Hồ sơ đã xử lý hoặc đang chờ sinh viên bổ sung."}
                </p>
              )}
            </form>
          </div>
        </>
      )}
    </PortalShell>
  );
}
function FilePreview({ file }: { file: ApplicationFile }) {
  const container = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (file.mime_type.startsWith("image/")) return;
    let cancelled = false;
    const abort = new AbortController();
    async function render() {
      let stage = "fetch";
      console.info("[PREVIEW] start", { fileId: file.id });
      try {
        const response = await fetch(file.previewUrl!, {
          signal: abort.signal,
        });
        if (!response.ok) throw new Error(`Preview HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        const frame = container.current;
        const doc = frame?.contentDocument;
        if (!doc) throw new Error();
        stage = "render_docx";
        const { renderAsync } = await import("docx-preview");
        await renderAsync(buffer, doc.body, doc.head, {
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          renderAltChunks: false,
        });
        if (!cancelled) {
          console.info("[PREVIEW] completed", { fileId: file.id });
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          console.error("[PREVIEW] failed", { fileId: file.id, stage });
          setError(
            "Không thể xem file. Hãy làm mới liên kết hoặc tải file về để kiểm tra.",
          );
          setLoading(false);
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [file.id, file.previewUrl, file.mime_type]);
  if (file.mime_type.startsWith("image/"))
    return (
      <div className="image-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.previewUrl}
          alt={fileLabels[file.file_type]}
          onError={() =>
            setError("Ảnh không tải được. Vui lòng làm mới liên kết.")
          }
        />
        {error && <p role="alert">{error}</p>}
      </div>
    );
  return (
    <>
      {loading && <p role="status">Đang mở tài liệu…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <iframe
        ref={container}
        title={`Xem ${file.original_name}`}
        className="docx-preview"
        sandbox="allow-same-origin"
        srcDoc={
          "<!doctype html><html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data: blob:;\"></head><body></body></html>"
        }
      />
    </>
  );
}
