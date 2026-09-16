import "server-only";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { statusLabels } from "@/lib/domain/models";
export async function applicationWorkbook(campaignId: string) {
  const db = await createClient();
  const book = new ExcelJS.Workbook();
  book.creator = "SV5T SGU";
  const sheet = book.addWorksheet("Hồ sơ");
  sheet.columns = [
    { header: "MSSV", key: "mssv", width: 20 },
    { header: "Họ tên", key: "name", width: 30 },
    { header: "Khoa", key: "faculty", width: 35 },
    { header: "Ngành", key: "major", width: 30 },
    { header: "Lớp", key: "class", width: 18 },
    { header: "Email", key: "email", width: 32 },
    { header: "SĐT", key: "phone", width: 18 },
    { header: "Loại hồ sơ", key: "type", width: 16 },
    { header: "Trạng thái", key: "status", width: 22 },
    { header: "Ngày nộp", key: "submitted", width: 26 },
    { header: "Lý do không đạt", key: "reason", width: 50 },
  ];
  let offset = 0;
  while (true) {
    const { data, error } = await db
      .from("applications")
      .select(
        "*,users!applications_user_id_fkey(*,faculties(name),majors(name))",
      )
      .eq("campaign_id", campaignId)
      .neq("status", "DRAFT")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    for (const a of data) {
      const u = a.users;
      sheet.addRow({
        mssv: u.mssv,
        name: u.full_name,
        faculty: u.faculties?.name,
        major: u.majors?.name,
        class: u.class_name,
        email: u.email,
        phone: u.phone,
        type: a.type === "INDIVIDUAL" ? "Cá nhân" : "Tập thể",
        status: statusLabels[a.status],
        submitted: a.submitted_at,
        reason: a.rejection_reason,
      });
    }
    if (data.length < 500) break;
    offset += 500;
  }
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2855DC" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "K1" };
  return book.xlsx.writeBuffer();
}
