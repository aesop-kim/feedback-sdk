// 고객사 화면(래티스 주식회사 계약서 목록)을 1440x900 좌표로 다시 그린 레이어.
// 기준: .screens/flow/01-host-closed.png. 데모 버그 3개(등록 버튼 무반응, '계약 긍액' 오타, 제목 글씨)를 그대로 둔다.
// 상태 칩만 강조색 하나 규칙에 맞춰 회색 계열로 바꿨다.
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, FONT, UI } from "../theme";
import { DocIcon, FolderIcon, HomeIcon, HostMark, PenIcon, PlusIcon, UsersIcon, ChevronDown } from "./Icons";
import { TEXTURES } from "../textures";

const NAMES = ["한빛상사", "세라트젠", "오름기획", "누리테크", "다온물산", "가람전자", "미르건설", "새솔유통"];
export const ROWS = Array.from({ length: 19 }, (_, i) => ({
  id: `DOC-${1001 + i}`,
  name: `${NAMES[i % 8]} 서비스 이용 계약서`,
  client: NAMES[i % 8],
  amount: `${(1200000 + 370000 * i).toLocaleString("ko-KR")}원`,
  done: i % 3 === 0,
}));

// 화면 안 주요 위치 (UI 좌표). 카메라·커서가 이 값을 쓴다.
export const HOST = {
  title: { x: 264, y: 14, w: 92, h: 26 },
  register: { x: 1208, y: 12, w: 108, h: 32 },
  amountHeader: { x: 1162, y: 68, w: 54, h: 24 },
  launcher: { x: 1388, y: 848 },
};

const COLS = { check: 272, id: 302, name: 432, client: 1002, amount: 1162, status: 1322 };
const SEPS = [418, 988, 1148, 1308];

type HostProps = {
  /** 제목 점선 상자 0~1 */
  titleBox?: number;
  titleDash?: number;
  /** '긍' 밑줄 그리기 0~1 */
  underline?: number;
  children?: ReactNode;
};

const txt = (size: number, weight: number, color: string, extra?: CSSProperties): CSSProperties => ({
  fontFamily: FONT,
  fontSize: size,
  fontWeight: weight,
  color,
  lineHeight: 1.3,
  whiteSpace: "nowrap",
  ...extra,
});

