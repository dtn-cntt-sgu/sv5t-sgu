export type DocumentDownload = {
  id: string;
  label: string;
  filename: string;
  format: "pdf" | "doc" | "docx";
};

export type BuiltinDocument = {
  id: string;
  title: string;
  category: "CRITERIA" | "GUIDE" | "TEMPLATE";
  downloads: DocumentDownload[];
};

export const publicDocuments: BuiltinDocument[] = [
  {
    id: "central-criteria",
    title:
      '1. Quy định về tiêu chuẩn xét chọn danh hiệu "Sinh viên 5 tốt" cấp Trung ương',
    category: "CRITERIA",
    downloads: [
      {
        id: "central-criteria",
        label: "Tải PDF",
        filename: "1. Quy chế xét chọn danh hiệu SV5T, Tập thể SV5T cấp TW.pdf",
        format: "pdf",
      },
    ],
  },
  {
    id: "city-criteria",
    title:
      '2. Quy định về tiêu chuẩn xét chọn danh hiệu "Sinh viên 5 tốt" cấp Thành phố',
    category: "CRITERIA",
    downloads: [
      {
        id: "city-criteria",
        label: "Tải PDF",
        filename:
          "2. Quy định tiêu chuẩn danh hiệu SV5T, Tập thể SV5T cấp TP. HCM.pdf",
        format: "pdf",
      },
    ],
  },
  {
    id: "school-criteria",
    title:
      '3. Quy định về tiêu chuẩn xét chọn danh hiệu "Sinh viên 5 tốt" cấp Trường năm 2026',
    category: "CRITERIA",
    downloads: [
      {
        id: "school-criteria",
        label: "Tải PDF",
        filename:
          "3. Quy định tiêu chuẩn danh hiệu SV5T, TT SV5T trường Đại học Sài Gòn GĐ 2025 - 2028.pdf",
        format: "pdf",
      },
    ],
  },
  {
    id: "school-guidance",
    title: "4. Thông báo và Hướng dẫn xét chọn danh hiệu cấp Trường năm 2026",
    category: "GUIDE",
    downloads: [
      {
        id: "school-guidance",
        label: "Tải PDF",
        filename:
          "4. Thông báo và Hướng dẫn xét chọn danh hiệu cấp Trường năm 2026.pdf",
        format: "pdf",
      },
      {
        id: "school-guidance-word",
        label: "Tải Word",
        filename:
          "4. Thông báo và Hướng dẫn xét chọn danh hiệu cấp Trường năm 2026.doc",
        format: "doc",
      },
    ],
  },
];

export const studentTemplates: BuiltinDocument[] = [
  {
    id: "template-01",
    title: "Mẫu 01 — Bảng khai thành tích cá nhân",
    category: "TEMPLATE",
    downloads: [
      {
        id: "template-01",
        label: "Tải Mẫu 01",
        filename: "MẪU 01 - BẢNG KHAI THÀNH TÍCH CÁ NHÂN 25-26.docx",
        format: "docx",
      },
    ],
  },
  {
    id: "template-02",
    title: "Mẫu 02 — Minh chứng thành tích cá nhân",
    category: "TEMPLATE",
    downloads: [
      {
        id: "template-02",
        label: "Tải Mẫu 02",
        filename: "MẪU 02 - MINH CHỨNG THÀNH TÍCH CÁ NHÂN 25-26.docx",
        format: "docx",
      },
    ],
  },
  {
    id: "template-03",
    title: "Mẫu 03 — Bảng khai thành tích tập thể",
    category: "TEMPLATE",
    downloads: [
      {
        id: "template-03",
        label: "Tải Mẫu 03",
        filename: "MẪU 03 - BẢNG KHAI THÀNH TÍCH TẬP THỂ 25-26.docx",
        format: "docx",
      },
    ],
  },
  {
    id: "template-04",
    title: "Mẫu 04 — Minh chứng thành tích tập thể",
    category: "TEMPLATE",
    downloads: [
      {
        id: "template-04",
        label: "Tải Mẫu 04",
        filename: "MẪU 04 - MINH CHỨNG THÀNH TÍCH TẬP THỂ 25-26.docx",
        format: "docx",
      },
    ],
  },
];
