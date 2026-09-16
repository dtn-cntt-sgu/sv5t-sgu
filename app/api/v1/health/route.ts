import { ok } from "@/lib/api/response";
import { hasSupabaseEnv } from "@/lib/config/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok({
    status: "ok",
    service: "sv5t-web",
    databaseConfigured: hasSupabaseEnv(),
    timestamp: new Date().toISOString(),
  });
}
