"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Archive, Download, ShieldCheck } from "lucide-react";
import { PortalShell } from "./portal-shell";
import { ResourceState } from "./resource-state";
import { useResource } from "@/lib/client/use-resource";
import { mutation } from "@/lib/client/api";
import { type Campaign, type Profile, dateLabel } from "@/lib/domain/models";
type Job = {
  id: string;
  status: string;
  record_count: number;
  created_at: string;
  error_message: string | null;
  cleanup_status: string;
};
export function ExportWorkspace() {
  const campaigns = useResource<Campaign[]>("/campaigns");
  const profile = useResource<Profile>("/users/me");
  const [campaignId, setCampaignId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [challenge, setChallenge] = useState("");
  const privileged = profile.data?.role === "SCHOOL_PRESIDENT";
  const selected = campaignId || campaigns.data?.[0]?.id;
  const campaign = campaigns.data?.find((c) => c.id === selected);
  const jobs = useResource<Job[]>(
    privileged && selected ? `/export/jobs?campaignId=${selected}` : null,
  );
  const reload = jobs.reload;
  useEffect(() => {
    const timer = setInterval(() => void reload(), 15000);
    return () => clearInterval(timer);
  }, [reload]);
  async function create() {
    setPending(true);
    setError("");
    try {
      await mutation("/export/jobs", { campaignId: selected });
      await jobs.reload();
      setMessage("Đã đưa vào hàng đợi xuất. Trạng thái sẽ tự cập nhật.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xuất.");
    } finally {
      setPending(false);
    }
  }
  async function requestOtp() {
    setPending(true);
    setError("");
    try {
      const result = await mutation<{ challengeId: string; message: string }>(
        "/security/request",
        { purpose: "PURGE_CAMPAIGN", campaignId: selected },
      );
      setChallenge(result.challengeId);
      setMessage(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể gửi mã.");
    } finally {
      setPending(false);
    }
  }
  async function purge(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError("");
    try {
      await mutation("/security/confirm", {
        challengeId: challenge,
        code: f.get("code"),
      });
      setMessage(
        "Đã lưu số liệu và xóa hồ sơ trong CSDL. Hệ thống đang dọn minh chứng; bản xuất vẫn được giữ lại.",
      );
      setChallenge("");
      await jobs.reload();
      await campaigns.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu trữ.");
    } finally {
      setPending(false);
    }
  }
  return (
    <PortalShell portal="manager" title="Xuất báo cáo & lưu trữ">
      <div className="workspace-toolbar">
        <p>
          Báo cáo đúng phạm vi khoa hoặc toàn trường theo tài khoản của bạn.
        </p>
        <select
          aria-label="Chọn đợt xét"
          value={selected ?? ""}
          onChange={(e) => {
            setCampaignId(e.target.value);
            setChallenge("");
          }}
        >
          <option value="" disabled>
            Chọn đợt xét
          </option>
          {campaigns.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <ResourceState {...campaigns} retry={campaigns.reload} />
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
      {selected && (
        <div className="admin-two-columns">
          <section className="panel">
            <div className="export-section-heading">
              <Download size={28} />
              <h2>Danh sách hồ sơ Excel</h2>
              <a
                className="button button-primary export-heading-action"
                href={`/api/v1/export/excel?campaignId=${selected}`}
              >
                <Download size={17} />
                Tải Excel
              </a>
            </div>
            <p>
              Tải danh sách sinh viên, thông tin liên hệ và trạng thái xét
              duyệt. Bản Excel này không bao gồm file minh chứng.
            </p>
            {privileged && (
              <>
                <hr />
                <div className="export-section-heading">
                  <Archive size={28} />
                  <h2>Lưu trữ toàn bộ đợt xét</h2>
                </div>
                <p>
                  Bản ZIP gồm Excel, toàn bộ minh chứng và dữ liệu hồ sơ. Đợt
                  phải đóng và hết hạn; hồ sơ sẽ được khóa để bảo đảm bản xuất
                  nhất quán.
                </p>
                <button
                  className="button button-outline"
                  disabled={
                    pending ||
                    campaign?.is_active ||
                    campaign?.is_archived ||
                    jobs.data?.some((j) => j.status === "PROCESSING")
                  }
                  onClick={create}
                >
                  Tạo bản xuất file đầy đủ
                </button>
                <ResourceState error={jobs.error} retry={jobs.reload} />
                {jobs.data?.map((j) => (
                  <article className="campaign-row" key={j.id}>
                    <div>
                      <h3>
                        {j.status === "READY"
                          ? "File zip chứa toàn bộ dữ liệu đã sẵn sàng"
                          : j.status === "FAILED"
                            ? "Xuất thất bại"
                            : "Đang chờ / xử lý"}
                      </h3>
                      <p>
                        {dateLabel(j.created_at)} · {j.record_count} hồ sơ
                      </p>
                      {j.error_message && (
                        <p className="form-error">{j.error_message}</p>
                      )}
                      {j.cleanup_status !== "NONE" && (
                        <p>
                          Dọn minh chứng:{" "}
                          {j.cleanup_status === "DONE"
                            ? "Hoàn tất"
                            : j.cleanup_status === "FAILED"
                              ? "Đang chờ thử lại"
                              : "Đang xử lý"}
                        </p>
                      )}
                    </div>
                    {j.status === "READY" && (
                      <a
                        className="button button-outline"
                        href={`/api/v1/export/jobs/${j.id}/download`}
                      >
                        Tải ZIP
                      </a>
                    )}
                  </article>
                ))}
              </>
            )}
          </section>
          {privileged && (
            <section className="panel">
              <ShieldCheck size={28} />
              <h2>Hoàn tất & giải phóng dung lượng</h2>
              <p>
                Tải và kiểm tra bản ZIP trước khi xóa. Thống kê theo khoa và bản
                lưu trữ vẫn được giữ; hồ sơ đang xét và minh chứng gốc sẽ bị
                xóa.
              </p>
              <div className="danger-zone">
                <p>Thao tác này không thể hoàn tác từ giao diện.</p>
                {!challenge ? (
                  <button
                    className="button button-outline"
                    disabled={
                      pending ||
                      campaign?.is_archived ||
                      !jobs.data?.some((j) => j.status === "READY")
                    }
                    onClick={requestOtp}
                  >
                    Gửi mã xác thực tới email HSV
                  </button>
                ) : (
                  <form className="workspace-form" onSubmit={purge}>
                    <label>
                      Mã xác thực email
                      <input
                        name="code"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        required
                        maxLength={6}
                        autoComplete="one-time-code"
                      />
                    </label>
                    <label className="checkbox">
                      <input type="checkbox" required />
                      Tôi đã tải, kiểm tra bản lưu trữ và xác nhận xóa hồ sơ của
                      đợt {campaign?.name}.
                    </label>
                    <button className="button button-danger" disabled={pending}>
                      Xác nhận xóa dữ liệu đợt này
                    </button>
                  </form>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </PortalShell>
  );
}
export function AdminSecurity() {
  const [challenge, setChallenge] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function request() {
    setPending(true);
    setError("");
    try {
      const result = await mutation<{ challengeId: string; message: string }>(
        "/security/request",
        { purpose: "CHANGE_ADMIN_PASSWORD" },
      );
      setChallenge(result.challengeId);
      setMessage(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể gửi mã.");
    } finally {
      setPending(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) {
      setError("Mật khẩu nhập lại chưa khớp.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await mutation("/security/confirm", {
        challengeId: challenge,
        code: f.get("code"),
        password: f.get("password"),
      });
      setMessage("Đã đổi mật khẩu quản trị.");
      setChallenge("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đổi mật khẩu.");
    } finally {
      setPending(false);
    }
  }
  return (
    <PortalShell portal="admin" title="Bảo mật tài khoản quản trị">
      <section className="panel workspace-form" style={{ maxWidth: 620 }}>
        <ShieldCheck size={32} />
        <h2>Đổi mật khẩu bằng mã email</h2>
        <p>
          Mã xác thực được gửi tới email khôi phục chính thức của Đoàn khoa
          CNTT.
        </p>
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
        {!challenge ? (
          <button
            className="button button-primary"
            disabled={pending}
            onClick={request}
          >
            Gửi mã xác thực
          </button>
        ) : (
          <form className="workspace-form" onSubmit={save}>
            <label>
              Mã xác thực
              <input
                name="code"
                pattern="[0-9]{6}"
                inputMode="numeric"
                maxLength={6}
                required
              />
            </label>
            <label>
              Mật khẩu mới
              <input
                name="password"
                type="password"
                minLength={14}
                maxLength={72}
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              Nhập lại mật khẩu
              <input
                name="confirm"
                type="password"
                minLength={14}
                maxLength={72}
                required
                autoComplete="new-password"
              />
            </label>
            <button className="button button-primary" disabled={pending}>
              Lưu mật khẩu mới
            </button>
          </form>
        )}
      </section>
    </PortalShell>
  );
}
