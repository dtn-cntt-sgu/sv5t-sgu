import { z } from "zod";

export const applicationTypeSchema = z.enum(["INDIVIDUAL", "COLLECTIVE"]);
export const fileCategorySchema = z.enum([
  "DECLARATION_DOC",
  "EVIDENCE_DOC",
  "PORTRAIT_IMG",
  "COLLECTIVE_DOC",
  "COLLECTIVE_IMG",
]);

export const createApplicationSchema = z.object({
  campaignId: z.uuid(),
  type: applicationTypeSchema,
});

export const presignUploadSchema = z.object({
  fileType: fileCategorySchema,
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  fileSizeBytes: z.number().int().positive(),
});

export const confirmUploadSchema = z.object({
  reservationId: z.uuid(),
});

export const individualFiles = [
  "DECLARATION_DOC",
  "EVIDENCE_DOC",
  "PORTRAIT_IMG",
] as const;
export const collectiveFiles = ["COLLECTIVE_DOC", "COLLECTIVE_IMG"] as const;
