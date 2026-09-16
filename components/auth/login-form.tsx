"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";

type Portal = "student" | "manager" | "admin";

const copy = {
  student: {
    title: "Chào mừng trở lại",
    description: "Tiếp tục hành trình Sinh viên 5 Tốt của bạn.",
    identifier: "MSSV hoặc email",
  },
  manager: {
    title: "Cổng xét duyệt",
    description: "Dành cho Liên chi Hội trưởng và Hội Sinh viên trường.",
    identifier: "Email quản lý",
  },
  admin: {
    title: "Quản trị hệ thống",
    description: "Khu vực bảo mật dành cho quản trị viên.",
    identifier: "Email quản trị",
  },
};

export function LoginForm({ portal }: { portal: Portal }) {
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: data.get("identifier"),
          password: data.get("password"),
          portal,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "Không thể đăng nhập.");
      window.location.assign(result.data.redirectTo);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể đăng nhập.",
      );
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-heading">
        <span className={`portal-badge portal-${portal}`}>
          {portal === "student"
            ? "Sinh viên"
            : portal === "manager"
              ? "Quản lý"
              : "Admin"}
        </span>
        <h1>{copy[portal].title}</h1>
        <p>{copy[portal].description}</p>
      </div>
      <label>
        <span>{copy[portal].identifier}</span>
        <div className="input-wrap">
          <Mail size={18} />
          <input
            name="identifier"
            autoComplete="username"
            required
            placeholder={
              portal === "student"
                ? "3124… hoặc ten@sgu.edu.vn"
                : "ten@sgu.edu.vn"
            }
          />
        </div>
      </label>
      <label>
        <span>Mật khẩu</span>
        <div className="input-wrap">
          <LockKeyhole size={18} />
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="Nhập mật khẩu"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label="Hiện hoặc ẩn mật khẩu"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      <div className="form-row">
        <span>Đăng nhập bằng tài khoản của bạn</span>
        <Link href="/forgot-password">Quên mật khẩu?</Link>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary button-full" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="spin" size={18} /> Đang xác thực
          </>
        ) : (
          <>
            Đăng nhập <ArrowRight size={18} />
          </>
        )}
      </button>
      {portal === "student" && (
        <p className="auth-switch">
          Chưa có tài khoản? <Link href="/register">Đăng ký ngay</Link>
        </p>
      )}
    </form>
  );
}
