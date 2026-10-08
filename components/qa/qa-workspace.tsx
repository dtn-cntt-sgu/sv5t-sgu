"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  HelpCircle,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { PortalShell } from "@/components/portal-shell";
import { api } from "@/lib/client/api";
import { createClient } from "@/lib/supabase/client";
import type { Faq, PrivateQuestion, QaPage } from "@/lib/domain/qa";
import styles from "./qa.module.css";

const date = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Chưa thể thực hiện. Vui lòng thử lại.";

export function QaWorkspace({ president = false }: { president?: boolean }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState(president ? "waiting" : "all");
  const [data, setData] = useState<QaPage>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    ++sequence.current;
  }, []);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const result = await api<QaPage>(`/qa?page=${page}&filter=${filter}`);
      if (current === sequence.current) {
        const lastPage = Math.max(1, Math.ceil(result.total / 20));
        if (page > lastPage) {
          setPage(lastPage);
          setLoading(true);
          return;
        }
        setData(result);
        setError("");
        setLoading(false);
      }
    } catch (failure) {
      if (current === sequence.current) {
        setError(errorText(failure));
        setLoading(false);
      }
    }
  }, [page, filter]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (active) void reload();
      }, 150);
    };
    const visible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    const db = createClient();
    const channel = db
      .channel("qa-workspace")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_faqs" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_questions" },
        schedule,
      )
      .subscribe((state) => {
        if (active && state === "SUBSCRIBED") schedule();
      });
    schedule();
    const interval = setInterval(visible, 30000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", schedule);
    return () => {
      active = false;
      invalidate();
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", schedule);
      void db.removeChannel(channel);
    };
  }, [reload, invalidate]);
  function changeView(nextPage: number, nextFilter = filter) {
    ++sequence.current;
    setLoading(true);
    setPage(nextPage);
    setFilter(nextFilter);
  }
  return (
    <PortalShell
      portal={president ? "manager" : "student"}
      title="Hỏi đáp"
      subtitle="LẮNG NGHE · GIẢI ĐÁP · ĐỒNG HÀNH"
    >
      {error && (
        <p className="form-error" role="alert">
          {error}{" "}
          <button type="button" onClick={() => void reload()}>
            Tải lại
          </button>
        </p>
      )}
      <div className={styles.columns}>
        <section className={styles.common} aria-label="Câu hỏi chung">
          <div className={styles.heading}>
            <span className={styles.icon}>
              <HelpCircle size={24} />
            </span>
            <div>
              <span className={styles.eyebrow}>THÔNG TIN HỮU ÍCH</span>
              <h2>Câu hỏi thường gặp</h2>
            </div>
          </div>
          <p className={styles.intro}>
            Những giải đáp chung giúp bạn chuẩn bị tốt hơn cho hành trình Sinh
            viên 5 Tốt.
          </p>
          <FaqPanel
            faqs={data?.faqs ?? []}
            president={president}
            ready={!!data && !error}
            reload={reload}
          />
          {loading && !data && <p role="status">Đang tải câu hỏi chung…</p>}
        </section>
        <section
          className={`panel ${styles.private}`}
          aria-label={president ? "Câu hỏi từ sinh viên" : "Hỏi Hội sinh viên Trường"}
        >
          <div className={styles.heading}>
            <span className={styles.icon}>
              <MessageCircle size={24} />
            </span>
            <div>
              <span className={styles.eyebrow}>TRAO ĐỔI RIÊNG</span>
              <h2>{president ? "Câu hỏi từ sinh viên" : "Hỏi Hội sinh viên Trường"}</h2>
            </div>
          </div>
          <p className={styles.intro}>
            {president
              ? `${data?.waiting ?? 0} câu hỏi đang chờ phản hồi.`
              : "Câu hỏi và câu trả lời ở đây chỉ hiển thị với bạn và Hội Sinh viên Trường."}
          </p>
          {!president && (
            <AskForm
              pending={data?.pending ?? false}
              ready={!!data && !error}
              reload={async () => {
                if (page !== 1) changeView(1);
                else await reload();
              }}
            />
          )}
          <div className={styles.historyHeading}>
            <h3>{president ? "Danh sách câu hỏi" : "Lịch sử hỏi đáp"}</h3>
            {president && (
              <select
                aria-label="Lọc câu hỏi"
                value={filter}
                onChange={(event) => changeView(1, event.target.value)}
              >
                <option value="waiting">Chờ trả lời</option>
                <option value="answered">Đã trả lời</option>
                <option value="all">Tất cả</option>
              </select>
            )}
          </div>
          {loading ? (
            <p role="status">Đang tải câu hỏi…</p>
          ) : data?.questions.length ? (
            data.questions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                president={president}
                reload={reload}
              />
            ))
          ) : (
            !error && (
              <div className={styles.empty}>
                <MessageCircle size={30} />
                <p>
                  {president
                    ? "Không có câu hỏi trong danh sách này."
                    : "Bạn chưa gửi câu hỏi nào. Hãy xem phần câu hỏi chung hoặc gửi câu hỏi của bạn ở trên."}
                </p>
              </div>
            )
          )}
          {!!data && data.total > 20 && (
            <div className={styles.pagination}>
              <button
                type="button"
                disabled={page === 1 || loading}
                onClick={() => changeView(page - 1)}
              >
                Trang trước
              </button>
              <span>
                {page}/{Math.ceil(data.total / 20)}
              </span>
              <button
                type="button"
                disabled={page * 20 >= data.total || loading}
                onClick={() => changeView(page + 1)}
              >
                Trang sau
              </button>
            </div>
          )}
        </section>
      </div>
    </PortalShell>
  );
}

