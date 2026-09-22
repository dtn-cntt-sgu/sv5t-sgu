import Image from "next/image";
import logoDoan from "@/assets/logo/LOGO_ĐOÀN.png";
import logoSgu from "@/assets/logo/LOGO_DHSG.png";
import logoFit from "@/assets/logo/LOGO_FIT.png";
import logoHsv from "@/assets/logo/LOGO_HSV.png";

const logos = [
  { src: logoDoan, alt: "Logo Đoàn" },
  { src: logoSgu, alt: "Logo Trường Đại học Sài Gòn" },
  { src: logoHsv, alt: "Logo Hội Sinh viên" },
  { src: logoFit, alt: "Logo Khoa Công nghệ Thông tin" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <div className="site-footer-logos" aria-label="Các đơn vị đồng hành">
          {logos.map((logo) => (
            <Image
              key={logo.alt}
              className="site-footer-logo"
              src={logo.src}
              alt={logo.alt}
              width={58}
              height={58}
            />
          ))}
        </div>
        <strong>Sinh viên 5 Tốt</strong>
        <span>Cổng thông tin xét duyệt danh hiệu</span>
      </div>
      <div className="site-footer-authority">
        <span>Cơ quan chủ quản</span>
        <strong>Hội Sinh viên Trường Đại học Sài Gòn</strong>
        <a href="mailto:hoisinhvien@sgu.edu.vn">Email: hoisinhvien@sgu.edu.vn</a>
      </div>
      <div className="site-footer-copyright">
        <span>Copyright © 2026 by</span>
        <strong>BCH Đoàn - Hội Khoa Công nghệ thông tin</strong>
      </div>
    </footer>
  );
}
