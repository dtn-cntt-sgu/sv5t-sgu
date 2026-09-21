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
      <div className="site-footer-logos" aria-label="Các đơn vị đồng hành">
        {logos.map((logo) => (
          <Image
            key={logo.alt}
            className="site-footer-logo"
            src={logo.src}
            alt={logo.alt}
            width={76}
            height={76}
          />
        ))}
      </div>
      <div className="site-footer-details">
        <p>
          <span>Cơ quan chủ quản:</span>
          Hội sinh viên Trường Đại học Sài Gòn
        </p>
        <p>
          <span>Copyright © 2026 by</span>
          BCH Đoàn-Hội khoa Công nghệ thông tin
        </p>
      </div>
    </footer>
  );
}
