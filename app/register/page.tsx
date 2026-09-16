import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Đăng ký tài khoản" };
export default function RegisterPage() {
  return <RegisterForm />;
}
