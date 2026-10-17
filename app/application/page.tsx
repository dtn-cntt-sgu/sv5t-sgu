import { redirect } from "next/navigation";
import { StudentApplication } from "@/components/student-application";
import { STUDENT_APPLICATION_FEATURES_ENABLED } from "@/lib/config/student-features";

export default function ApplicationPage() {
  if (!STUDENT_APPLICATION_FEATURES_ENABLED) redirect("/dashboard");
  return <StudentApplication />;
}
