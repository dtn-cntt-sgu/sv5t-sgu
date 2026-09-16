"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Circle,
  Sparkles,
  Trophy,
  GraduationCap,
  HeartHandshake,
  Globe2,
  Dumbbell,
  Heart,
} from "lucide-react";
import { PortalShell } from "./portal-shell";
import { useResource } from "@/lib/client/use-resource";
import {
  type Application,
  type Campaign,
  type Profile,
  statusLabels,
  fileLabels,
  dateLabel,
} from "@/lib/domain/models";
import { individualFiles, collectiveFiles } from "@/lib/validation/application";
import { ResourceState, EmptyState } from "./resource-state";
const qualities = [
  { label: "Đạo đức tốt", icon: Heart, color: "coral" },
  { label: "Học tập tốt", icon: GraduationCap, color: "blue" },
  { label: "Thể lực tốt", icon: Dumbbell, color: "lime" },
  { label: "Tình nguyện tốt", icon: HeartHandshake, color: "violet" },
  { label: "Hội nhập tốt", icon: Globe2, color: "amber" },
];
export function StudentDashboard() {
  const profile = useResource<Profile>("/users/me");
  const campaigns = useResource<Campaign | null>("/public/campaigns/active");
  const applications = useResource<Application[]>("/applications");
  const [now] = useState(() => Date.now());
  const campaign = campaigns.data;
  const days = campaign
    ? Math.max(0, Math.ceil((Date.parse(campaign.end_date) - now) / 86400000))
    : null;
  const current =
    applications.data?.filter((a) => a.campaign_id === campaign?.id) ?? [];
  const feedbackCount =
    applications.data?.filter((a) => a.status === "RESUBMIT_REQUIRED").length ??
    0;
  return (
    <PortalShell
      portal="student"
      title={`Xin chào${profile.data ? `, ${profile.data.full_name.split(" ").at(-1)}` : " bạn"}!`}
      subtitle="HÔM NAY LÀ MỘT NGÀY ĐỂ TIẾN XA HƠN ✦"
    >
      <section className="dashboard-hero">
        <div>
          <span className="section-kicker">
            <Sparkles size={15} /> HÀNH TRÌNH SINH VIÊN 5 TỐT
          </span>
          <h2>
            Nỗ lực của bạn,
            <br />
            <em>xứng đáng tỏa sáng.</em>
          </h2>
          <p>
            {campaign
              ? `${campaign.name} đang nhận hồ sơ. Sẵn sàng ghi dấu hành trình của riêng bạn?`
              : "Chuẩn bị minh chứng, khám phá tiêu chí và sẵn sàng cho đợt xét duyệt tiếp theo."}
          </p>
          <Link
            className="button button-light"
            href={campaign ? "/application" : "/documents"}
          >
            {campaign ? "Đến hồ sơ của tôi" : "Khám phá tiêu chí"}{" "}
            <ArrowRight size={18} />
          </Link>
        </div>
        <div className="student-hero-art" aria-hidden="true">
          <span className="art-spark one">✦</span>
          <span className="art-spark two">✧</span>
          <div className="hero-ticket">
            <span>THE NEXT CHAPTER</span>
            <Trophy size={64} strokeWidth={1.4} />
            <strong>5 TỐT</strong>
            <small>BE YOUR BEST SELF</small>
          </div>
          <div className="hero-sticker">You got this! ↗</div>
        </div>
      </section>
      <div className="student-strip">
        {qualities.map(({ label, icon: Icon, color }, i) => (
          <Link href="/documents" className={`quality-${color}`} key={label}>
            <span>
              <Icon size={20} />
            </span>
            <div>
              <small>0{i + 1}</small>
              <strong>{label}</strong>
            </div>
          </Link>
        ))}
      </div>
      {feedbackCount > 0 && (
        <Link href="/dashboard/feedback" className="feedback-banner">
          <span>✉</span>
          <div>
            <strong>Bạn có {feedbackCount} hồ sơ cần bổ sung</strong>
            <p>Xem phản hồi từ Liên chi Hội để hoàn thiện đúng minh chứng.</p>
          </div>
          <ArrowRight />
        </Link>
      )}
      <ResourceState
        loading={applications.loading || campaigns.loading}
        error={applications.error || campaigns.error}
        retry={() => {
          void applications.reload();
          void campaigns.reload();
        }}
      />
      {!applications.loading && !applications.error && (
        <div className="dashboard-grid">
          <section className="panel">
            <div className="section-title">
              <div>
                <span className="section-kicker">TỪNG BƯỚC TIẾN GẦN</span>
                <h2>Hồ sơ của bạn</h2>
              </div>
              <Link className="inline-link" href="/application">
                Xem tất cả <ArrowRight size={16} />
              </Link>
            </div>
            {current.length ? (
              current.map((a) => (
                <ApplicationSummary key={a.id} application={a} />
              ))
            ) : (
              <EmptyState title="Hành trình mới đang chờ bạn">
                <p>
                  {campaign
                    ? "Tạo hồ sơ đầu tiên để bắt đầu ghi nhận những nỗ lực của mình."
                    : "Chưa có đợt đang nhận hồ sơ. Bạn vẫn có thể xem hồ sơ cũ và chuẩn bị tài liệu."}
                </p>
                <Link className="button button-primary" href="/application">
                  {campaign ? "Tạo hồ sơ" : "Xem hồ sơ của tôi"}{" "}
                  <ArrowRight size={16} />
                </Link>
              </EmptyState>
            )}
          </section>
          <aside className="panel">
            <div className="section-title">
              <h2>Mốc thời gian</h2>
              <CalendarClock size={21} />
            </div>
            {campaign ? (
              <>
                <div className="deadline-card">
                  <small>THỜI GIAN NHẬN HỒ SƠ CÒN</small>
                  <strong>
                    {days}
                    <span> ngày</span>
                  </strong>
                  <p>Đến {dateLabel(campaign.end_date)}</p>
                </div>
                <div className="timeline">
                  <div className="complete">
                    <i>
                      <Check size={13} />
                    </i>
                    <span>
                      <strong>Mở đăng ký</strong>
                      <small>{dateLabel(campaign.start_date)}</small>
                    </span>
                  </div>
                  <div className="current">
                    <i />
                    <span>
                      <strong>Nhận hồ sơ</strong>
                      <small>{campaign.academic_year}</small>
                    </span>
                  </div>
                  <div>
                    <i />
                    <span>
                      <strong>Đóng đăng ký</strong>
                      <small>{dateLabel(campaign.end_date)}</small>
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState title="Chưa có lịch nhận hồ sơ">
                <p>Lịch sẽ hiển thị khi Hội Sinh viên mở đợt xét duyệt.</p>
              </EmptyState>
            )}
          </aside>
          <section className="tips-card">
            <div className="tips-icon">
              <Trophy size={25} />
            </div>
            <div>
              <span>MỘT CHÚT CHUẨN BỊ, THÊM NHIỀU TỰ TIN</span>
              <h3>Minh chứng rõ nét. Thành tích rõ ràng.</h3>
              <Link href="/documents">
                Tải biểu mẫu và đọc hướng dẫn <ArrowRight size={16} />
              </Link>
            </div>
          </section>
          <section className="panel tiny-note">
            <Sparkles />
            <h3>Không cần hoàn hảo ngay từ đầu.</h3>
            <p>
              Hồ sơ nháp giúp bạn chuẩn bị từng file, rồi kiểm tra trước khi
              chính thức gửi đi.
            </p>
          </section>
        </div>
      )}
    </PortalShell>
  );
}
function ApplicationSummary({ application: a }: { application: Application }) {
  const required = a.type === "INDIVIDUAL" ? individualFiles : collectiveFiles;
  return (
    <article className="application-summary">
      <div className="section-title">
        <h3>{a.type === "INDIVIDUAL" ? "Hồ sơ cá nhân" : "Hồ sơ tập thể"}</h3>
        <span className={`status-pill state-${a.status}`}>
          {statusLabels[a.status]}
        </span>
      </div>
      <div className="completion">
        <div>
          <span>Minh chứng đã tải</span>
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
      <div className="file-mini-list">
        {required.map((type) => {
          const file = a.application_files.find((f) => f.file_type === type);
          return (
            <span key={type}>
              <i className={file ? "done" : ""}>
                {file ? <Check size={13} /> : <Circle size={13} />}
              </i>
              {fileLabels[type]}
              <small>{file ? "Đã tải" : "Chưa có"}</small>
            </span>
          );
        })}
      </div>
      <Link className="inline-link" href={`/application?id=${a.id}`}>
        Xem chi tiết <ArrowRight size={16} />
      </Link>
    </article>
  );
}
