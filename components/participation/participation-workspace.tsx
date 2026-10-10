"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Download, RefreshCw, Search, Trash2, Users } from "lucide-react";
import { PortalShell } from "@/components/portal-shell";
import { ResourceState } from "@/components/resource-state";
import { api, ApiError, mutation } from "@/lib/client/api";
import { createClient } from "@/lib/supabase/client";
import {
  PARTICIPATION_RESET_CONFIRMATION,
  type ParticipationRegistrationList,
} from "@/lib/domain/participation";
import styles from "./participation.module.css";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
const date = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Chưa thể thực hiện thao tác. Vui lòng thử lại.";

export function ParticipationWorkspace() {
  const [data, setData] = useState<ParticipationRegistrationList>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [requestId, setRequestId] = useState<string>();
  const [pending, setPending] = useState<"export" | "prepare" | "reset">();
  const busy = useRef(false);
  const sequence = useRef(0);
  const invalidate = useCallback(() => {
    ++sequence.current;
  }, []);

  const reload = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const result = await api<ParticipationRegistrationList>(
        "/manager/participation",
      );
      if (current === sequence.current) {
        setData(result);
        setLoadError("");
        setLoading(false);
      }
    } catch (error) {
      if (current === sequence.current) {
        setLoadError(errorText(error));
        setLoading(false);
      }
    }
  }, []);

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
      .channel("participation-management")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "participation_totals" },
        schedule,
      )
      .subscribe((state) => {
        if (active && state === "SUBSCRIBED") schedule();
      });
    schedule();
    const interval = setInterval(visible, 30000);
    window.addEventListener("online", schedule);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      invalidate();
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("online", schedule);
      document.removeEventListener("visibilitychange", visible);
      void db.removeChannel(channel);
    };
  }, [reload, invalidate]);

  const rows = useMemo(() => {
    const query = normalize(search);
    return (data?.registrations ?? []).filter(
      (row) =>
        (!facultyId || row.faculty_id === facultyId) &&
        (!query ||
          normalize(
            [
              row.mssv,
              row.full_name,
              row.email,
              row.phone,
              row.class_name,
              row.faculty_name,
              row.major_name,
            ]
              .filter(Boolean)
              .join(" "),
          ).includes(query)),
    );
  }, [data, search, facultyId]);
  const ready = !!data && !loadError;

  async function exportExcel() {
    if (busy.current) return;
    busy.current = true;
    setPending("export");
    setActionError("");
    setSuccess("");
    try {
      const response = await fetch("/api/v1/manager/participation/excel", {
        cache: "no-store",
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error?.message ?? "Không thể xuất Excel.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "danh-sach-dang-ki.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setSuccess("Đã tạo tệp Excel gồm toàn bộ danh sách đăng kí.");
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      busy.current = false;
      setPending(undefined);
    }
  }

  function cancelReset() {
    setResetOpen(false);
    setRequestId(undefined);
    setConfirmation("");
    setActionError("");
  }

  async function prepareReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || confirmation !== PARTICIPATION_RESET_CONFIRMATION)
      return;
    busy.current = true;
    setPending("prepare");
    setActionError("");
    setSuccess("");
    try {
      const result = await mutation<{ requestId: string }>(
        "/manager/participation/reset",
        { step: "prepare", confirmation },
      );
      setRequestId(result.requestId);
    } catch (error) {
      setActionError(errorText(error));
    } finally {
      busy.current = false;
      setPending(undefined);
    }
  }

  async function confirmReset() {
    if (busy.current || !requestId) return;
    busy.current = true;
    setPending("reset");
    setActionError("");
    setSuccess("");
    ++sequence.current;
    try {
      const result = await mutation<{ deletedCount: number }>(
        "/manager/participation/reset",
        { step: "confirm", requestId },
      );
      cancelReset();
      setSuccess(
        `Đã reset danh sách, xóa ${result.deletedCount.toLocaleString("vi-VN")} lượt đăng kí. Sinh viên có thể đăng kí lại.`,
      );
      await reload();
    } catch (error) {
      setActionError(errorText(error));
      if (
        error instanceof ApiError &&
        error.code === "PARTICIPATION_RESET_INVALID"
      )
        setRequestId(undefined);
    } finally {
      busy.current = false;
      setPending(undefined);
    }
  }

  return (
    <PortalShell
      portal="manager"
      title="Danh sách đăng kí"
      subtitle="THAM GIA XÉT DANH HIỆU SINH VIÊN 5 TỐT"
    >
      <div className={styles.columns}>
        <section
          className={`panel ${styles.list}`}
          aria-label="Sinh viên đã đăng kí"
        >
          <div className={styles.heading}>
            <div>
              <h2>
                <Users size={23} /> Sinh viên đã đăng kí
              </h2>
              <p>
                Danh sách sinh viên đăng kí tham gia xét danh hiệu Sinh viên 5 Tốt.
              </p>
            </div>
            <button
              type="button"
              className="button button-outline"
              onClick={() => void reload()}
              disabled={!!pending}
              aria-label="Tải lại danh sách"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <div className={styles.filters}>
            <label>
              <span>
                <Search size={15} /> Tìm kiếm
              </span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Họ tên, MSSV, lớp, email, số điện thoại…"
              />
            </label>
            <label>
              <span>Khoa</span>
              <select
                aria-label="Khoa"
                value={facultyId}
                onChange={(event) => setFacultyId(event.target.value)}
              >
                <option value="">Tất cả khoa</option>
                {data?.faculties.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {data && (
            <p className={styles.count} role="status">
              Hiển thị {rows.length.toLocaleString("vi-VN")} /{" "}
              {data.registrations.length.toLocaleString("vi-VN")} sinh viên
            </p>
          )}
          <ResourceState
            loading={loading && !data}
            error={loadError}
            retry={() => void reload()}
          />
          {ready && (
            <div
              className={styles.tableScroll}
              tabIndex={0}
              role="region"
              aria-label="Bảng danh sách đăng kí, cuộn để xem thêm"
            >
              <table className={styles.table}>
                <thead>
                  <tr>
                    {[
                      "STT",
                      "MSSV",
                      "Họ và tên",
                      "Khoa / Ngành",
                      "Lớp",
                      "Liên hệ",
                      "Thời gian đăng kí",
                    ].map((name) => (
                      <th scope="col" key={name}>
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.user_id}>
                      <td>{index + 1}</td>
                      <td>{row.mssv ?? "—"}</td>
                      <td>
                        <strong>{row.full_name}</strong>
                      </td>
                      <td>
                        {row.faculty_name ?? "—"}
                        <small>{row.major_name}</small>
                      </td>
                      <td>{row.class_name ?? "—"}</td>
                      <td>
                        {row.email}
                        <small>{row.phone ?? "Chưa có số điện thoại"}</small>
                      </td>
                      <td>{date.format(new Date(row.registered_at))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && (
                <p className={styles.empty}>
                  {data.registrations.length
                    ? "Không có sinh viên phù hợp với tìm kiếm và bộ lọc."
                    : "Chưa có sinh viên đăng kí tham gia."}
                </p>
              )}
            </div>
          )}
        </section>
        <aside
          className={styles.actions}
          aria-label="Thao tác với danh sách đăng kí"
        >
          <section className={`panel ${styles.export}`}>
            <h2>
              <Download size={21} /> Xuất danh sách Excel
            </h2>
            <p>
              Tải toàn bộ danh sách đăng kí, gồm thông tin sinh viên và thời
              gian đăng kí. Tệp Excel không phụ thuộc bộ lọc bên trái.
            </p>
            <button
              type="button"
              className="button button-primary"
              onClick={() => void exportExcel()}
              disabled={!ready || !!pending}
            >
              <Download size={17} />
              {pending === "export"
                ? "Đang xuất Excel…"
                : "Xuất toàn bộ danh sách"}
            </button>
          </section>
          <section className={`panel ${styles.reset}`}>
            <h2>
              <Trash2 size={21} /> Reset danh sách đăng kí
            </h2>
            <p>
              Xóa toàn bộ lượt đăng kí của tất cả khoa và đưa bộ đếm về 0. Sinh
              viên có thể đăng kí lại. Hồ sơ xét duyệt và tài khoản được giữ
              nguyên.
            </p>
            <p className={styles.warning}>
              Thao tác không thể hoàn tác. Hãy xuất Excel trước nếu cần lưu lại
              danh sách.
            </p>
            {!resetOpen ? (
              <button
                type="button"
                className={styles.danger}
                disabled={!ready || !data?.registrations.length || !!pending}
                onClick={() => {
                  setResetOpen(true);
                  setActionError("");
                  setSuccess("");
                }}
              >
                Reset toàn bộ danh sách
              </button>
            ) : !requestId ? (
              <form onSubmit={prepareReset}>
                <h3>Bước 1 / 2: Nhập chuỗi xác nhận</h3>
                <label className={styles.confirmation}>
                  <span>Nhập chính xác:</span>
                  <code>{PARTICIPATION_RESET_CONFIRMATION}</code>
                  <input
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    autoFocus
                    disabled={!!pending}
                    aria-label="Chuỗi xác nhận reset"
                  />
                </label>
                <div className={styles.buttons}>
                  <button
                    type="submit"
                    className={styles.danger}
                    disabled={
                      confirmation !== PARTICIPATION_RESET_CONFIRMATION ||
                      !!pending
                    }
                  >
                    {pending === "prepare"
                      ? "Đang xác thực…"
                      : "Xác nhận bước 1"}
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={cancelReset}
                    disabled={!!pending}
                  >
                    Hủy
                  </button>
                </div>
              </form>
            ) : (
              <div className={styles.finalConfirm}>
                <h3>Bước 2 / 2: Xác nhận xóa</h3>
                <p>
                  Bạn sẽ xóa toàn bộ danh sách đăng kí hiện tại, kể cả lượt mới
                  phát sinh. Xác nhận này có hiệu lực trong 5 phút.
                </p>
                <div className={styles.buttons}>
                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => void confirmReset()}
                    disabled={!!pending}
                    autoFocus
                  >
                    {pending === "reset"
                      ? "Đang reset…"
                      : "Xác nhận xóa toàn bộ danh sách"}
                  </button>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={cancelReset}
                    disabled={!!pending}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </section>
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}
          {success && (
            <p className={styles.success} role="status">
              {success}
            </p>
          )}
        </aside>
      </div>
    </PortalShell>
  );
}
