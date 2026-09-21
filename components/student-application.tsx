"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CloudUpload,
  FileText,
  ImageIcon,
  Plus,
  Send,
  Monitor,
  Download,
} from "lucide-react";
import { PortalShell } from "./portal-shell";
import { ResourceState, EmptyState } from "./resource-state";
import { useResource } from "@/lib/client/use-resource";
import { ApiError, mutation } from "@/lib/client/api";
import {
  type Application,
  type Campaign,
  type ApplicationFile,
  statusLabels,
  fileLabels,
  dateLabel,
  bytesLabel,
  campaignOpen,
} from "@/lib/domain/models";
import { individualFiles, collectiveFiles } from "@/lib/validation/application";
const docxMime =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export function StudentApplication() {
  const applications = useResource<Application[]>("/applications");
  const campaigns = useResource<Campaign | null>("/public/campaigns/active");
  const [selected, setSelected] = useState("");
  const [type, setType] = useState<"INDIVIDUAL" | "COLLECTIVE">("INDIVIDUAL");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = matchMedia("(min-width: 1024px) and (pointer: fine)");
    const sync = () => setDesktop(query.matches);
    const timer = setTimeout(() => {
      sync();
      setSelected(new URLSearchParams(location.search).get("id") ?? "");
    }, 0);
    query.addEventListener("change", sync);
    return () => {
      clearTimeout(timer);
      query.removeEventListener("change", sync);
    };
  }, []);
  const a =
    applications.data?.find((item) => item.id === selected) ??
    applications.data?.[0];
  const required = a?.type === "COLLECTIVE" ? collectiveFiles : individualFiles;
  const open =
    !!a && a.campaign_id === campaigns.data?.id && campaignOpen(campaigns.data);
  const editable =
    !!a && ["DRAFT", "RESUBMIT_REQUIRED"].includes(a.status) && open;
  const complete =
    !!a &&
    required.every((t) => a.application_files.some((f) => f.file_type === t)) &&
    !a.application_files.some((f) => f.review_status === "RESUBMIT_REQUIRED");
  async function create() {
    setPending(true);
    setError("");
    try {
      const result = await mutation<Application>("/applications", {
        campaignId: campaigns.data?.id,
        type,
      });
      setSelected(result.id);
      await applications.reload();
      setMessage("Đã tạo hồ sơ nháp. Bạn có thể tải minh chứng lên.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tạo hồ sơ.");
    } finally {
      setPending(false);
    }
  }
  async function submit() {
    if (!a || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    let stage = "submit";
    console.info("[SUBMIT] start", { applicationId: a.id, status: a.status });
    try {
      const result = await mutation<Application>(
        `/applications/${a.id}/submit`,
        {},
      );
      console.info("[SUBMIT] API success", {
        applicationId: a.id,
        status: result.status,
      });
      stage = "refresh";
      await applications.reload();
      console.info("[SUBMIT] refreshed", { applicationId: a.id });
      setMessage(
        "Hồ sơ đã được gửi đến Liên chi Hội. Bạn có thể theo dõi phản hồi tại đây.",
      );
      setConfirmed(false);
    } catch (e) {
      console.error("[SUBMIT] failed", {
        stage,
        applicationId: a.id,
        message: e instanceof Error ? e.message : "Unknown error",
        ...(e instanceof ApiError
          ? { status: e.status, code: e.code, requestId: e.requestId }
          : {}),
      });
      setError(e instanceof Error ? e.message : "Không thể nộp hồ sơ.");
    } finally {
      setPending(false);
    }
  }
  return (
    <PortalShell
      portal="student"
      title="Hồ sơ của tôi"
      subtitle="LƯU GIỮ NỖ LỰC -  GHI DẤU HÀNH TRÌNH"
    >
      <ResourceState
        loading={applications.loading && !applications.data}
        error={applications.error || campaigns.error}
        retry={() => {
          void applications.reload();
          void campaigns.reload();
        }}
      />
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
      <section className="panel application-picker">
        <div>
          <span className="section-kicker">ĐỢT XÉT HIỆN TẠI</span>
          <h2>{campaigns.data?.name ?? "Chưa có đợt đang nhận hồ sơ"}</h2>
          <p>
            {campaigns.data
              ? `Hạn nộp: ${dateLabel(campaigns.data.end_date)}`
              : "Bạn vẫn có thể xem trạng thái và lịch sử hồ sơ đã tạo."}
          </p>
        </div>
        {campaigns.data && (
          <div className="create-controls">
            <label>
              Loại hồ sơ
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
              >
                <option value="INDIVIDUAL">Cá nhân - 3 file</option>
                <option value="COLLECTIVE">Tập thể - 2 file</option>
              </select>
            </label>
            <a
              className="button button-outline"
              href="/api/v1/documents/individual-template/download"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Tải hồ sơ mẫu"
            >
              <Download size={16} /> Hồ sơ mẫu
            </a>
            <button
              className="button button-primary"
              onClick={create}
              disabled={
                pending ||
                applications.loading ||
                applications.data?.some(
                  (item) =>
                    item.type === type &&
                    item.campaign_id === campaigns.data?.id,
                )
              }
            >
              <Plus size={17} /> Tạo hồ sơ
            </button>
          </div>
        )}
      </section>
      {!!applications.data?.length && (
        <div className="tabs" aria-label="Chọn hồ sơ">
          {applications.data.map((item) => (
            <button
              key={item.id}
              className={a?.id === item.id ? "active" : ""}
              onClick={() => {
                setSelected(item.id);
                setMessage("");
                setConfirmed(false);
              }}
            >
              {item.type === "INDIVIDUAL" ? "Cá nhân" : "Tập thể"}
              <small>
                {item.campaigns?.academic_year ?? dateLabel(item.updated_at)}
              </small>
            </button>
          ))}
        </div>
      )}
      {!a && !applications.loading && (
        <EmptyState title="Chưa có hồ sơ nào">
          <p>Chọn loại hồ sơ và tạo bản nháp khi đợt xét duyệt mở.</p>
          <Link className="inline-link" href="/documents">
            Chuẩn bị biểu mẫu <ArrowRight size={16} />
          </Link>
        </EmptyState>
      )}
      {a && (
        <div className="application-layout">
          <section className="application-main">
            <div className="section-title">
              <div>
                <span className="section-kicker">
                  {a.type === "INDIVIDUAL" ? "HỒ SƠ CÁ NHÂN" : "HỒ SƠ TẬP THỂ"}
                </span>
                <h2>Những minh chứng của bạn</h2>
              </div>
              <span className={`status-pill state-${a.status}`}>
                {statusLabels[a.status]}
              </span>
            </div>
            {!desktop && (
              <p className="notice">
                <Monitor size={20} /> Vui lòng dùng máy tính để tải minh chứng.
                Trên điện thoại, bạn có thể xem hồ sơ và phản hồi.
              </p>
            )}
            {a.status === "RESUBMIT_REQUIRED" && (
              <p className="notice warning">
                Chỉ thay các file được đánh dấu cần nộp lại, rồi nhấn Gửi lại hồ
                sơ.
              </p>
            )}
            {!open && (
              <p className="notice">
                Đợt này hiện không nhận hồ sơ hoặc minh chứng bổ sung.
              </p>
            )}
            <div className="upload-list">
              {required.map((category, index) => (
                <FileUpload
                  key={`${a.id}-${category}`}
                  applicationId={a.id}
                  category={category}
                  index={index}
                  file={a.application_files.find(
                    (f) => f.file_type === category,
                  )}
                  disabled={!desktop || !editable || pending}
                  onBusy={setPending}
                  onDone={applications.reload}
                />
              ))}
            </div>
            {a.rejection_reason && (
              <p className="form-error">
                <strong>Lý do không đạt: </strong>
                {a.rejection_reason}
              </p>
            )}
          </section>
          <aside className="submit-summary">
            <span className="section-kicker">SẴN SÀNG TỎA SÁNG?</span>
            <h3>Kiểm tra trước khi gửi</h3>
            <div className="completion">
              <div>
                <span>Minh chứng</span>
                <strong>
                  {a.application_files.length}/{required.length}
                </strong>
              </div>
              <div className="progress">
                <span
                  style={{
                    width: `${(a.application_files.length / required.length) * 100}%`,
                  }}
                />
              </div>
            </div>
            <ul>
              {required.map((t) => (
                <li
                  key={t}
                  className={
                    a.application_files.some((f) => f.file_type === t)
                      ? "done"
                      : ""
                  }
                >
                  <Check size={15} />
                  {fileLabels[t]}
                </li>
              ))}
            </ul>
            {editable ? (
              <>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span>Tôi đã kiểm tra và xác nhận minh chứng chính xác.</span>
                </label>
                <button
                  className="button button-primary button-full"
                  disabled={!complete || !confirmed || pending || !desktop}
                  onClick={submit}
                >
                  <Send size={16} />{" "}
                  {pending
                    ? "Đang xử lý…"
                    : a.status === "DRAFT"
                      ? "Nộp hồ sơ"
                      : "Gửi lại hồ sơ"}
                </button>
              </>
            ) : (
              <p>
                Hồ sơ được lưu trên hệ thống. Theo dõi kết quả và phản hồi để
                biết bước tiếp theo.
              </p>
            )}
            <Link className="inline-link" href="/dashboard/feedback">
              Lịch sử phản hồi <ArrowRight size={15} />
            </Link>
          </aside>
        </div>
      )}
    </PortalShell>
  );
}
function FileUpload({
  applicationId,
  category,
  file,
  disabled,
  index,
  onBusy,
  onDone,
}: {
  applicationId: string;
  category: string;
  file?: ApplicationFile;
  disabled: boolean;
  index: number;
  onBusy: (v: boolean) => void;
  onDone: () => Promise<void>;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const limits = useResource<Record<string, number>>("/public/upload-limits");
  const image = category.endsWith("IMG");
  const editable =
    !disabled &&
    (!file || ["PENDING", "RESUBMIT_REQUIRED"].includes(file.review_status));

  // upload file
  async function upload(chosen?: File) {
    if (!chosen || !editable) return;
    setError("");
    console.log("[UPLOAD] file selected:", {
      name: chosen.name,
      type: chosen.type,
      size: chosen.size,
      category,
      editable,
    });

    const docxMimeVariants = [
      docxMime,
      "application/msword",
      "application/vnd.ms-word.document.macroenabled.12",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
      "application/wps-office.docx",
      "application/octet-stream",
      "application/zip",
    ];
    const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    const normalizedMime = chosen.type?.toLowerCase() ?? "";
    const isDocxFile =
      chosen.name.toLowerCase().endsWith(".docx") ||
      docxMimeVariants.includes(normalizedMime) ||
      normalizedMime.includes("docx") ||
      normalizedMime.includes("word");
    const isImageFile = imageMimeTypes.includes(normalizedMime);
    const mime = normalizedMime || (!image && isDocxFile ? docxMime : "");

    if (!(image ? isImageFile : isDocxFile)) {
      setError("Vui lòng chọn đúng định dạng file.");
      return;
    }
    if (limits.data && (!chosen.size || chosen.size > limits.data[category])) {
      setError(
        `File phải có dung lượng tối đa ${bytesLabel(limits.data[category])}.`,
      );
      return;
    }
    onBusy(true);
    setProgress(0);
    let stage = "presign";
    try {
      const reservation = await mutation<{
        reservationId: string;
        uploadUrl: string;
        requiredHeaders: Record<string, string>;
        // call api --> get url upload
      }>(`/applications/${applicationId}/uploads/presign`, {
        fileType: category,
        fileName: chosen.name,
        mimeType: mime,
        fileSizeBytes: chosen.size,
      });
      console.log("[UPLOAD] presign result:", {
        reservationId: reservation.reservationId,
        requiredHeaders: reservation.requiredHeaders,
        uploadUrlHost:
          new URL(reservation.uploadUrl).origin +
          new URL(reservation.uploadUrl).pathname,
      });
      stage = "storage_put";
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        xhr.current = request;
        console.log("[UPLOAD] sending PUT to storage:", {
          urlHost:
            new URL(reservation.uploadUrl).origin +
            new URL(reservation.uploadUrl).pathname,
          headers: Object.keys(reservation.requiredHeaders),
          fileName: chosen.name,
        });
        // use uploadURL --> PUT file to storage
        request.open("PUT", reservation.uploadUrl);
        for (const [key, value] of Object.entries(reservation.requiredHeaders))
          request.setRequestHeader(key, value);
        request.timeout = 300000;
        request.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setProgress(Math.round((e.loaded / e.total) * 100));
        };
        request.onload = () => {
          console.log("[UPLOAD] PUT result:", {
            status: request.status,
            statusText: request.statusText,
            fileName: chosen.name,
          });
          return request.status >= 200 && request.status < 300
            ? resolve()
            : reject(new Error("Tải lên thất bại. Hãy thử lại sau ít phút."));
        };
        request.onerror = () =>
          reject(
            new Error("Mất kết nối khi tải file. Vui lòng thử lại sau 6 phút."),
          );
        request.onabort = () =>
          reject(new Error("Đã hủy tải. Bạn có thể thử lại sau 6 phút."));
        request.ontimeout = () =>
          reject(new Error("Tải file quá thời gian. Vui lòng thử lại."));
        request.send(chosen);
      });
      stage = "confirm";
      console.info("[UPLOAD] confirming", {
        reservationId: reservation.reservationId,
      });
      await mutation(`/applications/${applicationId}/uploads/confirm`, {
        reservationId: reservation.reservationId,
      });
      stage = "refresh";
      await onDone();
      console.info("[UPLOAD] completed", { applicationId, category });
    } catch (e) {
      console.error("[UPLOAD] failed", {
        stage,
        applicationId,
        category,
        error: e,
      });
      setError(e instanceof Error ? e.message : "Không thể tải file.");
    } finally {
      onBusy(false);
      setProgress(null);
      xhr.current = null;
      if (input.current) input.current.value = "";
    }
  }
  return (
    <article
      className={`evidence-card ${file?.review_status === "RESUBMIT_REQUIRED" ? "needs-revision" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (editable) void upload(e.dataTransfer.files[0]);
      }}
    >
      <div className="evidence-heading">
        <span className="file-icon">
          {image ? <ImageIcon size={22} /> : <FileText size={22} />}
        </span>
        <div>
          <small>MINH CHỨNG 0{index + 1}</small>
          <h3>{fileLabels[category]}</h3>
        </div>
        {file && (
          <span className={`status-pill state-${file.review_status}`}>
            {statusLabels[file.review_status]}
          </span>
        )}
      </div>
      {file ? (
        <div className="uploaded-file">
          <strong>{file.original_name}</strong>
          <small>
            {bytesLabel(file.file_size_bytes)} - Phiên bản {file.revision} -{" "}
            {dateLabel(file.uploaded_at)}
          </small>
          <a
            className="inline-link"
            href={`/api/v1/files/${file.id}/download`}
            target="_blank"
            rel="noreferrer"
          >
            <Download size={15} /> Tải file đã lưu
          </a>
        </div>
      ) : (
        <p className="upload-placeholder">
          {editable
            ? "Kéo thả file vào đây hoặc chọn từ máy tính"
            : "Chưa có minh chứng"}
        </p>
      )}
      {file?.feedback_note && (
        <p className="file-feedback">
          <strong>Phản hồi từ khoa:</strong> {file.feedback_note}
        </p>
      )}
      {progress !== null ? (
        <div role="status">
          <div className="progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p>
            {progress === 100 ? "Đang xác nhận file…" : `Đang tải ${progress}%`}
          </p>
          <button
            className="button button-outline"
            onClick={() => xhr.current?.abort()}
            disabled={progress === 100}
          >
            Hủy tải
          </button>
        </div>
      ) : (
        <div className="evidence-footer">
          <small>
            {image ? "JPG, PNG, WEBP" : "DOCX"}
            {limits.data
              ? ` — tối đa ${bytesLabel(limits.data[category])}`
              : " — giới hạn được kiểm tra khi tải lên"}
          </small>
          {editable && (
            <>
              <input
                ref={input}
                aria-label={`Chọn ${fileLabels[category]}`}
                type="file"
                hidden
                accept={image ? ".jpg,.jpeg,.png,.webp" : ".docx"}
                onChange={(e) => void upload(e.target.files?.[0])}
              />
              <button
                className="button button-outline"
                onClick={() => input.current?.click()}
              >
                <CloudUpload size={16} />
                {file ? "Thay file" : "Chọn file"}
              </button>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
