import styles from "@/components/widget/WidgetToast.module.css";

type WidgetToastProps = { message: string | null };

export function WidgetToast({ message }: WidgetToastProps) {
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {message ? <p className={styles.toast}>{message}</p> : null}
    </div>
  );
}
