"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, MessageSquareText, Save, ShieldCheck } from "lucide-react";
import { PortalShell } from "./portal-shell";
import { ResourceState, EmptyState } from "./resource-state";
import { useResource } from "@/lib/client/use-resource";
import { mutation } from "@/lib/client/api";
import {
  type Profile,
  type Application,
  dateLabel,
  fileLabels,
  statusLabels,
} from "@/lib/domain/models";
export function FeedbackPage() {
  const resource = useResource<Application[]>("/applications");
  const entries =
    resource.data
      ?.flatMap((a) =>
        a.application_files.flatMap((f) =>
          (f.file_review_logs ?? []).map((log) => ({
            ...log,
            file: f,
            application: a,
          })),
        ),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at)) ?? [];
  return (
    <PortalShell
      portal="student"
      title="Phản hồi xét duyệt"
      subtitle="LẮNG NGHE GÓP Ý · HOÀN THIỆN HỒ SƠ"
    >
      <ResourceState {...resource} retry={resource.reload} />
      {!resource.loading && !resource.error && (
        <section className="panel">
          <div className="section-title">
            <h2>Lịch sử phản hồi</h2>
            <MessageSquareText />
          </div>
          {!entries.length ? (
            <EmptyState title="Chưa có phản hồi mới">
              <p>
                Phản hồi từ Liên chi Hội sẽ được hiển thị theo từng minh chứng
                tại đây.
              </p>
            </EmptyState>
          ) : (
            <div className="feedback-list">
              {entries.map((entry) => (
                <article key={entry.id}>
                  <span className={`feedback-marker ${entry.action}`}>
                    <MessageSquareText size={20} />
                  </span>
                  <div>
                    <small>
                      {dateLabel(entry.created_at)} ·{" "}
                      {entry.reviewer_snapshot.full_name ?? "Liên chi Hội"}
                    </small>
                    <h3>{fileLabels[entry.file.file_type]}</h3>
                    <span
                      className={`status-pill state-${entry.action === "ACCEPT" ? "ACCEPTED" : entry.action === "REJECT" ? "REJECTED" : "RESUBMIT_REQUIRED"}`}
                    >
                      {entry.action === "ACCEPT"
                        ? "Đã chấp nhận"
                        : entry.action === "REJECT"
                          ? "Từ chối minh chứng"
                          : "Yêu cầu nộp lại"}
                    </span>
                    <p>{entry.note || "Minh chứng đã được chấp nhận."}</p>
                    <Link
                      className="inline-link"
                      href={`/application?id=${entry.application.id}`}
                    >
                      Xem hồ sơ · {statusLabels[entry.application.status]}{" "}
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </PortalShell>
  );
}
export function ProfilePage({
  portal = "student",
}: {
  portal?: "student" | "manager" | "admin";
}) {
  const resource = useResource<Profile>("/users/me");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await mutation(
        "/users/me",
        { full_name: form.get("full_name"), phone: form.get("phone") },
        "PUT",
      );
      await resource.reload();
      setMessage("Thông tin đã được cập nhật.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu.");
    } finally {
      setPending(false);
    }
  }
  return (
    <PortalShell portal={portal} title="Thông tin cá nhân">
      <ResourceState {...resource} retry={resource.reload} />
      {resource.data && (
        <div className="profile-layout">
          <section className="profile-card">
            <div className="profile-avatar">
              {resource.data.full_name
                .split(" ")
                .slice(-2)
                .map((v) => v[0])
                .join("")}
            </div>
            <h2>{resource.data.full_name}</h2>
            <p>{resource.data.mssv ?? "Tài khoản quản lý"}</p>
            <span className="status-pill state-ACCEPTED">
              Tài khoản đang hoạt động
            </span>
            <dl>
              <dt>Khoa</dt>
              <dd>{resource.data.faculties?.name ?? "Toàn trường"}</dd>
              <dt>Ngành</dt>
              <dd>{resource.data.majors?.name ?? "—"}</dd>
              <dt>Lớp</dt>
              <dd>{resource.data.class_name ?? "—"}</dd>
            </dl>
          </section>
          <form className="panel workspace-form" onSubmit={save}>
            <span className="section-kicker">THÔNG TIN LIÊN HỆ</span>
            <h2>Luôn giữ kết nối</h2>
            <p>
              Cập nhật họ tên và số điện thoại để cán bộ khoa liên hệ khi cần.
            </p>
            <label>
              Họ và tên
              <input
                name="full_name"
                defaultValue={resource.data.full_name}
                minLength={2}
                maxLength={100}
                required
              />
            </label>
            <label>
              Số điện thoại
              <input
                name="phone"
                defaultValue={resource.data.phone ?? ""}
                type="tel"
                pattern="\+?[0-9]{9,15}"
                required
              />
            </label>
            <label>
              Email
              <input value={resource.data.email} disabled readOnly />
            </label>
            <p className="muted">
              Để điều chỉnh MSSV, khoa, ngành hoặc lớp, vui lòng liên hệ quản
              trị viên.
            </p>
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
              {pending ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </form>
        </div>
      )}
    </PortalShell>
  );
}
export function SettingsPage({
  portal = "student",
}: {
  portal?: "student" | "manager" | "admin";
}) {
  return (
    <PortalShell portal={portal} title="Cài đặt tài khoản">
      <section className="panel settings-panel">
        <ShieldCheck size={36} />
        <span className="section-kicker">BẢO VỆ TÀI KHOẢN</span>
        <h2>Mật khẩu & quyền truy cập</h2>
        <p>
          Yêu cầu liên kết qua email đã đăng ký để đặt lại mật khẩu của bạn.
        </p>
        <Link href="/forgot-password" className="button button-primary">
          Đổi mật khẩu qua email <ArrowRight size={17} />
        </Link>
        <Link
          className="inline-link"
          href={
            portal === "student" ? "/dashboard/profile" : "/manager/profile"
          }
        >
          Cập nhật thông tin cá nhân
        </Link>
      </section>
    </PortalShell>
  );
}