export function HostPage({ titleBox = 0, titleDash = 0, underline = 0, children }: HostProps) {
  if (TEXTURES.host) {
    return (
      <div style={{ position: "absolute", inset: 0, background: C.surface }}>
        <Img src={staticFile(TEXTURES.host)} style={{ width: UI.w, height: UI.h, display: "block" }} />
        {titleBox > 0 ? (
          <svg style={{ position: "absolute", left: HOST.title.x - 8, top: HOST.title.y - 4, overflow: "visible" }} width={HOST.title.w + 16} height={HOST.title.h + 8}>
            <rect x={0} y={0} width={HOST.title.w + 16} height={HOST.title.h + 8} rx={6} fill="none" stroke={C.accent} strokeWidth={2} strokeDasharray="6 6" strokeDashoffset={-titleDash} opacity={titleBox} />
          </svg>
        ) : null}
        {/* '긍' 글자 밑줄 (1440 캡처 기준 위치) */}
        <div style={{ position: "absolute", left: 1189, top: 90, width: 15, height: 2.5, background: C.accent, transformOrigin: "left", transform: `scaleX(${underline})` }} />
        {children}
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", inset: 0, background: C.surface, overflow: "hidden" }}>
      {/* 사이드바 */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 240, height: 900, background: C.grey50, borderRight: `1px solid ${C.grey200}` }}>
        <div style={{ position: "absolute", left: 18, top: 17, display: "flex", alignItems: "center", gap: 8 }}>
          <HostMark size={18} />
          <span style={txt(15, 700, C.ink)}>래티스 주식회사</span>
        </div>
        <div style={{ position: "absolute", left: 208, top: 20, color: C.grey400 }}>
          <ChevronDown size={14} />
        </div>
        <div style={{ position: "absolute", left: 12, top: 52, width: 215, height: 32, border: `1px solid ${C.grey200}`, borderRadius: 8, background: C.surface, display: "flex", alignItems: "center", padding: "0 10px", gap: 8 }}>
          <div style={{ width: 14, height: 14, border: `1.5px dashed ${C.grey500}`, borderRadius: 3 }} />
          <span style={txt(13.5, 500, C.grey700)}>새로 만들기</span>
        </div>
        {[
          { y: 111, label: "홈", Icon: HomeIcon },
          { y: 145, label: "전체 계약서", Icon: DocIcon, active: true },
          { y: 179, label: "프로젝트", Icon: FolderIcon },
          { y: 213, label: "고객", Icon: UsersIcon },
          { y: 247, label: "전자서명", Icon: PenIcon },
        ].map(({ y, label, Icon, active }) => (
          <div key={label} style={{ position: "absolute", left: 12, top: y - 16, width: 215, height: 32, borderRadius: 8, background: active ? C.grey200 : "transparent", display: "flex", alignItems: "center", gap: 10, padding: "0 10px", color: active ? C.ink : C.grey700 }}>
            <Icon size={16} />
            <span style={txt(14, active ? 600 : 500, active ? C.ink : C.grey700)}>{label}</span>
          </div>
        ))}
      </div>

      {/* 상단 바: 제목(버그 3: 글씨가 어색함 — 다른 곳보다 굵고 자간이 좁다) */}
      <div style={{ position: "absolute", left: HOST.title.x, top: 15, display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={txt(15.5, 800, C.grey600, { letterSpacing: -1.1 })}>전체 계약서</span>
        <span style={txt(15, 700, C.accent)}>60</span>
      </div>
      {titleBox > 0 ? (
        <svg style={{ position: "absolute", left: HOST.title.x - 8, top: HOST.title.y - 4, overflow: "visible" }} width={HOST.title.w + 16} height={HOST.title.h + 8}>
          <rect x={0} y={0} width={HOST.title.w + 16} height={HOST.title.h + 8} rx={6} fill="none" stroke={C.accent} strokeWidth={2} strokeDasharray="6 6" strokeDashoffset={-titleDash} opacity={titleBox} />
        </svg>
      ) : null}
      {/* 버그 1: 눌러도 반응 없는 등록 버튼 */}
      <div style={{ position: "absolute", left: HOST.register.x, top: HOST.register.y, width: HOST.register.w, height: HOST.register.h, borderRadius: 6, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, color: "#fff" }}>
        <PlusIcon size={15} stroke={2} />
        <span style={txt(13.5, 600, "#fff")}>계약서 등록</span>
      </div>
      <div style={{ position: "absolute", left: 1324, top: 12, width: 100, height: 32, borderRadius: 6, border: `1px solid ${C.grey300}`, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={txt(13.5, 500, C.ink)}>엑셀 다운로드</span>
      </div>

      {/* 표 머리글 (버그 2: '계약 긍액') */}
      <div style={{ position: "absolute", left: 240, top: 56, width: 1200, height: 48, background: C.grey50, borderBottom: `1px solid ${C.grey200}` }} />
      <Check x={COLS.check} y={80} />
      {SEPS.map((x) => (
        <div key={x} style={{ position: "absolute", left: x, top: 73, width: 1, height: 14, background: C.grey300 }} />
      ))}
      {[
        [COLS.id, "문서 ID"],
        [COLS.name, "계약서명"],
        [COLS.client, "고객"],
        [COLS.status, "체결 여부"],
      ].map(([x, t]) => (
        <span key={t as string} style={{ position: "absolute", left: x as number, top: 71, ...txt(13.5, 500, C.grey600) }}>
          {t}
        </span>
      ))}
      <span style={{ position: "absolute", left: COLS.amount, top: 71, ...txt(13.5, 500, C.grey600) }}>
        계약 <span style={{ position: "relative" }}>긍
          <span style={{ position: "absolute", left: -1, right: -1, bottom: -3, height: 2.5, background: C.accent, transformOrigin: "left", transform: `scaleX(${underline})` }} />
        </span>액
      </span>

      {/* 행 */}
      {ROWS.map((r, i) => {
        const cy = 126 + 42 * i;
        return (
          <div key={r.id}>
            <div style={{ position: "absolute", left: 240, top: cy + 20, width: 1200, height: 1, background: C.grey100 }} />
            <Check x={COLS.check} y={cy} />
            <span style={{ position: "absolute", left: COLS.id + 1, top: cy - 10, ...txt(14, 500, C.ink) }}>{r.id}</span>
            <span style={{ position: "absolute", left: COLS.name + 1, top: cy - 10, ...txt(14, 500, C.ink) }}>{r.name}</span>
            <span style={{ position: "absolute", left: COLS.client + 1, top: cy - 10, ...txt(14, 500, C.ink) }}>{r.client}</span>
            <span style={{ position: "absolute", left: COLS.amount + 1, top: cy - 10, ...txt(14, 500, C.ink) }}>{r.amount}</span>
            <span style={{ position: "absolute", left: COLS.status, top: cy - 10, padding: "1px 6px", borderRadius: 5, background: r.done ? C.grey200 : C.grey100, ...txt(12, 600, r.done ? C.grey800 : C.grey600) }}>
              {r.done ? "체결완료" : "미체결"}
            </span>
          </div>
        );
      })}
      {children}
    </div>
  );
}

function Check({ x, y }: { x: number; y: number }) {
  return <div style={{ position: "absolute", left: x - 7, top: y - 8, width: 16, height: 16, border: `1.5px solid ${C.grey300}`, borderRadius: 4, background: C.surface }} />;
}

/** 1440x900 UI를 1536x960 레이어로 화면 가운데에 둔다(Notion식 여백 프레이밍). */
export function UILayer({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        left: UI.x,
        top: UI.y,
        width: UI.w,
        height: UI.h,
        transform: `scale(${UI.s})`,
        transformOrigin: "0 0",
        borderRadius: 14,
        overflow: "hidden",
        outline: `1px solid ${C.grey200}`,
        background: C.surface,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** 고객사 화면 일부를 잘라 보여 주는 장면 이미지(이슈 썸네일, 질문 카드 장면). */
export function HostCrop({ w, h, cx, cy, zoom, box, boxDraw = 1, dim = 0 }: { w: number; h: number; cx: number; cy: number; zoom: number; box?: { x: number; y: number; w: number; h: number }; boxDraw?: number; dim?: number }) {
  const left = w / 2 - cx * zoom;
  const top = h / 2 - cy * zoom;
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: C.grey100 }}>
      <div style={{ position: "absolute", left, top, width: UI.w, height: UI.h, transform: `scale(${zoom})`, transformOrigin: "0 0" }}>
        <HostPage />
        {dim > 0 ? <AbsoluteFill style={{ background: `rgba(25,31,40,${dim})` }} /> : null}
        {box ? (
          <svg style={{ position: "absolute", left: box.x, top: box.y, overflow: "visible" }} width={box.w} height={box.h}>
            <rect x={0} y={0} width={box.w} height={box.h} rx={4} fill={dim > 0 ? "rgba(255,255,255,0.0)" : "none"} stroke={C.accent} strokeWidth={2.5 / Math.min(zoom, 2)} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - boxDraw} />
          </svg>
        ) : null}
      </div>
    </div>
  );
}
