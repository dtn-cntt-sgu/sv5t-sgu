import { redirect } from "next/navigation";
import { AuthError, requireUser } from "@/lib/auth/require-user";
import { homeForRole, managerRoles } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/domain/models";
import { PortalProfileProvider } from "@/components/portal-profile-provider";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let actor;
  try {
    actor = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) redirect("/manager/login");
    throw error;
  }
  if (!managerRoles.includes(actor.role)) redirect(homeForRole(actor.role));

  const db = await createClient();
  const { data, error } = await db
    .from("users")
    .select("*, faculties(name, code), majors(name)")
    .eq("id", actor.id)
    .single();
  if (error) throw error;

  return (
    <PortalProfileProvider initialProfile={data as Profile} key={actor.id}>
      {children}
    </PortalProfileProvider>
  );
}
