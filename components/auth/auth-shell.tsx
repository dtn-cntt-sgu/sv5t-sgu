import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/auth/login-form";

export function AuthShell({
  portal,
}: {
  portal: "student" | "manager" | "admin";
}) {
  return (
    <main className={`auth-page auth-page-${portal}`}>
      <section className="auth-aside">
        <Brand />
        <div className="auth-aside-copy">
          <span className="eyebrow light">
            <span /> Không gian số của sinh viên SGU
          </span>
          <h2>
            {portal === "student"
              ? "Một hành trình tốt, bắt đầu từ hôm nay."
              : "Xét duyệt chính xác. Phản hồi minh bạch."}
          </h2>
          <p>
            {portal === "student"
              ? "Lưu tiến độ, nhận phản hồi theo từng minh chứng và chủ động hoàn thiện hồ sơ."
              : "Một quy trình thống nhất giúp Hội Sinh viên theo dõi, xét duyệt và báo cáo hiệu quả."}
          </p>
          <div className="auth-benefits">
            <span>
              <CheckCircle2 size={18} /> Theo dõi trạng thái theo thời gian thực
            </span>
            <span>
              <ShieldCheck size={18} /> File riêng tư, truy cập bằng liên kết
              ngắn hạn
            </span>
          </div>
        </div>
        <p className="auth-quote">
          “Tuổi trẻ SGU — Tiên phong, bản lĩnh, hội nhập.”
        </p>
      </section>
      <section className="auth-panel">
        <Link className="back-link" href="/">
          <ArrowLeft size={16} /> Về trang chủ
        </Link>
        <div className="auth-form-wrap">
          <LoginForm portal={portal} />
        </div>
        <small className="security-note">
          Kết nối được mã hóa · Không chia sẻ thông tin đăng nhập
        </small>
      </section>
    </main>
  );
}
