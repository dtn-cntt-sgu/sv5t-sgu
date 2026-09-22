"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Files,
  Search,
  XCircle,
  Download,
} from "lucide-react";
import { PortalShell } from "./portal-shell";
import { ResourceState, EmptyState } from "./resource-state";
import { useResource } from "@/lib/client/use-resource";
import {
  type Campaign,
  type Profile,
  type Application,
  statusLabels,
  dateLabel,
} from "@/lib/domain/models";
type Summary = {
  totalSubmitted: number;
  pending: number;
  resubmitRequired: number;
  approved: number;
  rejected: number;
  faculties?: { name: string; total: number; approved: number }[];
};
type Faculty = {
  id: string;
  name: string;
  majors: { id: string; name: string }[];
};
export function ManagerWorkspace({
  view = "overview",
}: {
  view?: "overview" | "applications" | "statistics";
}) {
  const campaigns = useResource<Campaign[]>("/campaigns");
  const profile = useResource<Profile>("/users/me");
  const faculties = useResource<Faculty[]>("/public/faculties");
  const [campaignId, setCampaignId] = useState("");
  const [filters, setFilters] = useState("");
  const [page, setPage] = useState(1);
  const selected =
    campaignId ||
    campaigns.data?.find((c) => c.is_active)?.id ||
    campaigns.data?.[0]?.id;
  const summary = useResource<Summary>(
    selected ? `/statistics/summary?campaignId=${selected}` : null,
  );
  const applications = useResource<{
    items: Application[];
    total: number;
    pageSize: number;
  }>(
    selected
      ? `/manager/applications?campaignId=${selected}&page=${page}${filters}`
      : null,
  );
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (value)
        params.set(
          key,
          key === "from"
            ? new Date(`${value}T00:00:00+07:00`).toISOString()
            : key === "to"
              ? new Date(`${value}T23:59:59+07:00`).toISOString()
              : String(value),
        );
    }
    setFilters(`&${params}`);
    setPage(1);
  }
  const scope =
    profile.data?.role === "FACULTY_SECRETARY"
      ? profile.data.faculties?.name
      : "Toàn trường";
  const visibleFaculties =
    profile.data?.role === "FACULTY_SECRETARY"
      ? faculties.data?.filter((f) => f.id === profile.data?.faculty_id)
      : faculties.data;
  return (
    <PortalShell
      portal="manager"
      title={
        view === "applications"
          ? "Danh sách hồ sơ"
          : view === "statistics"
            ? "Thống kê xét duyệt"
            : "Tổng quan xét duyệt"
      }
      subtitle={scope ?? "KHÔNG GIAN XÉT DUYỆT"}
    >
      <div className="workspace-toolbar">
        <div>
          <span className="section-kicker">ĐỢT XÉT DUYỆT</span>
          <p>Theo dõi tiến độ và đồng hành cùng sinh viên.</p>
        </div>
        <label>
          <span className="sr-only">Chọn đợt xét</span>
          <select
            value={selected ?? ""}
            onChange={(e) => {
              setCampaignId(e.target.value);
              setPage(1);
            }}
          >
            <option value="" disabled>
              Chọn đợt
            </option>
            {campaigns.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.is_archived ? " - Đã lưu trữ" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ResourceState
        loading={campaigns.loading}
        error={campaigns.error}
        retry={campaigns.reload}
      />
      {!campaigns.loading && !campaigns.data?.length && (
        <EmptyState title="Chưa có đợt xét duyệt">
          <p>Hội Sinh viên trường có thể tạo đợt xét tại mục Đợt xét duyệt.</p>
        </EmptyState>
      )}
      {selected && (
        <>
          <ResourceState
            loading={summary.loading}
            error={summary.error}
            retry={summary.reload}
          />
          {summary.data && (
            <>
              <div className="metric-grid">
                {[
                  {
                    label: "Tổng hồ sơ đã nộp",
                    value: summary.data.totalSubmitted,
                    icon: Files,
                    tone: "blue",
                  },
                  {
                    label: "Chờ xét duyệt",
                    value: summary.data.pending,
                    icon: Clock3,
                    tone: "amber",
                  },
                  {
                    label: "Đạt danh hiệu",
                    value: summary.data.approved,
                    icon: CheckCircle2,
                    tone: "green",
                  },
                  {
                    label: "Không đạt",
                    value: summary.data.rejected,
                    icon: XCircle,
                    tone: "red",
                  },
                ].map(({ label, value, icon: Icon, tone }) => (
                  <article className={`metric-card metric-${tone}`} key={label}>
                    <div>
                      <span>{label}</span>
                      <strong>{value.toLocaleString("vi-VN")}</strong>
                      <small>
                        {summary.data!.totalSubmitted
                          ? (
                              (value / summary.data!.totalSubmitted) *
                              100
                            ).toFixed(1)
                          : 0}
                        % tổng hồ sơ
                      </small>
                    </div>
                    <i>
                      <Icon size={22} />
                    </i>
                  </article>
                ))}
              </div>
              <p className="muted">
                Có {summary.data.resubmitRequired} hồ sơ đang chờ sinh viên bổ
                sung minh chứng.
              </p>
            </>
          )}
          {view === "statistics" && summary.data && (
            <section className="panel">
              <div className="section-title">
                <h2>Tiến độ theo khoa</h2>
                <Link className="inline-link" href="/manager/export">
                  Xuất báo cáo <Download size={16} />
                </Link>
              </div>
              <div className="faculty-chart">
                {summary.data.faculties?.map((f) => (
                  <div key={f.name}>
                    <div>
                      <strong>{f.name}</strong>
                      <span>
                        {f.approved}/{f.total} đạt (
                        {f.total ? Math.round((f.approved / f.total) * 100) : 0}
                        %)
                      </span>
                    </div>
                    <div className="progress">
                      <span
                        style={{
                          width: `${f.total ? (f.approved / f.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {view !== "statistics" && (
            <section className="manager-table-card">
              <div className="section-title">
                <div>
                  <h2>
                    {view === "overview"
                      ? "Hồ sơ mới cập nhật"
                      : "Tra cứu hồ sơ"}
                  </h2>
                  <p>
                    Tìm kiếm, lọc và xem chi tiết hồ sơ trong phạm vi phụ trách.
                  </p>
                </div>
                {view === "overview" && (
                  <Link href="/manager/applications" className="inline-link">
                    Tất cả hồ sơ <ArrowRight size={16} />
                  </Link>
                )}
              </div>
              <form className="filter-grid" onSubmit={filter}>
                <label>
                  Tìm kiếm
                  <input
                    name="search"
                    placeholder="MSSV hoặc họ tên"
                    maxLength={100}
                  />
                </label>
                <label>
                  Trạng thái
                  <select name="status">
                    <option value="">Tất cả trạng thái</option>
                    {[
                      "SUBMITTED",
                      "RESUBMITTED",
                      "RESUBMIT_REQUIRED",
                      "APPROVED",
                      "REJECTED",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ngành
                  <select name="majorId">
                    <option value="">Tất cả ngành</option>
                    {visibleFaculties?.flatMap((f) =>
                      f.majors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      )),
                    )}
                  </select>
                </label>
                <label>
                  Lớp
                  <input name="className" placeholder="VD: DCT1241" />
                </label>
                <label>
                  Từ ngày
                  <input type="date" name="from" />
                </label>
                <label>
                  Đến ngày
                  <input type="date" name="to" />
                </label>
                <button className="button button-primary">
                  <Search size={17} />
                  Lọc hồ sơ
                </button>
                <button
                  type="reset"
                  className="button button-outline"
                  onClick={() => {
                    setFilters("");
                    setPage(1);
                  }}
                >
                  Đặt lại
                </button>
              </form>
              <ResourceState
                loading={applications.loading}
                error={applications.error}
                retry={applications.reload}
              />
              {!applications.loading && applications.data && (
                <>
                  <div className="table-scroll">
                    <table className="workspace-table">
                      <thead>
                        <tr>
                          <th>Sinh viên</th>
                          <th>MSSV / Lớp</th>
                          <th>Loại hồ sơ</th>
                          <th>Trạng thái</th>
                          <th>Cập nhật</th>
                          <th>
                            <span className="sr-only">Thao tác</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications.data.items.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <strong>{a.users?.full_name}</strong>
                            </td>
                            <td>
                              {a.users?.mssv}
                              <small>{a.users?.class_name}</small>
                            </td>
                            <td>
                              {a.type === "INDIVIDUAL" ? "Cá nhân" : "Tập thể"}
                            </td>
                            <td>
                              <span className={`status-pill state-${a.status}`}>
                                {statusLabels[a.status]}
                              </span>
                            </td>
                            <td>{dateLabel(a.updated_at)}</td>
                            <td>
                              <Link
                                className="table-link review-link"
                                href={`/manager/applications/${a.id}`}
                              >
                                Xem xét <ArrowRight size={15} />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!applications.data.items.length && (
                    <EmptyState title="Không có hồ sơ phù hợp">
                      <p>Thử thay đổi bộ lọc hoặc chọn đợt xét khác.</p>
                    </EmptyState>
                  )}
                  <div className="pagination">
                    <span>
                      {applications.data.total} hồ sơ - Trang {page}
                    </span>
                    <div>
                      <button
                        className="button button-outline"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Trước
                      </button>
                      <button
                        className="button button-outline"
                        disabled={
                          page * applications.data.pageSize >=
                          applications.data.total
                        }
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </PortalShell>
  );
}
