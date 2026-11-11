import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import styles from "@/app/admin/login/login-page.module.css";

export default function AdminLoginPage() {
  return (
    <main className={styles.page}>
      <AdminLoginForm />
    </main>
  );
}
