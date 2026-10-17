import { redirect } from "next/navigation";
import { FeedbackPage } from "@/components/account-pages";
import { STUDENT_APPLICATION_FEATURES_ENABLED } from "@/lib/config/student-features";

export default function StudentFeedbackRoute() {
  if (!STUDENT_APPLICATION_FEATURES_ENABLED) redirect("/dashboard");
  return <FeedbackPage />;
}
