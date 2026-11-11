// 위젯 전용 라인 아이콘. 1.75px stroke, currentColor 단색.
import type { ReactNode } from "react";

type IconProps = { size?: number };

function IconFrame({ size = 24, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </IconFrame>
  );
}

export function ScreenIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="2.5" />
      <path d="M9 20h6M12 16.5V20" />
    </IconFrame>
  );
}

export function ScreenMicIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M13 16.5H5.5A2.5 2.5 0 0 1 3 14V7a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 19 7v2" />
      <path d="M7 20h5" />
      <rect x="16" y="11.5" width="4" height="6" rx="2" />
      <path d="M14.5 17a3.5 3.5 0 0 0 7 0M18 20.5V21.5" />
    </IconFrame>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </IconFrame>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5 12.5 10 17.5 19 7" />
    </IconFrame>
  );
}
