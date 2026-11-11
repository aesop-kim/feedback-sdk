// 관리자 화면(래티스 피드백)을 1440x900 UI 좌표로 다시 그린 레이어.
// 기준: src/components/admin/*, .screens/flow/05-admin-analysis.png, .screens/qa-v2/ux/admin-1440-*.png
import type { ReactNode } from "react";
import { C, mix } from "../theme";
import { HOST, HostCrop } from "./Host";

// 이슈마다 가리킨 요소 (UI 좌표). 썸네일은 이 상자를 가운데에 같은 여백으로 맞춘다.
export const ISSUE_BOX = [
  { x: HOST.register.x, y: HOST.register.y, w: HOST.register.w, h: HOST.register.h },
  { x: 1160, y: 68, w: 60, h: 24 },
  { x: HOST.title.x - 4, y: HOST.title.y - 1, w: HOST.title.w + 8, h: HOST.title.h + 2 },
];
import { CheckIcon, ChevronDown, LatticeMark, PlusIcon, CloseIcon, VideoIcon } from "./Icons";
import { OPTIONS, QUESTION, QUOTE, Radio, SCENE_BOX, t } from "./Widget";

export const ISSUES = [
  {
    title: "계약서 등록 버튼 무반응",
    summary: "우측 상단 파란 ‘계약서 등록’ 버튼을 두 번 눌러도 아무 반응이 없고 …",
  },
  {
    title: "표 머리글 ‘계약 금액’ 오타",
    summary: "표 머리글의 ‘계약 금액’ 열 제목이 ‘계약 긍액’으로 잘못 표기되어 있…",
  },
  {
    title: "상단 제목 글씨 어색함",
    summary: "화면 맨 위 ‘전체 계약서’ 제목의 글씨가 다른 곳과 달라 보인다고 했어요",
  },
];
export const DETAIL_SUMMARY = "화면 맨 위 ‘전체 계약서’ 제목의 글씨가 다른 곳과 달라 보여 어색하다고 했으나, 정확히 무엇이 문제인지는 고객도 모른다.";

/** "확인 필요" 배지. 영상에서는 강조색 하나 규칙에 맞춰 blue-50 / accent (스토리보드 0장). */
export function NeedBadge({ size = 12.5, scale = 1, opacity = 1 }: { size?: number; scale?: number; opacity?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: `${size * 0.25}px ${size * 0.6}px`, borderRadius: size * 0.5, background: C.blue50, transform: `scale(${scale})`, opacity, ...t(size, 600, C.accent, { lineHeight: 1.2, whiteSpace: "nowrap" }) }}>확인 필요</span>
  );
}

export function DoneChip({ size = 13, draw = 1, scale = 1 }: { size?: number; draw?: number; scale?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.3, padding: `${size * 0.3}px ${size * 0.7}px`, borderRadius: size * 0.6, background: C.blue50, transform: `scale(${scale})`, ...t(size, 600, C.accent, { lineHeight: 1.2, whiteSpace: "nowrap" }) }}>
      <CheckIcon size={size * 1.15} color={C.accent} stroke={2.4} draw={draw} />
      반영 완료
    </span>
  );
}

type ListItem = { name: string; time: string; preview: string; meta?: string; badge?: number; badgeScale?: number; active?: boolean };

export type AdminProps = {
  list?: ListItem[];
  thread?: ReactNode;
  right?: ReactNode;
};

export const DEFAULT_LIST: ListItem[] = [
  { name: "김데모", time: "방금", preview: "화면 녹화를 보냈어요", meta: "녹화 1개 · 남은 문제 3건", active: true },
  { name: "박지훈", time: "2분 전", preview: "화면 녹화를 보냈어요", meta: "녹화 1개" },
  { name: "이수진", time: "어제", preview: "감사합니다. 확인했어요" },
  { name: "최유나", time: "어제", preview: "화면 녹화를 보냈어요", meta: "녹화 1개" },
];

