import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { homeForRole } from "@/lib/auth/roles";
import { QaWorkspace } from "@/components/qa/qa-workspace";
export default async function Page() {
  const actor = await requireUser();
  if (actor.role !== "SCHOOL_PRESIDENT") redirect(homeForRole(actor.role));
  return <QaWorkspace president />;
}
