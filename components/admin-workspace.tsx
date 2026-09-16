"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  HardDrive,
  UsersRound,
  Plus,
  Save,
} from "lucide-react";
import { PortalShell } from "./portal-shell";
import { ResourceState } from "./resource-state";
import { useResource } from "@/lib/client/use-resource";
import { api, mutation } from "@/lib/client/api";
import {
  type Campaign,
  type Profile,
  roleLabels,
  bytesLabel,
  dateLabel,
} from "@/lib/domain/models";
type Faculty = {
  id: string;
  code: string;
  name: string;
  majors: { id: string; name: string; code: string }[];
};
type Storage = {
  r2: {
    committedBytes: number;
    reservedBytes: number;
    hardLimitBytes: number;
    percent: number;
    warning: boolean;
  };
  database: { bytes: number; limitBytes: number };
};
export function AdminOverview() {
  const storage = useResource<Storage>("/admin/system/storage-health");
  const users = useResource<{ total: number }>("/admin/users");
  return (
    <PortalShell portal="admin" title="Tổng quan hệ thống">
      <ResourceState {...storage} retry={storage.reload} />
      <ResourceState error={users.error} retry={users.reload} />
      {storage.data && (
        <>
          <p className={`notice ${storage.data.r2.warning ? "warning" : ""}`}>
            {storage.data.r2.warning
              ? "Dung lượng minh chứng đang gần ngưỡng. Hãy kiểm tra và chuẩn bị lưu trữ đợt cũ."
              : "Dung lượng minh chứng hiện nằm trong ngưỡng đã cấu hình."}
          </p>
          <div className="admin-grid">
            {[
              {
                label: "Dung lượng cơ sở dữ liệu",
                value: bytesLabel(storage.data.database.bytes),
                sub: `Giới hạn tham chiếu ${bytesLabel(storage.data.database.limitBytes)}`,
                icon: Database,
              },
              {
                label: "Minh chứng đã xác nhận",
                value: bytesLabel(storage.data.r2.committedBytes),
                sub: `${bytesLabel(storage.data.r2.reservedBytes)} đang giữ chỗ · ngưỡng ${bytesLabel(storage.data.r2.hardLimitBytes)}`,
                icon: HardDrive,
              },
              {
                label: "Tổng tài khoản",
                value: users.data?.total?.toLocaleString("vi-VN") ?? "…",
                sub: "Tài khoản đã tạo hồ sơ người dùng",
                icon: UsersRound,
              },
            ].map(({ label, value, sub, icon: Icon }) => (
              <article className="panel metric-card" key={label}>
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>{sub}</small>
                </div>
                <i>
                  <Icon size={24} />
                </i>
              </article>
            ))}
          </div>
        </>
      )}
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Vận hành đợt xét duyệt</h2>
          <p>
            Tạo lịch nhận hồ sơ, cập nhật danh mục và theo dõi hoạt động hệ
            thống.
          </p>
          <Link className="button button-primary" href="/admin/campaigns">
            Quản lý đợt xét <ArrowRight size={17} />
          </Link>
        </section>
        <section className="panel">
          <h2>Quản trị tài khoản</h2>
          <p>
            Cấp tài khoản cán bộ khoa, cập nhật thông tin và khóa quyền truy cập
            khi cần.
          </p>
          <Link className="inline-link" href="/admin/users">
            Quản lý tài khoản <ArrowRight size={17} />
          </Link>
        </section>
      </div>
    </PortalShell>
  );
}
export function CampaignManagement({
  portal = "admin",
}: {
  portal?: "admin" | "manager";
}) {
  const resource = useResource<Campaign[]>("/campaigns");
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setPending(true);
    setError("");
    try {
      await mutation(
        editing ? `/campaigns/${editing.id}` : "/campaigns",
        {
          name: f.get("name"),
          academic_year: f.get("academic_year"),
          start_date: new Date(`${f.get("start_date")}:00+07:00`).toISOString(),
          end_date: new Date(`${f.get("end_date")}:00+07:00`).toISOString(),
          is_active: f.get("is_active") === "on",
        },
        editing ? "PUT" : "POST",
      );
      await resource.reload();
      setEditing(null);
      form.reset();
      setMessage("Đã lưu đợt xét duyệt.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu.");
    } finally {
      setPending(false);
    }
  }
  const local = (v?: string) =>
    v ? new Date(Date.parse(v) + 7 * 3600000).toISOString().slice(0, 16) : "";
  return (
    <PortalShell portal={portal} title="Quản lý đợt xét duyệt">
      <ResourceState {...resource} retry={resource.reload} />
      <div className="admin-two-columns">
        <section className="panel">
          <h2>Các đợt xét duyệt</h2>
          <p>Mỗi thời điểm chỉ một đợt được bật nhận hồ sơ.</p>
          {resource.data?.map((c) => (
            <article className="campaign-row" key={c.id}>
              <div>
                <h3>{c.name}</h3>
                <p>
                  {dateLabel(c.start_date)} → {dateLabel(c.end_date)}
                </p>
                <span
                  className={`status-pill ${c.is_active ? "state-ACCEPTED" : ""}`}
                >
                  {c.is_archived
                    ? "Đã lưu trữ"
                    : c.is_active
                      ? "Đã bật nhận hồ sơ"
                      : "Đang đóng"}
                </span>
              </div>
              <button
                disabled={c.is_archived}
                className="button button-outline"
                onClick={() => {
                  setEditing(c);
                  setMessage("");
                }}
              >
                Chỉnh sửa
              </button>
            </article>
          ))}
          {resource.data?.length === 0 && (
            <p>Chưa có đợt xét. Tạo đợt đầu tiên bằng biểu mẫu bên cạnh.</p>
          )}
        </section>
        <form
          key={editing?.id ?? "new"}
          className="panel workspace-form"
          onSubmit={save}
        >
          <h2>{editing ? "Chỉnh sửa đợt xét" : "Tạo đợt xét mới"}</h2>
          <label>
            Tên đợt
            <input
              name="name"
              defaultValue={editing?.name}
              required
              minLength={3}
              maxLength={150}
              placeholder="Sinh viên 5 Tốt · Năm học 2026–2027"
            />
          </label>
          <label>
            Năm học
            <input
              name="academic_year"
              defaultValue={editing?.academic_year}
              required
              pattern="[0-9]{4}-[0-9]{4}"
              placeholder="2026-2027"
            />
          </label>
          <label>
            Mở nhận hồ sơ (giờ Việt Nam)
            <input
              type="datetime-local"
              name="start_date"
              defaultValue={local(editing?.start_date)}
              required
            />
          </label>
          <label>
            Đóng nhận hồ sơ (giờ Việt Nam)
            <input
              type="datetime-local"
              name="end_date"
              defaultValue={local(editing?.end_date)}
              required
            />
          </label>
          <label className="checkbox">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked={editing?.is_active ?? false}
            />
            Bật nhận hồ sơ trong khoảng thời gian trên
          </label>
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
          <button className="button button-primary" disabled={pending}>
            <Save size={17} />
            {pending ? "Đang lưu…" : "Lưu đợt xét"}
          </button>
          {editing && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => setEditing(null)}
            >
              Hủy chỉnh sửa
            </button>
          )}
        </form>
      </div>
    </PortalShell>
  );
}
export function UserManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const users = useResource<{ items: Profile[]; total: number }>(
    `/admin/users?page=${page}&search=${encodeURIComponent(search)}`,
  );
  const faculties = useResource<Faculty[]>("/public/faculties");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [role, setRole] = useState("FACULTY_SECRETARY");
  const [faculty, setFaculty] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [deleteId, setDeleteId] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setPending(true);
    setError("");
    try {
      await mutation(
        selected ? `/admin/users/${selected.id}` : "/admin/users",
        selected
          ? {
              full_name: f.get("full_name"),
              is_active: f.get("is_active") === "on",
              phone: String(f.get("phone") || "") || null,
              faculty_id: faculty || null,
              major_id: String(f.get("major_id") || "") || null,
              class_name: String(f.get("class_name") || "") || null,
            }
          : {
              full_name: f.get("full_name"),
              email: f.get("email"),
              password: f.get("password"),
              role,
              faculty_id: faculty || null,
              ...(role === "STUDENT"
                ? {
                    mssv: f.get("mssv"),
                    phone: f.get("phone"),
                    major_id: f.get("major_id"),
                    class_name: f.get("class_name"),
                  }
                : {}),
            },
        selected ? "PUT" : "POST",
      );
      await users.reload();
      setMessage(
        selected
          ? "Đã cập nhật tài khoản."
          : "Đã tạo tài khoản. Bàn giao mật khẩu qua kênh riêng.",
      );
      setSelected(null);
      form.reset();
      setFaculty("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu.");
    } finally {
      setPending(false);
    }
  }
  async function remove(id: string) {
    setPending(true);
    setError("");
    try {
      await api(`/admin/users/${id}`, { method: "DELETE" });
      await users.reload();
      setDeleteId("");
      setSelected(null);
      setMessage("Đã xóa tài khoản.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xóa.");
    } finally {
      setPending(false);
    }
  }
  return (
    <PortalShell portal="admin" title="Quản lý tài khoản">
      <div className="workspace-toolbar">
        <p>Cấp quyền và quản lý thông tin người dùng.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(String(new FormData(e.currentTarget).get("search")));
            setPage(1);
          }}
          className="inline-form"
        >
          <input
            name="search"
            placeholder="Tìm theo họ tên"
            aria-label="Tìm theo họ tên"
          />
          <button className="button button-outline">Tìm kiếm</button>
        </form>
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
      <ResourceState {...users} retry={users.reload} />
      <div className="admin-two-columns">
        <section className="panel">
          <div className="table-scroll">
            <table className="workspace-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Vai trò</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.data?.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.full_name}</strong>
                      <small>{u.email}</small>
                      <small>
                        {u.is_active ? "Đang hoạt động" : "Đã khóa"}
                      </small>
                    </td>
                    <td>{roleLabels[u.role]}</td>
                    <td>
                      <button
                        className="button button-outline"
                        onClick={() => {
                          setSelected(u);
                          setRole(u.role);
                          setFaculty(u.faculty_id ?? "");
                          setDeleteId("");
                        }}
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>{users.data?.total ?? 0} tài khoản</span>
            <div>
              <button
                className="button button-outline"
                disabled={page === 1}
                onClick={() => setPage((v) => v - 1)}
              >
                Trước
              </button>
              <button
                className="button button-outline"
                disabled={page * 30 >= (users.data?.total ?? 0)}
                onClick={() => setPage((v) => v + 1)}
              >
                Sau
              </button>
            </div>
          </div>
        </section>
        <form
          key={selected?.id ?? "new"}
          className="panel workspace-form"
          onSubmit={save}
        >
          <h2>{selected ? "Chỉnh sửa tài khoản" : "Cấp tài khoản mới"}</h2>
          <label>
            Họ và tên
            <input
              name="full_name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={selected?.full_name}
            />
          </label>
          {!selected && (
            <>
              <label>
                Email
                <input type="email" name="email" required />
              </label>
              <label>
                Mật khẩu ban đầu
                <input
                  type="password"
                  name="password"
                  minLength={14}
                  maxLength={72}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Vai trò
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="FACULTY_SECRETARY">Liên chi Hội trưởng</option>
                  <option value="SCHOOL_PRESIDENT">Hội Sinh viên trường</option>
                  <option value="STUDENT">Sinh viên</option>
                </select>
              </label>
            </>
          )}
          <label>
            Khoa
            <select
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              required={role === "STUDENT" || role === "FACULTY_SECRETARY"}
            >
              <option value="">Toàn trường</option>
              {faculties.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          {role === "STUDENT" && (
            <>
              {!selected && (
                <label>
                  MSSV
                  <input name="mssv" required minLength={5} maxLength={20} />
                </label>
              )}
              <label>
                Ngành
                <select
                  key={faculty}
                  name="major_id"
                  required
                  defaultValue={selected?.major_id ?? ""}
                >
                  <option value="">Chọn ngành</option>
                  {faculties.data
                    ?.find((f) => f.id === faculty)
                    ?.majors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Lớp
                <input
                  name="class_name"
                  required
                  defaultValue={selected?.class_name ?? ""}
                />
              </label>
            </>
          )}
          {(selected || role === "STUDENT") && (
            <label>
              Số điện thoại
              <input
                name="phone"
                type="tel"
                pattern="\+?[0-9]{9,15}"
                required={role === "STUDENT"}
                defaultValue={selected?.phone ?? ""}
              />
            </label>
          )}
          {selected && (
            <label className="checkbox">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={selected.is_active}
              />
              Cho phép hoạt động
            </label>
          )}
          <button className="button button-primary" disabled={pending}>
            <Save size={17} />
            {pending ? "Đang xử lý…" : "Lưu tài khoản"}
          </button>
          {selected && (
            <>
              <button
                className="button button-outline"
                type="button"
                onClick={() => {
                  setSelected(null);
                  setRole("FACULTY_SECRETARY");
                  setFaculty("");
                }}
              >
                Tạo tài khoản khác
              </button>
              {selected.role !== "SUPER_ADMIN" && (
                <div className="danger-zone">
                  <p>
                    Xóa vĩnh viễn tài khoản {selected.full_name}. Tài khoản còn
                    hồ sơ sẽ không được xóa.
                  </p>
                  {deleteId === selected.id ? (
                    <button
                      type="button"
                      className="button button-danger"
                      disabled={pending}
                      onClick={() => void remove(selected.id)}
                    >
                      Xác nhận xóa tài khoản
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => setDeleteId(selected.id)}
                    >
                      Xóa tài khoản này
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </form>
      </div>
    </PortalShell>
  );
}
export function AdminSettings() {
  const settings = useResource<{
    r2_hard_limit_bytes: number;
    r2_warning_percent: number;
  }>("/admin/settings");
  const faculties = useResource<Faculty[]>("/public/faculties");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<{
    id: string;
    kind: string;
    name: string;
    code: string;
    faculty_id?: string;
  } | null>(null);
  async function save(
    e: FormEvent<HTMLFormElement>,
    kind: "settings" | "catalog",
  ) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setPending(true);
    setError("");
    try {
      if (kind === "settings")
        await mutation(
          "/admin/settings",
          {
            r2_hard_limit_bytes: Math.round(Number(f.get("limit")) * 1024 ** 3),
            r2_warning_percent: Number(f.get("warning")),
          },
          "PUT",
        );
      else
        await mutation("/admin/catalog", {
          ...(editing ? { id: editing.id } : {}),
          kind: f.get("kind"),
          code: f.get("code"),
          name: f.get("name"),
          ...(f.get("faculty_id") ? { faculty_id: f.get("faculty_id") } : {}),
        });
      await faculties.reload();
      await settings.reload();
      setMessage("Đã lưu cấu hình.");
      if (kind === "catalog") {
        form.reset();
        setEditing(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu.");
    } finally {
      setPending(false);
    }
  }
  return (
    <PortalShell portal="admin" title="Cấu hình & danh mục">
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
      <ResourceState {...settings} retry={settings.reload} />
      <div className="admin-two-columns">
        {settings.data && (
          <form
            className="panel workspace-form"
            onSubmit={(e) => void save(e, "settings")}
          >
            <h2>Dung lượng minh chứng</h2>
            <label>
              Ngưỡng dừng tải (GiB)
              <input
                name="limit"
                type="number"
                step="0.01"
                min="0.01"
                max="10"
                required
                defaultValue={settings.data.r2_hard_limit_bytes / 1024 ** 3}
              />
            </label>
            <label>
              Cảnh báo khi đạt (%)
              <input
                name="warning"
                type="number"
                min="1"
                max="99"
                required
                defaultValue={settings.data.r2_warning_percent}
              />
            </label>
            <button className="button button-primary" disabled={pending}>
              Lưu ngưỡng dung lượng
            </button>
            <Link href="/admin/security" className="inline-link">
              Đổi mật khẩu quản trị qua mã email <ArrowRight size={16} />
            </Link>
          </form>
        )}
        <form
          key={editing?.id ?? "new"}
          className="panel workspace-form"
          onSubmit={(e) => void save(e, "catalog")}
        >
          <h2>{editing ? "Sửa danh mục" : "Thêm khoa / ngành"}</h2>
          <label>
            Loại danh mục
            <select name="kind" defaultValue={editing?.kind ?? "faculties"}>
              <option value="faculties">Khoa</option>
              <option value="majors">Ngành</option>
            </select>
          </label>
          <label>
            Mã
            <input
              name="code"
              pattern="[A-Z0-9_-]{2,20}"
              required
              defaultValue={editing?.code}
            />
          </label>
          <label>
            Tên
            <input
              name="name"
              minLength={2}
              maxLength={150}
              required
              defaultValue={editing?.name}
            />
          </label>
          <label>
            Khoa trực thuộc (khi tạo ngành)
            <select name="faculty_id" defaultValue={editing?.faculty_id ?? ""}>
              <option value="">Chọn khoa</option>
              {faculties.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-primary" disabled={pending}>
            <Plus size={17} />
            Lưu danh mục
          </button>
          {editing && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => setEditing(null)}
            >
              Hủy sửa
            </button>
          )}
        </form>
      </div>
      <section className="panel" style={{ marginTop: 20 }}>
        <h2>Danh mục khoa & ngành</h2>
        <p>
          Danh sách ban đầu là dữ liệu mẫu; cập nhật danh mục chính thức trước
          khi mở đợt nhận hồ sơ.
        </p>
        {faculties.data?.map((f) => (
          <div key={f.id} className="catalog-row">
            <button
              className="inline-link"
              onClick={() => setEditing({ ...f, kind: "faculties" })}
            >
              {f.code} · {f.name} — Sửa
            </button>
            <div>
              {f.majors.map((m) => (
                <button
                  className="catalog-chip"
                  key={m.id}
                  onClick={() =>
                    setEditing({ ...m, kind: "majors", faculty_id: f.id })
                  }
                >
                  {m.name} ↗
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </PortalShell>
  );
}
export function AuditPage() {
  const [page, setPage] = useState(1);
  const r = useResource<{
    items: {
      id: string;
      action: string;
      created_at: string;
      resource_type: string;
      metadata: unknown;
    }[];
    total: number;
  }>(`/admin/audit?page=${page}`);
  return (
    <PortalShell portal="admin" title="Nhật ký hệ thống">
      <ResourceState {...r} retry={r.reload} />
      <section className="panel">
        <h2>Lịch sử thao tác</h2>
        {r.data?.items.map((item) => (
          <details key={item.id} className="audit-entry">
            <summary>
              {dateLabel(item.created_at)} · {item.action}
            </summary>
            <pre>{JSON.stringify(item.metadata, null, 2)}</pre>
          </details>
        ))}
        <div className="pagination">
          <span>{r.data?.total ?? 0} bản ghi</span>
          <div>
            <button
              className="button button-outline"
              disabled={page === 1}
              onClick={() => setPage((v) => v - 1)}
            >
              Trước
            </button>
            <button
              className="button button-outline"
              disabled={page * 30 >= (r.data?.total ?? 0)}
              onClick={() => setPage((v) => v + 1)}
            >
              Sau
            </button>
          </div>
        </div>
      </section>
    </PortalShell>
  );
}
