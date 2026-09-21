import Link from "next/link";
import Image from "next/image";
import logo from "@/assets/logo/LOGO_SV5T.png";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Trang chủ Sinh viên 5 Tốt">
      <Image
        className="brand-logo"
        src={logo}
        alt="Logo Hội Sinh viên Việt Nam"
        width={42}
        height={42}
        priority
      />
      {!compact && (
        <span className="brand-copy">
          <strong>Sinh viên 5 Tốt</strong>
          <small>Trường Đại học Sài Gòn</small>
        </span>
      )}
    </Link>
  );
}
