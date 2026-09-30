"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Bold,
  Italic,
  Heading,
  List,
  ListOrdered,
  Send,
  Megaphone,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PortalShell } from "@/components/portal-shell";
import { useResource } from "@/lib/client/use-resource";
import { api } from "@/lib/client/api";
import type {
  NotificationPage,
  StudentNotification,
} from "@/lib/domain/notifications";
import { FormattedText } from "./formatted-text";
import { useNotifications } from "./notification-context";
import styles from "./notifications.module.css";

function time(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total <= 20) return null;
  return (
    <div className={styles.pagination}>
      <button
        type="button"
        className="button button-outline"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Trang trước"
      >
        <ChevronLeft size={16} />
      </button>
      <span>
        Trang {page}/{Math.ceil(total / 20)}
      </span>
      <button
        type="button"
        className="button button-outline"
        disabled={page * 20 >= total}
        onClick={() => onChange(page + 1)}
        aria-label="Trang sau"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
export function PresidentNotifications() {
  const [page, setPage] = useState(1);
  const history = useResource<NotificationPage>(`/notifications?page=${page}`);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editor = useRef<HTMLTextAreaElement>(null);
  const requestId = useRef<string | null>(null);
  const sending = useRef(false);

  function format(kind: "bold" | "italic" | "heading" | "list" | "number") {
    const input = editor.current;
    if (!input) return;
    let start = input.selectionStart,
      end = input.selectionEnd;
    let replacement: string;
    if (kind === "bold" || kind === "italic") {
      const marker = kind === "bold" ? "**" : "*";
      replacement = marker + (body.slice(start, end) || "Nội dung") + marker;
    } else {
      start = body.lastIndexOf("\n", start - 1) + 1;
      const nextLine = body.indexOf("\n", end);
      end = nextLine === -1 ? body.length : nextLine;
      replacement = (body.slice(start, end) || "Nội dung")
        .split("\n")
        .map(
          (line, index) =>
            `${kind === "heading" ? "## " : kind === "list" ? "- " : `${index + 1}. `}${line}`,
        )
        .join("\n");
    }
    const next = body.slice(0, start) + replacement + body.slice(end);
    if (next.length > 10000) return;
    setBody(next);
    requestId.current = null;
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start, start + replacement.length);
    });
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setPending(true);
    setMessage("");
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      await api("/notifications", {
        method: "POST",
        body: JSON.stringify({ requestId: requestId.current, title, body }),
      });
      setTitle("");
      setBody("");
      requestId.current = null;
      setMessage("Đã gửi thông báo đến toàn bộ sinh viên.");
      if (page === 1) await history.reload();
      else setPage(1);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Chưa thể gửi thông báo.",
      );
    } finally {
      sending.current = false;
      setPending(false);
    }
  }
  return (
    <PortalShell
      portal="manager"
      title="Thông báo sinh viên"
      subtitle="KẾT NỐI CÙNG SINH VIÊN SGU"
    >
      <div className={styles.workspace}>
        <section className={`panel ${styles.composer}`}>
          <div className={styles.sectionTitle}>
            <Megaphone size={23} />
            <div>
              <h2>Soạn thông báo</h2>
              <p>Gửi đến toàn bộ sinh viên trong hệ thống.</p>
            </div>
          </div>
          <form onSubmit={send}>
            <label className={styles.field}>
              Tiêu đề
              <input
                required
                minLength={2}
                maxLength={160}
                value={title}
                disabled={pending}
                placeholder="Nhập tiêu đề thông báo"
                onChange={(e) => {
                  setTitle(e.target.value);
                  requestId.current = null;
                }}
              />
            </label>
            <label className={styles.field} htmlFor="notification-body">
              Nội dung
            </label>
            <div className={styles.editor}>
              <div
                className={styles.toolbar}
                role="group"
                aria-label="Định dạng nội dung"
              >
                {(
                  [
                    ["bold", "In đậm", Bold],
                    ["italic", "In nghiêng", Italic],
                    ["heading", "Tiêu đề đoạn", Heading],
                    ["list", "Danh sách", List],
                    ["number", "Danh sách đánh số", ListOrdered],
                  ] as const
                ).map(([kind, label, Icon]) => (
                  <button
                    key={kind}
                    type="button"
                    title={label}
                    aria-label={label}
                    disabled={pending}
                    onClick={() => format(kind)}
                  >
                    <Icon size={18} />
                  </button>
                ))}
              </div>
              <textarea
                id="notification-body"
                ref={editor}
                required
                maxLength={10000}
                value={body}
                disabled={pending}
                placeholder="Viết thông báo tới sinh viên…"
                aria-describedby="notification-format-help"
                onChange={(e) => {
                  setBody(e.target.value);
                  requestId.current = null;
                }}
              />
            </div>
            <div className={styles.editorHint}>
              <span id="notification-format-help">
                Chọn đoạn chữ rồi nhấn nút định dạng. Chỉ hỗ trợ văn bản.
              </span>
              <span>{body.length.toLocaleString("vi-VN")}/10.000</span>
            </div>
            <div className={styles.preview}>
              <span className={styles.eyebrow}>XEM TRƯỚC</span>
              <h3>{title || "Tiêu đề thông báo"}</h3>
              <FormattedText
                text={body || "Nội dung thông báo sẽ hiển thị tại đây."}
              />
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="form-message success" role="status">
                {message}
              </p>
            )}
            <button
              className="button button-primary"
              disabled={pending || title.trim().length < 2 || !body.trim()}
            >
              <Send size={17} />
              {pending ? "Đang gửi…" : "Gửi thông báo"}
            </button>
          </form>
        </section>
        <section className="panel">
          <div className={styles.sectionTitle}>
            <div>
              <h2>Thông báo đã gửi</h2>
              <p>
                {history.data
                  ? `${history.data.total} thông báo`
                  : "Lịch sử gửi đến sinh viên"}
              </p>
            </div>
          </div>
          {history.loading && <p role="status">Đang tải thông báo…</p>}
          {history.error && (
            <p className="form-error" role="alert">
              {history.error}{" "}
              <button type="button" onClick={() => void history.reload()}>
                Thử lại
              </button>
            </p>
          )}
          {history.data?.total === 0 && (
            <div className={styles.empty}>
              <Megaphone size={32} />
              <h3>Chưa có thông báo</h3>
              <p>Thông báo gửi thành công sẽ xuất hiện tại đây.</p>
            </div>
          )}
          {history.data?.items.map((notice) => (
            <details className={styles.historyItem} key={notice.id}>
              <summary>
                <strong>{notice.title}</strong>
                <small>
                  {time(notice.created_at)} · {notice.author_name}
                </small>
              </summary>
              <FormattedText text={notice.body} />
            </details>
          ))}
          <Pagination
            page={page}
            total={history.data?.total ?? 0}
            onChange={setPage}
          />
        </section>
      </div>
    </PortalShell>
  );
}

