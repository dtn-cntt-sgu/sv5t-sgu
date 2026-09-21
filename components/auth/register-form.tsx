"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  UserRoundPlus,
} from "lucide-react";
import { Brand } from "@/components/brand";

type Faculty = {
  id: string;
  code: string;
  name: string;
  majors: Array<{ id: string; code: string; name: string }>;
};

const fallback: Faculty[] = [
  { id: "", code: "CNTT", name: "Khoa Công nghệ Thông tin", majors: [] },
  { id: "", code: "QTKD", name: "Khoa Quản trị Kinh doanh", majors: [] },
  { id: "", code: "SP", name: "Khoa Sư phạm", majors: [] },
];

export function RegisterForm() {
  const [faculties, setFaculties] = useState<Faculty[]>(fallback);
  const [facultyId, setFacultyId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  }>();
  const majors = useMemo(
    () => faculties.find((faculty) => faculty.id === facultyId)?.majors ?? [],
    [faculties, facultyId],
  );

  useEffect(() => {
    fetch("/api/v1/public/faculties")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((result) => setFaculties(result.data))
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (form.get("password") !== form.get("confirmPassword")) {
      setMessage({ type: "error", text: "Mật khẩu nhập lại chưa khớp." });
      setPending(false);
      return;
    }
    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mssv: form.get("mssv"),
          fullName: form.get("fullName"),
          email: form.get("email"),
          phone: form.get("phone"),
          password: form.get("password"),
          facultyId: form.get("facultyId"),
          majorId: form.get("majorId"),
          className: form.get("className"),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message ?? "Không thể tạo tài khoản.");
      setMessage({
        type: "success",
        text: result.data.emailConfirmationRequired
          ? "Đăng ký thành công. Hãy kiểm tra email để xác nhận tài khoản."
          : "Đăng ký thành công. Bạn có thể đăng nhập ngay.",
      });
      formElement.reset();
      setFacultyId("");
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Không thể tạo tài khoản.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="register-page">
      <header className="register-header">
        <Brand />
        <Link className="register-login-link" href="/login">
          Đã có tài khoản? <strong>Đăng nhập</strong>
        </Link>
      </header>
      <section className="register-layout">
        <aside className="register-intro">
          <Link className="back-link" href="/">
            <ArrowLeft size={16} /> Trang chủ
          </Link>
          <span className="portal-badge portal-student">
            <UserRoundPlus size={14} /> Tạo tài khoản
          </span>
          <h1>
            <span>Bắt đầu hành trình</span>
            <span>Sinh viên 5 Tốt.</span>
          </h1>
          <p>
            Thông tin chính xác giúp Liên chi Hội khoa xác minh hồ sơ nhanh hơn.
          </p>
          <ol>
            <li className="active">
              <span>1</span>
              <div>
                <strong>Thông tin sinh viên</strong>
                <small>Danh tính và đơn vị học tập</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Xác thực email</strong>
                <small>Bảo vệ quyền truy cập tài khoản</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Tạo hồ sơ</strong>
                <small>Chọn loại hồ sơ và tải minh chứng</small>
              </div>
            </li>
          </ol>
        </aside>
        <form className="register-form" onSubmit={submit}>
          <div className="form-title">
            <span>Bước 1/3</span>
            <h2>Thông tin của bạn</h2>
            <p>Các trường có dấu * là bắt buộc.</p>
          </div>
          <div className="form-grid">
            <label>
              <span>Mã số sinh viên *</span>
              <input
                name="mssv"
                required
                minLength={5}
                maxLength={20}
                placeholder="VD: 3124410001"
              />
            </label>
            <label>
              <span>Họ và tên *</span>
              <input
                name="fullName"
                required
                minLength={2}
                maxLength={100}
                placeholder="Nguyễn Văn An"
              />
            </label>
            <label>
              <span>Email *</span>
              <input
                name="email"
                type="email"
                required
                placeholder="ten@sgu.edu.vn"
              />
            </label>
            <label>
              <span>Số điện thoại *</span>
              <input
                name="phone"
                type="tel"
                required
                pattern="\+?[0-9]{9,15}"
                placeholder="09xxxxxxxx"
              />
            </label>
            <label>
              <span>Khoa *</span>
              <select
                name="facultyId"
                required
                value={facultyId}
                onChange={(event) => setFacultyId(event.target.value)}
              >
                <option value="">Chọn khoa</option>
                {faculties.map((faculty) => (
                  <option
                    key={faculty.code}
                    value={faculty.id}
                    disabled={!faculty.id}
                  >
                    {faculty.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Ngành *</span>
              <select
                key={facultyId}
                name="majorId"
                required
                disabled={!majors.length}
              >
                <option value="">Chọn ngành</option>
                {majors.map((major) => (
                  <option key={major.id} value={major.id}>
                    {major.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Lớp *</span>
              <input
                name="className"
                required
                minLength={2}
                maxLength={50}
                placeholder="VD: DCT1241"
              />
            </label>
            <span />
            <label>
              <span>Mật khẩu *</span>
              <input
                name="password"
                type="password"
                required
                minLength={10}
                maxLength={72}
                autoComplete="new-password"
                placeholder="Tối thiểu 10 ký tự"
              />
            </label>
            <label>
              <span>Nhập lại mật khẩu *</span>
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={10}
                maxLength={72}
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu"
              />
            </label>
          </div>
          <label className="checkbox consent">
            <input type="checkbox" required />
            <span>
              Tôi xác nhận thông tin trên là chính xác và đồng ý với quy định xử
              lý dữ liệu của chương trình.
            </span>
          </label>
          {message && (
            <p className={`form-message ${message.type}`} role="status">
              {message.type === "success" && <CheckCircle2 size={17} />}
              {message.text}
            </p>
          )}
          <button
            className="button button-primary register-submit"
            disabled={pending || !faculties.some((faculty) => faculty.id)}
          >
            {pending ? (
              <>
                <LoaderCircle className="spin" size={18} /> Đang tạo tài khoản
              </>
            ) : (
              <>
                Tiếp tục <ArrowRight size={18} />
              </>
            )}
          </button>
          {!faculties.some((faculty) => faculty.id) && (
            <small className="setup-hint">
              Danh sách khoa chưa tải được. Vui lòng tải lại trang sau ít phút.
            </small>
          )}
        </form>
      </section>
    </main>
  );
}