export function AdminShell({ list = DEFAULT_LIST, thread, right }: AdminProps) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.surface, overflow: "hidden" }}>
      {/* 헤더 */}
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 56, borderBottom: `1px solid ${C.grey200}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 8 }}>
        <LatticeMark size={20} />
        <span style={t(15.5, 700, C.ink)}>래티스 피드백</span>
        <span style={{ flex: 1 }} />
        <span style={t(13, 500, C.grey600)}>래티스 주식회사</span>
        <span style={{ width: 1, height: 12, background: C.grey300, margin: "0 12px" }} />
        <span style={t(13, 500, C.grey600)}>로그아웃</span>
      </div>
      {/* 목록 */}
      <div style={{ position: "absolute", left: 0, top: 56, width: 320, bottom: 0, borderRight: `1px solid ${C.grey200}` }}>
        <p style={t(16, 700, C.ink, { position: "absolute", left: 20, top: 14 })}>
          받은 의견 <span style={{ color: C.grey500, fontWeight: 600 }}>{list.length}</span>
        </p>
        <div style={{ position: "absolute", left: 8, right: 8, top: 52 }}>
          {list.map((it) => (
            <div key={it.name + it.time} style={{ position: "relative", padding: "12px 12px", borderRadius: 12, background: it.active ? C.grey100 : "transparent", marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={t(15, 700, C.ink)}>{it.name}</span>
                <span style={t(12.5, 500, C.grey500)}>{it.time}</span>
              </div>
              <p style={t(13.5, 500, C.grey700, { marginTop: 2 })}>{it.preview}</p>
              {it.meta ? <p style={t(12, 500, C.grey500, { marginTop: 2 })}>{it.meta}</p> : null}
              {it.badge ? (
                <div style={{ position: "absolute", right: 12, top: 40, width: 20, height: 20, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${it.badgeScale ?? 1})`, ...t(12, 700, "#fff", { lineHeight: 1 }) }}>{it.badge}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {/* 대화 */}
      <div style={{ position: "absolute", left: 320, top: 56, width: 680, bottom: 0, background: C.surface }}>
        <div style={{ position: "absolute", left: 24, right: 24, top: 0, height: 84, borderBottom: `1px solid ${C.grey200}` }}>
          <p style={t(18, 700, C.ink, { position: "absolute", top: 20 })}>김데모</p>
          <p style={t(13.5, 400, C.grey600, { position: "absolute", top: 47 })}>demo.user@example.com · u_1024</p>
          <p style={t(13, 400, C.grey500, { position: "absolute", right: 0, top: 47 })}>마지막 활동 방금</p>
        </div>
        <div style={{ position: "absolute", left: 24, right: 24, top: 108 }}>
          <p style={t(12.5, 500, C.grey500, { textAlign: "center", marginBottom: 14 })}>11월 11일</p>
          {thread ?? <RecordingChip />}
        </div>
        <div style={{ position: "absolute", left: 24, right: 24, bottom: 40, height: 48, borderRadius: 12, background: C.grey100, display: "flex", alignItems: "center", padding: "0 16px" }}>
          <span style={t(14.5, 400, C.grey500, { flex: 1 })}>김데모 님에게 답장하기</span>
          <span style={{ padding: "6px 12px", borderRadius: 8, background: C.blue50, ...t(13, 600, C.accent) }}>보내기</span>
        </div>
      </div>
      {/* 오른쪽 패널 */}
      <div style={{ position: "absolute", left: 1000, top: 56, right: 0, bottom: 0, borderLeft: `1px solid ${C.grey200}`, overflow: "hidden" }}>{right}</div>
    </div>
  );
}

export function RecordingChip() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px 10px 10px", borderRadius: 14, border: `1px solid ${C.accent}`, background: C.blue50 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", color: C.accent }}>
          <VideoIcon size={17} />
        </div>
        <span style={t(15, 700, C.ink)}>화면 녹화 1:07 · 문제 3건</span>
      </div>
      <span style={t(12, 400, C.grey500)}>오후 11:42</span>
    </div>
  );
}

export function CustomerBubble({ text, time, style }: { text: string; time: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, ...style }}>
      <div style={{ padding: "11px 14px", borderRadius: 18, background: C.grey100, ...t(15, 500, C.ink) }}>{text}</div>
      <span style={t(12, 400, C.grey500)}>{time}</span>
    </div>
  );
}

