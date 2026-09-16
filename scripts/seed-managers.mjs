import { createClient } from "@supabase/supabase-js";

const supabaseSecret =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const required = ["NEXT_PUBLIC_SUPABASE_URL"];
for (const key of required) {
  if (!process.env[key])
    throw new Error(`Missing environment variable: ${key}`);
}
if (!supabaseSecret)
  throw new Error("Missing environment variable: SUPABASE_SECRET_KEY");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseSecret,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const accounts = [
  {
    email: process.env.INITIAL_ADMIN_EMAIL,
    password: process.env.INITIAL_ADMIN_PASSWORD,
    fullName: "Quản trị viên hệ thống",
    role: "SUPER_ADMIN",
  },
  {
    email: process.env.INITIAL_PRESIDENT_EMAIL,
    password: process.env.INITIAL_PRESIDENT_PASSWORD,
    fullName: "Chủ tịch Hội Sinh viên trường",
    role: "SCHOOL_PRESIDENT",
  },
  ...JSON.parse(process.env.INITIAL_FACULTY_MANAGERS_JSON || "[]").map(
    (item) => ({
      ...item,
      role: "FACULTY_SECRETARY",
    }),
  ),
].filter((account) => account.email && account.password);

for (const account of accounts) {
  if (account.password.length < 14) {
    throw new Error(
      `Initial password for ${account.email} must contain at least 14 characters.`,
    );
  }

  let facultyId = null;
  if (account.role === "FACULTY_SECRETARY" && !account.facultyCode) {
    throw new Error(
      `Faculty manager ${account.email} must have facultyCode (for example CNTT).`,
    );
  }
  if (account.facultyCode) {
    const { data, error } = await supabase
      .from("faculties")
      .select("id")
      .eq("code", account.facultyCode)
      .single();
    if (error)
      throw new Error(`Faculty ${account.facultyCode}: ${error.message}`);
    facultyId = data.id;
  }

  const { error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    app_metadata: { role: account.role },
    user_metadata: { full_name: account.fullName, faculty_id: facultyId },
  });

  if (error?.message.toLowerCase().includes("already")) {
    console.warn(`Skipped existing account: ${account.email}`);
  } else if (error) {
    if (
      error.code === "unexpected_failure" ||
      error.message.toLowerCase().includes("database error")
    ) {
      console.error(
        "Apply migration 202609150006_defer_auth_profile_creation.sql, then retry. If it still fails, check Supabase Auth/Postgres logs for the underlying SQL error. Never share passwords or API keys.",
      );
    }
    throw new Error(`Could not create ${account.email}: ${error.message}`);
  } else {
    console.log(`Created ${account.role}: ${account.email}`);
  }
}

console.log(
  "Manager seed completed. Remove all INITIAL_* secrets from your local environment.",
);
