// 고객 위젯(런처, 패널, 메시지, 질문 카드)을 1440x900 UI 좌표로 다시 그린 레이어.
// 기준: src/components/widget/*, .screens/flow/02-widget-empty.png, 08-widget-question.png
import type { CSSProperties, ReactNode } from "react";
import { C, FONT, mix } from "../theme";
import { HostCrop } from "./Host";
import { ChatIcon, CheckIcon, CloseIcon, ScreenIcon, ScreenMicIcon, SendIcon } from "./Icons";

export const PANEL = { x: 1037, y: 165, w: 378, h: 638 };
export const LAUNCHER = { x: 1388, y: 848, r: 28 };

export const t = (size: number, weight: number, color: string, extra?: CSSProperties): CSSProperties => ({
  fontFamily: FONT,
  fontSize: size,
  fontWeight: weight,
  color,
  lineHeight: 1.45,
  margin: 0,
  ...extra,
});

/** 런처(accent 원). open 0→1이면 말풍선 → × 로 90° 돌며 바뀐다. */
export function Launcher({ x = LAUNCHER.x, y = LAUNCHER.y, size = 56, open = 0, scale = 1, badge, badgeScale = 1 }: { x?: number; y?: number; size?: number; open?: number; scale?: number; badge?: string; badgeScale?: number }) {
  const icon = size * 0.46;
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, transform: `scale(${scale})` }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <div style={{ transform: `rotate(${open * 90}deg)` }}>{open < 0.5 ? <ChatIcon size={icon} stroke={2} /> : <CloseIcon size={icon} stroke={2} />}</div>
      </div>
      {badge ? (
        <div style={{ position: "absolute", right: -size * 0.08, top: -size * 0.08, minWidth: size * 0.42, height: size * 0.42, padding: "0 5px", borderRadius: 999, background: C.surface, border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${badgeScale})`, ...t(size * 0.24, 700, C.accent, { lineHeight: 1 }) }}>
          {badge}
        </div>
      ) : null}
    </div>
  );
}

/** 위젯 패널 틀. 오른쪽 아래 기준으로 scale/y/opacity가 바뀐다. */
/** compact: 인사 머리글을 한 줄로 줄여 메시지 영역을 넓힌다(질문 카드 장면이 가려지지 않게). */
export const PANEL_CONTENT_TOP = { normal: 84, compact: 52 };
export function Panel({ children, scale = 1, dy = 0, opacity = 1, scrollY = 0, footer = true, compact = false }: { children: ReactNode; scale?: number; dy?: number; opacity?: number; scrollY?: number; footer?: boolean; compact?: boolean }) {
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: PANEL.x,
        top: PANEL.y,
        width: PANEL.w,
        height: PANEL.h,
        borderRadius: 20,
        border: `1px solid ${C.grey200}`,
        background: C.surface,
        overflow: "hidden",
        transformOrigin: "100% 100%",
        transform: `translateY(${dy}px) scale(${scale})`,
        opacity,
      }}
    >
      {compact ? (
        <div style={{ position: "absolute", left: 20, top: 16, right: 56, display: "flex", alignItems: "baseline", gap: 8 }}>
          <p style={t(16, 700, C.ink, { letterSpacing: -0.3 })}>래티스 주식회사</p>
          <p style={t(13, 500, C.grey600)}>김데모님</p>
        </div>
      ) : (
        <div style={{ position: "absolute", left: 20, top: 22, right: 20 }}>
          <p style={t(12, 500, C.grey600)}>래티스 주식회사</p>
          <p style={t(19, 700, C.ink, { letterSpacing: -0.3, marginTop: 2 })}>김데모님, 무엇이든 알려주세요</p>
        </div>
      )}
      <div style={{ position: "absolute", right: 22, top: compact ? 15 : 26, color: C.grey600 }}>
        <CloseIcon size={22} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: compact ? PANEL_CONTENT_TOP.compact : PANEL_CONTENT_TOP.normal, bottom: footer ? 74 : 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 20, right: 20, top: 8 - scrollY }}>{children}</div>
      </div>
      {footer ? <Composer /> : null}
    </div>
  );
}

function Composer() {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 74, borderTop: `1px solid ${C.grey200}`, background: C.surface }}>
      <div style={{ position: "absolute", left: 26, top: 25, color: C.grey700 }}>
        <ScreenIcon size={22} />
      </div>
      <div style={{ position: "absolute", left: 68, right: 16, top: 12, height: 44, borderRadius: 22, background: C.grey100, display: "flex", alignItems: "center", padding: "0 6px 0 14px" }}>
        <span style={t(14, 400, C.grey500, { flex: 1 })}>메시지를 입력해 주세요</span>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.grey300, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          <SendIcon size={18} stroke={2.2} />
        </div>
      </div>
    </div>
  );
}

export const STEPS = ["녹화를 누르고 ‘이 탭’을 골라요", "문제가 있는 곳을 가리키며 말해요", "끝내기를 누르면 저희가 정리해서 확인해요"];

/** 빈 상태: 소개 + 단계 3줄 + "화면 녹화로 설명하기" 버튼 */
export function EmptyState({ stepIn = [1, 1, 1], stepColor, ctaRing = 0, ctaScale = 1 }: { stepIn?: number[]; stepColor?: string[]; ctaRing?: number; ctaScale?: number }) {
  return (
    <div style={{ position: "relative", height: 540 }}>
      <p style={t(16, 700, C.ink, { marginTop: 14 })}>화면을 보여주며 말로 알려주세요</p>
      <p style={t(14, 400, C.grey600, { marginTop: 4 })}>어느 화면의 어떤 버튼인지 따로 적지 않아도 돼요</p>
      <div style={{ marginTop: 22 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", gap: 18, alignItems: "center", height: 35, opacity: stepIn[i], transform: `translateY(${(1 - stepIn[i]) * 12}px)` }}>
            <span style={t(14, 500, C.grey400, { width: 10 })}>{i + 1}</span>
            <span style={t(15, 500, stepColor?.[i] ?? C.grey700)}>{s}</span>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 382 }}>
        <div style={{ position: "relative", transform: `scale(${ctaScale})` }}>
          <div style={{ height: 48, borderRadius: 12, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#fff" }}>
            <ScreenMicIcon size={20} />
            <span style={t(16, 600, "#fff")}>화면 녹화로 설명하기</span>
          </div>
          {ctaRing > 0 ? <div style={{ position: "absolute", inset: -5, borderRadius: 16, border: `2px solid ${C.accent}`, opacity: ctaRing }} /> : null}
        </div>
        <p style={t(12, 400, C.grey600, { textAlign: "center", marginTop: 10 })}>최대 3분이에요. 글로 남기려면 아래에 적어 주세요</p>
      </div>
    </div>
  );
}

/** 내 녹화 메시지 카드 (오른쪽 정렬) */
export function RecordingCard({ length = "1:07", sub, dotsFrame }: { length?: string; sub: string; dotsFrame?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 18px 14px 14px", borderRadius: 18, background: C.grey100, width: 270 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", color: C.grey700 }}>
          <ScreenIcon size={20} />
        </div>
        <div>
          <p style={t(15, 700, C.ink)}>화면 녹화 · {length}</p>
          <p style={t(13, 500, C.grey600, { display: "flex", alignItems: "center", gap: 6 })}>
            {sub}
            {dotsFrame !== undefined ? <Dots f={dotsFrame} /> : null}
          </p>
        </div>
      </div>
    </div>
  );
}

/** 점 3개가 15f 주기로 차례로 진해진다 */
export function Dots({ f, size = 5 }: { f: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[0, 1, 2].map((i) => {
        const phase = ((f - i * 5) % 15 + 15) % 15;
        const o = phase < 5 ? 1 : 0.3;
        return <span key={i} style={{ width: size, height: size, borderRadius: "50%", background: C.accent, opacity: o }} />;
      })}
    </span>
  );
}

export function MyBubble({ text, style }: { text: string; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", ...style }}>
      <div style={{ maxWidth: 280, padding: "11px 14px", borderRadius: 18, background: C.accent, ...t(15, 500, "#fff") }}>{text}</div>
    </div>
  );
}

/** 시스템 메시지(반영 완료 알림). 가운데 회색 글자. line 0~1이면 왼쪽 accent 세로선이 그려진다. */
export function SystemMessage({ title, line = 0, style }: { title: string; line?: number; style?: CSSProperties }) {
  return (
    <div style={{ position: "relative", padding: "10px 12px 10px 16px", borderRadius: 12, background: C.grey50, ...style }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 3, height: `${line * 100}%`, background: C.accent, borderRadius: 2 }} />
      <p style={t(13.5, 500, C.grey700, { lineHeight: 1.5 })}>
        ‘{title}’ 수정을 반영했어요. 같은 화면에서 한 번 더 확인해 주세요.
      </p>
    </div>
  );
}

export const QUESTION = "‘전체 계약서’ 제목 글씨의 어떤 점이 불편하셨어요?";
export const QUOTE = "맨 위에 있는 전체 계약서라는 제목이요. 이 글씨가 다른 곳이랑 좀 달라 보여요.";
export const OPTIONS = ["글씨가 너무 굵어요", "글자 사이 간격이 너무 좁아요", "글자 크기가 다른 곳과 달라요", "글자 모양(폰트)이 다른 곳과 달라요"];
// 질문 장면의 제목 상자 (UI 좌표)
export const SCENE_BOX = { x: 256, y: 10, w: 108, h: 34 };

/** 위젯 질문 카드. sceneH: 장면 높이(0~190), selected: 고른 보기, dimOthers 0~1 */
/** 질문 카드 안 세로 위치(카드 위 기준, UI px). 커서 좌표 계산에 쓴다. 질문은 한 줄, 인용은 두 줄. */
export const QCARD_LAYOUT = (optH: number) => {
  const optTop = 190 + 14 + 38 + 8 + 22 + 8;
  return { optTop, opt1: optTop + optH / 2, send: optTop + 5 * optH + 10 + 23, height: optTop + 5 * optH + 10 + 46 + 16 };
};
export function QuestionCard({ sceneH = 190, boxDraw = 1, kenBurns = 1, selected = -1, selectT = 0, sendScale = 1, width = 338, optH = 42 }: { sceneH?: number; boxDraw?: number; kenBurns?: number; selected?: number; selectT?: number; sendScale?: number; width?: number; optH?: number }) {
  return (
    <div style={{ width, borderRadius: 20, border: `1px solid ${C.grey200}`, background: C.surface, overflow: "hidden" }}>
      <div style={{ height: sceneH, overflow: "hidden", position: "relative" }}>
        <div style={{ transform: `scale(${kenBurns})`, transformOrigin: "30% 20%" }}>
          <HostCrop w={width} h={190} cx={330} cy={154} zoom={0.62} box={SCENE_BOX} boxDraw={boxDraw} />
        </div>
        <div style={{ position: "absolute", right: 8, bottom: 8, padding: "3px 8px", borderRadius: 6, background: "rgba(25,31,40,0.72)", ...t(11.5, 600, "#fff") }}>전체 보기</div>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <p style={t(13, 400, C.grey600)}>“{QUOTE}”</p>
        <p style={t(15, 700, C.ink, { marginTop: 8, letterSpacing: -0.2 })}>{QUESTION}</p>
        <div style={{ marginTop: 8 }}>
          {OPTIONS.map((o, i) => {
            const isSel = i === selected;
            const k = isSel ? selectT : 0;
            const other = selected >= 0 && !isSel ? selectT : 0;
            return (
              <div key={o} style={{ display: "flex", alignItems: "center", gap: 12, height: optH, margin: "0 -8px", padding: "0 8px", borderRadius: 10, background: isSel ? mix("#FFFFFF", C.blue50, k) : "transparent" }}>
                <Radio t={k} />
                <span style={t(14.5, 500, mix(C.ink, C.grey400, other))}>{o}</span>
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 12, height: optH }}>
            <Radio t={0} />
            <span style={t(14.5, 500, selected >= 0 ? mix(C.ink, C.grey400, selectT) : C.ink)}>직접 입력할게요</span>
          </div>
        </div>
        <div style={{ marginTop: 10, height: 46, borderRadius: 12, background: selected >= 0 ? C.accent : C.grey200, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${sendScale})`, ...t(15, 600, selected >= 0 ? "#fff" : C.grey500) }}>답변 보내기</div>
      </div>
    </div>
  );
}

