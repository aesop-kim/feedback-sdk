// 위젯·관리자 화면에서 쓰는 선 아이콘. src/components/widget/WidgetIcons.tsx와 같은 1.75 stroke, currentColor.
import type { ReactNode } from "react";

type P = { size?: number; color?: string; stroke?: number; style?: React.CSSProperties };

function Frame({ size = 24, color = "currentColor", stroke = 1.75, style, children }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0, ...style }}>
      {children}
    </svg>
  );
}

export const CloseIcon = (p: P) => (
  <Frame {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Frame>
);
export const ScreenIcon = (p: P) => (
  <Frame {...p}>
    <rect x="3" y="4.5" width="18" height="12" rx="2.5" />
    <path d="M9 20h6M12 16.5V20" />
  </Frame>
);
export const ScreenMicIcon = (p: P) => (
  <Frame {...p}>
    <path d="M13 16.5H5.5A2.5 2.5 0 0 1 3 14V7a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 19 7v2" />
    <path d="M7 20h5" />
    <rect x="16" y="11.5" width="4" height="6" rx="2" />
    <path d="M14.5 17a3.5 3.5 0 0 0 7 0M18 20.5V21.5" />
  </Frame>
);
export const SendIcon = (p: P) => (
  <Frame {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Frame>
);
export const CheckIcon = (p: P & { draw?: number }) => (
  <Frame {...p}>
    <path d="M5 12.5 10 17.5 19 7" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - (p.draw ?? 1)} />
  </Frame>
);
export const ChatIcon = (p: P) => (
  <Frame {...p}>
    <path d="M4 11.5C4 7.4 7.6 4.5 12 4.5s8 2.9 8 7-3.6 7-8 7c-1 0-2-.1-2.9-.4L5 19.5l1.1-3.3C4.8 14.9 4 13.3 4 11.5Z" />
  </Frame>
);
/** 런처 아이콘: 말풍선 안 음성 막대 3개 (src/sdk/launcher-styles.ts LAUNCHER_ICON) */
export const LauncherIcon = (p: P) => (
  <Frame {...p}>
    <path d="M7 4.5h10a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1-3.5 3.5h-5l-3.5 3v-3H7A3.5 3.5 0 0 1 3.5 14V8A3.5 3.5 0 0 1 7 4.5Z" />
    <path d="M9 10v2M12 8.5v5M15 10v2" />
  </Frame>
);
export const VideoIcon = (p: P) => (
  <Frame {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2.5" />
    <path d="m16 10.5 5-3v9l-5-3" />
  </Frame>
);
export const ChevronDown = (p: P) => (
  <Frame {...p}>
    <path d="m6 9 6 6 6-6" />
  </Frame>
);
export const PlusIcon = (p: P) => (
  <Frame {...p}>
    <path d="M12 5v14M5 12h14" />
  </Frame>
);
export const HomeIcon = (p: P) => (
  <Frame {...p}>
    <path d="M4 10.5 12 4l8 6.5V20H4z" />
  </Frame>
);
export const DocIcon = (p: P) => (
  <Frame {...p}>
    <path d="M6 3.5h8l4 4V20.5H6z" />
    <path d="M9 12h6M9 16h6" />
  </Frame>
);
export const FolderIcon = (p: P) => (
  <Frame {...p}>
    <path d="M3.5 6.5h6l2 2h9v11h-17z" />
  </Frame>
);
export const UsersIcon = (p: P) => (
  <Frame {...p}>
    <circle cx="9" cy="9" r="3" />
    <circle cx="16.5" cy="10" r="2.5" />
    <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5M15 14.6c2.4-.2 4.6 1 5.3 4" />
  </Frame>
);
export const PenIcon = (p: P) => (
  <Frame {...p}>
    <path d="M4 20l1-4.5L15.5 5l3.5 3.5L8.5 19z" />
  </Frame>
);
export const MicIcon = (p: P) => (
  <Frame {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
  </Frame>
);
export const FilmIcon = (p: P) => (
  <Frame {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9h17M3.5 15h17M8.5 4.5v15M15.5 4.5v15" />
  </Frame>
);
export const PointerIcon = (p: P) => (
  <Frame {...p}>
    <path d="M6 3.5 18 13l-5.2.8L15.5 20l-2.6 1-2.7-6.2L6 18.5z" />
  </Frame>
);
export const SplitIcon = (p: P) => (
  <Frame {...p}>
    <rect x="3.5" y="4" width="17" height="4.5" rx="1.5" />
    <rect x="3.5" y="10" width="17" height="4.5" rx="1.5" />
    <rect x="3.5" y="16" width="17" height="4.5" rx="1.5" />
  </Frame>
);
export const ListCheckIcon = (p: P) => (
  <Frame {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8 12.2 2.8 2.8L16.2 9.5" />
  </Frame>
);
export const ReplyIcon = (p: P) => (
  <Frame {...p}>
    <path d="M9 7 4 12l5 5" />
    <path d="M4 12h10a6 6 0 0 1 6 6" />
  </Frame>
);
export const RefreshIcon = (p: P) => (
  <Frame {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4.5v4h-4" />
  </Frame>
);
export const WrenchIcon = (p: P) => (
  <Frame {...p}>
    <path d="M14.5 4.5a4.5 4.5 0 0 0 4.9 6.1L20 11l-8.5 8.5a2.1 2.1 0 0 1-3-3L17 8l.4.6" />
  </Frame>
);
export const QuestionIcon = (p: P) => (
  <Frame {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.8 9.5a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.5v.4M12 16.6v.1" />
  </Frame>
);

/** 래티스 로고 마크 (src/components/admin/LatticeMark.tsx). */
export function LatticeMark({ size = 20, color = "#3182F6" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: "block", flexShrink: 0 }}>
      <rect width="20" height="20" rx="5" fill={color} />
      <rect x="5" y="5" width="4" height="4" rx="1" fill="#fff" />
      <rect x="11" y="5" width="4" height="4" rx="1" fill="#fff" />
      <rect x="5" y="11" width="4" height="4" rx="1" fill="#fff" />
      <rect x="11" y="11" width="4" height="4" rx="1" fill="#fff" opacity={0.55} />
    </svg>
  );
}

/** 고객사(래티스 주식회사) 로고: 교차 선 마크 */
export function HostMark({ size = 20, color = "#3182F6" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" style={{ display: "block", flexShrink: 0 }}>
      <path d="M3 4l6 6-6 6M9 4l6 6-6 6M15 4l3 3M15 16l3-3" />
    </svg>
  );
}
