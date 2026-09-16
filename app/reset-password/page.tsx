import type { Metadata } from "next";
import { ResetPassword } from "@/components/auth/password-recovery";

export const metadata: Metadata = { title: "Đặt lại mật khẩu" };
export default function ResetPasswordPage() {
  return <ResetPassword />;
}
