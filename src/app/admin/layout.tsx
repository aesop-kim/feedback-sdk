import type { Metadata } from "next";
import type { ReactNode } from "react";
import styles from "@/app/admin/admin-layout.module.css";

export const metadata: Metadata = {
  title: "래티스 피드백 관리자",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className={styles.screen}>{children}</div>;
}
