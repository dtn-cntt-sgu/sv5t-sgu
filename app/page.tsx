import Link from "next/link";
import { CampaignAnnouncement } from "@/components/campaign-announcement";
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronRight,
  FileCheck2,
  GraduationCap,
  HeartHandshake,
  Medal,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { LandingNav } from "@/components/landing-nav";
import { TiltCard } from "@/components/tilt-card";

const qualities = [
  { label: "Đạo đức tốt", icon: HeartHandshake, color: "coral" },
  { label: "Học tập tốt", icon: GraduationCap, color: "blue" },
  { label: "Thể lực tốt", icon: Sparkles, color: "lime" },
  { label: "Tình nguyện tốt", icon: UsersRound, color: "violet" },
  { label: "Hội nhập tốt", icon: BookOpenCheck, color: "amber" },
];

export default function HomePage() {
  return (
    <main className="landing-page">
      <LandingNav />

      <section className="hero">
        <div className="hero-orb hero-orb-one" />
        <div className="hero-orb hero-orb-two" />
        <div className="hero-copy">
          <CampaignAnnouncement />
          <h1>
            Mỗi nỗ lực
            <br />
            đều <em>xứng đáng</em>
            <br />
            được ghi nhận.
          </h1>
          <p>
            Đăng ký, hoàn thiện minh chứng và theo dõi hành trình chinh phục
            danh hiệu Sinh viên 5 Tốt — tất cả tại một nơi.
          </p>
          <div className="hero-actions">
            <Link
              className="button button-primary button-large"
              href="/register"
            >
              Bắt đầu đăng ký <ArrowRight size={18} />
            </Link>
            <Link className="button button-ghost button-large" href="#tieu-chi">
              Khám phá tiêu chí
            </Link>
          </div>
          <div className="hero-trust">
            <span>
              <ShieldCheck size={17} /> Dữ liệu được bảo vệ
            </span>
            <span>
              <FileCheck2 size={17} /> Theo dõi minh bạch
            </span>
          </div>
        </div>

        <div className="hero-stage" aria-label="Minh họa hồ sơ Sinh viên 5 Tốt">
          <div className="stage-grid" />
          <TiltCard className="award-card">
            <div className="award-card-top">
              <span className="mini-brand">SGU</span>
              <span className="verified-pill">
                <Check size={12} /> Sẵn sàng tỏa sáng
              </span>
            </div>
            <div className="medal-wrap">
              <div className="medal-ring">
                <Medal size={58} strokeWidth={1.4} />
              </div>
              <span className="medal-star">★</span>
            </div>
            <small>Hành trình của bạn</small>
            <h2>Sinh viên 5 Tốt</h2>
            <div className="award-person">
              <div className="avatar-placeholder">✦</div>
              <div>
                <strong>Phiên bản tốt hơn của bạn</strong>
                <span>Bắt đầu từ hôm nay</span>
              </div>
            </div>
            <div className="award-progress">
              <span />
            </div>
            <div className="award-status">
              <span>Năm tiêu chí</span>
              <strong>Một hành trình</strong>
            </div>
          </TiltCard>
          <div className="floating-note note-deadline">
            <span className="note-icon">
              <CalendarDays size={18} />
            </span>
            <div>
              <CampaignAnnouncement deadline />
            </div>
          </div>
          <div className="floating-note note-approved">
            <span className="note-icon success">
              <Award size={18} />
            </span>
            <div>
              <small>Từng nỗ lực nhỏ</small>
              <strong>Tạo nên dấu ấn lớn</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="quality-section" id="tieu-chi">
        <div className="section-heading">
          <div>
            <span className="section-kicker">
              Năm tiêu chí · Một hành trình
            </span>
            <h2>Phiên bản tốt hơn của chính bạn</h2>
          </div>
          <p>
            Mỗi tiêu chí là một dấu mốc giúp sinh viên phát triển toàn diện,
            vững vàng và sẵn sàng đóng góp.
          </p>
        </div>
        <div className="quality-grid">
          {qualities.map(({ label, icon: Icon, color }, index) => (
            <article className={`quality-card quality-${color}`} key={label}>
              <span className="quality-number">0{index + 1}</span>
              <span className="quality-icon">
                <Icon size={25} />
              </span>
              <h3>{label}</h3>
              <p>Xem điều kiện và các loại minh chứng được công nhận.</p>
              <Link href="#tai-lieu" aria-label={`Xem ${label}`}>
                <ChevronRight size={18} />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="process-section" id="quy-trinh">
        <div className="process-copy">
          <span className="section-kicker">Đơn giản và minh bạch</span>
          <h2>
            Hồ sơ của bạn,
            <br />
            luôn trong tầm mắt.
          </h2>
          <p>
            Mọi phản hồi đều gắn trực tiếp với từng minh chứng. Bạn biết chính
            xác cần làm gì và khi nào.
          </p>
          <Link className="inline-link" href="/register">
            Tạo tài khoản ngay <ArrowRight size={17} />
          </Link>
        </div>
        <ol className="process-list">
          <li>
            <span>01</span>
            <div>
              <strong>Tạo hồ sơ</strong>
              <p>Chọn hồ sơ cá nhân hoặc tập thể cho đợt đang mở.</p>
            </div>
            <Check size={17} />
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Tải minh chứng</strong>
              <p>Tải lên đúng mẫu, xem tiến trình và xác nhận trước khi nộp.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Theo dõi xét duyệt</strong>
              <p>Nhận phản hồi chi tiết và chỉ nộp lại file được yêu cầu.</p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <strong>Nhận kết quả</strong>
              <p>Kết quả rõ ràng, lịch sử xử lý được lưu lại minh bạch.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="document-strip" id="tai-lieu">
        <div>
          <span className="section-kicker">Chuẩn bị hồ sơ</span>
          <h2>Mẫu biểu và hướng dẫn</h2>
        </div>
        <p>
          Tải đúng biểu mẫu mới nhất trước khi kê khai để hạn chế yêu cầu nộp
          lại.
        </p>
        <Link className="button button-dark" href="/documents">
          Xem thư viện tài liệu <ArrowRight size={16} />
        </Link>
      </section>

      <footer className="landing-footer">
        <span>© 2026 Hội Sinh viên Trường Đại học Sài Gòn</span>
        <div>
          <Link href="/manager/login">Cổng quản lý</Link>
          <Link href="/admin/login">Quản trị hệ thống</Link>
        </div>
      </footer>
    </main>
  );
}
