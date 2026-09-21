import Link from "next/link";
import {
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  FileText,
  LockKeyhole,
} from "lucide-react";
import { CampaignAnnouncement } from "@/components/campaign-announcement";
import { LandingNav } from "@/components/landing-nav";
import styles from "./landing.module.css";

const documentUrl = "/api/v1/documents/criteria/download";

export default function HomePage() {
  return (
    <div className={styles.page}>
      <LandingNav />
      <main className={styles.hero} id="gioi-thieu">
        <section className={styles.copy} aria-labelledby="guest-title">
          {/* show current campaign */}
          {/* <CampaignAnnouncement /> */}
          <h1 id="guest-title">
            Mỗi nỗ lực đều
            <br />
            <span>xứng đáng</span>
            <br />
            được ghi nhận.
          </h1>
          <div className={styles.description}>
            <p className={styles.introduction}>
              🥇 <strong>Sinh viên 5 Tốt</strong> là một danh hiệu cao quý, là
              sự bảo chứng uy tín nhất cho quá trình phấn đấu và hoàn thiện bản
              thân của sinh viên. Đây là mục tiêu mà mỗi sinh viên luôn hướng
              tới để khẳng định giá trị và tài năng của mình.
            </p>
            <ol>
              <li>
                <strong> Đạo đức tốt</strong> - Nền tảng nhân cách,{" "}
              </li>
              <li>
                <strong> Học tập tốt</strong> - Chìa khóa tri thức,{" "}
              </li>
              <li>
                <strong> Thể lực tốt</strong> - Sức mạnh bền bỉ,{" "}
              </li>
              <li>
                <strong> Tình nguyện tốt</strong> - Trách nhiệm cộng đồng,
              </li>
              <li>
                <strong> Hội nhập tốt</strong> - Bản lĩnh vươn xa.{" "}
              </li>
            </ol>
          </div>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/register">
              Bắt đầu đăng ký <ArrowRight size={18} />
            </Link>
            <a className={styles.secondaryButton} href="#tai-lieu">
              Tìm hiểu tiêu chuẩn <ArrowRight size={17} />
            </a>
          </div>
          <ul className={styles.benefits}>
            <li>
              <Check size={16} /> Đăng ký trực tuyến
            </li>
            <li>
              <Check size={16} /> Theo dõi minh bạch
            </li>
            <li>
              <Check size={16} /> Bảo mật thông tin
            </li>
          </ul>
          <div className={styles.organization}>
            <span className={styles.organizationLine} />
            <p>
              Đồng hành cùng sinh viên
              <br />
              <strong>Hội Sinh viên Trường Đại học Sài Gòn</strong>
            </p>
          </div>
        </section>

        <section
          className={styles.documentSection}
          id="tai-lieu"
          aria-labelledby="document-title"
        >
          <div className={styles.window}>
            <div className={styles.windowBar}>
              <div className={styles.trafficLights} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <span className={styles.windowCaption}>
                <LockKeyhole size={12} /> Tài liệu Sinh viên 5 Tốt
              </span>
              <a
                href={`${documentUrl}?view=inline`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Mở tài liệu trong tab mới"
                title="Mở trong tab mới"
              >
                <ExternalLink size={15} />
              </a>
            </div>
            <div className={styles.documentHeader}>
              <span className={styles.fileIcon}>
                <FileText size={22} />
              </span>
              <div>
                <span className={styles.documentLabel}>TÀI LIỆU HƯỚNG DẪN</span>
                <h2 id="document-title">
                  Bộ tiêu chuẩn &amp; hướng dẫn danh hiệu SV5T cấp Thành phố
                </h2>
              </div>
              <a
                className={styles.downloadButton}
                href={documentUrl}
                aria-label="Tải bộ tiêu chuẩn PDF"
                title="Tải PDF"
              >
                <Download size={18} />
              </a>
            </div>
            <object
              className={styles.pdf}
              data={`${documentUrl}?view=inline#toolbar=0&navpanes=0&view=FitH`}
              type="application/pdf"
              aria-label="Nội dung bộ tiêu chuẩn và hướng dẫn danh hiệu Sinh viên 5 Tốt cấp Thành phố"
            >
              <div className={styles.pdfFallback}>
                <FileText size={36} />
                <p>
                  Bộ tiêu chuẩn &amp; hướng dẫn danh hiệu SV5T cấp Thành phố
                </p>
                <a
                  className={styles.primaryButton}
                  href={`${documentUrl}?view=inline`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mở tài liệu PDF <ExternalLink size={16} />
                </a>
                <p>Bạn cũng có thể tải tài liệu để đọc trên thiết bị.</p>
              </div>
            </object>
            <div className={styles.documentFooter}>
              <span>
                <FileText size={13} /> Định dạng PDF
              </span>
              <a
                href={`${documentUrl}?view=inline`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở toàn màn hình <ExternalLink size={13} />
              </a>
            </div>
          </div>
          <p className={styles.documentNote}>
            Đọc kỹ tiêu chuẩn và hướng dẫn trước khi chuẩn bị hồ sơ của bạn.
          </p>
        </section>
      </main>
    </div>
  );
}
