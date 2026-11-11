import styles from "@/app/admin/(dashboard)/dashboard-page.module.css";
import { AdminHomePlaceholder } from "@/components/admin/AdminHomePlaceholder";

export default function AdminHomePage() {
  return (
    <>
      <AdminHomePlaceholder />
      <aside className={styles.sideColumn} aria-hidden="true" />
    </>
  );
}
