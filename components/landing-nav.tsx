import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";

export function LandingNav() {
  return (
    <header className="landing-nav">
      <Brand />
      <nav aria-label="Điều hướng chính">
        <Link href="#tieu-chi">Tiêu chí</Link>
        <Link href="#quy-trinh">Quy trình</Link>
        <Link href="#tai-lieu">Tài liệu</Link>
      </nav>
      <div className="nav-actions">
        <Link className="text-button" href="/manager/login">
          Dành cho quản lý
        </Link>
        <Link className="button button-dark" href="/login">
          Đăng nhập <ArrowUpRight size={16} />
        </Link>
      </div>
    </header>
  );
}
