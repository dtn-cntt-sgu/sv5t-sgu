"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ChevronRight,
  History,
  HelpCircle,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  FileText,
  UserRound,
  MessageSquareText,
  Settings,
  Files,
  BarChart3,
  FileSpreadsheet,
  Archive,
  UserCog,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { useResource } from "@/lib/client/use-resource";
import { api } from "@/lib/client/api";
import { roleLabels, type Profile } from "@/lib/domain/models";
export type PortalNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
};
const studentNav = [
  { label: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { label: "Hồ sơ của tôi", href: "/application", icon: FileText },
  {
    label: "Phản hồi xét duyệt",
    href: "/dashboard/feedback",
    icon: MessageSquareText,
  },
  {
    label: "Thông tin và Tài khoản",
    href: "/dashboard/profile",
    icon: UserRound,
  },
];
const managerNav = [
  { label: "Tổng quan", href: "/manager", icon: LayoutDashboard },
  { label: "Danh sách hồ sơ", href: "/manager/applications", icon: Files },
  {
    label: "Thống kê và Lưu trữ",
    href: "/manager/statistics",
    icon: BarChart3,
  },
  { label: "Đợt xét duyệt", href: "/manager/campaigns", icon: Archive },
  {
    label: "Thông tin và Tài khoản",
    href: "/manager/profile",
    icon: UserRound,
  },
];
const adminNav = [
  { label: "Tổng quan", href: "/admin", icon: LayoutDashboard },
  { label: "Quản lý tài khoản", href: "/admin/users", icon: UserCog },
  { label: "Đợt xét duyệt", href: "/admin/campaigns", icon: Archive },
  { label: "Tài liệu công khai", href: "/admin/documents", icon: FileText },
  { label: "Nhật ký hệ thống", href: "/admin/audit", icon: History },
  { label: "Các khoa ngành", href: "/admin/catalog", icon: Files },
  { label: "Cấu hình", href: "/admin/settings", icon: Settings },
  { label: "Bảo mật", href: "/admin/security", icon: ShieldCheck },
];
export function PortalShell({
  portal,
  title,
  subtitle,
  children,
}: {
  portal: "student" | "manager" | "admin";
  title: string;
  subtitle?: string;
  items?: PortalNavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const profile = useResource<Profile>("/users/me");
  const items = (
    portal === "student"
      ? studentNav
      : portal === "manager"
        ? managerNav
        : adminNav
  ).filter(
    (item) =>
      (item.href !== "/manager/campaigns" ||
        profile.data?.role === "SCHOOL_PRESIDENT") &&
      (item.href !== "/manager" || profile.data?.role !== "FACULTY_SECRETARY"),
  );
  async function logout() {
    setSigningOut(true);
    try {
      await api("/auth/logout", { method: "POST" });
      window.location.assign(
        portal === "student" ? "/login" : `/${portal}/login`,
      );
    } catch {
      setError("Chưa thể đăng xuất. Vui lòng thử lại.");
      setSigningOut(false);
    }
  }
  const initials =
    profile.data?.full_name
      .split(" ")
      .slice(-2)
      .map((s) => s[0])
      .join("") ?? "…";
  const roleTheme =
    profile.data?.role === "FACULTY_SECRETARY"
      ? "portal-role-faculty"
      : profile.data?.role === "SCHOOL_PRESIDENT"
        ? "portal-role-president"
        : profile.data?.role === "SUPER_ADMIN"
          ? "portal-role-admin"
          : "";
  return (
    <main className={`portal portal-${portal} ${roleTheme}`}>
      <a href="#portal-content" className="skip-link">
        Đến nội dung chính
      </a>
      <aside className={`portal-sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-menu"
            aria-label="Đóng menu"
            onClick={() => setOpen(false)}
          >
            <X size={22} />
          </button>
        </div>
        <span className="nav-caption">
          {portal === "student"
            ? "GÓC CỦA BẠN"
            : portal === "admin"
              ? "QUẢN LÝ"
              : "KHÔNG GIAN LÀM VIỆC"}
        </span>
        <nav aria-label="Điều hướng tài khoản">
          {items.map(({ label, href, icon: Icon }, index) => {
            const active =
              pathname === href ||
              (href !== "/manager" &&
                href !== "/admin" &&
                href !== "/dashboard" &&
                pathname.startsWith(`${href}/`));
            return (
              <Fragment key={href}>
                {portal === "admin" && index === 4 && (
                  <span className="admin-nav-group">HỆ THỐNG</span>
                )}
                <Link
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={active ? "active" : ""}
                  href={href}
                  key={href}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                  {active && <i />}
                </Link>
              </Fragment>
            );
          })}
        </nav>
        {portal === "student" && (
          <div className="sidebar-inspiration">
            <span>✦</span>
            <strong>Mỗi ngày <br/> một chút tốt hơn.</strong>
            <p>Hành trình của bạn bắt đầu từ những điều nhỏ nhất.</p>
            <Link href="/documents">Khám phá tiêu chí ↗</Link>
          </div>
        )}
        <div className="sidebar-bottom">
          <Link href="/documents">
            <HelpCircle size={18} /> Tài liệu & hướng dẫn
          </Link>
          <button
            className="logout-button"
            disabled={signingOut}
            onClick={logout}
          >
            <LogOut size={18} /> {signingOut ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="menu-backdrop"
          aria-label="Đóng menu"
          onClick={() => setOpen(false)}
        />
      )}
      <section className="portal-main">
        <header className="portal-header">
          <button
            className="mobile-menu"
            aria-label="Mở menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="portal-heading">
            {portal === "admin" ? (
              <nav className="admin-breadcrumb" aria-label="Đường dẫn">
                <Link href="/admin">Quản trị</Link>
                <ChevronRight size={14} />
                <span>{title}</span>
              </nav>
            ) : (
              <p>{subtitle ?? "HỘI SINH VIÊN - TRƯỜNG ĐẠI HỌC SÀI GÒN"}</p>
            )}
            {portal !== "admin" && <h1>{title}</h1>}
          </div>
          <div className="portal-user">
            {portal === "student" && (
              <Link
                className="icon-button"
                href="/dashboard/feedback"
                aria-label="Xem phản hồi xét duyệt"
              >
                <Bell size={19} />
              </Link>
            )}
            <div className="portal-avatar">{initials}</div>
            <span>
              <strong>{profile.data?.full_name ?? "Tài khoản của bạn"}</strong>
              <small>
                {profile.data ? roleLabels[profile.data.role] : "Đang tải…"}
              </small>
            </span>
          </div>
        </header>
        <div id="portal-content" className="portal-content">
          {(error || profile.error) && (
            <p className="form-error" role="alert">
              {error || profile.error}{" "}
              <Link href={portal === "student" ? "/login" : `/${portal}/login`}>
                Đăng nhập lại
              </Link>
            </p>
          )}
          {children}
        </div>
      </section>
    </main>
  );
}