/** 오른쪽 패널 위쪽: 녹화 분석 (영상 썸네일 + 출처) */
export function AnalysisHead() {
  return (
    <div style={{ padding: "16px 20px 0", height: 368, borderBottom: `1px solid ${C.grey200}` }}>
      <p style={t(16, 700, C.ink)}>녹화 분석</p>
      <div style={{ position: "relative", marginTop: 12, borderRadius: 14, overflow: "hidden", width: 400, height: 225 }}>
        <HostCrop w={400} h={225} cx={720} cy={450} zoom={0.278} />
        <div style={{ position: "absolute", left: 176, top: 88, width: 48, height: 48, borderRadius: "50%", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 0, height: 0, borderLeft: "14px solid " + C.ink, borderTop: "9px solid transparent", borderBottom: "9px solid transparent", marginLeft: 4 }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <span style={t(14, 600, C.ink)}>전체 계약서 · 래티스 주식회사</span>
        <span style={t(13.5, 500, C.grey600)}>1:07</span>
      </div>
      <p style={t(13, 400, C.grey500)}>contracts.lattice-demo.kr</p>
    </div>
  );
}

/** 오른쪽 패널의 이슈 줄 (관리자 실제 레이아웃) */
export function IssueRow({ n, title, summary, right, open, children }: { n: number; title: string; summary?: string; right?: ReactNode; open?: boolean; children?: ReactNode }) {
  return (
    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.grey200}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={t(15, 600, C.grey400, { width: 10 })}>{n}</span>
        <span style={t(15.5, 700, C.ink, { flex: 1, whiteSpace: "nowrap" })}>{title}</span>
        {right}
        <div style={{ color: C.grey500, transform: open ? "rotate(180deg)" : undefined }}>
          <ChevronDown size={18} />
        </div>
      </div>
      {summary ? <p style={t(13.5, 400, C.grey700, { marginLeft: 24, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })}>{summary}</p> : null}
      {children ? <div style={{ marginLeft: 24, marginTop: 12 }}>{children}</div> : null}
    </div>
  );
}

/** 관리자 "고객에게 물어볼 질문" 초안 카드. typed: 질문 입력창에 보이는 글자 수, optIn: 보기별 등장(0~1) */
export function DraftCard({ typed = QUESTION.length, optIn = [1, 1, 1, 1], btnScale = 1, sent = false, caret = false }: { typed?: number; optIn?: number[]; btnScale?: number; sent?: boolean; caret?: boolean }) {
  return (
    <div style={{ width: 380, padding: "18px 16px 16px", borderRadius: 20, border: `1px solid ${C.grey200}`, background: C.surface }}>
      <p style={t(16, 700, C.ink)}>고객에게 물어볼 질문</p>
      <p style={t(12.5, 400, C.grey600, { marginTop: 2 })}>자동으로 만든 초안이에요. 고쳐서 보내도 돼요.</p>
      <div style={{ marginTop: 12, minHeight: 62, padding: "12px 12px", borderRadius: 12, border: `1px solid ${caret ? C.accent : C.grey200}`, ...t(15, 700, C.ink, { lineHeight: 1.45, letterSpacing: -0.2 }) }}>
        {QUESTION.slice(0, typed)}
        {caret ? <span style={{ display: "inline-block", width: 2, height: 18, background: C.accent, marginLeft: 1, verticalAlign: -3 }} /> : null}
      </div>
      <div style={{ marginTop: 10 }}>
        {OPTIONS.map((o, i) => (
          // 줄 높이도 0→48로 같이 자라서 질문 입력창과 "보기 추가하기" 사이에 빈 칸이 생기지 않는다
          <div key={o} style={{ height: 48 * optIn[i], overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, opacity: optIn[i] > 0 ? 1 : 0, transform: `translateY(${(1 - optIn[i]) * 20}px)` }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, height: 40, padding: "0 12px", borderRadius: 10, border: `1px solid ${C.grey200}` }}>
              <Radio t={0} />
              <span style={t(14, 500, mix(C.grey400, C.ink, optIn[i]))}>{o}</span>
            </div>
            <div style={{ color: C.grey400 }}>
              <CloseIcon size={14} />
            </div>
          </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.grey600, marginTop: 4 }}>
        <PlusIcon size={14} />
        <span style={t(13.5, 500, C.grey600)}>보기 추가하기</span>
      </div>
      <div style={{ height: 1, background: C.grey200, margin: "14px 0" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={t(12.5, 400, C.grey600)}>고객 화면에 이 장면과 함께 보여요</span>
        <span style={{ padding: "8px 12px", borderRadius: 10, background: sent ? C.blue50 : C.accent, transform: `scale(${btnScale})`, ...t(13.5, 600, sent ? C.accent : "#fff", { whiteSpace: "nowrap" }) }}>{sent ? "보냈어요" : "고객에게 물어보기"}</span>
      </div>
    </div>
  );
}

/** 장면 이미지 (관리자 상세 / S16) */
export function SceneImage({ w, h, boxDraw = 1, zoom = 0.9 }: { w: number; h: number; boxDraw?: number; zoom?: number }) {
  return <HostCrop w={w} h={h} cx={420} cy={110} zoom={zoom} box={SCENE_BOX} boxDraw={boxDraw} />;
}

export { QUOTE };
