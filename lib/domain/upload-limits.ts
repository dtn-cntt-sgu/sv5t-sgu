import { z } from "zod";
export const uploadLimitLabels = {
  DECLARATION_DOC: "Bản kê khai thành tích (DOCX)",
  EVIDENCE_DOC: "Minh chứng cá nhân (DOCX)",
  PORTRAIT_IMG: "Ảnh chân dung",
  COLLECTIVE_DOC: "Hồ sơ tập thể (DOCX)",
  COLLECTIVE_IMG: "Ảnh tập thể",
} as const;
const bytes = z
  .number()
  .int()
  .min(1)
  .max(1024 ** 3);
export const uploadLimitsSchema = z
  .object({
    DECLARATION_DOC: bytes,
    EVIDENCE_DOC: bytes,
    PORTRAIT_IMG: bytes,
    COLLECTIVE_DOC: bytes,
    COLLECTIVE_IMG: bytes,
  })
  .strict();
export type UploadLimits = z.infer<typeof uploadLimitsSchema>;
