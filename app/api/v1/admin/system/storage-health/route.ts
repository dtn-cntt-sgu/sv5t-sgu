import { apiError, ok } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireUser(["SCHOOL_PRESIDENT", "SUPER_ADMIN"]);
    const admin = createAdminClient();
    const [
      { data: committed, error: committedError },
      { data: reserved, error: reservedError },
      { data: settings, error: settingsError },
    ] = await Promise.all([
      admin.rpc("storage_committed_bytes"),
      admin.rpc("storage_reserved_bytes"),
      admin
        .from("system_settings")
        .select("r2_hard_limit_bytes, r2_warning_percent")
        .single(),
    ]);
    if (committedError || reservedError || settingsError)
      throw committedError ?? reservedError ?? settingsError;
    const used = Number(committed ?? 0);
    const pending = Number(reserved ?? 0);
    const limit = Number(settings.r2_hard_limit_bytes);
    const { data: databaseBytes, error: databaseError } = await admin.rpc(
      "database_size_bytes",
    );
    if (databaseError) throw databaseError;
    return ok({
      r2: {
        committedBytes: used,
        reservedBytes: pending,
        hardLimitBytes: limit,
        percent: Math.round(((used + pending) / limit) * 10000) / 100,
        warning: used + pending >= limit * (settings.r2_warning_percent / 100),
        uploadBlocked: used + pending >= limit,
      },
      database: { bytes: Number(databaseBytes), limitBytes: 500 * 1024 ** 2 },
    });
  } catch (error) {
    return apiError(error);
  }
}
