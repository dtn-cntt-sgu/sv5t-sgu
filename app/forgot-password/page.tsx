import type { Metadata } from "next";
import { ForgotPassword } from "@/components/auth/password-recovery";

export const metadata: Metadata = { title: "Quên mật khẩu" };
export default function ForgotPasswordPage() {
  return <ForgotPassword />;
}
