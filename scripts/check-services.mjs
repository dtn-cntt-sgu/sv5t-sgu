import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const secret =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const required = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: secret,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
};

const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length) {
  console.error(`FAIL environment: missing ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("PASS environment: all required variables are present");

  const publicClient = createClient(
    required.NEXT_PUBLIC_SUPABASE_URL,
    required.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const { data, error } = await publicClient
    .from("faculties")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.error(`FAIL Supabase schema/RLS: ${error.message}`);
    process.exitCode = 1;
  } else {
    void data;
    console.log("PASS Supabase: project, schema and public RLS are reachable");
  }

  const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${required.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required.R2_ACCESS_KEY_ID,
      secretAccessKey: required.R2_SECRET_ACCESS_KEY,
    },
  });
  try {
    await r2.send(new HeadBucketCommand({ Bucket: required.R2_BUCKET_NAME }));
    console.log("PASS Cloudflare R2: private bucket is reachable");
  } catch (error) {
    console.error(
      `FAIL Cloudflare R2: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exitCode = 1;
  }
}
