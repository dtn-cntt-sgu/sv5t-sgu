import "server-only";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerEnv } from "@/lib/config/env";
import { getR2Client } from "@/lib/r2/client";

export type FileCategory =
  | "DECLARATION_DOC"
  | "EVIDENCE_DOC"
  | "PORTRAIT_IMG"
  | "COLLECTIVE_DOC"
  | "COLLECTIVE_IMG";

const docxMimeTypes = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  "application/msword",
  "application/vnd.ms-word.document.macroenabled.12",
  "application/wps-office.docx",
  "application/octet-stream",
  "application/zip",
] as const;

const allowedMime: Record<FileCategory, readonly string[]> = {
  DECLARATION_DOC: [...docxMimeTypes],
  EVIDENCE_DOC: [...docxMimeTypes],
  COLLECTIVE_DOC: [...docxMimeTypes],
  PORTRAIT_IMG: ["image/jpeg", "image/png", "image/webp"],
  COLLECTIVE_IMG: ["image/jpeg", "image/png", "image/webp"],
};

export function validateUpload(
  category: FileCategory,
  mimeType: string,
  size: number,
) {
  const env = getServerEnv();
  const normalizedMime = mimeType.toLowerCase();
  const isDocxMime =
    category.endsWith("DOC") &&
    (allowedMime[category].some((value) => value.toLowerCase() === normalizedMime) ||
      normalizedMime.includes("docx") ||
      normalizedMime.includes("word"));
  const isImageMime =
    category.endsWith("IMG") &&
    allowedMime[category].some((value) => value.toLowerCase() === normalizedMime);

  if (!(isDocxMime || isImageMime))
    throw new Error("UNSUPPORTED_FILE_TYPE");

  const limit = category.endsWith("DOC")
    ? env.MAX_DOCX_BYTES
    : env.MAX_IMAGE_BYTES;
  if (size < 1 || size > limit) throw new Error("FILE_TOO_LARGE");
}

export function buildObjectKey(input: {
  campaignId: string;
  applicationId: string;
  facultyCode: string;
  studentCode: string;
  category: FileCategory;
  mimeType: string;
}) {
  const safeFaculty = input.facultyCode
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
  const safeStudent = input.studentCode
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
  if (!safeFaculty || !safeStudent) throw new Error("INVALID_OBJECT_KEY");

  // Deliberately extensionless: the key remains identical if a replacement image changes format.
  // The real MIME type and original filename live in metadata and signed response headers.
  const objectKey = `campaigns/${input.campaignId}/${safeFaculty}/${safeStudent}/${input.applicationId}/${input.category}`;
  console.log("[R2] buildObjectKey:", {
    campaignId: input.campaignId,
    applicationId: input.applicationId,
    facultyCode: input.facultyCode,
    studentCode: input.studentCode,
    category: input.category,
    mimeType: input.mimeType,
    objectKey,
  });
  return objectKey;
}

export async function createUploadUrl(
  key: string,
  mimeType: string,
  size: number,
) {
  const env = getServerEnv();
  console.log("[R2] createUploadUrl:", {
    bucket: env.R2_BUCKET_NAME,
    key,
    mimeType,
    size,
  });
  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ContentType: mimeType,
      ContentLength: size,
    }),
    { expiresIn: 300 },
  );
}

export async function inspectObject(key: string) {
  const env = getServerEnv();
  return getR2Client().send(
    new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
  );
}

export async function createReadUrl(key: string, downloadName?: string) {
  const env = getServerEnv();
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ResponseContentDisposition: downloadName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
        : "inline",
    }),
    { expiresIn: 300 },
  );
}
