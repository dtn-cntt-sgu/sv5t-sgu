"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

export function ForgotPassword() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const email = String(new FormData(event.currentTarget).get("email"));
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      // Do not reveal whether an account exists.
      setMessage(
        "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.",
      );
    } catch {
      setMessage(
        "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <RecoveryShell>
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-heading">
          <span className="portal-badge portal-student">
            <Mail size={14} /> Khôi phục tài khoản
          </span>
          <h1>Quên mật khẩu?</h1>
          <p>
            Nhập email đã đăng ký. Bạn sẽ nhận được liên kết khôi phục qua
            email.
          </p>
        </div>
        <label>
          <span>Email</span>
          <div className="input-wrap">
            <Mail size={18} />
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="ten@sgu.edu.vn"
            />
          </div>
        </label>
        {message && (
          <p className="form-message success" role="status">
            <CheckCircle2 size={17} />
            {message}
          </p>
        )}
        <button
          className="button button-primary button-full"
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle className="spin" size={18} /> Đang gửi
            </>
          ) : (
            "Gửi hướng dẫn"
          )}
        </button>
        <p className="auth-switch">
          <Link href="/login">
            <ArrowLeft size={13} /> Quay lại đăng nhập
          </Link>
        </p>
      </form>
    </RecoveryShell>
  );
}

export function ResetPassword() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string }>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== data.get("confirmPassword")) {
      setMessage({ success: false, text: "Mật khẩu nhập lại chưa khớp." });
      setPending(false);
      return;
    }
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage({
        success: true,
        text: "Đổi mật khẩu thành công. Bạn có thể đăng nhập lại.",
      });
    } catch {
      setMessage({
        success: false,
        text: "Liên kết không hợp lệ hoặc đã hết hạn. Hãy gửi yêu cầu mới.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <RecoveryShell>
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-heading">
          <span className="portal-badge portal-student">
            <LockKeyhole size={14} /> Mật khẩu mới
          </span>
          <h1>Đặt lại mật khẩu</h1>
          <p>Dùng tối thiểu 10 ký tự và không sử dụng lại mật khẩu cũ.</p>
        </div>
        <label>
          <span>Mật khẩu mới</span>
          <div className="input-wrap">
            <LockKeyhole size={18} />
            <input
              name="password"
              type="password"
              minLength={10}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </div>
        </label>
        <label>
          <span>Nhập lại mật khẩu</span>
          <div className="input-wrap">
            <LockKeyhole size={18} />
            <input
              name="confirmPassword"
              type="password"
              minLength={10}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </div>
        </label>
        {message && (
          <p
            className={`form-message ${message.success ? "success" : "error"}`}
            role="status"
          >
            {message.success && <CheckCircle2 size={17} />}
            {message.text}
          </p>
        )}
        <button
          className="button button-primary button-full"
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle className="spin" size={18} /> Đang cập nhật
            </>
          ) : (
            "Lưu mật khẩu mới"
          )}
        </button>
        {message?.success && (
          <p className="auth-switch">
            <Link href="/login">Đăng nhập ngay</Link>
          </p>
        )}
      </form>
    </RecoveryShell>
  );
}

function RecoveryShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="recovery-page">
      <header>
        <Brand />
        <Link href="/">
          <ArrowLeft size={15} /> Trang chủ
        </Link>
      </header>
      <section>{children}</section>
      <small>
        Liên kết khôi phục có thời hạn và chỉ nên mở trên thiết bị của bạn.
      </small>
    </main>
  );
}
