"use client";

import { useLayoutEffect, useRef } from "react";
import styles from "@/components/widget/WidgetToast.module.css";

type WidgetToastProps = { message: string | null };

// TDS 토스트: 한 줄이면 알약, 두 줄 이상이면 둥근 사각형. 줄 수는 그린 뒤 높이로 잰다.
export function WidgetToast({ message }: WidgetToastProps) {
  const toastRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const toast = toastRef.current;
    if (!toast) {
      return;
    }
    const style = window.getComputedStyle(toast);
    const contentHeight = toast.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    toast.dataset.multiline = String(contentHeight > parseFloat(style.lineHeight) * 1.5);
  }, [message]);

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {message ? (
        <p ref={toastRef} className={styles.toast}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