export function Radio({ t: k }: { t: number }) {
  return (
    <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${mix(C.grey300, C.accent, Math.min(1, k))}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.accent, transform: `scale(${k})` }} />
    </div>
  );
}

/** "답변을 보냈어요" 접힌 카드 */
export function AnsweredCard() {
  return (
    <div style={{ padding: "12px 14px", borderRadius: 16, border: `1px solid ${C.grey200}`, background: C.surface, width: 290 }}>
      <p style={t(13.5, 600, C.ink, { display: "flex", alignItems: "center", gap: 6 })}>
        <CheckIcon size={15} color={C.accent} stroke={2.2} />
        답변을 보냈어요
      </p>
      <p style={t(12.5, 400, C.grey600, { marginTop: 2 })}>{QUESTION}</p>
    </div>
  );
}

/** 녹화 알약(화면 공간). 실제 RecordingPill과 같은 grey-900 바탕. 점은 강조색 하나 규칙에 맞춰 accent. */
export function RecordingPill({ timer, dot = 1, wave, stopPress = 1, stopRing = 0 }: { timer: string; dot?: number; wave?: number[]; stopPress?: number; stopRing?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, height: 64, padding: "0 10px 0 26px", borderRadius: 32, background: C.ink }}>
      <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.accent, opacity: dot }} />
      <span style={t(22, 700, "#fff", { fontVariantNumeric: "tabular-nums", lineHeight: 1 })}>
        {timer}
        <span style={{ fontWeight: 400, color: C.grey400 }}> / 3:00</span>
      </span>
      {wave ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, height: 48, marginLeft: 6 }}>
          {wave.map((h, i) => (
            <div key={i} style={{ width: 4, height: h, borderRadius: 2, background: C.accent }} />
          ))}
        </div>
      ) : null}
      <div style={{ position: "relative", marginLeft: 8, transform: `scale(${stopPress})` }}>
        <div style={{ height: 46, padding: "0 22px", borderRadius: 23, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", ...t(18, 600, "#fff", { lineHeight: 1 }) }}>끝내기</div>
        {stopRing > 0 ? <div style={{ position: "absolute", inset: -5, borderRadius: 28, border: `2px solid ${C.accent}`, opacity: stopRing }} /> : null}
      </div>
    </div>
  );
}
