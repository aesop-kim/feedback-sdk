import type { ComponentProps } from "react";
import styles from "@/components/admin/AdminButton.module.css";

type AdminButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "weak" | "text";
  size?: "large" | "medium" | "small";
  isLoading?: boolean;
  isBlock?: boolean;
};

// TDS 버튼을 어드민 크기로. primary는 화면 주요 행동에만, 나머지는 weak 또는 text.
export function AdminButton({
  variant = "primary",
  size = "medium",
  isLoading = false,
  isBlock = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: AdminButtonProps) {
  const classNames = [styles.button, styles[variant], styles[size], isBlock ? styles.block : "", className ?? ""].join(" ");
  return (
    <button type={type} className={classNames} disabled={disabled || isLoading} aria-busy={isLoading} {...rest}>
      <span className={isLoading ? styles.hiddenLabel : undefined}>{children}</span>
      {isLoading ? (
        <span className={styles.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      ) : null}
    </button>
  );
}