export function StudentNotifications() {
  return (
    <PortalShell
      portal="student"
      title="Thông báo"
      subtitle="THÔNG TIN TỪ HỘI SINH VIÊN TRƯỜNG"
    >
      <StudentInbox />
    </PortalShell>
  );
}
function StudentInbox() {
  const {
    revision,
    refresh,
    unread,
    error: countError,
    loading: countLoading,
  } = useNotifications();
  const [page, setPage] = useState(1);
  const resource = useResource<NotificationPage>(
    `/notifications?page=${page}&revision=${revision}`,
  );
  const [selected, setSelected] = useState<StudentNotification>();
  const [marking, setMarking] = useState<string>();
  const [error, setError] = useState("");
  const activeRead = useRef<string | null>(null);
  const selectedId = useRef<string | null>(null);
  const detail = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected?.id && window.matchMedia("(max-width: 1100px)").matches) {
      detail.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    }
  }, [selected?.id]);
  async function open(notice: StudentNotification) {
    selectedId.current = notice.id;
    setSelected(notice);
    setError("");
    if (notice.read_at || activeRead.current === notice.id) return;
    activeRead.current = notice.id;
    setMarking(notice.id);
    try {
      const result = await api<{ readAt: string }>(
        `/notifications/${notice.id}/read`,
        { method: "POST" },
      );
      setSelected((current) =>
        current?.id === notice.id
          ? { ...current, read_at: result.readAt }
          : current,
      );
      refresh();
    } catch (failure) {
      if (selectedId.current === notice.id)
        setError(
          failure instanceof Error
            ? failure.message
            : "Chưa thể lưu trạng thái đã đọc.",
        );
    } finally {
      if (activeRead.current === notice.id) {
        activeRead.current = null;
        setMarking(undefined);
      }
    }
  }
  return (
    <div className={styles.inbox}>
      <section className="panel">
        <div className={styles.sectionTitle}>
          <div>
            <h2>Hộp thông báo</h2>
            <p>
              {countLoading
                ? "Đang kiểm tra thông báo…"
                : countError
                  ? "Chưa cập nhật được số chưa đọc"
                  : unread
                    ? `${unread} thông báo chưa đọc`
                    : "Bạn đã đọc tất cả thông báo"}
            </p>
          </div>
        </div>
        {resource.loading && <p role="status">Đang tải thông báo…</p>}
        {resource.error && (
          <p className="form-error" role="alert">
            {resource.error}{" "}
            <button type="button" onClick={() => void resource.reload()}>
              Thử lại
            </button>
          </p>
        )}
        {resource.data?.total === 0 && (
          <div className={styles.empty}>
            <Megaphone size={32} />
            <h3>Chưa có thông báo</h3>
            <p>Thông báo từ Chủ tịch Hội Sinh viên sẽ xuất hiện ở đây.</p>
          </div>
        )}
        {resource.data?.items.map((notice) => (
          <button
            type="button"
            className={`${styles.inboxItem} ${!notice.read_at ? styles.unread : ""} ${selected?.id === notice.id ? styles.selected : ""}`}
            key={notice.id}
            aria-pressed={selected?.id === notice.id}
            onClick={() => void open(notice)}
          >
            <span className={styles.noticeTitle}>
              {!notice.read_at && <i aria-label="Chưa đọc" />}
              <strong>{notice.title}</strong>
            </span>
            <small>{time(notice.created_at)}</small>
            <span>{notice.read_at ? "Đã đọc" : "Chưa đọc · Nhấn để xem"}</span>
          </button>
        ))}
        <Pagination
          page={page}
          total={resource.data?.total ?? 0}
          onChange={setPage}
        />
      </section>
      <section
        ref={detail}
        className={`panel ${styles.detail}`}
        aria-label="Nội dung thông báo"
      >
        {selected ? (
          <>
            <span className={styles.eyebrow}>HỘI SINH VIÊN TRƯỜNG</span>
            <h2>{selected.title}</h2>
            <p className={styles.metadata}>
              {selected.author_name} · {time(selected.created_at)}
            </p>
            <FormattedText text={selected.body} />
            {marking === selected.id && (
              <p role="status">Đang lưu trạng thái đã đọc…</p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}{" "}
                <button type="button" onClick={() => void open(selected)}>
                  Thử lại
                </button>
              </p>
            )}
            {selected.read_at && (
              <span className={styles.readStatus}>
                <CheckCheck size={16} />
                Đã đọc
              </span>
            )}
          </>
        ) : (
          <div className={styles.empty}>
            <Megaphone size={36} />
            <h3>Thông báo từ Hội Sinh viên</h3>
            <p>Chọn một thông báo để xem nội dung.</p>
          </div>
        )}
      </section>
    </div>
  );
}
