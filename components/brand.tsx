import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Trang chủ Sinh viên 5 Tốt">
      <span className="brand-mark" aria-hidden="true">
        <span>5</span>
        <i>★</i>
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>Sinh viên 5 Tốt</strong>
          <small>Trường Đại học Sài Gòn</small>
        </span>
      )}
    </Link>
  );
}
