import { createClient } from "@/lib/supabase/server";
import { isFacultyCatalog, type Faculty } from "@/lib/domain/faculty-catalog";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Đăng ký tài khoản" };
export const dynamic = "force-dynamic";
export default async function RegisterPage() {
  let initialFaculties: Faculty[] = [];
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("faculties")
      .select("id, code, name, majors(id, code, name)")
      .order("name")
      .order("name", { referencedTable: "majors" })
      .abortSignal(AbortSignal.timeout(5000));
    if (!error && isFacultyCatalog(data)) initialFaculties = data;
  } catch {
    /* The browser offers a bounded retry if the server cannot load the catalog. */
  }
  return <RegisterForm initialFaculties={initialFaculties} />;
}
