import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth/require-user";
import { apiError } from "@/lib/api/response";
import { participationRegistrations } from "@/lib/participation/registrations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    await requireUser(["SCHOOL_PRESIDENT"]);
    const { registrations } = await participationRegistrations();
    const book = new ExcelJS.Workbook();
    book.creator = "SV5T SGU";
    const sheet = book.addWorksheet("Danh sách đăng kí");
    sheet.columns = [
      { header: "STT", key: "index", width: 8 },
      { header: "MSSV", key: "mssv", width: 20 },
      { header: "Họ và tên", key: "full_name", width: 30 },
      { header: "Khoa", key: "faculty_name", width: 35 },
      { header: "Ngành", key: "major_name", width: 35 },
      { header: "Lớp", key: "class_name", width: 20 },
      { header: "Email", key: "email", width: 35 },
      { header: "Số điện thoại", key: "phone", width: 20 },
      {
        header: "Thời gian đăng kí (giờ Việt Nam)",
        key: "registered_at",
        width: 34,
      },
    ];
    const date = new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Asia/Ho_Chi_Minh",
    });
    registrations.forEach((row, index) => {
      // Plain strings preserve leading zeroes and cannot become Excel formulas.
      sheet.addRow({
        ...row,
        index: index + 1,
        registered_at: date.format(new Date(row.registered_at)),
      });
    });
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2855DC" },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: "I1" };
    const buffer = await book.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="danh-sach-dang-ki.xlsx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
