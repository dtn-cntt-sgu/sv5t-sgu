import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Đăng nhập quản trị" };
export default function AdminLoginPage() {
  return <AuthShell portal="admin" />;
}
