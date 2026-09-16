import type { UserRole } from "@/lib/auth/roles";
export type Profile = {
  id: string;
  mssv: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  faculty_id: string | null;
  major_id: string | null;
  class_name: string | null;
  is_active: boolean;
  faculties?: { name: string; code: string };
  majors?: { name: string };
};
export type Campaign = {
  id: string;
  name: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  is_archived?: boolean;
};
export type ReviewLog = {
  id: string;
  action: string;
  note: string | null;
  created_at: string;
  reviewer_snapshot: { full_name?: string };
};
export type ApplicationFile = {
  id: string;
  file_type: string;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
  revision: number;
  review_status: string;
  feedback_note: string | null;
  uploaded_at: string;
  file_review_logs?: ReviewLog[];
  previewUrl?: string;
  downloadUrl?: string;
};
export type Application = {
  id: string;
  campaign_id: string;
  type: "INDIVIDUAL" | "COLLECTIVE";
  status: string;
  rejection_reason: string | null;
  submitted_at: string | null;
  updated_at: string;
  application_files: ApplicationFile[];
  campaigns?: Campaign;
  users?: Profile;
};
export const statusLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  SUBMITTED: "Đã nộp",
  RESUBMIT_REQUIRED: "Cần nộp lại",
  RESUBMITTED: "Đã nộp lại",
  APPROVED: "Đạt",
  REJECTED: "Không đạt",
  PENDING: "Chờ xét duyệt",
  ACCEPTED: "Đã chấp nhận",
};
export const fileLabels: Record<string, string> = {
  DECLARATION_DOC: "Bản kê khai thành tích",
  EVIDENCE_DOC: "Tệp ảnh minh chứng",
  PORTRAIT_IMG: "Ảnh chân dung cá nhân",
  COLLECTIVE_DOC: "Kê khai thành tích tập thể",
  COLLECTIVE_IMG: "Ảnh tập thể tuyên dương",
};
export const roleLabels: Record<UserRole, string> = {
  STUDENT: "Sinh viên",
  FACULTY_SECRETARY: "Liên chi Hội trưởng",
  SCHOOL_PRESIDENT: "Hội Sinh viên trường",
  SUPER_ADMIN: "Quản trị viên",
};
export function dateLabel(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(value))
    : "Chưa có";
}
export function bytesLabel(value: number) {
  return value >= 1024 ** 3
    ? `${(value / 1024 ** 3).toFixed(2)} GB`
    : `${(value / 1024 ** 2).toFixed(1)} MB`;
}
export function campaignOpen(campaign?: Campaign | null) {
  const now = Date.now();
  return (
    !!campaign &&
    campaign.is_active !== false &&
    !campaign.is_archived &&
    now >= Date.parse(campaign.start_date) &&
    now <= Date.parse(campaign.end_date)
  );
}
