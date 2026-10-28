import type { Metadata } from "next";
import { StudentDashboard } from "@/components/student-dashboard";

export const metadata: Metadata = { title: "Tổng quan sinh viên" };
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ documents?: string }>;
}) {
  const params = await searchParams;
  return (
    <StudentDashboard
      documentsRegistrationRequired={
        params.documents === "registration-required"
      }
    />
  );
}
