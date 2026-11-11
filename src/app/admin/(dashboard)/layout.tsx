import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";

// 대화 목록은 레이아웃에 두어 대화를 옮겨 다녀도 다시 불러오지 않는다.
export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
