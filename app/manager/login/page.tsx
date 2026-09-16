import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Đăng nhập quản lý" };
export default function ManagerLoginPage() {
  return <AuthShell portal="manager" />;
}
