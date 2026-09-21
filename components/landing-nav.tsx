import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { Brand } from "@/components/brand";
import styles from "@/app/landing.module.css";

export function LandingNav() {
  return (
    <header className={styles.header}>
      <div className={styles.navInner}>
        <Brand />
        <nav className={styles.desktopNav} aria-label="Điều hướng chính">
          <Link className={styles.activeLink} href="/" aria-current="page">
            Giới thiệu
          </Link>
          <Link href="/documents">Thư viện tài liệu</Link>
        </nav>
        <div className={styles.navActions}>
          <Link className={styles.managerLink} href="/manager/login">
            Dành cho quản lý <ArrowUpRight size={14} />
          </Link>
          <span className={styles.navDivider} />
          <Link className={styles.loginLink} href="/login">
            Đăng nhập
          </Link>
          <Link className={styles.registerLink} href="/register">
            Đăng ký <ArrowUpRight size={16} />
          </Link>
        </div>
        <details className={styles.mobileMenu}>
          <summary aria-label="Mở menu điều hướng">
            <Menu size={22} />
          </summary>
          <nav aria-label="Điều hướng trên điện thoại">
            <Link href="/">Giới thiệu</Link>
            <Link href="/documents">Thư viện tài liệu</Link>
            <Link href="/manager/login">Dành cho quản lý</Link>
            <Link href="/login">Đăng nhập</Link>
            <Link href="/register">Đăng ký tài khoản</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
