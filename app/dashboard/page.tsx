import type { Metadata } from "next";
import { StudentDashboard } from "@/components/student-dashboard";

export const metadata: Metadata = { title: "Tổng quan sinh viên" };
export default function DashboardPage() {
  return <StudentDashboard />;
}