function FaqPanel({
  faqs,
  president,
  ready,
  reload,
}: {
  faqs: Faq[];
  president: boolean;
  ready: boolean;
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<{
    id: string;
    version: number;
    question: string;
    answer: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState<string>();
  const inFlight = useRef(false);
  async function mutate(
    body: {
      action: string;
      id: string;
      version: number;
      question?: string;
      answer?: string;
      direction?: number;
    },
    success: string,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/qa/faqs", { method: "POST", body: JSON.stringify(body) });
      setMessage(success);
      if (
        body.action === "save" ||
        (body.action === "delete" && editing?.id === body.id)
      )
        setEditing(undefined);
      setDeleting(undefined);
      await reload();
    } catch (failure) {
      setError(errorText(failure));
      await reload();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {president && (
        <button
          type="button"
          className={`button button-outline ${styles.add}`}
          disabled={!ready || busy}
          onClick={() => {
            setEditing({
              id: crypto.randomUUID(),
              version: 0,
              question: "",
              answer: "",
            });
            setError("");
            setMessage("");
          }}
        >
          <Plus size={17} />
          Thêm câu hỏi chung
        </button>
      )}
      {editing && (
        <form
          className={styles.faqEditor}
          onSubmit={(event) => {
            event.preventDefault();
            void mutate(
              { action: "save", ...editing },
              "Đã lưu câu hỏi chung.",
            );
          }}
        >
          <h3>
            {editing.version ? "Sửa câu hỏi chung" : "Thêm câu hỏi chung"}
          </h3>
          <div className={styles.field}>
            <label htmlFor="faq-question">Câu hỏi</label>
            <input
              id="faq-question"
              required
              minLength={2}
              maxLength={240}
              disabled={busy}
              value={editing.question}
              onChange={(event) =>
                setEditing({ ...editing, question: event.target.value })
              }
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="faq-answer">Câu trả lời</label>
            <textarea
              id="faq-answer"
              required
              maxLength={5000}
              disabled={busy}
              rows={5}
              value={editing.answer}
              onChange={(event) =>
                setEditing({ ...editing, answer: event.target.value })
              }
            />
          </div>
          <div className={styles.actions}>
            <button
              className="button button-primary"
              disabled={
                busy ||
                !editing.answer.trim() ||
                editing.question.trim().length < 2
              }
            >
              {busy ? "Đang lưu…" : "Lưu câu hỏi"}
            </button>
            <button
              className="button button-outline"
              type="button"
              disabled={busy}
              onClick={() => setEditing(undefined)}
            >
              Hủy
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className={styles.success}>
          {message}
        </p>
      )}
      <div className={styles.faqList}>
        {faqs.map((faq, index) => (
          <article key={faq.id} className={styles.faq}>
            <details name="common-questions">
              <summary>
                <span>{faq.question}</span>
                <Plus className={styles.expand} size={20} />
                <X className={styles.collapse} size={20} />
              </summary>
              <div className={styles.faqAnswer}>{faq.answer}</div>
            </details>
            {president && (
              <div className={styles.faqTools}>
                <button
                  type="button"
                  title="Đưa lên"
                  aria-label={`Đưa lên: ${faq.question}`}
                  disabled={busy || !ready || index === 0}
                  onClick={() =>
                    void mutate(
                      {
                        action: "move",
                        id: faq.id,
                        version: faq.version,
                        direction: -1,
                      },
                      "Đã thay đổi thứ tự.",
                    )
                  }
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  title="Đưa xuống"
                  aria-label={`Đưa xuống: ${faq.question}`}
                  disabled={busy || !ready || index === faqs.length - 1}
                  onClick={() =>
                    void mutate(
                      {
                        action: "move",
                        id: faq.id,
                        version: faq.version,
                        direction: 1,
                      },
                      "Đã thay đổi thứ tự.",
                    )
                  }
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  disabled={busy || !ready}
                  aria-label={`Sửa: ${faq.question}`}
                  onClick={() => {
                    setEditing({ ...faq });
                    setError("");
                    setMessage("");
                  }}
                >
                  <Pencil size={15} />
                  Sửa
                </button>
                <button
                  type="button"
                  disabled={busy || !ready}
                  aria-label={`Xóa: ${faq.question}`}
                  onClick={() => setDeleting(faq.id)}
                >
                  <Trash2 size={15} />
                  Xóa
                </button>
              </div>
            )}
            {deleting === faq.id && (
              <div className={styles.confirm}>
                <p>Xóa câu hỏi chung này khỏi danh sách?</p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      { action: "delete", id: faq.id, version: faq.version },
                      "Đã xóa câu hỏi chung.",
                    )
                  }
                >
                  Xác nhận xóa
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDeleting(undefined)}
                >
                  Giữ lại
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {ready && faqs.length === 0 && (
        <div className={styles.empty}>
          <HelpCircle size={30} />
          <p>
            Chưa có câu hỏi chung.{" "}
            {president
              ? "Thêm những giải đáp hữu ích cho sinh viên."
              : "Bạn có thể gửi câu hỏi riêng cho Chủ tịch ở bên cạnh."}
          </p>
        </div>
      )}
    </>
  );
}
function AskForm({
  pending,
  ready,
  reload,
}: {
  pending: boolean;
  ready: boolean;
  reload: () => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const id = useRef<string | null>(null);
  const inFlight = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || pending || !ready) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setSent(false);
    id.current ??= crypto.randomUUID();
    try {
      await api("/qa/questions", {
        method: "POST",
        body: JSON.stringify({ id: id.current, question }),
      });
      setQuestion("");
      id.current = null;
      setSent(true);
      await reload();
    } catch (failure) {
      setError(errorText(failure));
      await reload();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={styles.ask}>
      {pending ? (
        <div className={styles.waiting}>
          <Clock3 size={20} />
          <div>
            <strong>Câu hỏi của bạn đang chờ trả lời</strong>
            <p>Bạn có thể gửi câu hỏi tiếp theo sau khi Chủ tịch phản hồi.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="personal-question">Câu hỏi của bạn</label>
          <textarea
            id="personal-question"
            required
            minLength={2}
            maxLength={3000}
            rows={4}
            placeholder="Bạn cần được giải đáp điều gì?"
            value={question}
            disabled={busy || !ready}
            onChange={(event) => {
              setQuestion(event.target.value);
              id.current = null;
              setSent(false);
            }}
          />
          <div className={styles.sendRow}>
            <small>{question.length}/3.000 ký tự · Mỗi lần một câu hỏi</small>
            <button
              className="button button-primary"
              disabled={busy || !ready || question.trim().length < 2}
            >
              <Send size={16} />
              {busy ? "Đang gửi…" : "Gửi câu hỏi"}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className={styles.success}>
          Đã gửi câu hỏi đến Chủ tịch.
        </p>
      )}
    </div>
  );
}
function QuestionCard({
  question: q,
  president,
  reload,
}: {
  question: PrivateQuestion;
  president: boolean;
  reload: () => Promise<void>;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await api(`/qa/questions/${q.id}/answer`, {
        method: "POST",
        body: JSON.stringify({ answer }),
      });
      await reload();
    } catch (failure) {
      setError(errorText(failure));
      await reload();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <article className={styles.question}>
      <div className={styles.questionMeta}>
        <span>
          {president
            ? `${q.student_name}${q.student_code ? ` · ${q.student_code}` : ""}`
            : "Câu hỏi của bạn"}
        </span>
        <span className={q.answer ? styles.answeredBadge : styles.waitingBadge}>
          {q.answer ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
          {q.answer ? "Đã trả lời" : "Chờ trả lời"}
        </span>
      </div>
      <small className={styles.date}>{date(q.created_at)}</small>
      <p className={styles.questionText}>{q.question}</p>
      {q.answer ? (
        <div className={styles.reply}>
          <strong>Hội Sinh viên Trường · {q.answered_name}</strong>
          <p>{q.answer}</p>
          <small>{q.answered_at && date(q.answered_at)}</small>
        </div>
      ) : (
        president && (
          <form className={styles.replyForm} onSubmit={submit}>
            <label htmlFor={`answer-${q.id}`}>Trả lời sinh viên</label>
            <textarea
              id={`answer-${q.id}`}
              required
              maxLength={5000}
              rows={4}
              value={answer}
              disabled={busy}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Nhập câu trả lời…"
            />
            <div className={styles.sendRow}>
              <small>{answer.length}/5.000 ký tự</small>
              <button
                className="button button-primary"
                disabled={busy || !answer.trim()}
              >
                <Send size={15} />
                {busy ? "Đang gửi…" : "Gửi trả lời"}
              </button>
            </div>
          </form>
        )
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
