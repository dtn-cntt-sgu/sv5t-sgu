import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Đăng nhập sinh viên" };
export default function LoginPage() {
  return <AuthShell portal="student" />;
}
